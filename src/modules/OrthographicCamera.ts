import { mat4, vec3, type Mat4, type Vec3 } from 'wgpu-matrix'

type OrthographicCameraArgs = {
  left?: number
  right?: number
  bottom?: number
  top?: number
  near?: number
  far?: number
}

export class OrthographicCamera {
  public left: number
  public right: number
  public bottom: number
  public top: number
  public near: number
  public far: number

  public readonly position: Vec3
  public readonly target: Vec3
  public readonly up: Vec3

  public readonly buffer: GPUBuffer

  private readonly projectionMatrix: Mat4
  private readonly viewMatrix: Mat4

  constructor(
    private readonly device: GPUDevice,
    args?: OrthographicCameraArgs,
  ) {
    this.left = args?.left ?? -1
    this.right = args?.right ?? 1
    this.bottom = args?.bottom ?? -1
    this.top = args?.top ?? 1
    this.near = args?.near ?? 0.1
    this.far = args?.far ?? 10

    this.position = vec3.set(0, 0, 1)
    this.target = vec3.set(0, 0, 0)
    this.up = vec3.set(0, 1, 0)

    this.buffer = this.createBuffer()

    this.projectionMatrix = mat4.identity()
    this.updateProjectionMatrix()

    this.viewMatrix = mat4.identity()
    this.updateViewMatrix()
  }

  private createBuffer() {
    return this.device.createBuffer({
      size: (16 + 16) * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  updateProjectionMatrix() {
    mat4.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far, this.projectionMatrix)
    this.device.queue.writeBuffer(this.buffer, 0, this.projectionMatrix)
    return this
  }

  updateViewMatrix() {
    mat4.lookAt(this.position, this.target, this.up, this.viewMatrix)
    this.device.queue.writeBuffer(this.buffer, 16 * 4, this.viewMatrix)
    return this
  }

  setRect(left: number, right: number, bottom: number, top: number) {
    this.left = left
    this.right = right
    this.bottom = bottom
    this.top = top
    return this
  }

  setFrustum(left: number, right: number, bottom: number, top: number, near: number, far: number) {
    this.left = left
    this.right = right
    this.bottom = bottom
    this.top = top
    this.near = near
    this.far = far
    return this
  }
}
