import redTriangle from "./index.wgsl?raw";

const rand = (min = 0, max = min || 1) => min + Math.random() * (max - min);

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

	const staticUniformBufferSize =
		4 * 4 + // 4byte RGBA
		2 * 4 + // 4byte 2 Scale
		2 * 4; // 4byte 2 Offset

	const scaleUniformBufferSize = 2 * 4;

	const kColorOffset = 0;
	const kOffsetOffset = 4;
	const kScaleOffset = 0;

	const kNumObjects = 10;
	const objectInfos = [];

	for (let i = 0; i < kNumObjects; i++) {
		const staticUniformBuffer = device.createBuffer({
			label: `object-${i} static uniform buffer`,
			size: staticUniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		{
			const uniformValues = new Float32Array(staticUniformBufferSize / 4);
			uniformValues.set([rand(), rand(), rand(), 1], kColorOffset);
			uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], kOffsetOffset);
			device.queue.writeBuffer(staticUniformBuffer, 0, uniformValues);
		}

		const uniformValues = new Float32Array(scaleUniformBufferSize / 4);
		const uniformBuffer = device.createBuffer({
			size: scaleUniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const bindGroup = device.createBindGroup({
			label: `object-${i} bind group`,
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: staticUniformBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: uniformBuffer,
					},
				},
			],
		});

		objectInfos.push({
			scale: rand(0.2, 0.5),
			bindGroup,
			uniformBuffer,
			uniformValues,
		});
	}

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

		// @ts-ignore
		renderPassDescriptor.colorAttachments[0].view = context
			.getCurrentTexture()
			.createView();

		const encoder = device.createCommandEncoder({ label: "render-pass" });
		const pass = encoder.beginRenderPass(renderPassDescriptor);
		pass.setPipeline(pipeline);

		const aspect = canvas.width / canvas.height;

		for (const {
			scale,
			bindGroup,
			uniformBuffer,
			uniformValues,
		} of objectInfos) {
			uniformValues.set([scale / aspect, scale], kScaleOffset);
			device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
			pass.setBindGroup(0, bindGroup);
			pass.draw(3);
		}

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
