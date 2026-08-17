struct Particle {
  id: f32,
  pos: vec2f,
  vel: vec2f,
}

struct Frequently {
  dt: f32,
}

struct Sim {
  rMax: f32,
  beta: f32,
  avoidance: f32,
  force: f32,
  friction: f32,
  speed: f32,
  bounds: vec2f,
  grid: vec2u,
}

@group(0) @binding(0) var<storage, read>       readParticles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> writeParticles: array<Particle>;
@group(0) @binding(2) var<storage, read>       particleCell: array<u32>;
@group(0) @binding(3) var<storage, read_write> cellCount: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read>       cellStart: array<u32>;
@group(0) @binding(5) var<storage, read>       cellParticleIndices: array<u32>;

@group(0) @binding(6) var                      forceMap: texture_storage_2d<r32float, read>;
@group(0) @binding(7) var<uniform>             freq: Frequently;
@group(0) @binding(8) var<uniform>             sim: Sim;

@compute @workgroup_size(256)
fn cs(@builtin(global_invocation_id) gidV3: vec3u) {
  let gid = gidV3.x;
  if (gid >= arrayLength(&readParticles)) { return; }

  var p = readParticles[gid];
  
  let force = getForce(gid);
  //  let force = vec2f(100, 0);

  p.vel *= sim.friction;
  p.vel += force * freq.dt * sim.speed;
  p.pos += p.vel * freq.dt * sim.speed;
  
  p = adjustBounds(p);

  writeParticles[gid] = p;
}

fn getForce(pi: u32) -> vec2f {
  let p = readParticles[pi];

  var totalForce = vec2f(0);
  var avoidForce = vec2f(0);

  let len = arrayLength(&readParticles);
  let mrs = sim.rMax * sim.rMax;

  var div = 0f;

  let grid = vec2i(sim.grid);
  let cellId = i32(particleCell[pi]);

  let cell = vec2i(
    cellId % grid.x,
    cellId / grid.x,
  );

  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      var nx = cell.x + x;
      // 境界条件
      if      (nx < 0)       { nx = grid.x - 1; }
      else if (grid.x <= nx) { nx = 0; }

      var ny = cell.y + y;
      // 境界条件
      if      (ny < 0)       { ny = grid.y - 1; }
      else if (grid.y <= ny) { ny = 0; }

      let neighborCellId = u32(ny * grid.x + nx);

      let start = cellStart[neighborCellId];
      let count = atomicLoad(&cellCount[neighborCellId]);

      for (var i = 0u; i < count; i++) {
        let particleIndex = cellParticleIndices[start + i];

        if (particleIndex == pi) { continue; }

        let other = readParticles[particleIndex];
        let rVec = getParticleVec(p.pos, other.pos);
        let rs = dot(rVec, rVec);

        if (0 < rs && rs < mrs) {
          let r = sqrt(rs);
          let a = textureLoad(forceMap, vec2u(u32(p.id), u32(other.id))).r;
          let f = force(r / sim.rMax, a);

          totalForce += rVec / r * f.x;
          avoidForce += rVec / r * f.y;
          div += pow(max(0, -f.y), 1) / 10 * sim.avoidance;

        } else if (rs == 0) {
          avoidForce.x += (f32(pi) * 20293.302 % 4932.329) / 1e5;
        }
      }
    }
  }

  totalForce *= sim.rMax * sim.force / (1 + div);

  return vec2f(totalForce.x + avoidForce.x, totalForce.y + avoidForce.y);
}

fn force(r: f32, a: f32) -> vec2f {
  let beta = sim.beta;
  if (r < beta) {
    // 斥力
    // 閾値に近いほど0になり、遠いほど（particle間の距離が密なほど）-1に近付く
    return vec2f(0, r / beta - 1);
  } else if (r < 1) {
    // 条件による力
    // 範囲両端で0，中央で1になる
    return vec2f(
      a * (1 - abs(2 * r - 1 - beta) / (1 - beta)),
      0
    );
  } else {
    // 範囲外
    return vec2f(0);
  }
}

/**
 * repeatを考慮したparticle間のベクトルを取得する
 */
fn getParticleVec(selfPos: vec2f, otherPos: vec2f) -> vec2f {
  let half = sim.bounds * 0.5;
  let bounds = vec3f(sim.bounds, 0);
  var v = otherPos - selfPos;

  if (selfPos.x + sim.rMax > half.x) {
    // particleの位置x + rmaxが右端を越えている場合、particleを左端に移動させたときのベクトルを生成する
    let v2 = otherPos - (selfPos - bounds.xz);
    if (dot(v2, v2) < dot(v, v)) {
      // 右端にある場合と、左端にある場合のベクトルの距離を比較して小さい方のベクトルを採用する
      v = v2;
    }
  } else if (selfPos.x - sim.rMax < -half.x) {
    let v2 = otherPos - (selfPos + bounds.xz);
    if (dot(v2, v2) < dot(v, v)) {
      v = v2;
    }
  }

  if (selfPos.y + sim.rMax > half.y) {
    // particleの位置y + rmaxが上端を越えている場合、particleを下端に移動させたときのベクトルを生成する
    let v2 = otherPos - (selfPos - bounds.zy);
    if (dot(v2, v2) < dot(v, v)) {
      // 上端にある場合と、下端にある場合のベクトルの距離を比較して小さい方のベクトルを採用する
      v = v2;
    }
  } else if (selfPos.y - sim.rMax < -half.y) {
    let v2 = otherPos - (selfPos + bounds.zy);
    if (dot(v2, v2) < dot(v, v)) {
      v = v2;
    }
  }

  return v;
}

fn adjustBounds(p: Particle) -> Particle {
  // 位置を逆サイドからrepeatさせる

  var res = p;
  let half = sim.bounds * 0.5;

  if (p.pos.x > half.x) {
    res.pos.x = -half.x;
  } else if (p.pos.x < -half.x) {
    res.pos.x = half.x;
  }

  if (p.pos.y > half.y) {
    res.pos.y = -half.y;
  } else if (p.pos.y < -half.y) {
    res.pos.y = half.y;
  }

  return res;
}