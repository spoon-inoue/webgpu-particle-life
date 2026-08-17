import { GPUStats } from '@/modules/GPUStats'
import { Display } from './display/Display'
import { GPU } from '@/modules/GPU'
import { createResizeObserver, type ResizedSize } from '@/modules/resize'
import { Simulation } from './simulation/Simulation'

const gpu = await GPU.request('timestamp-query')
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

const simulation = new Simulation(gpu.device)
const display = new Display(gpu, canvas, simulation)

const stats = new GPUStats({ device: gpu.device, trackGPU: true, trackCPT: true })
stats.visibleGraph().setGraphLayout('bottom-right', 'horizontal')

// ===========================
// render
// ===========================

let prev: number | null = performance.now()
let step = 0

function render() {
  if (!prev) return requestAnimationFrame(render)

  const now = performance.now()
  const dt = (now - prev) / 1000
  prev = now

  stats.begin()

  const encoder = gpu.device.createCommandEncoder()

  simulation.setTimestampWrites(stats.getTimestampWrites('compute'))
  simulation.compute(encoder, step, dt)

  display.setTimestampWrites(stats.getTimestampWrites('render'))
  display.render(encoder, step)

  stats.end(encoder)

  gpu.device.queue.submit([encoder.finish()])

  stats.update()

  step++

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

// ===========================
// events
// ===========================

createResizeObserver(gpu.device, (size: ResizedSize) => {
  simulation.resize(size.client.width, size.client.height)
  display.resize(size.resolution.width, size.resolution.height)
  stats.updateGraphLayout()
}).observe(canvas)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    prev = performance.now()
  } else {
    prev = null
  }
})
