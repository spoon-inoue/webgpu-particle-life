export function getParticleCount(defaultValue: number) {
  const params = new URL(location.href).searchParams
  const particleCount = params.get('particle-count')
  if (particleCount) {
    return Math.min(Number(particleCount), 50_000)
  }
  return defaultValue
}

export function getColors(defaultValue: number) {
  const params = new URL(location.href).searchParams
  const colors = params.get('colors')
  if (colors) {
    return Math.min(Number(colors), 7)
  }
  return defaultValue
}
