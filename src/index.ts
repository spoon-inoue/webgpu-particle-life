const settigs = {
  count: '5000',
  colors: '5',
  optimization: 'particle-loop',
}

addInputEvent('count')
addInputEvent('colors')
addInputEvent('optimization')

function addInputEvent(name: 'count' | 'colors' | 'optimization') {
  const inputs = document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)
  for (const input of inputs) {
    input.addEventListener('change', () => {
      settigs[name] = input.value
      updateLink()
    })
  }
}

const link = document.querySelector<HTMLAnchorElement>('main a')!

function updateLink() {
  const prefix = import.meta.env.PROD ? 'https://spoon-inoue.github.io/webgpu-particle-life/' : import.meta.env.BASE_URL
  link.href = prefix + settigs.optimization + '/?' + `particle-count=${settigs.count}&colors=${settigs.colors}`
}

updateLink()
