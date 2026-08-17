# GPUオブジェクト

**考え方**

- Shaderに書かれている内容を、GPUに説明するためのオブジェクト
- Shader起点で構造が決まる

**構造図**

<img width="800" alt="Frame 46" src="https://github.com/user-attachments/assets/1f0ab8da-fe7c-44e3-a89c-c2048bee960e" />

## ShaderModule

- WGSL(WebGPU Shading Language)で記述したシェーダーコードをGPUが利用できる形にしたオブジェクト
- `GPUDevice.createShaderModule()`で生成する
- `Vertex Shader`、`Fragment Shader`、`Compute Shader`を1つのWGSLファイルにまとめて記述できる
- `@vertex`、`@fragment`、`@compute`属性の付いた関数をエントリーポイントとして利用する
- 単体では実行できず、`RenderPipeline`または`ComputePipeline`から参照して使用する
- パイプライン生成時にシェーダーの検証・コンパイルが行われる（実装によってタイミングは異なる）

```wgsl
  @vertex
  fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    var positions = array(
      vec2f(-1.0, -1.0),
      vec2f( 3.0, -1.0),
      vec2f(-1.0,  3.0),
    );
    return vec4f(positions[vertexIndex], 0.0, 1.0);
  }

  @fragment
  fn fs() -> @location(0) vec4f {
    return vec4f(0.2, 0.6, 1.0, 1.0);
  }
```

```ts
const shaderModule = device.createShaderModule({
  code: shaderCode,
})
```

## BindGroupLayout

- シェーダーが使用するリソース（Buffer、Texture、Samplerなど）の**レイアウト（構成）**を定義するオブジェクト
- `GPUDevice.createBindGroupLayout()`で生成する
- 各リソースのバインディング番号、種類、シェーダーから参照可能なステージを指定する
- WGSLの`@group()`・`@binding()`と対応する
- `BindGroup`作成時や`PipelineLayout`作成時に使用される
- シェーダーとBindGroupの整合性を保証する役割を持つ
- `layout: 'auto'`を指定すると、パイプライン生成時に自動生成することもできる

```wgsl
@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
```

```ts
const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform' },
    },
  ],
})
```

## BindGroup

- シェーダーで使用する**実際のリソース（Buffer、Texture、Samplerなど）**をまとめたオブジェクト
- `GPUDevice.createBindGroup()`で生成する
- `BindGroupLayout`で定義されたレイアウトに従ってリソースを設定する
- WGSLの`@group()`・`@binding()`と対応する
- `RenderPass`や`ComputePass`で`setBindGroup()`を呼び出してGPUへバインドする
- 同じ`BindGroupLayout`であれば、異なるリソースを持つ複数の`BindGroup`を作成できる
- パイプライン生成後も、`BindGroup`を切り替えることで異なるデータを使用できる

```wgsl
@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
```

```ts
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    {
      binding: 0,
      resource: { buffer: uniformBuffer },
    },
  ],
})
```

## PipelineLayout

- 複数の`BindGroupLayout`をまとめて管理するオブジェクト
- `GPUDevice.createPipelineLayout()`で生成する
- `RenderPipeline`または`ComputePipeline`で使用する
- シェーダーが使用する**すべてのBindGroupの構成**を定義する
- `BindGroupLayout`を`@group()`番号順に配列で指定する
- `layout: 'auto'`を指定すると、シェーダーから自動生成することもできる
- 同じ`PipelineLayout`を複数のパイプラインで共有できる

```wgsl
@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@group(1) @binding(0)
var colorTexture: texture_2d<f32>;

@group(1) @binding(1)
var colorSampler: sampler;
```

```ts
const uniformLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' },
    },
  ],
})

const textureLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      texture: {},
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {},
    },
  ],
})
```

```ts
const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [
    uniformLayout, // @group(0)
    textureLayout, // @group(1)
  ],
})
```

## Pipeline

- GPUが描画または計算を実行するための**実行設定をまとめたオブジェクト**
- `RenderPipeline`と`ComputePipeline`の2種類がある
- シェーダー、PipelineLayout、各種GPUステートを保持する
- `GPUDevice.createRenderPipeline()`または`GPUDevice.createComputePipeline()`で生成する
- 作成後は変更不可（Immutable）
- `RenderPass`や`ComputePass`で`setPipeline()`を呼び出して使用する
- 一度作成したPipelineは複数回再利用できる

```ts
const pipeline = device.createRenderPipeline({
  layout: pipelineLayout,
  vertex: {
    module: shaderModule,
    entryPoint: 'vs',
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'fs',
    targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
  },
  primitive: {
    topology: 'triangle-list',
    cullMode: 'back',
    frontFace: 'ccw', // 表面と判定する頂点の並び（ccw / cw）
  },
  depthStencil: {
    format: 'depth24plus',
    depthWriteEnabled: true,
    depthCompare: 'less',
  },
})
```

## VertexBuffer

