export type ResizedSize = {
  client: { width: number; height: number }
  resolution: { width: number; height: number }
}

export function createResizeObserver(device: GPUDevice, callback?: (size: ResizedSize) => void) {
  const maxTextureDimension2D = device.limits.maxTextureDimension2D
  const dpr = window.devicePixelRatio

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentBoxSize[0].inlineSize
      const height = entry.contentBoxSize[0].blockSize
      const resWidth = Math.max(1, Math.min(width * dpr, maxTextureDimension2D))
      const resHeight = Math.max(1, Math.min(height * dpr, maxTextureDimension2D))

      callback?.({ client: { width, height }, resolution: { width: resWidth, height: resHeight } })
    }
  })

  return observer
}
