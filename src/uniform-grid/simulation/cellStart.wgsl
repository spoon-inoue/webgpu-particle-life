@group(0) @binding(0) var<storage, read>       cellCount: array<u32>;
@group(0) @binding(1) var<storage, read_write> cellStart: array<u32>;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) gid3: vec3u) {
  let gid = gid3.x;
  if (gid >= arrayLength(&cellCount)) { return; }

  var prefixSum = 0u;
  for(var i = 0u; i < arrayLength(&cellCount); i++) {
    if (i == gid) { break; }

    prefixSum += cellCount[i];
  }

  cellStart[gid] = prefixSum;
}