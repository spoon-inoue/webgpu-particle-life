struct Particle {
  id: f32,
  pos: vec2f,
  vel: vec2f,
}

struct Uniforms {
  bounds: vec2f,
  grid: vec2u,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> particleCell: array<u32>;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) gid3: vec3u) {
  let gid = gid3.x;
  if (gid >= arrayLength(&particles)) { return; }

  let p = particles[gid];
  let norm = p.pos / uni.bounds + 0.5;
  let cell = min(
    vec2u(floor(norm * vec2f(uni.grid))),
    uni.grid - 1,
  );
  let cellId = cell.y * uni.grid.x + cell.x;

  particleCell[gid] = cellId;
}