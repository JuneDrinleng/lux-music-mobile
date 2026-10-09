/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface Rgb {
  r: number
  g: number
  b: number
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

export const parseHex = (value: string): Rgb => {
  const raw = value.replace('#', '')
  const hex = raw.length === 3 ? raw.split('').map(part => part + part).join('') : raw.slice(0, 6)
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

export const toHex = ({ r, g, b }: Rgb): string => {
  const channel = (value: number) => clampByte(value).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export const mixHex = (from: string, to: string, amount: number): string => {
  const start = parseHex(from)
  const end = parseHex(to)
  return toHex({
    r: start.r + (end.r - start.r) * amount,
    g: start.g + (end.g - start.g) * amount,
    b: start.b + (end.b - start.b) * amount,
  })
}

export const rgbaHex = (hex: string, alpha: number): string => {
  const { r, g, b } = parseHex(hex)
  const text = Number.isInteger(alpha) ? String(alpha) : String(Math.round(alpha * 1000) / 1000)
  return `rgba(${r},${g},${b},${text})`
}

const channelLuminance = (channel: number) => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export const relativeLuminance = (hex: string): number => {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

export const contrastRatio = (foreground: string, background: string): number => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

export const readableOn = (foreground: string, background: string, minimum: number): string => {
  if (contrastRatio(foreground, background) >= minimum) return foreground
  const toward = relativeLuminance(background) > 0.45 ? '#000000' : '#ffffff'
  let current = foreground
  for (let step = 1; step <= 10; step++) {
    current = mixHex(foreground, toward, step / 10)
    if (contrastRatio(current, background) >= minimum) return current
  }
  return toward
}

interface Hsl {
  h: number
  s: number
  l: number
}

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: lightness }
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return { h: hue / 6, s: saturation, l: lightness }
}

const hueToRgb = (p: number, q: number, t: number) => {
  let channel = t
  if (channel < 0) channel += 1
  if (channel > 1) channel -= 1
  if (channel < 1 / 6) return p + (q - p) * 6 * channel
  if (channel < 1 / 2) return q
  if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6
  return p
}

const hslToHex = ({ h, s, l }: Hsl): string => {
  if (s === 0) {
    const gray = l * 255
    return toHex({ r: gray, g: gray, b: gray })
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return toHex({
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  })
}

export const shiftHue = (hex: string, degrees: number): string => {
  const hsl = rgbToHsl(parseHex(hex))
  const hue = (hsl.h + degrees / 360) % 1
  return hslToHex({ ...hsl, h: hue < 0 ? hue + 1 : hue })
}
