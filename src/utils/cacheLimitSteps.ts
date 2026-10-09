/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

/** Audio cache ceiling in MB. 0 turns new audio cache writes off. */
export const AUDIO_CACHE_STEPS_MB = [0, 256, 512, 1024, 2048, 4096, 8192] as const

/** Image cache ceiling in file count. */
export const IMAGE_CACHE_STEPS = [200, 400, 800, 1200, 2000] as const

export const clampUnit = (ratio: number): number => {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0
  if (ratio >= 1) return 1
  return ratio
}

/** Map a 0..1 drag position onto an equally spaced step. Ties round to the higher index. */
export const nearestCacheStepIndex = (ratio: number, count: number): number => {
  if (count <= 1) return 0
  return Math.round(clampUnit(ratio) * (count - 1))
}

export const cacheStepRatio = (index: number, count: number): number => {
  if (count <= 1) return 0
  const clamped = Math.min(count - 1, Math.max(0, index))
  return clamped / (count - 1)
}

/**
 * Thumb / tick center x on the track. Same mapping as the thumb:
 * `cacheStepRatio(i, n) × trackWidth`. See design-system-magazine §10.2.
 */
export const cacheTickCenterX = (index: number, count: number, trackWidth: number): number => {
  if (!(trackWidth > 0)) return 0
  return cacheStepRatio(index, count) * trackWidth
}

/**
 * Left edge for a tick label centered on the thumb x, clamped to track edges.
 * Do not use evenly spaced flex cells — that drifts mid-track (e.g. 1GB).
 */
export const cacheTickLabelLeft = (
  index: number,
  count: number,
  trackWidth: number,
  labelWidth: number,
): number => {
  if (!(trackWidth > 0)) return 0
  const centerX = cacheTickCenterX(index, count, trackWidth)
  if (!(labelWidth > 0)) return centerX
  if (labelWidth >= trackWidth) return 0
  const half = labelWidth / 2
  return Math.min(Math.max(0, centerX - half), trackWidth - labelWidth)
}

/**
 * Exact steps stay on their tick. A stored value outside the list (older builds)
 * displays on the nearest tick and is not rewritten until the user releases the slider.
 * Equal distance keeps the smaller step.
 */
export const indexForCacheStep = (steps: readonly number[], value: number): number => {
  const exact = steps.indexOf(value)
  if (exact >= 0) return exact
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  steps.forEach((step, index) => {
    const distance = Math.abs(step - value)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

export const cacheStepFromRatio = (steps: readonly number[], ratio: number): number => {
  if (steps.length === 0) return 0
  return steps[nearestCacheStepIndex(ratio, steps.length)]
}

export const shouldCommitCacheStep = (current: number, next: number): boolean => current !== next

/** The step to write on release. Null when the stored value is already that step. */
export const resolveCacheStepCommit = (
  steps: readonly number[],
  ratio: number,
  current: number,
): number | null => {
  if (steps.length === 0) return null
  const next = cacheStepFromRatio(steps, ratio)
  return shouldCommitCacheStep(current, next) ? next : null
}

/**
 * Compact audio label. 0 is the off copy, never "0 MB" / "0MB".
 * 256 and 512 stay in MB; whole gibibytes become 1GB, 2GB, and so on.
 */
export const formatAudioCacheLimit = (mb: number, offLabel: string): string => {
  if (!(mb > 0)) return offLabel
  if (mb % 1024 === 0) return `${mb / 1024}GB`
  return `${mb}MB`
}

/** Tick under the image slider. The 张 / 張 unit stays in the chip, not here. */
export const formatImageCacheTick = (count: number): string => String(count)
