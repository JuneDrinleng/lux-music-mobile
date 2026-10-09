/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type PlayRecord } from './types'

/** Rolling windows. `days7` is the last 7 local days including today, not a calendar week. */
export type PlayRangeId = 'today' | 'days7' | 'month' | 'year' | 'all'

export interface RangeBounds {
  /** Inclusive. `null` means the beginning of the history. */
  start: number | null
  /** Exclusive. */
  end: number
}

export interface RankedSong {
  key: string
  song: PlayRecord['song']
  playCount: number
  listenedMs: number
}

export interface RankedArtist {
  name: string
  playCount: number
  listenedMs: number
  fallbackImg?: string
}

/** Chart X-axis bucket for the listening-time summary. */
export type ChartBucketKind = 'hour2' | 'day' | 'month' | 'year'

export interface ChartBucket {
  start: number
  end: number
  isCurrent: boolean
  kind: ChartBucketKind
  /** `Date#getDay` when `kind` is `day`. */
  weekday: number
  /** Start hour (0, 2, …, 22) when `kind` is `hour2`. */
  hour: number
  /** 1–31 when useful for day-of-month labels. */
  dayOfMonth: number
  /** 0–11 month index. */
  month: number
  year: number
  listenedMs: number
  minutes: number
}

/** @deprecated Prefer ChartBucket; kept for older call sites during the chart rewrite. */
export interface DayBucket {
  start: number
  end: number
  isToday: boolean
  weekday: number
  listenedMs: number
  minutes: number
}

