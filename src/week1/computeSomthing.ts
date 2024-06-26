import shader from "./computeSomthing.wgsl?raw";

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
		label: "Compute",
		code: shader,
	});

	const pipeline = device.createComputePipeline({
		label: "pipeline",
		layout: "auto",
		compute: {
			module,
			entryPoint: "computeSomthing",
		},
	});

	const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

	const dataBuffer = device.createBuffer({
		label: "Data Buffer",
		size: data.byteLength,
		usage:
			GPUBufferUsage.STORAGE |
			GPUBufferUsage.COPY_SRC |
			GPUBufferUsage.COPY_DST,
	});

	device.queue.writeBuffer(dataBuffer, 0, data);

	const resultBuffer = device.createBuffer({
		label: "Result Buffer",
		size: data.byteLength,
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
	});

	const bindGroup = device.createBindGroup({
		label: "Bind Group",
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: dataBuffer,
				},
			},
		],
	});

	const encoder = device.createCommandEncoder({ label: "Encoder" });

	const pass = encoder.beginComputePass({
		label: "Compute Pass",
	});

	pass.setPipeline(pipeline);
	pass.setBindGroup(0, bindGroup);
	pass.dispatchWorkgroups(data.length);
	pass.end();

	encoder.copyBufferToBuffer(dataBuffer, 0, resultBuffer, 0, resultBuffer.size);

	const commandBuffer = encoder.finish();
	device.queue.submit([commandBuffer]);

	await resultBuffer.mapAsync(GPUMapMode.READ);
	const result = new Float32Array(resultBuffer.getMappedRange());

	alert(`Input: ${data}\nOutput: ${result}`);

	resultBuffer.unmap();
}

export default main;
