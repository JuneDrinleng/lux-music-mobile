/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { mergePlayRecords } from '../playHistory/merge'
import { type PlayRecord } from '../playHistory/types'
import { dayOrdinal, localDateReader, type TimeZone } from './calendar'
import { artistNames, songKey } from './onThisDay'

/** Only thresholds explicitly shown by 5B/5C; artist hours apply separately to each named artist. */
export const milestoneDefinitions = [
  { kind: 'uniqueSongs', threshold: 1000, textKey: 'memories_milestone_unique_songs' },
  { kind: 'streak', threshold: 30, textKey: 'memories_milestone_streak' },
  { kind: 'artistHours', threshold: 100, textKey: 'memories_milestone_artist_hours' },
] as const
export type MilestoneKind = typeof milestoneDefinitions[number]['kind']
export interface Milestone {
  id: string
  kind: MilestoneKind
  textKey: typeof milestoneDefinitions[number]['textKey']
  threshold: number
  value: number
  progress: number
  remaining: number
  artist?: string
  reachedAt?: number
  song?: PlayRecord['song']
}
export interface MilestoneState {
  version: 1
  achieved: Record<string, Milestone>
  ignored: string[]
}
export const emptyMilestoneState = (): MilestoneState => ({ version: 1, achieved: {}, ignored: [] })
export const artistMilestoneId = (artist: string): string => `artistHours:100:${encodeURIComponent(artist)}`
/** Historical maximum streak; completed achievements survive gaps and subsequent imports. */
export const milestoneProgress = (history: readonly PlayRecord[], tz?: TimeZone): Milestone[] => {
  const readDate = localDateReader(tz)
  const make = (kind: MilestoneKind, id: string, artist?: string): Milestone => {
    const definition = milestoneDefinitions.find(item => item.kind == kind)!
    return { ...definition, id, value: 0, progress: 0, remaining: definition.threshold, artist }
  }
  const unique = make('uniqueSongs', 'uniqueSongs:1000')
  const streak = make('streak', 'streak:30')
  const artists = new Map<string, Milestone>()
  const seen = new Set<string>()
  let lastDay: number | undefined
  let run = 0
  const reach = (item: Milestone, record: PlayRecord) => {
    if (item.value >= item.threshold && item.reachedAt == null) {
      item.reachedAt = record.startedAt
      item.song = { ...record.song }
    }
  }
  for (const record of mergePlayRecords(history)) {
    seen.add(songKey(record))
    unique.value = seen.size
    reach(unique, record)
    const day = dayOrdinal(readDate(record.startedAt))
    if (day != lastDay) {
      run = lastDay != null && day == lastDay + 1 ? run + 1 : 1
      lastDay = day
      streak.value = Math.max(streak.value, run)
      reach(streak, record)
    }
    for (const name of artistNames(record.song.singer)) {
      const item = artists.get(name) ?? make('artistHours', artistMilestoneId(name), name)
      // Accumulate integer milliseconds to avoid rounding across the threshold.
      item.value += record.listenedMs
      if (item.value >= item.threshold * 3_600_000 && item.reachedAt == null) {
        item.reachedAt = record.startedAt
        item.song = { ...record.song }
      }
      artists.set(name, item)
    }
  }
  return [unique, streak, ...[...artists.values()].sort((a, b) => a.id.localeCompare(b.id))].map(item => {
    const value = item.kind == 'artistHours' ? item.value / 3_600_000 : item.value
    return { ...item, value, progress: Math.min(1, value / item.threshold), remaining: Math.max(0, item.threshold - value) }
  })
}
/** Pure: persist the returned state before displaying newlyReached. */
export const evaluate = (history: readonly PlayRecord[], state: MilestoneState, tz?: TimeZone): { newlyReached: Milestone[], state: MilestoneState } => {
  const newlyReached = milestoneProgress(history, tz).filter(item => item.reachedAt != null &&
    !Object.prototype.hasOwnProperty.call(state.achieved, item.id) && !state.ignored.includes(item.id))
  return {
    newlyReached,
    state: { version: 1, achieved: { ...state.achieved, ...Object.fromEntries(newlyReached.map(item => [item.id, item])) }, ignored: [...state.ignored] },
  }
}
