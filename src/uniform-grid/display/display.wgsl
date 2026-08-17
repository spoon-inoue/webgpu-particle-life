struct Attributes {
  @location(0) position: vec3f,
  @location(1) texcoord: vec2f,
}

struct Particle {
  id: f32,
  pos: vec2f,
  vel: vec2f,
}

struct Camera {
  proj: mat4x4f,
  view: mat4x4f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
  @location(1) @interpolate(flat) particleType: u32,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: Camera;
@group(0) @binding(2) var<storage, read> palette: array<vec3f>;

override dpr: f32;

@vertex
fn vs(
  attr: Attributes,
  @builtin(instance_index) instanceIndex: u32,
) -> VSOut {
  var pos = attr.position;
  var particle = particles[instanceIndex];
  pos = vec3f(pos.xy + particle.pos, pos.z) * 1.01 * dpr;

  var vsOut: VSOut;
  vsOut.position = camera.proj * camera.view * vec4f(pos, 1);
  vsOut.texcoord = attr.texcoord;
  vsOut.particleType = u32(particle.id);
  return vsOut;
}

@fragment 
fn fs(in: VSOut) -> @location(0) vec4f {
  let a = smoothstep(0.50, 0.3, distance(in.texcoord, vec2f(0.5)));
  let color = palette[in.particleType];
  
  return vec4f(color * a, a);
}