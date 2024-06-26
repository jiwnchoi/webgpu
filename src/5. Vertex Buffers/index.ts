import redTriangle from "./index.wgsl?raw";

const rand = (min = 0, max = min || 1) => min + Math.random() * (max - min);
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
	const numVertices = (numSubdivisions + 1) * 2;
	const vertexData = new Float32Array(numVertices * (2 + 1));
	const colorData = new Uint8Array(vertexData.buffer);

	let vertexOffset = 0;
	let colorOffset = 8;
	function addVertex(x: number, y: number, r: number, g: number, b: number) {
		vertexData[vertexOffset++] = x;
		vertexData[vertexOffset++] = y;
		vertexOffset++;
		colorData[colorOffset++] = r * 255;
		colorData[colorOffset++] = g * 255;
		colorData[colorOffset++] = b * 255;
		colorOffset += 9;
	}

	const innerColor: [number, number, number] = [1, 1, 1];
	const outerColor: [number, number, number] = [0, 0, 0];

	for (let i = 0; i <= numSubdivisions; ++i) {
		const angle = startAngle + (endAngle - startAngle) * (i / numSubdivisions);
		const x = Math.cos(angle);
		const y = Math.sin(angle);

		addVertex(x * radius, y * radius, ...outerColor);
		addVertex(x * innerRadius, y * innerRadius, ...innerColor);
	}

	const indexData = new Uint32Array(numSubdivisions * 6);

	let index = 0;

	for (let i = 0; i < numSubdivisions; ++i) {
		const indexOffset = i * 2;
		indexData[index++] = indexOffset;
		indexData[index++] = indexOffset + 1;
		indexData[index++] = indexOffset + 2;

		indexData[index++] = indexOffset + 2;
		indexData[index++] = indexOffset + 1;
		indexData[index++] = indexOffset + 3;
	}

	return {
		vertexData,
		colorData,
		indexData,
		numVertices: indexData.length,
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
			buffers: [
				{
					arrayStride: 2 * 4 + 4,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x2",
						},
						{
							shaderLocation: 4,
							offset: 2 * 4,
							format: "unorm8x4",
						},
					],
				},
				{
					arrayStride: 4 + 2 * 4,
					stepMode: "instance",
					attributes: [
						{
							shaderLocation: 1,
							offset: 0,
							format: "unorm8x4",
						}, // color
						{
							shaderLocation: 2,
							offset: 4,
							format: "float32x2", // offset
						},
					],
				},
				{
					arrayStride: 2 * 4,
					stepMode: "instance",
					attributes: [
						{
							shaderLocation: 3,
							offset: 0,
							format: "float32x2",
						}, //scale
					],
				},
			],
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

	const kNumObjects = 50;
	const objectInfos: ObjectInfo[] = [];

	const staticUnitSize =
		4 + //color
		2 * 4; // offset
	const changingUnitSize = 2 * 4; //scale
	const staticStorageBufferSize = kNumObjects * staticUnitSize;
	const changingStorageBufferSize = kNumObjects * changingUnitSize;

	const staticStorageBuffer = device.createBuffer({
		label: "static-storage-buffer",
		size: staticStorageBufferSize,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});

	const changingStorageBuffer = device.createBuffer({
		label: "changing-storage-buffer",
		size: changingStorageBufferSize,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});

	const kColorOffset = 0;
	const kOffsetOffset = 1;
	const kScaleOffset = 0;
	{
		const staticVertexValuesUint8 = new Uint8Array(staticStorageBufferSize);
		const staticVertexValuesF32 = new Float32Array(
			staticVertexValuesUint8.buffer,
		);

		for (let i = 0; i < kNumObjects; ++i) {
			const staticOffsetUint8 = i * staticUnitSize;
			const staticOffsetFloat32 = staticOffsetUint8 / 4;

			staticVertexValuesUint8.set(
				[rand() * 255, rand() * 255, rand() * 255, 255],
				staticOffsetUint8 + kColorOffset,
			);

			staticVertexValuesF32.set(
				[rand(-1, 1), rand(-1, 1)],
				staticOffsetFloat32 + kOffsetOffset,
			);

			objectInfos.push({
				scale: rand(0.2, 0.5),
			});
		}
		device.queue.writeBuffer(staticStorageBuffer, 0, staticVertexValuesF32);
	}

	const storageValues = new Float32Array(changingStorageBufferSize / 4);

	const { vertexData, numVertices, indexData, colorData } =
		createCircleVertices({
			radius: 0.5,
			innerRadius: 0.25,
		});

	const vertexStroageBuffer = device.createBuffer({
		label: "vertex-storage-buffer",
		size: vertexData.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});

	device.queue.writeBuffer(vertexStroageBuffer, 0, vertexData);

	const indexBuffer = device.createBuffer({
		label: "index-buffer",
		size: indexData.byteLength,
		usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(indexBuffer, 0, indexData);

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
		pass.setVertexBuffer(0, vertexStroageBuffer);
		pass.setVertexBuffer(1, staticStorageBuffer);
		pass.setVertexBuffer(2, changingStorageBuffer);
		pass.setIndexBuffer(indexBuffer, "uint32");

		const aspect = canvas.width / canvas.height;

		objectInfos.forEach(({ scale }, i) => {
			const offset = (i * changingUnitSize) / 4;
			storageValues.set([scale / aspect, scale], offset + kScaleOffset);
		});
		device.queue.writeBuffer(changingStorageBuffer, 0, storageValues);

		pass.drawIndexed(numVertices, kNumObjects);
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
