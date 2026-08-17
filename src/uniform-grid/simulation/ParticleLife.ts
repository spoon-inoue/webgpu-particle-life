import { gui } from '@/modules/GUI'
import type { Buffers, Settings } from './Simulation'
import { UniformGrid } from './UniformGrid'
import shader from './particleLife.wgsl?raw'
import * as wgu from 'webgpu-utils'

type Uniform = {
  buffer: GPUBuffer
  view: wgu.StructuredView
  writeBuffer: () => void
}

export class ParticleLife extends UniformGrid {
  private readonly bufferBindGroupLayout: GPUBindGroupLayout
  private readonly bindGroupLayout: GPUBindGroupLayout
  private readonly pipeline: GPUComputePipeline
  private readonly freqUniformData: Uniform
  private readonly simUniformData: Uniform
  private readonly matrix: GPUTexture
  private readonly bufferBindGroups: GPUBindGroup[]
  private readonly bindGroup: GPUBindGroup

  constructor(device: GPUDevice, buffers: Buffers, settings: Settings) {
    super(device, buffers, settings, 'ParticleLife')

    this.bufferBindGroupLayout = this.createBufferBindGroupLayout()
    this.bindGroupLayout = this.createBindGroupLayout()
    this.pipeline = this.createPipeline()
    this.freqUniformData = this.createUniformData('freq')
    this.simUniformData = this.createSimulationUniformData()
    this.matrix = this.createMatrix()
    // prettier-ignore
    this.bufferBindGroups = [
      this.createBufferBindGroup( 0),
      this.createBufferBindGroup( 1),
    ]
    this.bindGroup = this.createBindGroup()

    this.setGUI()
  }

