import type { Buffers, Settings } from './Simulation'
import { UniformGrid } from './UniformGrid'
import shader from './particleCell.wgsl?raw'
import * as wgu from 'webgpu-utils'

export class ParticleCell extends UniformGrid {
  private readonly pipeline: GPUComputePipeline
  private readonly uniform: { buffer: GPUBuffer; view: wgu.StructuredView; writeBuffer: () => void }
  private readonly bindGroups: GPUBindGroup[]

  constructor(device: GPUDevice, buffers: Buffers, settings: Settings) {
    super(device, buffers, settings, 'ParticleCell')

    const bindGroupLayout = this.createBindGroupLayout()
    this.pipeline = this.createPipeline(bindGroupLayout)
    this.uniform = this.createUniformData()
    // prettier-ignore
    this.bindGroups = [
      this.createBindGroup(bindGroupLayout, this.buffers.particles1),
      this.createBindGroup(bindGroupLayout, this.buffers.particles2),
    ]
  }

  private createBindGroupLayout() {
    return this.device.createBindGroupLayout({
      label: this.label,
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    })
  }

  private createPipeline(bindGroupLayout: GPUBindGroupLayout) {
    return this.device.createComputePipeline({
      label: this.label,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: {
        module: this.device.createShaderModule({ code: shader }),
      },
    })
  }

  private createUniformData() {
    const defs = wgu.makeShaderDataDefinitions(shader)
    const view = wgu.makeStructuredView(defs.uniforms.uni)
    view.set({
      bounds: [this.settigs.bounds.width, this.settigs.bounds.height],
      grid: [this.settigs.grid.col, this.settigs.grid.row],
    })
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

  private createBindGroup(layout: GPUBindGroupLayout, particleBuffer: GPUBuffer) {
    return this.device.createBindGroup({
      label: this.label,
      layout,
      entries: [
        { binding: 0, resource: particleBuffer },
        { binding: 1, resource: this.buffers.particleCell },
        { binding: 2, resource: this.uniform.buffer },
      ],
    })
  }

  compute(encoder: GPUCommandEncoder, step: number) {
    const pass = encoder.beginComputePass(this.computePassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroups[step % 2])
    pass.dispatchWorkgroups(this.workgroupCount.particle)
    pass.end()
  }

  resize() {
    super.resize()

    this.uniform.view.set({
      bounds: [this.settigs.bounds.width, this.settigs.bounds.height],
      grid: [this.settigs.grid.col, this.settigs.grid.row],
    })
    this.uniform.writeBuffer()
  }
}
