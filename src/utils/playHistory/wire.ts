/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { isPlayRecord } from './merge'
import { type PlayHistorySong, type PlayRecord } from './types'

/**
 * message2call method paths. Each name is one path segment.
 * Called on the server remote after `finished()`.
 */
export const PLAY_HISTORY_PUSH = 'playHistory:push' as const
export const PLAY_HISTORY_PULL = 'playHistory:pull' as const

/** Server rejects the whole batch when any record is invalid, and caps a batch at 500. */
export const PLAY_HISTORY_BATCH = 500

const LIMITS = {
  id: 160,
  deviceId: 128,
  source: 64,
  songmid: 256,
  name: 512,
  singer: 512,
  albumName: 512,
  interval: 64,
  img: 2048,
} as const

const boundedString = (value: unknown, max: number, allowEmpty: boolean): string | null => {
  if (typeof value != 'string') return null
  if (!allowEmpty && value.length == 0) return null
  if (value.length > max) return null
  return value
}

const safeInt = (value: unknown): number | null => {
  if (typeof value != 'number' || !Number.isSafeInteger(value) || value < 0) return null
  return value
}

/**
 * A record the server will accept. Invalid rows are dropped here so one bad
 * local row cannot reject the rest of the batch. Optional fields that fail
 * their limit drop the row rather than sending a rewritten song.
 */
export const toWireRecord = (value: unknown): PlayRecord | null => {
  if (!isPlayRecord(value)) return null
  const deviceId = boundedString(value.deviceId, LIMITS.deviceId, false)
  const startedAt = safeInt(value.startedAt)
  const endedAt = safeInt(value.endedAt)
  const listenedMs = safeInt(value.listenedMs)
  const id = boundedString(value.id, LIMITS.id, false)
  if (!deviceId || startedAt == null || endedAt == null || listenedMs == null || !id) return null
  if (id != `${deviceId}:${startedAt}`) return null
  const source = boundedString(value.song.source, LIMITS.source, false)
  const songmid = boundedString(value.song.songmid, LIMITS.songmid, false)
  const name = boundedString(value.song.name, LIMITS.name, true)
  const singer = boundedString(value.song.singer, LIMITS.singer, true)
  if (!source || !songmid || name == null || singer == null) return null
  const song: PlayHistorySong = { source, songmid, name, singer }
  if (value.song.albumName != null) {
    const albumName = boundedString(value.song.albumName, LIMITS.albumName, true)
    if (albumName == null) return null
    song.albumName = albumName
  }
  if (value.song.interval != null) {
    const interval = boundedString(value.song.interval, LIMITS.interval, true)
    if (interval == null) return null
    song.interval = interval
  }
  if (value.song.img != null) {
    const img = boundedString(value.song.img, LIMITS.img, true)
    if (img == null) return null
    song.img = img
  }
  return { id, deviceId, startedAt, endedAt, listenedMs, song }
}

export const chunkWireRecords = (records: readonly unknown[]): PlayRecord[][] => {
  const wire: PlayRecord[] = []
  for (const record of records) {
    const next = toWireRecord(record)
    if (next) wire.push(next)
  }
  const chunks: PlayRecord[][] = []
  for (let index = 0; index < wire.length; index += PLAY_HISTORY_BATCH) {
    chunks.push(wire.slice(index, index + PLAY_HISTORY_BATCH))
  }
  return chunks
}
