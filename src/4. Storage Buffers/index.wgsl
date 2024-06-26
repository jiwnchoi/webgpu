struct OurStruct {
  color: vec4f,
  // scale: vec2f,
  offset: vec2f,
};

struct ScaleStruct {
  scale: vec2f,
};

struct Vertex {
  position: vec2f,
};


struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<storage, read> ourStruct: array<OurStruct>;
@group(0) @binding(1) var<storage, read> scaleStruct: array<ScaleStruct>;
@group(0) @binding(2) var<storage, read> vertexBuffer: array<Vertex>;


@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex : u32
) -> VSOutput {
  let ourStruct = ourStruct[instanceIndex];
  let scaleStruct = scaleStruct[instanceIndex];

  var vsOutput: VSOutput;
  vsOutput.position = vec4f(vertexBuffer[vertexIndex].position * scaleStruct.scale + ourStruct.offset, 0.0, 1.0);
  vsOutput.color = ourStruct.color;
  return vsOutput;
}


@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}