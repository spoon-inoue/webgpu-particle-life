export function getParticleCount(defaultValue: number) {
  const params = new URL(location.href).searchParams
  const particleCount = params.get('particle-count')
  if (particleCount) {
    return Number(particleCount)
  }
  return defaultValue
}

export function getColors(defaultValue: number) {
  const params = new URL(location.href).searchParams
  const colors = params.get('colors')
  if (colors) {
    return Number(colors)
  }
  return defaultValue
}