  private createBufferBindGroupLayout() {
    // @group(0) @binding(0) var<storage, read>       readParticles: array<Particle>;
    // @group(0) @binding(1) var<storage, read_write> writeParticles: array<Particle>;
    // @group(0) @binding(2) var<storage, read>       particleCell: array<u32>;
    // @group(0) @binding(3) var<storage, read>       cellCount: array<u32>;
    // @group(0) @binding(4) var<storage, read>       cellStart: array<u32>;
    // @group(0) @binding(5) var<storage, read>       cellParticleIndices: array<u32>;
    return this.device.createBindGroupLayout({
      label: this.label,
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      ],
    })
  }

  private createBindGroupLayout() {
    // @group(1) @binding(0) var          forceMap: texture_storage_2d<r32float, read>;
    // @group(1) @binding(1) var<uniform> freq: Frequently;
    // @group(1) @binding(2) var<uniform> sim: Sim;
    return this.device.createBindGroupLayout({
      label: this.label,
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float', access: 'read-only' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    })
  }

  private createPipeline() {
    return this.device.createComputePipeline({
      label: this.label,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bufferBindGroupLayout, this.bindGroupLayout] }),
      compute: {
        module: this.device.createShaderModule({ code: shader }),
      },
    })
  }

  private createSimulationUniformData() {
    // struct Sim {
    //   rMax: f32,
    //   beta: f32,
    //   avoidance: f32,
    //   force: f32,
    //   friction: f32,
    //   speed: f32,
    //   bounds: vec2f,
    //   grid: vec2u,
    // }
    const u = this.createUniformData('sim')
    u.view.set({
      rMax: this.settigs.rMax,
      beta: 0.4,
      avoidance: 40,
      force: 1,
      friction: 0.04,
      speed: 30,
      bounds: [this.settigs.bounds.width, this.settigs.bounds.height],
      grid: [this.settigs.grid.col, this.settigs.grid.row],
    })
    u.writeBuffer()
    return u
  }

  private createUniformData(uniformName: string) {
    const defs = wgu.makeShaderDataDefinitions(shader)
    const view = wgu.makeStructuredView(defs.uniforms[uniformName])

    const buffer = this.device.createBuffer({
      label: this.label,
      size: view.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, view.arrayBuffer)

    return {
      buffer,
      view,
      writeBuffer: () => this.device.queue.writeBuffer(buffer, 0, view.arrayBuffer),
    }
  }

  private createForceMap() {
    const r = () => Math.random() * 2 - 1

    const map: number[] = []
    for (let i = 0; i < this.settigs.colors; i++) {
      for (let j = 0; j < this.settigs.colors; j++) {
        if (i === j) {
          map.push((r() * 0.5 + 0.5) * 0.5 + 0.05)
        } else {
          map.push(r() * 0.3)
        }
      }
    }

    return new Float32Array(map)
  }

  private createMatrix() {
    const texture = this.device.createTexture({
      size: [this.settigs.colors, this.settigs.colors],
      format: 'r32float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
    })
    // prettier-ignore
    this.device.queue.writeTexture(
      { texture }, 
      this.createForceMap(), 
      { bytesPerRow: this.settigs.colors * 4 }, 
      { width: this.settigs.colors, height: this.settigs.colors }
    )
    return texture
  }

  private updateMatrix() {
    this.device.queue.writeTexture(
      { texture: this.matrix },
      this.createForceMap(),
      { bytesPerRow: this.settigs.colors * 4 },
      { width: this.settigs.colors, height: this.settigs.colors },
    )
  }

  private createBufferBindGroup(readBufferIndex: number) {
    return this.device.createBindGroup({
      label: this.label,
      layout: this.bufferBindGroupLayout,
      entries: [
        { binding: 0, resource: [this.buffers.particles1, this.buffers.particles2][readBufferIndex % 2] },
        { binding: 1, resource: [this.buffers.particles2, this.buffers.particles1][readBufferIndex % 2] },
        { binding: 2, resource: this.buffers.particleCell },
        { binding: 3, resource: this.buffers.cellCount },
        { binding: 4, resource: this.buffers.cellStart },
        { binding: 5, resource: this.buffers.cellParticleIndices },
      ],
    })
  }

  private createBindGroup() {
    return this.device.createBindGroup({
      label: this.label,
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.matrix },
        { binding: 1, resource: this.freqUniformData.buffer },
        { binding: 2, resource: this.simUniformData.buffer },
      ],
    })
  }

  compute(encoder: GPUCommandEncoder, step: number, dt: number) {
    this.freqUniformData.view.set({ dt })
    this.freqUniformData.writeBuffer()

    const pass = encoder.beginComputePass(this.computePassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bufferBindGroups[step % 2])
    pass.setBindGroup(1, this.bindGroup)
    pass.dispatchWorkgroups(this.workgroupCount.particle)
    pass.end()
  }

  resize() {
    super.resize()

    this.simUniformData.view.set({
      rMax: [this.settigs.rMax],
      bounds: [this.settigs.bounds.width, this.settigs.bounds.height],
      grid: [this.settigs.grid.col, this.settigs.grid.row],
    })
    this.simUniformData.writeBuffer()

    this.bufferBindGroups.length = 0
    // prettier-ignore
    this.bufferBindGroups.push(
      this.createBufferBindGroup(0),
      this.createBufferBindGroup(1),
    )
  }

  private setGUI() {
    const settings = {
      updateMatrix: () => this.updateMatrix(),
    }
    gui.add(this.simUniformData.view.views.beta, 0, 0.1, 0.7, 0.01).name('beta').decimals(2).onChange(this.simUniformData.writeBuffer.bind(this))
    gui.add(this.simUniformData.view.views.avoidance, 0, 10, 50, 1).name('avoidance').onChange(this.simUniformData.writeBuffer.bind(this))
    gui.add(this.simUniformData.view.views.force, 0, 0.5, 2, 0.01).name('force').decimals(2).onChange(this.simUniformData.writeBuffer.bind(this))
    gui.add(this.simUniformData.view.views.friction, 0, 0.01, 0.5, 0.01).name('friction').decimals(2).onChange(this.simUniformData.writeBuffer.bind(this))
    gui.add(this.simUniformData.view.views.speed, 0, 10, 50, 1).name('speed').onChange(this.simUniformData.writeBuffer.bind(this))
    gui.add(settings, 'updateMatrix').name('update matrix')
  }
}
