type PlaneGeometryArgs = {
  width?: number
  height?: number
}

export class PlaneGeometry {
  public readonly vertexBuffer: GPUBuffer
  public readonly indexFormat: GPUIndexFormat = 'uint16'
  public readonly indexBuffer: GPUBuffer
  public readonly numVertices: number
  public readonly vertexBufferLayout: GPUVertexBufferLayout

  private readonly stride = { pos: 3, tex: 2 } as const

  constructor(
    private readonly device: GPUDevice,
    args?: PlaneGeometryArgs,
  ) {
    const { vertices, indices, numVertices } = this.createVertices(args)

    this.vertexBuffer = this.createVertexBuffer(vertices)
    this.numVertices = numVertices
    this.indexBuffer = this.createIndexBuffer(indices)
    this.vertexBufferLayout = this.createVertexBufferLayout()
  }

  private createVertices(args?: PlaneGeometryArgs) {
    const halfW = (args?.width ?? 2) / 2
    const halfH = (args?.height ?? 2) / 2

    // prettier-ignore
    const positions = [
      -halfW, -halfH,  0,
       halfW, -halfH,  0,
       halfW,  halfH,  0,
      -halfW,  halfH,  0,
    ]
    // prettier-ignore
    const texcoords = [
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]

    const count = positions.length / this.stride.pos
    // prettier-ignore
    const vertices = new Float32Array(Array.from({ length: count }, (_, i) => [
      positions[i * this.stride.pos + 0], positions[i * this.stride.pos + 1], positions[i * this.stride.pos + 2],
      texcoords[i * this.stride.tex + 0], texcoords[i * this.stride.tex + 1],
    ]).flat())

    // prettier-ignore
    const indices = new Uint16Array([
      0, 2, 3,
      0, 1, 2,
    ])

    return { vertices, indices, numVertices: indices.length }
  }

  private createVertexBuffer(vertices: Float32Array) {
    const buffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, vertices)
    return buffer
  }

  private createIndexBuffer(indices: Uint16Array) {
    const buffer = this.device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, indices)
    return buffer
  }

  private createVertexBufferLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: (this.stride.pos + this.stride.tex) * 4,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
        { shaderLocation: 1, offset: this.stride.pos * 4, format: 'float32x2' }, // texcoord
      ],
    }
  }
}
