/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { localDateReader, type TimeZone } from '../memories/calendar'
import { artistNames, songKey } from '../memories/onThisDay'
import { mergePlayRecords } from '../playHistory/merge'
import { type PlayRecord } from '../playHistory/types'
import { type ReportCardContent } from './model'

/** Same session, identity, artist and timezone rules as monthly memories. */
export const annualShareReport = (history: readonly PlayRecord[], year: number, now: number, tz?: TimeZone): Omit<ReportCardContent, 'title'> => {
  const readDate = localDateReader(tz)
  const songs = new Map<string, { name: string, singer: string, playCount: number, listenedMs: number }>()
  const artists = new Set<string>()
  let listenedMs = 0
  let playCount = 0
  for (const record of mergePlayRecords(history)) {
    if (record.startedAt > now || readDate(record.startedAt).year !== year) continue
    listenedMs += record.listenedMs
    playCount++
    artistNames(record.song.singer).forEach(name => artists.add(name))
    const key = songKey(record)
    const song = songs.get(key) ?? { name: record.song.name, singer: record.song.singer, playCount: 0, listenedMs: 0 }
    song.playCount++
    song.listenedMs += record.listenedMs
    songs.set(key, song)
  }
  const ranked = [...songs.entries()].sort(([aKey, a], [bKey, b]) => b.playCount - a.playCount || b.listenedMs - a.listenedMs || aKey.localeCompare(bKey))
  return {
    minutes: Math.round(listenedMs / 60_000),
    playCount,
    songCount: songs.size,
    artistCount: artists.size,
    topSongs: ranked.slice(0, 3).map(([, { name, singer, playCount }]) => ({ name, singer, playCount })),
  }
}
