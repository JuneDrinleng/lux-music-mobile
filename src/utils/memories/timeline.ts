/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type PlayRecord } from '../playHistory/types'
import { dateKey, localDateReader, type TimeZone } from './calendar'
import { type Milestone, type MilestoneState, milestoneProgress } from './milestones'
import { monthAt, monthIndex, monthlyReport } from './monthly'
import { type MemoryDay, onThisDay } from './onThisDay'

export type MemoryTimelineEntry =
  | { id: string, kind: 'anniversary', date: string, memory: MemoryDay }
  | { id: string, kind: 'milestone', date: string, milestone: Milestone }
  | { id: string, kind: 'monthly', date: string, report: ReturnType<typeof monthlyReport> }

/** Ignoring a progress row suppresses it; a previously achieved event remains in history. */
export const visibleMilestones = (history: readonly PlayRecord[], state: MilestoneState, tz?: TimeZone): Milestone[] => {
  const items = new Map(milestoneProgress(history, tz).map(item => [item.id, item]))
  for (const item of Object.values(state.achieved)) items.set(item.id, item)
  return [...items.values()].filter(item => !state.ignored.includes(item.id) || !!state.achieved[item.id])
}

export const groupMemoryTimeline = (entries: readonly MemoryTimelineEntry[]) => {
  const groups = new Map<string, MemoryTimelineEntry[]>()
  for (const entry of [...entries].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))) {
    const group = groups.get(entry.date) ?? []
    group.push(entry)
    groups.set(entry.date, group)
  }
  return [...groups].map(([date, items]) => ({ date, items }))
}

/** Monthly events occur on the first local calendar day after a completed report month. */
export const buildMemoryTimeline = (history: readonly PlayRecord[], state: MilestoneState, now: number, tz?: TimeZone) => {
  const readDate = localDateReader(tz)
  const today = readDate(now)
  const retained = history.filter(record => record.startedAt <= now)
  const entries: MemoryTimelineEntry[] = onThisDay(retained, now, tz).map(memory => ({
    id: `anniversary:${memory.date}`, kind: 'anniversary', date: dateKey(today), memory,
  }))
  for (const milestone of Object.values(state.achieved)) {
    if (milestone.reachedAt == null || milestone.reachedAt > now) continue
    entries.push({ id: `milestone:${milestone.id}`, kind: 'milestone', date: dateKey(readDate(milestone.reachedAt)), milestone })
  }
  const months = new Set(retained.map(record => monthIndex(readDate(record.startedAt))))
  for (const index of months) {
    if (index >= monthIndex(today)) continue
    entries.push({
      id: `monthly:${index}`,
      kind: 'monthly',
      date: dateKey({ ...monthAt(index + 1), day: 1 }),
      report: monthlyReport(retained, monthAt(index), now, tz),
    })
  }
  return groupMemoryTimeline(entries)
}
