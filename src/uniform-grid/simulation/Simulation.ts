import { gui } from '@/modules/GUI'
import { CellCount } from './CellCount'
import { CellParticleIndices } from './CellParticleIndices'
import { CellStart } from './CellStart'
import { ParticleCell } from './ParticleCell'
import { ParticleLife } from './ParticleLife'
import type { UniformGrid } from './UniformGrid'
import * as urlParams from '@/modules/URLParams'

export type Buffers = {
  /** 【particle】位置，速度，typeを持つparticleの配列。readとwriteを切り替える */
  particles1: GPUBuffer
  /** 【particle】位置，速度，typeを持つparticleの配列。readとwriteを切り替える */
  particles2: GPUBuffer
  /** 【particle】particleが所属するセルの配列 */
  particleCell: GPUBuffer
  /** 【cell/atomic】セルが持つparticle数の配列 */
  cellCount: GPUBuffer
  /** 【cell】セルに所属するparticleの開始位置の配列 */
  cellStart: GPUBuffer
  /** 【cell/atomic】cellStartのコピー。cellParticleIndicesで使用する */
  cellWriteCursor: GPUBuffer
  /** 【particle】cellのid順に並べ変えたparticle idの配列 */
  cellParticleIndices: GPUBuffer
}

export type Settings = {
  colors: number
  count: number
  rMax: number
  grid: { row: number; col: number }
  bounds: { width: number; height: number }
}

export class Simulation {
  public readonly buffers: Buffers
  public readonly settings: Settings
  private readonly nodes: UniformGrid[]
  private timestampWrites?: GPUComputePassTimestampWrites

  constructor(private readonly device: GPUDevice) {
    this.settings = this.getSettings()

    this.setGui()

    this.buffers = {
      particles1: this.createParticleDataBuffer(true),
      particles2: this.createParticleDataBuffer(),
      particleCell: this.createParticleBuffer(),
      cellCount: this.createCellBuffer(GPUBufferUsage.COPY_DST),
      cellStart: this.createCellBuffer(GPUBufferUsage.COPY_SRC),
      cellWriteCursor: this.createCellBuffer(GPUBufferUsage.COPY_DST),
      cellParticleIndices: this.createParticleBuffer(),
    }

    this.nodes = [
      new ParticleCell(device, this.buffers, this.settings),
      new CellCount(device, this.buffers, this.settings),
      new CellStart(device, this.buffers, this.settings),
      new CellParticleIndices(device, this.buffers, this.settings),
      new ParticleLife(device, this.buffers, this.settings),
    ]
  }

  private getSettings(): Settings {
    const rMax = 60
    return {
      colors: urlParams.getColors(5),
      count: urlParams.getParticleCount(navigator.maxTouchPoints > 0 ? 5000 : 50000),
      rMax,
      grid: {
        row: Math.max(1, Math.floor(window.innerHeight / rMax)),
        col: Math.max(1, Math.floor(window.innerWidth / rMax)),
      },
      bounds: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    }
  }

  private createParticleDataBuffer(writeInitData?: boolean) {
    const stride = 1 + 1 + 2 + 2 // color: f32, padding, pos: vec2f, vel: vec2f
    const datas = new Float32Array(this.settings.count * stride)

    const buffer = this.device.createBuffer({
      size: datas.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    if (writeInitData) {
      const r = () => Math.random() * 2 - 1

      let count = 0
      for (let i = 0; i < this.settings.count; i++) {
        count = 0
        datas[i * stride + count++] = i % this.settings.colors
        count++ // padding
        datas[i * stride + count++] = r() * window.innerWidth * 0.5
        datas[i * stride + count++] = r() * window.innerHeight * 0.5
        datas[i * stride + count++] = 0
        datas[i * stride + count++] = 0
      }

      this.device.queue.writeBuffer(buffer, 0, datas)
    }
    return buffer
  }

  private createParticleBuffer(usage?: number) {
    return this.device.createBuffer({
      size: this.settings.count * 4,
      usage: GPUBufferUsage.STORAGE | (usage ?? 0),
    })
  }

  private createCellBuffer(usage?: number) {
    return this.device.createBuffer({
      size: this.settings.grid.row * this.settings.grid.col * 4,
      usage: GPUBufferUsage.STORAGE | (usage ?? 0),
    })
  }

  setTimestampWrites(timestampWrites?: GPUComputePassTimestampWrites) {
    this.timestampWrites = timestampWrites
  }

  compute(encoder: GPUCommandEncoder, step: number, dt: number) {
    for (const node of this.nodes) {
      node.setTimestampWrites(this.timestampWrites)
      node.compute(encoder, step, dt)
    }
  }

  resize(width: number, height: number) {
    this.settings.bounds = { width, height }
    this.settings.grid = {
      row: Math.max(1, Math.floor(height / this.settings.rMax)),
      col: Math.max(1, Math.floor(width / this.settings.rMax)),
    }

    this.buffers.cellCount = this.createCellBuffer(GPUBufferUsage.COPY_DST)
    this.buffers.cellStart = this.createCellBuffer(GPUBufferUsage.COPY_SRC)
    this.buffers.cellWriteCursor = this.createCellBuffer(GPUBufferUsage.COPY_DST)

    this.nodes.forEach((node) => node.resize())
  }

  private setGui() {
    gui.add(this.settings, 'count').disable()
    gui.add(this.settings, 'colors').disable()
    gui.add(this.settings, 'rMax', 30, 80, 10).onChange(() => this.resize(this.settings.bounds.width, this.settings.bounds.height))
  }
}
