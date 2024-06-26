import redTriangle from "./cheker.wgsl?raw";

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

	// Shader Module

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
