/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/**
 * Listening duration helpers. Magazine rule: always whole minutes, never hours
 * (docs/design-system-magazine.md §10.10).
 */

/** Floor milliseconds to a non-negative whole-minute count. */
export const minutesFromMs = (ms: number): number => {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.floor(ms / 60_000)
}

/**
 * Format a minute count with thousands separators (e.g. 1240 → `"1,240"`).
 * Accepts either a minute count or raw milliseconds when `fromMs` is true.
 */
export const formatMinutes = (value: number, fromMs = false): string => {
  const minutes = fromMs ? minutesFromMs(value) : (
    !Number.isFinite(value) || value <= 0 ? 0 : Math.floor(value)
  )
  return minutes.toLocaleString('en-US')
}
