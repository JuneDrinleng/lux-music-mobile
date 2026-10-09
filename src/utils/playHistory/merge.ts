/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type PlayHistorySong, type PlayRecord } from './types'

const isSong = (value: unknown): value is PlayHistorySong => {
  if (!value || typeof value != 'object') return false
  const song = value as PlayHistorySong
  return typeof song.source == 'string' && song.source.length > 0 &&
    typeof song.songmid == 'string' && song.songmid.length > 0 &&
    typeof song.name == 'string' &&
    typeof song.singer == 'string'
}

export const isPlayRecord = (value: unknown): value is PlayRecord => {
  if (!value || typeof value != 'object') return false
  const record = value as PlayRecord
  return typeof record.id == 'string' && record.id.length > 0 &&
    typeof record.deviceId == 'string' && record.deviceId.length > 0 &&
    typeof record.startedAt == 'number' && Number.isFinite(record.startedAt) &&
    typeof record.endedAt == 'number' && Number.isFinite(record.endedAt) &&
    typeof record.listenedMs == 'number' && Number.isFinite(record.listenedMs) && record.listenedMs >= 0 &&
    isSong(record.song)
}

const preferRecord = (current: PlayRecord, incoming: PlayRecord): PlayRecord => {
  if (incoming.listenedMs > current.listenedMs) return incoming
  if (incoming.listenedMs == current.listenedMs && incoming.endedAt > current.endedAt) return incoming
  return current
}

/** Full merge by `id`. The copy that heard more of the session wins. Nothing else is dropped. */
export const mergePlayRecords = (...groups: Array<readonly PlayRecord[] | null | undefined>): PlayRecord[] => {
  const merged = new Map<string, PlayRecord>()
  for (const group of groups) {
    if (!group) continue
    for (const record of group) {
      if (!isPlayRecord(record)) continue
      const previous = merged.get(record.id)
      merged.set(record.id, previous ? preferRecord(previous, record) : record)
    }
  }
  return [...merged.values()].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
}
