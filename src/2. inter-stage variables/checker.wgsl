struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.5, -0.5),  // bottom left
    vec2f( 0.5, -0.5)   // bottom right
  );

  // var color = array<vec4f, 3>(
  //   vec4f(1.0, 0.0, 0.0, 1.0),
  //   vec4f(0.0, 1.0, 0.0, 1.0),
  //   vec4f(0.0, 0.0, 1.0, 1.0)
  // );

  var vsOutput: OurVertexShaderOutput;
  vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  // vsOutput.color = color[vertexIndex];
  return vsOutput;
}

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
  let red = vec4f(0.0, 0.0, 0.0, 1.0);
  let cyan = vec4f(1.0, 1.0, 1.0, 1.0);

  let grid = vec2u(fsInput.position.xy) / 10;
  let checker = (grid.x + grid.y) % 2 == 1;

  return select(red, cyan, checker);
}

// @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
//   return color;
// }