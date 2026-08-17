import type { Buffers, Settings } from './Simulation'

export abstract class UniformGrid {
  private readonly workgroupSize = 64
  protected readonly computePassDescriptor: GPUComputePassDescriptor = {}
  protected readonly workgroupCount: { particle: number; cell: number }

  constructor(
    protected readonly device: GPUDevice,
    protected readonly buffers: Buffers,
    protected readonly settigs: Settings,
    protected readonly label?: string,
  ) {
    this.workgroupCount = {
      particle: Math.ceil(settigs.count / this.workgroupSize),
      cell: Math.ceil((settigs.grid.row * settigs.grid.col) / this.workgroupSize),
    }
  }

  setTimestampWrites(timestampWrites?: GPUComputePassTimestampWrites) {
    this.computePassDescriptor.timestampWrites = timestampWrites
  }

  abstract compute(encoder: GPUCommandEncoder, ...args: any[]): void

  resize() {
    this.workgroupCount.cell = Math.ceil((this.settigs.grid.row * this.settigs.grid.col) / this.workgroupSize)
  }
}
