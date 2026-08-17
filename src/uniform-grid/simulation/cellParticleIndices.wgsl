@group(0) @binding(0) var<storage, read> particleCell: array<u32>;
@group(0) @binding(1) var<storage, read_write> cellWriteCursor: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> cellParticleIndices: array<u32>;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) gid3: vec3u) {
  let gid = gid3.x;
  if (gid >= arrayLength(&particleCell)) { return; }

  let cellId = particleCell[gid];
  let offset = atomicAdd(&cellWriteCursor[cellId], 1u);

  cellParticleIndices[offset] = gid;
}