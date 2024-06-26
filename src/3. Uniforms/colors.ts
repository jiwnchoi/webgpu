import redTriangle from "./colors.wgsl?raw";

async function main() {
	const adapter = await navigator.gpu?.requestAdapter();
	const device = (await adapter?.requestDevice()) as GPUDevice;

	if (!device) {
		alert("need a browser that supports WebGPU");
		return;
	}

	const canvas = document.querySelector("canvas") as HTMLCanvasElement;
	const context = canvas.getContext("webgpu") as GPUCanvasContext;

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
	context.configure({
		device,
		format: presentationFormat,
	});

	const module = device.createShaderModule({
		label: "Red Triangle",
		code: redTriangle,
	});

	const pipeline = device.createRenderPipeline({
		label: "pipeline",
		layout: "auto",
		vertex: {
			module,
			entryPoint: "vs",
		},
		fragment: {
			module,
			entryPoint: "fs",
			targets: [
				{
					format: presentationFormat,
				},
			],
		},
	});

	const renderPassDescriptor: GPURenderPassDescriptor = {
		label: "render-pass",
		colorAttachments: [
			{
				view: context.getCurrentTexture().createView(),
				clearValue: [0.3, 0.3, 0.3, 1],
				loadOp: "clear",
				storeOp: "store",
			},
		],
	};

	const uniformBufferSize =
		4 * 4 + // 4byte RGBA
		2 * 4 + // 4byte 2 Scale
		2 * 4; // 4byte 2 Offset

	const uniformBuffer = device.createBuffer({
		size: uniformBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const uniformValues = new Float32Array(uniformBufferSize / 4);

	const kColorOffsaet = 0;
	const kScaleOffset = 4;
	const kOffsetOffset = 6;

	uniformValues.set([0, 1, 0, 1], kColorOffsaet);
	uniformValues.set([-0.5, -0.25], kOffsetOffset);

	const bindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: uniformBuffer,
				},
			},
		],
	});

	const canvasToSizeMap = new WeakMap();

	function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
		let { width, height } = canvasToSizeMap.get(canvas) || canvas;

		width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
		height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));

		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			return true;
		}
		return false;
	}

	function render() {
		resizeCanvasToDisplaySize(canvas);

		const aspect = canvas.width / canvas.height;
		uniformValues.set([0.5 / aspect, 0.5], kScaleOffset);
		device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

		// @ts-ignore
		renderPassDescriptor.colorAttachments[0].view = context
			.getCurrentTexture()
			.createView();

		const encoder = device.createCommandEncoder({ label: "render-pass" });
		const pass = encoder.beginRenderPass(renderPassDescriptor);
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.draw(3);
		pass.end();

		const commandBuffer = encoder.finish();
		device.queue.submit([commandBuffer]);
	}

	// render();

	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			canvasToSizeMap.set(entry.target, {
				width: entry.contentBoxSize[0].inlineSize,
				height: entry.contentBoxSize[0].blockSize,
			});
		}
		render();
	});
	observer.observe(canvas);
}

export default main;
