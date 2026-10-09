/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** A play counts at 30 seconds, or sooner when the track is shorter than a minute. */
export const PLAY_COUNT_LIMIT_MS = 30_000

export const intervalToMs = (interval: string | null | undefined): number | null => {
  if (!interval) return null
  const matched = /^(\d+):(\d{1,2})$/.exec(interval.trim())
  if (!matched) return null
  const minutes = Number(matched[1])
  const seconds = Number(matched[2])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null
  const ms = (minutes * 60 + seconds) * 1000
  return ms > 0 ? ms : null
}

/**
 * Threshold is the shorter of 30s and half the track.
 * Unknown or empty duration falls back to 30s so a missing length cannot count a glance.
 */
export const playCountThresholdMs = (durationMs: number | null | undefined): number => {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) return PLAY_COUNT_LIMIT_MS
  return Math.min(PLAY_COUNT_LIMIT_MS, durationMs / 2)
}

export const qualifiesAsPlay = (listenedMs: number, durationMs: number | null | undefined): boolean => {
  if (!Number.isFinite(listenedMs) || listenedMs <= 0) return false
  return listenedMs >= playCountThresholdMs(durationMs)
}
