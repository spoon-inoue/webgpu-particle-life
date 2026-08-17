import type { Buffers, Settings } from './Simulation'
import { UniformGrid } from './UniformGrid'
import shader from './cellParticleIndices.wgsl?raw'

export class CellParticleIndices extends UniformGrid {
  private readonly bindGroupLayout: GPUBindGroupLayout
  private readonly pipeline: GPUComputePipeline
  private bindGroup: GPUBindGroup

  constructor(device: GPUDevice, buffers: Buffers, settings: Settings) {
    super(device, buffers, settings, 'CellParticleIndices')

    this.bindGroupLayout = this.createBindGroupLayout()
    this.pipeline = this.createPipeline()
    this.bindGroup = this.createBindGroup()
  }

  private createBindGroupLayout() {
    return this.device.createBindGroupLayout({
      label: this.label,
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    })
  }

  private createPipeline() {
    return this.device.createComputePipeline({
      label: this.label,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      compute: {
        module: this.device.createShaderModule({ code: shader }),
      },
    })
  }

  private createBindGroup() {
    return this.device.createBindGroup({
      label: this.label,
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.buffers.particleCell },
        { binding: 1, resource: this.buffers.cellWriteCursor },
        { binding: 2, resource: this.buffers.cellParticleIndices },
      ],
    })
  }

  compute(encoder: GPUCommandEncoder) {
    encoder.copyBufferToBuffer(this.buffers.cellStart, this.buffers.cellWriteCursor)

    const pass = encoder.beginComputePass(this.computePassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.dispatchWorkgroups(this.workgroupCount.particle)
    pass.end()
  }

  resize() {
    super.resize()

    this.bindGroup = this.createBindGroup()
  }
}
