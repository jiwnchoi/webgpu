import redTriangle from "./index.wgsl?raw";

const rand = (min = 0, max = min || 1) => min + Math.random() * (max - min);

// interface ObjectInfo {
// 	bindGroup: GPUBindGroup;
// 	uniformBuffer: GPUBuffer;
// 	uniformValues: Float32Array;
// }

interface ObjectInfo {
	scale: number;
}

function createCircleVertices({
	numSubdivisions = 24,
	radius = 1,
	innerRadius = 0,
	startAngle = 0,
	endAngle = Math.PI * 2,
} = {}) {
	const numVertices = numSubdivisions * 3 * 2;
	const vertexData = new Float32Array(numSubdivisions * 2 * 3 * 2);

	let vertexOffset = 0;
	function addVertex(x: number, y: number) {
		vertexData[vertexOffset++] = x;
		vertexData[vertexOffset++] = y;
	}

	for (let i = 0; i < numSubdivisions; ++i) {
		const angle1 = startAngle + ((i + 0) * (endAngle - startAngle)) / numSubdivisions;
		const angle2 = startAngle + ((i + 1) * (endAngle - startAngle)) / numSubdivisions;

		const c1 = Math.cos(angle1);
		const s1 = Math.sin(angle1);
		const c2 = Math.cos(angle2);
		const s2 = Math.sin(angle2);

		// first triangle
		addVertex(c1 * radius, s1 * radius);
		addVertex(c2 * radius, s2 * radius);
		addVertex(c1 * innerRadius, s1 * innerRadius);

		// second triangle
		addVertex(c1 * innerRadius, s1 * innerRadius);
		addVertex(c2 * radius, s2 * radius);
		addVertex(c2 * innerRadius, s2 * innerRadius);
	}

	return {
		vertexData,
		numVertices,
	};
}

async function main() {
	const adapter = await navigator.gpu?.requestAdapter();
	const device = (await adapter?.requestDevice()) as GPUDevice;

	if (!device) {
		alert("need a browser that supports WebGPU");
		return;
	}

	const canvas = document.querySelector("canvas") as HTMLCanvasElement;
	const context = canvas.getContext("webgpu") as GPUCanvasContext;

	const pf = navigator.gpu.getPreferredCanvasFormat();
	context.configure({
		device,
		format: pf,
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
		},
		fragment: {
			module,
			targets: [{ format: pf }],
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

	const kNumObjects = 10;
	const objectInfos: ObjectInfo[] = [];

	const staticUnitSize = 4 * 4 + 2 * 4 + 2 * 4;
	const changingUnitSize = 2 * 4;
	const staticStorageBufferSize = kNumObjects * staticUnitSize;
	const changingStorageBufferSize = kNumObjects * changingUnitSize;

	const staticStorageBuffer = device.createBuffer({
		label: "static-storage-buffer",
		size: staticStorageBufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});

	const changingStorageBuffer = device.createBuffer({
		label: "changing-storage-buffer",
		size: changingStorageBufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});

	const kColorOffset = 0;
	const kOffsetOffset = 4;
	const kScaleOffset = 0;
	{
		const staticStorageValues = new Float32Array(staticStorageBufferSize / 4);
		for (let i = 0; i < kNumObjects; ++i) {
			const staticOffset = (i * staticUnitSize) / 4;
			staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset);
			staticStorageValues.set([rand(-1, 1), rand(-0.9, 0.9)], staticOffset + kOffsetOffset);

			objectInfos.push({
				scale: rand(0.1, 0.5),
			});
		}
		device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);
	}

	const storageValues = new Float32Array(changingStorageBufferSize / 4);

	const { vertexData, numVertices } = createCircleVertices({
		radius: 0.5,
		innerRadius: 0.25,
	});

	const vertexStroageBuffer = device.createBuffer({
		label: "vertex-storage-buffer",
		size: vertexData.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});

	device.queue.writeBuffer(vertexStroageBuffer, 0, vertexData);

	const bindGroup = device.createBindGroup({
		label: "bind-group",
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: staticStorageBuffer,
				},
			},
			{
				binding: 1,
				resource: {
					buffer: changingStorageBuffer,
				},
			},
			{
				binding: 2,
				resource: {
					buffer: vertexStroageBuffer,
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

		// @ts-ignore
		renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();

		const encoder = device.createCommandEncoder({ label: "render-pass" });
		const pass = encoder.beginRenderPass(renderPassDescriptor);
		pass.setPipeline(pipeline);

		const aspect = canvas.width / canvas.height;

		objectInfos.forEach(({ scale }, i) => {
			const offset = (i * changingUnitSize) / 4;
			storageValues.set([scale / aspect, scale], offset + kScaleOffset);
		});
		device.queue.writeBuffer(changingStorageBuffer, 0, storageValues);

		pass.setBindGroup(0, bindGroup);
		pass.draw(numVertices, kNumObjects);
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
