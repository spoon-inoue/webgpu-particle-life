import { CanvasRenderTarget } from '@/modules/CanvasRenderTarget'
import { hsvToRgb } from '@/modules/color'
import { GPU } from '@/modules/GPU'
import { OrthographicCamera } from '@/modules/OrthographicCamera'
import { PlaneGeometry } from '@/modules/PlaneGeometry'
import type { Simulation } from '../simulation/Simulation'
import shader from './display.wgsl?raw'

export class Display {
  private readonly device: GPUDevice
  private readonly renderTarget: CanvasRenderTarget
  private readonly camera: OrthographicCamera
  private readonly paletteBuffer: GPUBuffer
  private readonly geometry: PlaneGeometry
  private readonly bindGroupLayout: GPUBindGroupLayout
  private readonly pipeline: GPURenderPipeline
  private readonly bindGroups: GPUBindGroup[]

  constructor(
    private readonly gpu: GPU,
    canvas: HTMLCanvasElement,
    private readonly sim: Simulation,
  ) {
    this.device = gpu.device

    this.renderTarget = new CanvasRenderTarget({
      device: gpu.device,
      canvas,
      configure: { format: gpu.presentationFormat, alphaMode: 'premultiplied' },
    })
    this.camera = this.createCamera(this.renderTarget.size)
    this.paletteBuffer = this.createPaletteBuffer()
    this.geometry = new PlaneGeometry(this.device, { width: 5, height: 5 })
    this.bindGroupLayout = this.createBindGroupLayout()
    this.pipeline = this.createPipeline([this.bindGroupLayout], [this.geometry.vertexBufferLayout])
    // prettier-ignore
    this.bindGroups = [
      this.createBindGroup(sim.particleBuffers[0]),
      this.createBindGroup(sim.particleBuffers[1]),
    ]
  }

  private createCamera({ width, height }: { width: number; height: number }) {
    const halfW = width / 2
    const halfH = height / 2
    return new OrthographicCamera(this.device, { left: -halfW, right: halfW, bottom: -halfH, top: halfH, near: 0.1, far: 10 })
    // return new OrthographicCamera(this.device).setFrustum(-halfW, halfW, -halfH, halfH, 0.1, 10).updateProjectionMatrix()
  }

  private createPaletteBuffer() {
    const s = 0.8
    const v = 1
    const offset = Math.random() * 180
    const colors = new Float32Array(Array.from({ length: this.sim.colors }, (_, i) => [...hsvToRgb((i / this.sim.colors) * 360 + offset, s, v), 0]).flat())

    const buffer = this.device.createBuffer({
      size: colors.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, colors)
    return buffer
  }

  private createBindGroupLayout() {
    return this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // particles
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // camera
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }, // palettes
      ],
    })
  }

  private createPipeline(bindGroupLayouts: GPUBindGroupLayout[], vertexBufferLayouts: GPUVertexBufferLayout[]) {
    const module = this.device.createShaderModule({ code: shader })

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: {
        module,
        buffers: vertexBufferLayouts,
        constants: {
          dpr: window.devicePixelRatio,
        },
      },
      fragment: {
        module,
        targets: [
          {
            format: this.gpu.presentationFormat,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: {
        cullMode: 'back',
      },
    })
  }

  private createBindGroup(particleBuffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: particleBuffer },
        { binding: 1, resource: this.camera.buffer },
        { binding: 2, resource: this.paletteBuffer },
      ],
    })
  }

  resize(width: number, height: number) {
    // render target
    this.renderTarget.canvas.width = width
    this.renderTarget.canvas.height = height
    // camera
    const halfW = width / 2
    const halfH = height / 2
    this.camera.setRect(-halfW, halfW, -halfH, halfH).updateProjectionMatrix()
  }

  setTimestampWrites(timestampWrites?: GPURenderPassTimestampWrites) {
    this.renderTarget.renderPassDescriptor.timestampWrites = timestampWrites
  }

  render(encoder: GPUCommandEncoder, step: number) {
    this.renderTarget.updateView()

    const pass = encoder.beginRenderPass(this.renderTarget.renderPassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setVertexBuffer(0, this.geometry.vertexBuffer)
    pass.setIndexBuffer(this.geometry.indexBuffer, this.geometry.indexFormat)
    pass.setBindGroup(0, this.bindGroups[(step + 1) % 2])
    pass.drawIndexed(this.geometry.numVertices, this.sim.count)
    pass.end()
  }
}
