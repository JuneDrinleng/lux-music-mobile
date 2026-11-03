/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Fixed-duration interpolation: work does not grow with the target count. */
export const COUNT_ROLL_MS = 760
export const STAGGER_GAP_MS = 40
export const STAGGER_ROW_MS = 320
export const STAGGER_LIMIT = 12

export const interpolateCount = (from: number, to: number, progress: number) => {
  const clamped = Math.max(0, Math.min(1, progress))
  const eased = 1 - Math.pow(1 - clamped, 3)
  return Math.round(from + (to - from) * eased)
}

export const staggerWindow = (index: number) => {
  if (index < 0 || index >= STAGGER_LIMIT) return null
  const start = index * STAGGER_GAP_MS
  return { start, end: start + STAGGER_ROW_MS }
}
