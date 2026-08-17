/**
 * hsv to rgb
 * @param h 0 ~ 360
 * @param s 0 ~ 1
 * @param v 0 ~ 1
 * @returns [0 ~ 1, 0 ~ 1, 0 ~ 1]
 */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360

  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return [r + m, g + m, b + m]
}

/**
 * rgb to hsv
 * @param r 0 ~ 1
 * @param g 0 ~ 1
 * @param b 0 ~ 1
 * @returns [0 ~ 360, 0 ~ 1, 0 ~ 1]
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0

  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2)
    } else {
      h = 60 * ((r - g) / delta + 4)
    }
  }

  if (h < 0) {
    h += 360
  }

  const s = max === 0 ? 0 : delta / max
  const v = max

  return [h, s, v]
}