- 頂点データ（位置、法線、UV、頂点カラーなど）を格納する`GPUBuffer`
- `GPUDevice.createBuffer()`で生成する
- `GPUBufferUsage.VERTEX`を指定して作成する
- `RenderPipeline`の`vertex.buffers`でレイアウトを定義する
- `RenderPass`で`setVertexBuffer()`を呼び出してバインドする
- `draw()`実行時にVertex Shaderから読み取られる

```wgsl
@vertex
fn vs(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position, 1.0);
}
```

```ts
// prettier-ignore
const vertices = new Float32Array([
  -0.5, -0.5, 0,
   0.5, -0.5, 0,
   0.0,  0.5, 0,
])

const vertexBuffer = device.createBuffer({
  size: vertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})

device.queue.writeBuffer(vertexBuffer, 0, vertices)
```

```ts
const pipeline = device.createRenderPipeline({
  layout: pipelineLayout,
  vertex: {
    module: shaderModule,
    buffers: [
      {
        arrayStride: 3 * 4, // vec3<f32>
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
      },
    ],
  },
  fragment: {
    module: shaderModule,
    targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
  },
  primitive: { topology: 'triangle-list' },
})
```

## IndexBuffer

- 頂点の描画順を表すインデックスデータを格納する`GPUBuffer`
- `GPUDevice.createBuffer()`で生成する
- `GPUBufferUsage.INDEX`を指定して作成する
- `RenderPass`で`setIndexBuffer()`を呼び出してバインドする
- `drawIndexed()`実行時に使用される
- 同じ頂点を複数回参照できるため、頂点データの重複を削減できる

```ts
// prettier-ignore
const indices = new Uint16Array([
  0, 1, 2,
  0, 2, 3,
])

const indexBuffer = device.createBuffer({
  size: indices.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
})

device.queue.writeBuffer(indexBuffer, 0, indices)
```

```ts
const pass = encoder.beginRenderPass(renderPassDescriptor)
pass.setPipeline(pipeline)
pass.setVertexBuffer(0, vertexBuffer)
pass.setIndexBuffer(indexBuffer, 'uint16')
pass.drawIndexed(indices.length)
pass.end()
```

## UniformBuffer

- シェーダーで使用する読み取り専用の定数データを格納する`GPUBuffer`
- `GPUDevice.createBuffer()`で生成する
- `GPUBufferUsage.UNIFORM`を指定して作成する
- カメラ行列、変換行列、ライト情報、時間など、全頂点・全ピクセルで共通のデータを格納する
- `BindGroup`を通してシェーダーへ渡す
- WGSLでは`var<uniform>`として参照する
- レイアウトはWGSLのアラインメント・パディング規則に従う必要がある

```wgsl
struct Uniforms {
  mvpMatrix : mat4x4<f32>,
  time : f32,
}
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@vertex
fn vs(@location(0) position : vec3f) -> @builtin(position) vec4f {
  return uniforms.mvpMatrix * vec4f(position, 1.0);
}
```

```ts
// mat4x4f + f32 + padding
const uniformBufferSize = (16 + 1 + 3) * 4

const uniformData = new Float32Array(uniformBufferSize / 4)
// Viewを分割する
const matrixView = uniformData.subarray(0, 16)
const timeView = uniformData.subarray(16, 16 + 1)
// 時間を書き込む
timeView[0] = performance.now() * 0.001

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})
// GPUBufferに書き込む
device.queue.writeBuffer(uniformBuffer, 0, uniformData)
```

```ts
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    {
      binding: 0,
      resource: { buffer: uniformBuffer },
    },
  ],
})
```

## StorageBuffer

- シェーダーで使用する読み書き可能なデータを格納する`GPUBuffer`
- `GPUDevice.createBuffer()`で生成する
- `GPUBufferUsage.STORAGE`を指定して作成する
- 配列や大量のデータを格納する用途に適している
- `BindGroup`を通してシェーダーへ渡す
- WGSLでは`var<storage>`として参照する
- Vertex、Fragment、Compute Shaderから利用できる（Storage Textureなど一部リソースとは異なり、Storage Buffer自体は各ステージで利用可能）
- Compute Shaderでは特に頻繁に使用される

```wgsl
@group(0) @binding(0) var<storage, read_write> values : array<f32>;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) id: vec3u) {
  values[id.x] *= 2.0;
}
```

```ts
const data = new Float32Array([1, 2, 3, 4])

const storageBuffer = device.createBuffer({
  size: data.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(storageBuffer, 0, data)
```

```ts
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    {
      binding: 0,
      resource: { buffer: storageBuffer },
    },
  ],
})
```

## Texture

- 画像データやレンダー結果を格納するGPU上の画像リソース
- `GPUDevice.createTexture()`で生成する
- 色、深度、法線、Compute Shaderの出力など、2D・3Dデータを保持できる
- シェーダーからは通常`TextureView`を通して参照する
- `TextureView`を`BindGroup`に設定してシェーダーへ渡す
- 描画先（Render Target）としても、シェーダーから読み取るリソースとしても利用できる
- 用途に応じて`usage`を指定する

