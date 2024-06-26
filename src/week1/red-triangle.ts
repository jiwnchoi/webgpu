import redTriangle from "./red-triangle.wgsl?raw";

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

	function render() {
		const encoder = device.createCommandEncoder({ label: "render-pass" });
		const pass = encoder.beginRenderPass(renderPassDescriptor);
		pass.setPipeline(pipeline);
		pass.draw(3);
		pass.end();

		const commandBuffer = encoder.finish();
		device.queue.submit([commandBuffer]);
	}

	render();
}

export default main;