export interface RangeStats {
  bounds: RangeBounds
  previousBounds: RangeBounds | null
  listenedMs: number
  playCount: number
  previousListenedMs: number
  /** Elapsed local days in the window, used for the daily average. */
  dayCount: number
  songs: RankedSong[]
  artists: RankedArtist[]
  /** Listening-time buckets for the selected range. */
  chart: ChartBucket[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const ARTIST_SPLIT = /[、&/;；,，|]/
const HOUR2_SLOT_MS = 2 * HOUR_MS

export const startOfLocalDay = (time: number): number => {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export const startOfLocalMonth = (time: number): number => {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

export const startOfLocalYear = (time: number): number => {
  const date = new Date(time)
  return new Date(date.getFullYear(), 0, 1).getTime()
}

export const rangeBounds = (range: PlayRangeId, now: number): RangeBounds => {
  const end = startOfLocalDay(now) + DAY_MS
  if (range == 'all') return { start: null, end }
  if (range == 'today') return { start: startOfLocalDay(now), end }
  if (range == 'days7') return { start: startOfLocalDay(now) - 6 * DAY_MS, end }
  const date = new Date(now)
  if (range == 'month') return { start: new Date(date.getFullYear(), date.getMonth(), 1).getTime(), end }
  return { start: new Date(date.getFullYear(), 0, 1).getTime(), end }
}

export const previousRangeBounds = (range: PlayRangeId, now: number): RangeBounds | null => {
  const current = rangeBounds(range, now)
  if (range == 'all' || current.start == null) return null
  if (range == 'today' || range == 'days7') {
    const length = current.end - current.start
    return { start: current.start - length, end: current.start }
  }
  if (range == 'month') {
    const date = new Date(now)
    return {
      start: new Date(date.getFullYear(), date.getMonth() - 1, 1).getTime(),
      end: current.start,
    }
  }
  const date = new Date(now)
  return {
    start: new Date(date.getFullYear() - 1, 0, 1).getTime(),
    end: current.start,
  }
}

export const recordInBounds = (record: PlayRecord, bounds: RangeBounds): boolean => {
  if (record.startedAt >= bounds.end) return false
  if (bounds.start == null) return true
  return record.startedAt >= bounds.start
}

export const last7DayStarts = (now: number): number[] => {
  const today = startOfLocalDay(now)
  const starts: number[] = []
  for (let offset = 6; offset >= 0; offset -= 1) starts.push(today - offset * DAY_MS)
  return starts
}

const sumListenedInWindow = (records: readonly PlayRecord[], start: number, end: number): number => {
  let listenedMs = 0
  for (const record of records) {
    if (record.startedAt >= start && record.startedAt < end) listenedMs += record.listenedMs
  }
  return listenedMs
}

const bucketMeta = (start: number, kind: ChartBucketKind, hour = 0): Omit<ChartBucket, 'listenedMs' | 'minutes' | 'isCurrent' | 'end'> & { end: number } => {
  const date = new Date(start)
  const end = kind == 'hour2'
    ? start + HOUR2_SLOT_MS
    : kind == 'day'
      ? start + DAY_MS
      : kind == 'month'
        ? new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime()
        : new Date(date.getFullYear() + 1, 0, 1).getTime()
  return {
    start,
    end,
    kind,
    weekday: date.getDay(),
    hour,
    dayOfMonth: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear(),
  }
}

const finishBucket = (
  meta: ReturnType<typeof bucketMeta>,
  records: readonly PlayRecord[],
  isCurrent: boolean,
): ChartBucket => {
  const listenedMs = sumListenedInWindow(records, meta.start, meta.end)
  return {
    ...meta,
    isCurrent,
    listenedMs,
    minutes: Math.round(listenedMs / 60_000),
  }
}

/** Today: 12 two-hour slots (0时–22时). */
export const buildTodayHourlyBuckets = (records: readonly PlayRecord[], now: number): ChartBucket[] => {
  const todayStart = startOfLocalDay(now)
  const currentHour = new Date(now).getHours()
  const currentSlot = Math.floor(currentHour / 2) * 2
  const buckets: ChartBucket[] = []
  for (let hour = 0; hour < 24; hour += 2) {
    const start = todayStart + hour * HOUR_MS
    const meta = bucketMeta(start, 'hour2', hour)
    buckets.push(finishBucket(meta, records, hour == currentSlot))
  }
  return buckets
}

const buildDayBuckets = (starts: number[], records: readonly PlayRecord[], now: number): ChartBucket[] => {
  const today = startOfLocalDay(now)
  return starts.map((start) => {
    const meta = bucketMeta(start, 'day')
    return finishBucket(meta, records, start == today)
  })
}

const buildMonthDayBuckets = (records: readonly PlayRecord[], now: number): ChartBucket[] => {
  const monthStart = startOfLocalMonth(now)
  const today = startOfLocalDay(now)
  const starts: number[] = []
  for (let start = monthStart; start <= today; start += DAY_MS) starts.push(start)
  return buildDayBuckets(starts, records, now)
}

const buildYearMonthBuckets = (records: readonly PlayRecord[], now: number): ChartBucket[] => {
  const yearStart = startOfLocalYear(now)
  const currentMonth = startOfLocalMonth(now)
  const buckets: ChartBucket[] = []
  for (let start = yearStart; start <= currentMonth;) {
    const meta = bucketMeta(start, 'month')
    buckets.push(finishBucket(meta, records, start == currentMonth))
    start = meta.end
  }
  return buckets
}

const monthsBetween = (from: number, to: number): number => {
  const a = new Date(from)
  const b = new Date(to)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

/** All-time: per month, or per year when the span exceeds 24 months. */
export const buildAllChartBuckets = (records: readonly PlayRecord[], now: number): ChartBucket[] => {
  const currentMonth = startOfLocalMonth(now)
  const earliest = records.reduce((min, record) => Math.min(min, record.startedAt), now)
  const firstMonth = startOfLocalMonth(earliest)
  if (monthsBetween(firstMonth, currentMonth) > 24) {
    const firstYear = startOfLocalYear(earliest)
    const currentYear = startOfLocalYear(now)
    const buckets: ChartBucket[] = []
    for (let start = firstYear; start <= currentYear;) {
      const meta = bucketMeta(start, 'year')
      buckets.push(finishBucket(meta, records, start == currentYear))
      start = meta.end
    }
    return buckets
  }
  const buckets: ChartBucket[] = []
  for (let start = firstMonth; start <= currentMonth;) {
    const meta = bucketMeta(start, 'month')
    buckets.push(finishBucket(meta, records, start == currentMonth))
    start = meta.end
  }
  return buckets
}

export const buildChartBuckets = (
  records: readonly PlayRecord[],
  range: PlayRangeId,
  now: number,
): ChartBucket[] => {
  if (range == 'today') return buildTodayHourlyBuckets(records, now)
  if (range == 'days7') return buildDayBuckets(last7DayStarts(now), records, now)
  if (range == 'month') return buildMonthDayBuckets(records, now)
  if (range == 'year') return buildYearMonthBuckets(records, now)
  return buildAllChartBuckets(records, now)
}

const artistNames = (singer: string): string[] => {
  const parts = singer.split(ARTIST_SPLIT).map(name => name.trim()).filter(Boolean)
  return parts.length ? parts : (singer.trim() ? [singer.trim()] : [])
}

const dayCountFor = (range: PlayRangeId, now: number, records: readonly PlayRecord[]): number => {
  if (range == 'today') return 1
  if (range == 'days7') return 7
  if (range == 'month') return new Date(now).getDate()
  if (range == 'year') {
    const start = rangeBounds(range, now).start ?? startOfLocalDay(now)
    return Math.max(1, Math.round((startOfLocalDay(now) - start) / DAY_MS) + 1)
  }
  const earliest = records.reduce((min, record) => Math.min(min, record.startedAt), now)
  return Math.max(1, Math.round((startOfLocalDay(now) - startOfLocalDay(earliest)) / DAY_MS) + 1)
}

const sumInBounds = (records: readonly PlayRecord[], bounds: RangeBounds | null): { listenedMs: number, playCount: number } => {
  if (!bounds) return { listenedMs: 0, playCount: 0 }
  let listenedMs = 0
  let playCount = 0
  for (const record of records) {
    if (!recordInBounds(record, bounds)) continue
    listenedMs += record.listenedMs
    playCount += 1
  }
  return { listenedMs, playCount }
}

export const buildRangeStats = (records: readonly PlayRecord[], range: PlayRangeId, now: number): RangeStats => {
  const bounds = rangeBounds(range, now)
  const previousBounds = previousRangeBounds(range, now)
  const current = sumInBounds(records, bounds)
  const previous = sumInBounds(records, previousBounds)
  const songs = new Map<string, RankedSong>()
  const artists = new Map<string, RankedArtist>()
  const selected: PlayRecord[] = []

  for (const record of records) {
    if (!recordInBounds(record, bounds)) continue
    selected.push(record)
    const key = `${record.song.source}\0${record.song.songmid}`
    const existing = songs.get(key)
    if (existing) {
      existing.playCount += 1
      existing.listenedMs += record.listenedMs
      if (!existing.song.img && record.song.img) existing.song = record.song
    } else {
      songs.set(key, {
        key,
        song: record.song,
        playCount: 1,
        listenedMs: record.listenedMs,
      })
    }
    for (const name of artistNames(record.song.singer)) {
      const artist = artists.get(name)
      if (artist) {
        artist.playCount += 1
        artist.listenedMs += record.listenedMs
        if (!artist.fallbackImg && record.song.img) artist.fallbackImg = record.song.img
      } else {
        artists.set(name, {
          name,
          playCount: 1,
          listenedMs: record.listenedMs,
          fallbackImg: record.song.img,
        })
      }
    }
  }

  const rankedSongs = [...songs.values()].sort((a, b) => b.playCount - a.playCount || b.listenedMs - a.listenedMs || a.song.name.localeCompare(b.song.name))
  for (const artist of artists.values()) {
    let bestImg: string | undefined
    let bestCount = -1
    for (const song of rankedSongs) {
      if (!artistNames(song.song.singer).includes(artist.name) || !song.song.img) continue
      if (song.playCount > bestCount) {
        bestCount = song.playCount
        bestImg = song.song.img
      }
    }
    if (bestImg) artist.fallbackImg = bestImg
  }
  const rankedArtists = [...artists.values()].sort((a, b) => b.playCount - a.playCount || b.listenedMs - a.listenedMs || a.name.localeCompare(b.name))

  return {
    bounds,
    previousBounds,
    listenedMs: current.listenedMs,
    playCount: current.playCount,
    previousListenedMs: previous.listenedMs,
    dayCount: dayCountFor(range, now, selected),
    songs: rankedSongs,
    artists: rankedArtists,
    chart: buildChartBuckets(selected, range, now),
  }
}
