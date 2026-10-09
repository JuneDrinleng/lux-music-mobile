/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import {
  buildRangeStats,
  buildTodayHourlyBuckets,
  recordInBounds,
  rangeBounds,
  startOfLocalDay,
  type ChartBucket,
  type PlayRangeId,
  type RangeStats,
} from './range'
import { type PlayRecord } from './types'

const LATE_NIGHT_HOURS = new Set([0, 1, 2, 3, 4, 5, 22, 23])

export interface SourceShareRow {
  source: string
  listenedMs: number
  playCount: number
  percent: number
}

export interface ReplayAggregations {
  stats: RangeStats
  /** Twelve 2-hour slots aggregated across the selected range (by session start hour). */
  hour2Slots: ChartBucket[]
  lateNightMs: number
  /** Sunday = 0 … Saturday = 6 */
  weekdayMs: number[]
  busiestWeekday: number | null
  activeDays: number
  playCount: number
  sources: SourceShareRow[]
  periodYear: number
  periodMonth: number
  earliestStartedAt: number | null
}

const emptyWeekday = (): number[] => [0, 0, 0, 0, 0, 0, 0]

const recordsInRange = (records: readonly PlayRecord[], range: PlayRangeId, now: number): PlayRecord[] => {
  const bounds = rangeBounds(range, now)
  const selected: PlayRecord[] = []
  for (const record of records) {
    if (recordInBounds(record, bounds)) selected.push(record)
  }
  return selected
}

const buildRangeHour2Slots = (selected: readonly PlayRecord[], now: number): ChartBucket[] => {
  const template = buildTodayHourlyBuckets([], now)
  const listenedByHour = new Array<number>(12).fill(0)
  for (const record of selected) {
    const hour = new Date(record.startedAt).getHours()
    const slot = Math.floor(hour / 2)
    listenedByHour[slot] += record.listenedMs
  }
  return template.map((bucket, index) => {
    const listenedMs = listenedByHour[index]
    return {
      ...bucket,
      listenedMs,
      minutes: Math.round(listenedMs / 60_000),
    }
  })
}

const sumLateNightMs = (selected: readonly PlayRecord[]): number => {
  let total = 0
  for (const record of selected) {
    const hour = new Date(record.startedAt).getHours()
    if (LATE_NIGHT_HOURS.has(hour)) total += record.listenedMs
  }
  return total
}

const buildWeekdayMs = (selected: readonly PlayRecord[]): number[] => {
  const totals = emptyWeekday()
  for (const record of selected) {
    totals[new Date(record.startedAt).getDay()] += record.listenedMs
  }
  return totals
}

const pickBusiestWeekday = (weekdayMs: number[]): number | null => {
  let best = -1
  let bestDay: number | null = null
  weekdayMs.forEach((ms, day) => {
    if (ms > best) {
      best = ms
      bestDay = day
    }
  })
  return best > 0 ? bestDay : null
}

const countActiveDays = (selected: readonly PlayRecord[]): number => {
  const days = new Set<number>()
  for (const record of selected) {
    if (record.listenedMs > 0) days.add(startOfLocalDay(record.startedAt))
  }
  return days.size
}

const buildSourceShares = (selected: readonly PlayRecord[], totalMs: number): SourceShareRow[] => {
  const map = new Map<string, { listenedMs: number, playCount: number }>()
  for (const record of selected) {
    const key = record.song.source || 'unknown'
    const row = map.get(key)
    if (row) {
      row.listenedMs += record.listenedMs
      row.playCount += 1
    } else {
      map.set(key, { listenedMs: record.listenedMs, playCount: 1 })
    }
  }
  const rows = [...map.entries()].map(([source, row]) => ({
    source,
    listenedMs: row.listenedMs,
    playCount: row.playCount,
    percent: totalMs > 0 ? Math.round(row.listenedMs / totalMs * 100) : 0,
  }))
  rows.sort((a, b) => b.listenedMs - a.listenedMs || b.playCount - a.playCount || a.source.localeCompare(b.source))
  return rows
}

export const buildReplayAggregations = (
  records: readonly PlayRecord[],
  range: PlayRangeId,
  now: number,
): ReplayAggregations => {
  const stats = buildRangeStats(records, range, now)
  const selected = recordsInRange(records, range, now)
  const weekdayMs = buildWeekdayMs(selected)
  const date = new Date(now)
  const earliestStartedAt = records.length
    ? records.reduce((min, record) => Math.min(min, record.startedAt), records[0].startedAt)
    : null

  return {
    stats,
    hour2Slots: buildRangeHour2Slots(selected, now),
    lateNightMs: sumLateNightMs(selected),
    weekdayMs,
    busiestWeekday: pickBusiestWeekday(weekdayMs),
    activeDays: countActiveDays(selected),
    playCount: selected.length,
    sources: buildSourceShares(selected, stats.listenedMs),
    periodYear: date.getFullYear(),
    periodMonth: date.getMonth() + 1,
    earliestStartedAt,
  }
}

export const replayRhythmBuckets = (stats: RangeStats): ChartBucket[] => stats.chart
