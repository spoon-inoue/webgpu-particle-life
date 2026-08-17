import Stats from 'stats-gl'

type StatsOptions = {
  device: GPUDevice
  trackFPS?: boolean
  trackGPU?: boolean
  trackCPT?: boolean
  trackHz?: boolean
}

type GraphPostion = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type GraphAlign = 'horizontal' | 'vertical'
type GraphLayout = {
  position: GraphPostion
  align: GraphAlign
}

export class GPUStats extends Stats {
  private graphLayout: GraphLayout = {
    position: 'top-left',
    align: 'horizontal',
  }

  constructor(options: StatsOptions) {
    super(options)
    this.init(options.device)
  }

  visibleGraph() {
    document.body.appendChild(this.dom)
    return this
  }

  setGraphLayout(position: GraphPostion, align: GraphAlign) {
    this.graphLayout = { position, align }
    this.updateGraphLayout()
    return this
  }

  updateGraphLayout() {
    const { position, align } = this.graphLayout

    // clear
    this.dom.style.top = 'auto'
    this.dom.style.bottom = 'auto'
    this.dom.style.left = 'auto'
    this.dom.style.right = 'auto'
    this.dom.style.display = 'auto'

    if (position === 'top-left') {
      this.dom.style.top = '0'
      this.dom.style.left = '0'
    } else if (position === 'top-right') {
      this.dom.style.top = '0'
      this.dom.style.right = '0'
    } else if (position === 'bottom-left') {
      this.dom.style.bottom = '0'
      this.dom.style.left = '0'
    } else if (position === 'bottom-right') {
      this.dom.style.bottom = '0'
      this.dom.style.right = '0'
    }

    if (align === 'horizontal') {
      this.dom.style.display = 'flex'
    }

    this.dom.querySelectorAll<HTMLCanvasElement>('canvas').forEach((canvas) => {
      canvas.style.position = 'relative'
      canvas.style.left = 'auto'
    })
  }
}
