/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Pure helpers for listen together (protocol §4.4 / §4.6). No React Native imports; unit-tested. */

export const CLOCK_BURST_COUNT = 5
export const CLOCK_BURST_GAP_MS = 200
export const CLOCK_INTERVAL_MS = 60_000
export const CLOCK_SAMPLE_WINDOW = 5

export const HOST_HEARTBEAT_MS = 10_000
export const HOST_MIN_INTERVAL_MS = 250
export const HOST_QUEUE_THROTTLE_MS = 1000
export const QUEUE_MAX_ITEMS = 200

export const DRIFT_CHECK_MS = 5000
export const DRIFT_THRESHOLD_MS = 1500
export const SEEK_LEAD_MS = 300
export const SEEK_COOLDOWN_MS = 3000

export interface ClockSample {
  rtt: number
  offset: number
}

export const makeClockSample = (t0: number, t1: number, serverTime: number): ClockSample => ({
  rtt: t1 - t0,
  offset: serverTime - (t0 + t1) / 2,
})

/** Offset of the sample with the smallest round trip, or null when there are none. */
export const pickClockOffset = (samples: readonly ClockSample[]): number | null => {
  let best: ClockSample | null = null
  for (const sample of samples) {
    if (!Number.isFinite(sample.rtt) || sample.rtt < 0 || !Number.isFinite(sample.offset)) continue
    if (!best || sample.rtt < best.rtt) best = sample
  }
  return best ? best.offset : null
}

export const pushClockSample = (samples: readonly ClockSample[], sample: ClockSample, windowSize = CLOCK_SAMPLE_WINDOW): ClockSample[] => {
  const next = [...samples, sample]
  return next.length > windowSize ? next.slice(next.length - windowSize) : next
}

export const expectedPositionMs = (playback: {
  positionMs: number
  isPlaying: boolean
  updatedAt: number
  durationMs: number
}, serverNow: number): number => {
  let expected = playback.positionMs + (playback.isPlaying ? serverNow - playback.updatedAt : 0)
  const max = playback.durationMs > 0 ? playback.durationMs : Infinity
  if (expected < 0) expected = 0
  if (expected > max) expected = max
  return expected
}

/** True when the member should seek. `lastSeekAt` and `now` use the same local clock. */
export const shouldCorrectDrift = (localMs: number, expectedMs: number, lastSeekAt: number, now: number): boolean => {
  if (now - lastSeekAt < SEEK_COOLDOWN_MS) return false
  return Math.abs(localMs - expectedMs) > DRIFT_THRESHOLD_MS
}

export const seekTargetSeconds = (expectedMs: number): number => (expectedMs + SEEK_LEAD_MS) / 1000

/**
 * `stale`: drop the push. `apply`: next in sequence. `gap`: apply, then resync with getRoom().
 */
export type PushVersionDecision = 'stale' | 'apply' | 'gap'
export const classifyPushVersion = (lastVersion: number, pushVersion: number): PushVersionDecision => {
  if (pushVersion <= lastVersion) return 'stale'
  if (pushVersion > lastVersion + 1) return 'gap'
  return 'apply'
}

export const normalizeInviteCode = (input: string): string => input.trim().replace(/\s+/g, '')
export const isValidInviteCode = (code: string): boolean => /^[1-9]\d{5}$/.test(code)

export const isSameSong = (
  a: { id: string, source: string } | null | undefined,
  b: { id: string, source: string } | null | undefined,
): boolean => {
  if (!a || !b) return a == b
  return a.id == b.id && a.source == b.source
}

/**
 * Keep at most `max` items around `currentIndex` so the current song stays inside the window.
 */
export const windowQueue = <T>(items: readonly T[], currentIndex: number, max = QUEUE_MAX_ITEMS): T[] => {
  if (items.length <= max) return [...items]
  const before = Math.floor(max / 4)
  let start = Math.max(0, currentIndex - before)
  if (start + max > items.length) start = items.length - max
  return items.slice(start, start + max)
}

export const queueSignature = (items: ReadonlyArray<{ id: string, source: string }>, currentId: string | null): string => {
  return `${currentId ?? ''}|${items.map(item => `${item.source}:${item.id}`).join(',')}`
}
