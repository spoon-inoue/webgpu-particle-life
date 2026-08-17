import type { GPU } from '@/modules/GPU'
import { gui } from '@/modules/GUI'
import * as wgu from 'webgpu-utils'
import shader from './simulation.wgsl?raw'
import * as urlParams from '@/modules/URLParams'

type Uniform = {
  buffer: GPUBuffer
  view: wgu.StructuredView
  writeBuffer: () => void
}

export class Simulation {
  private readonly device: GPUDevice

  public readonly colors = urlParams.getColors(5)
  public readonly count = urlParams.getParticleCount(navigator.maxTouchPoints > 0 ? 5000 : 10000)
  public readonly particleBuffers: GPUBuffer[]

  private readonly bindGroups: GPUBindGroup[]
  private readonly matrix: GPUTexture
  private readonly frequentlyUniform: Uniform
  private readonly simulationUniform: Uniform
  private readonly bindGroupLayout: GPUBindGroupLayout
  private readonly pipeline: GPUComputePipeline
  private readonly computePassDescriptor: GPUComputePassDescriptor = {}

  constructor(gpu: GPU) {
    this.device = gpu.device

    // prettier-ignore
    this.particleBuffers = [
      this.createParticleBuffer(true),
      this.createParticleBuffer(false),
    ]
    this.matrix = this.createMatrix()
    this.frequentlyUniform = this.createUniformData('freq')
    this.simulationUniform = this.createSimulationUniformData()

    this.bindGroupLayout = this.createBindGroupLayout()
    this.pipeline = this.createPipeline([this.bindGroupLayout])

    // prettier-ignore
    this.bindGroups = [
      this.createBindGroup(this.particleBuffers[0], this.particleBuffers[1]),
      this.createBindGroup(this.particleBuffers[1], this.particleBuffers[0]),
    ]

    this.setGui()
  }

  private createParticleBuffer(writeInitData: boolean) {
    const stride = 1 + 1 + 2 + 2 // id: f32, padding, pos: vec2f, vel: vec2f
    const datas = new Float32Array(this.count * stride) // id: f32, padding, pos: vec2f, vel: vec2f

    const buffer = this.device.createBuffer({
      size: datas.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    if (writeInitData) {
      const r = () => Math.random() * 2 - 1
      // const dpr = window.devicePixelRatio
      const dpr = 1

      let count = 0
      for (let i = 0; i < this.count; i++) {
        count = 0
        datas[i * stride + count++] = i % this.colors
        count++ // padding
        datas[i * stride + count++] = r() * window.innerWidth * dpr * 0.5
        datas[i * stride + count++] = r() * window.innerHeight * dpr * 0.5
        datas[i * stride + count++] = 0
        datas[i * stride + count++] = 0
      }

      this.device.queue.writeBuffer(buffer, 0, datas)
    }
    return buffer
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
    // }
    const u = this.createUniformData('sim')
    u.view.set({
      rMax: 50,
      beta: 0.5,
      avoidance: 20,
      force: 1,
      friction: 0.04,
      speed: 30,
      bounds: [window.innerWidth, window.innerHeight],
    })
    u.writeBuffer()
    return u
  }

  private createUniformData(uniformName: string) {
    const defs = wgu.makeShaderDataDefinitions(shader)
    const view = wgu.makeStructuredView(defs.uniforms[uniformName])

    const buffer = this.device.createBuffer({
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
    for (let i = 0; i < this.colors; i++) {
      for (let j = 0; j < this.colors; j++) {
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
      size: [this.colors, this.colors],
      format: 'r32float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
    })
    // prettier-ignore
    this.device.queue.writeTexture(
      { texture }, 
      this.createForceMap(), 
      { bytesPerRow: this.colors * 4 }, 
      { width: this.colors, height: this.colors }
    )
    return texture
  }

  private updateMatrix() {
    this.device.queue.writeTexture(
      { texture: this.matrix },
      this.createForceMap(),
      { bytesPerRow: this.colors * 4 },
      { width: this.colors, height: this.colors },
    )
  }

  private createBindGroupLayout() {
    let binding = 0
    return this.device.createBindGroupLayout({
      entries: [
        { binding: binding++, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: binding++, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: binding++, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float', access: 'read-only' } },
        { binding: binding++, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: binding++, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    })
  }

  private createPipeline(bindGroupLayouts: GPUBindGroupLayout[]) {
    return this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      compute: { module: this.device.createShaderModule({ code: shader }) },
    })
  }

  private createBindGroup(particleBuffer1: GPUBuffer, particleBuffer2: GPUBuffer) {
    let binding = 0
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: binding++, resource: particleBuffer1 },
        { binding: binding++, resource: particleBuffer2 },
        { binding: binding++, resource: this.matrix },
        { binding: binding++, resource: this.frequentlyUniform.buffer },
        { binding: binding++, resource: this.simulationUniform.buffer },
      ],
    })
  }

  resize(width: number, height: number) {
    this.simulationUniform.view.set({
      bounds: [width, height],
    })
    this.simulationUniform.writeBuffer()
  }

  setTimestampWrites(timestampWrites?: GPUComputePassTimestampWrites) {
    this.computePassDescriptor.timestampWrites = timestampWrites
  }

  compute(encoder: GPUCommandEncoder, dt: number, step: number) {
    this.frequentlyUniform.view.set({ dt })
    this.frequentlyUniform.writeBuffer()

    const pass = encoder.beginComputePass(this.computePassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroups[step % 2])
    pass.dispatchWorkgroups(Math.ceil(this.count / 256))
    pass.end()
  }

  private setGui() {
    const uni = this.simulationUniform

    const settings = {
      updateMatrix: () => this.updateMatrix(),
    }
    gui.add(this, 'count').disable()
    gui.add(this, 'colors').disable()

    gui.add(uni.view.views.rMax, 0, 30, 80, 10).name('rMax').onChange(uni.writeBuffer.bind(this))
    gui.add(uni.view.views.beta, 0, 0.1, 0.7, 0.01).name('beta').decimals(2).onChange(uni.writeBuffer.bind(this))
    gui.add(uni.view.views.avoidance, 0, 10, 50, 1).name('avoidance').onChange(uni.writeBuffer.bind(this))
    gui.add(uni.view.views.force, 0, 0.5, 2, 0.01).name('force').decimals(2).onChange(uni.writeBuffer.bind(this))
    gui.add(uni.view.views.friction, 0, 0.01, 0.5, 0.01).name('friction').decimals(2).onChange(uni.writeBuffer.bind(this))
    gui.add(uni.view.views.speed, 0, 10, 50, 1).name('speed').onChange(uni.writeBuffer.bind(this))
    gui.add(settings, 'updateMatrix').name('update matrix')
  }
}
