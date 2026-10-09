/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/**
 * One playback session. `listenedMs` is audio that actually advanced.
 * Pauses contribute nothing. A position jump outside 0.2x–4.5x wall time is a seek and is dropped.
 * The rate window covers the player's 0.25x–4x speeds without treating a scrub as listening.
 */
export interface ListenSession {
  startedAt: number
  listenedMs: number
  lastAt: number | null
  lastPositionMs: number | null
  playing: boolean
}

const MIN_RATE = 0.2
const MAX_RATE = 4.5
const MIN_WALL_MS = 40

export const createListenSession = (startedAt: number): ListenSession => ({
  startedAt,
  listenedMs: 0,
  lastAt: null,
  lastPositionMs: null,
  playing: false,
})

export const sampleListenSession = (
  session: ListenSession,
  at: number,
  positionMs: number,
  playing: boolean,
): ListenSession => {
  const next: ListenSession = {
    ...session,
    lastAt: at,
    lastPositionMs: positionMs,
    playing,
  }
  if (!playing || !session.playing || session.lastAt == null || session.lastPositionMs == null) return next
  const wall = at - session.lastAt
  const pos = positionMs - session.lastPositionMs
  if (wall < MIN_WALL_MS || pos < 0) return next
  const rate = pos / wall
  if (rate < MIN_RATE || rate > MAX_RATE) return next
  next.listenedMs = session.listenedMs + pos
  return next
}
