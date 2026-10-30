/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { mergePlayRecords } from '../playHistory/merge'
import { type PlayRecord } from '../playHistory/types'
import { localDateReader, type TimeZone } from './calendar'
import { artistNames, songKey } from './onThisDay'

export interface ReportMonth { year: number, month: number }
export const monthIndex = ({ year, month }: ReportMonth): number => year * 12 + month - 1
export const monthAt = (index: number): ReportMonth => ({ year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 })
export interface MonthlySong {
  key: string
  song: PlayRecord['song']
  playCount: number
  listenedMs: number
  firstPlayedAt: number
}
/** Bounds include empty gaps, but never future months. Empty history stays on the current month. */
export const monthlyBounds = (history: readonly PlayRecord[], now: number, tz?: TimeZone) => {
  const readDate = localDateReader(tz)
  const max = monthIndex(readDate(now))
  const records = mergePlayRecords(history).filter(record => record.startedAt <= now)
  const min = records.length ? monthIndex(readDate(records[0].startedAt)) : max
  return { min, max }
}
export const switchReportMonth = (current: ReportMonth, offset: number, bounds: { min: number, max: number }): ReportMonth =>
  monthAt(Math.max(bounds.min, Math.min(bounds.max, monthIndex(current) + offset)))

/** Pure aggregation of one data space's retained history. Entire sessions belong to their local start day.
 * Calendar dates (not fixed 24-hour steps) preserve every day across DST changes.
 * Ranking ties use duration, then source/song identity, independent of input order.
 */
export const monthlyReport = (history: readonly PlayRecord[], selected: ReportMonth, now: number, tz?: TimeZone) => {
  const readDate = localDateReader(tz)
  const records = mergePlayRecords(history).filter(record => record.startedAt <= now)
  const index = monthIndex(selected)
  const days = Array.from({ length: new Date(Date.UTC(selected.year, selected.month, 0)).getUTCDate() }, (_, i) => ({ day: i + 1, listenedMs: 0, playCount: 0 }))
  const hours = Array<number>(24).fill(0)
  const hourReader = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' })
  const first = new Map<string, number>()
  const songs = new Map<string, MonthlySong>()
  const artists = new Set<string>()
  let listenedMs = 0
  let previousListenedMs = 0
  let playCount = 0
  for (const record of records) {
    const key = songKey(record)
    if (!first.has(key)) first.set(key, record.startedAt)
    const date = readDate(record.startedAt)
    const recordMonth = monthIndex(date)
    if (recordMonth == index - 1) previousListenedMs += record.listenedMs
    if (recordMonth != index) continue
    listenedMs += record.listenedMs
    playCount++
    days[date.day - 1].listenedMs += record.listenedMs
    days[date.day - 1].playCount++
    const hour = Number(hourReader.formatToParts(record.startedAt).find(part => part.type == 'hour')?.value)
    hours[hour] += record.listenedMs
    artistNames(record.song.singer).forEach(name => artists.add(name))
    const song = songs.get(key) ?? { key, song: { ...record.song }, playCount: 0, listenedMs: 0, firstPlayedAt: first.get(key)! }
    song.playCount++
    song.listenedMs += record.listenedMs
    if (!song.song.img && record.song.img) song.song = { ...record.song }
    songs.set(key, song)
  }
  const ranked = [...songs.values()].sort((a, b) => b.playCount - a.playCount || b.listenedMs - a.listenedMs || a.key.localeCompare(b.key))
  const discoveries = ranked.filter(song => monthIndex(readDate(song.firstPlayedAt)) == index)
  const peak = days.reduce((best, day) => day.listenedMs > best.listenedMs ? day : best)
  return {
    ...selected,
    listenedMs,
    minutes: Math.round(listenedMs / 60_000),
    previousListenedMs,
    // A percentage with a zero denominator is undefined; the UI explicitly labels this case.
    changePercent: previousListenedMs ? Math.round((listenedMs - previousListenedMs) / previousListenedMs * 100) : listenedMs ? null : 0,
    playCount,
    songCount: songs.size,
    artistCount: artists.size,
    peakHour: playCount ? hours.indexOf(Math.max(...hours)) : null,
    days,
    peakDay: peak.listenedMs ? peak : null,
    topSongs: ranked.slice(0, 3),
    discoveries,
  }
}
