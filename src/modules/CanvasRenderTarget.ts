type Configure = {
  format?: GPUTextureFormat
  alphaMode?: GPUCanvasAlphaMode
  clearColor?: [number, number, number, number]
  usage?: number
}

type CanvasRenderTargetArgs = {
  device: GPUDevice
  canvas: HTMLCanvasElement
  configure?: Configure
  depthStencil?: {
    enable: boolean
    format?: GPUTextureFormat
  }
}

export class CanvasRenderTarget {
  private readonly device: GPUDevice
  public readonly canvas: HTMLCanvasElement
  public readonly context: GPUCanvasContext
  public readonly depthStencilFormat: GPUTextureFormat
  public readonly renderPassDescriptor: GPURenderPassDescriptor
  private depthTexture: GPUTexture | null = null

  constructor(private readonly args: CanvasRenderTargetArgs) {
    this.device = args.device
    this.canvas = args.canvas
    this.depthStencilFormat = args.depthStencil?.format ?? 'depth24plus'

    this.context = this.getContext()
    this.renderPassDescriptor = this.createRenderPassDescriptor()
  }

  private getContext() {
    const context = this.canvas.getContext('webgpu')
    if (!context) throw Error('GPUCanvasContextの取得に失敗しました')

    context.configure({
      device: this.device,
      format: this.args.configure?.format ?? navigator.gpu.getPreferredCanvasFormat(),
      ...this.args.configure,
    })

    return context
  }

  private createRenderPassDescriptor(): GPURenderPassDescriptor {
    return {
      colorAttachments: [
        {
          view: null as any,
          clearValue: this.args.configure?.clearColor,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: this.args.depthStencil?.enable
        ? {
            view: null as any,
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          }
        : undefined,
    }
  }

  updateView() {
    const canvasTexture = this.context.getCurrentTexture()
    this.renderPassDescriptor.colorAttachments[0]!.view = canvasTexture.createView()

    if (!this.args.depthStencil?.enable) return

    if (!this.depthTexture || this.depthTexture.width !== canvasTexture.width || this.depthTexture.height !== canvasTexture.height) {
      this.depthTexture?.destroy()

      this.depthTexture = this.device.createTexture({
        size: [canvasTexture.width, canvasTexture.height],
        format: this.depthStencilFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
    }
    this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture.createView()
  }

  get size() {
    return {
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
      aspect: this.canvas.clientWidth / this.canvas.clientHeight,
    }
  }

  get resolution() {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    }
  }
}
