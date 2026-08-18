import raw from './PerformanceErrorDialog.html?raw'

export class PerformanceErrorDialog {
  private readonly dom: HTMLDialogElement

  constructor() {
    this.dom = this.append()
    this.setReturnUrl()
  }

  private append() {
    const temp = document.createElement('div')
    temp.innerHTML = raw
    document.body.append(...temp.childNodes)
    return document.querySelector<HTMLDialogElement>('dialog.performance-error-dialog')!
  }

  private setReturnUrl() {
    const link = this.dom.querySelector<HTMLAnchorElement>('a')!
    link.href = import.meta.env.PROD ? 'https://spoon-inoue.github.io/webgpu-particle-life/' : import.meta.env.BASE_URL
  }

  showModal() {
    this.dom.showModal()
  }
}