| Usage             | 説明                                |
| :---------------- | :---------------------------------- |
| TEXTURE_BINDING   | シェーダーから読み取る              |
| COPY_DST          | CPUからデータを書き込む             |
| COPY_SRC          | CPUへコピーする                     |
| RENDER_ATTACHMENT | 描画先(Render Target)として使用する |
| STORAGE_BINDING   | Storage Textureとして使用する       |

```wgsl
@group(0) @binding(0) var colorTexture : texture_2d<f32>;
@group(0) @binding(1) var colorSampler : sampler;

@fragment
fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  return textureSample(colorTexture, colorSampler, uv);
}
```

```ts
const texture = device.createTexture({
  size: [1024, 1024],
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
})
```

```ts
const textureView = texture.createView()
```

```ts
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    { binding: 0, resource: textureView },
    { binding: 1, resource: sampler },
  ],
})
```

## Sampler

- Textureの**サンプリング方法**を定義するオブジェクト
- `GPUDevice.createSampler()`で生成する
- Textureとは別オブジェクトとして管理される
- `BindGroup`を通してシェーダーへ渡す
- WGSLでは`sampler`として参照する
- Textureをどのように補間・繰り返し・比較して読み取るかを指定する
- 同じSamplerを複数のTextureで共有できる

```wgsl
@group(0) @binding(0) var colorTexture : texture_2d<f32>;
@group(0) @binding(1) var colorSampler : sampler;

@fragment
fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  return textureSample(colorTexture, colorSampler, uv);
}
```

```ts
const sampler = device.createSampler({
  // 拡大時の補間方法
  magFilter: 'linear',
  // 縮小時の補間方法
  minFilter: 'linear',
  // Mipmapの補間方法
  mipmapFilter: 'linear',
  // U方向の範囲外UVの扱い
  addressModeU: 'clamp-to-edge',
  // V方向の範囲外UVの扱い
  addressModeV: 'clamp-to-edge',
  // W方向（3D Texture）の範囲外UVの扱い
  addressModeW: 'clamp-to-edge',
})
```

```ts
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    { binding: 0, resource: textureView },
    { binding: 1, resource: sampler },
  ],
})
```

### Comparison Sampler

シャドウマッピングなどでは比較用Samplerを使用する。

```wgsl
var shadowSampler : sampler_comparison;
```

```ts
const sampler = device.createSampler({
  compare: 'less',
})
```

## RenderPassDescriptor

- 1回の描画（Render Pass）の**描画先やクリア方法**を定義するオブジェクト
- `GPUCommandEncoder.beginRenderPass()`に渡して使用する
- カラーバッファやDepth Bufferなどの**Render Attachment**を指定する
- 描画開始時のクリア色や、描画終了後の保存方法を設定する
- RenderPipelineとは独立しており、毎フレーム変更できる
- 1つのRenderPassでは、同じ描画先（Framebuffer）に対して描画を行う

```ts
const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      clearValue: [0.2, 0.2, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
  depthStencilAttachment: {
    view: depthTexture.createView(),
    depthClearValue: 1,
    depthLoadOp: 'clear',
    depthStoreOp: 'store',
  },
}
```

```ts
const encoder = device.createCommandEncoder()
const pass = encoder.beginRenderPass(renderPassDescriptor)
pass.setPipeline(pipeline)
pass.setBindGroup(0, bindGroup)
pass.draw(3)
pass.end()
device.queue.submit([encoder.finish()])
```

## CommandEncoder

- GPUへ送る**コマンドを記録（エンコード）する**オブジェクト
- `GPUDevice.createCommandEncoder()`で生成する
- Render PassやCompute Pass、Bufferコピーなどのコマンドを記録する
- 記録したコマンドは`finish()`で`GPUCommandBuffer`に変換する
- `GPUQueue.submit()`でGPUへ送信して実行する
- 1つの`CommandEncoder`には複数のRender Pass・Compute Passを記録できる
- `finish()`を呼び出した後は再利用できない

| オブジェクト       | 役割                               |
| :----------------- | :--------------------------------- |
| CommandEncoder     | GPUへ送るコマンドを記録する        |
| RenderPassEncoder  | 描画コマンドを記録する             |
| ComputePassEncoder | Compute Shaderのコマンドを記録する |
| GPUCommandBuffer   | 記録済みコマンドを保持する         |
| GPUQueue           | CommandBufferをGPUへ送信する       |

```ts
const encoder = device.createCommandEncoder();

// Compute
const computePass = encoder.beginComputePass();
...
computePass.end();

// Render
const renderPass = encoder.beginRenderPass(renderPassDescriptor);
...
renderPass.end();

const commandBuffer = encoder.finish();
device.queue.submit([commandBuffer]);
```

Bufferのコピー

```ts
encoder.copyBufferToBuffer(sourceBuffer, 0, destinationBuffer, 0, size)
```
