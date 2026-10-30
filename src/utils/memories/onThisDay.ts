/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { mergePlayRecords } from '../playHistory/merge'
import { type PlayRecord } from '../playHistory/types'
import { dateKey, isLeapYear, localDateReader, type TimeZone } from './calendar'

export const songKey = (record: PlayRecord): string => JSON.stringify([record.song.source, record.song.songmid])
export const artistNames = (singer: string): string[] => [...new Set(singer.split(/[、&/;；,，|]/).map(name => name.trim()).filter(Boolean))]
export interface MemorySong {
  key: string
  song: PlayRecord['song']
  playCount: number
  listenedMs: number
  /** First recorded play in the entire retained history, not necessarily lifetime. */
  firstPlayedAt: number
  firstPlayedThatDay: boolean
}
export interface MemoryDay {
  date: string
  year: number
  yearsAgo: number
  records: PlayRecord[]
  playCount: number
  listenedMs: number
  minutes: number
  songs: MemorySong[]
  artists: Array<{ name: string, playCount: number, listenedMs: number }>
  firstPlayed: MemorySong[]
}
/** Whole sessions belong to their start date. Feb 29 anniversaries appear Feb 28 in non-leap years.
 * A Feb 29 query only matches Feb 29. Separate historical dates, newest first. */
export const onThisDay = (history: readonly PlayRecord[], now: number, tz?: TimeZone): MemoryDay[] => {
  const readDate = localDateReader(tz)
  const today = readDate(now)
  const records = mergePlayRecords(history).filter(record => record.startedAt <= now)
  const first = new Map<string, number>()
  const groups = new Map<string, PlayRecord[]>()
  for (const record of records) {
    const key = songKey(record)
    if (!first.has(key)) first.set(key, record.startedAt)
    const date = readDate(record.startedAt)
    if (date.year >= today.year) continue
    const day = date.month == 2 && date.day == 29 && !isLeapYear(today.year) ? 28 : date.day
    if (date.month != today.month || day != today.day) continue
    const dateId = dateKey(date)
    const group = groups.get(dateId) ?? []
    group.push(record)
    groups.set(dateId, group)
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([date, selected]) => {
    const songs = new Map<string, MemorySong>()
    const artists = new Map<string, { name: string, playCount: number, listenedMs: number }>()
    for (const record of selected) {
      const key = songKey(record)
      const item = songs.get(key) ?? {
        key,
        song: { ...record.song },
        playCount: 0,
        listenedMs: 0,
        firstPlayedAt: first.get(key)!,
        firstPlayedThatDay: dateKey(readDate(first.get(key)!)) == date,
      }
      item.playCount++
      item.listenedMs += record.listenedMs
      if (!item.song.img && record.song.img) item.song = { ...record.song }
      songs.set(key, item)
      for (const name of artistNames(record.song.singer)) {
        const artist = artists.get(name) ?? { name, playCount: 0, listenedMs: 0 }
        artist.playCount++
        artist.listenedMs += record.listenedMs
        artists.set(name, artist)
      }
    }
    const ranked = [...songs.values()].sort((a, b) => b.playCount - a.playCount || b.listenedMs - a.listenedMs || a.key.localeCompare(b.key))
    const listenedMs = selected.reduce((total, record) => total + record.listenedMs, 0)
    const year = readDate(selected[0].startedAt).year
    return {
      date,
      year,
      yearsAgo: today.year - year,
      records: selected,
      playCount: selected.length,
      listenedMs,
      minutes: Math.round(listenedMs / 60_000),
      songs: ranked,
      artists: [...artists.values()].sort((a, b) => b.playCount - a.playCount || b.listenedMs - a.listenedMs || a.name.localeCompare(b.name)),
      firstPlayed: ranked.filter(song => song.firstPlayedThatDay),
    }
  })
}
