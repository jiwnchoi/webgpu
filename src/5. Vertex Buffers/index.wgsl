struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
  @location(4) perVertexColor: vec3f,
};


struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}


@vertex fn vs(
  vert: Vertex,
) -> VSOutput {

  var vsOutput: VSOutput;
  vsOutput.position = vec4f(vert.position * vert.scale + vert.offset, 0.0, 1.0);
  vsOutput.color = vert.color * vec4f(vert.perVertexColor, 1.0);
  return vsOutput;
}


@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}