export class GPU {
  static async request(...features: GPUFeatureName[]) {
    const adapter = await navigator.gpu?.requestAdapter()
    if (!adapter) throw Error('GPUAdapterの取得に失敗しました')

    const hasFeatures = features.filter((feature) => adapter.features.has(feature))

    const device = await adapter.requestDevice({ requiredFeatures: hasFeatures })
    if (!device) throw Error('GPUDeviceの取得に失敗しました')

    return new GPU(adapter, device, hasFeatures)
  }

  public readonly presentationFormat: GPUTextureFormat
  public readonly hasFeature: (feature: GPUFeatureName) => boolean

  private constructor(
    public readonly adapter: GPUAdapter,
    public readonly device: GPUDevice,
    hasFeatures: GPUFeatureName[],
  ) {
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
    this.hasFeature = (feature: GPUFeatureName) => hasFeatures.includes(feature)
  }
}
