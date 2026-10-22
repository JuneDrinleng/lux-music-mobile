/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { intervalToMs } from '../playHistory/threshold'
import { type PlayRecord } from '../playHistory/types'
import { isRuleSet, type Rule, type RuleField, type RuleSet } from './model'

/** Structural subset of LX.Music.MusicInfo; accepts existing library objects directly. */
export interface LibrarySong {
  id: string
  name: string
  singer: string
  source: string
  interval: string | null
  meta: { songId: string | number, albumName: string }
}
export interface LibraryList<T extends LibrarySong> { songs: readonly T[], liked?: boolean }
export interface SongFacts<T extends LibrarySong = LibrarySong> {
  song: T
  artist: string
  title: string
  album: string
  source: string
  playCount: number
  lastPlayed: number | null
  addedDate: number | null
  liked: boolean
  duration: number | null
}
/** Provider + provider ID, never title/artist: different recordings remain distinct. */
export const songKey = (source: string, songId: string | number): string => JSON.stringify([source, String(songId)])
const musicKey = (song: LibrarySong): string => songKey(song.source, song.meta.songId)

/** Library is the candidate universe; history supplies facts, not unsaved tracks.
 * Each persisted play record represents a counted play (the tracker applies its threshold).
 * addedDates is optional because legacy library songs have no per-song added timestamp.
 */
const buildFactsSteps = function * <T extends LibrarySong>(lists: ReadonlyArray<LibraryList<T>>, history: readonly PlayRecord[], addedDates: ReadonlyMap<string, number> = new Map()): Generator<void, Array<SongFacts<T>>, void> {
  yield
  let processed = 0
  const facts = new Map<string, SongFacts<T>>()
  for (const list of lists) {
    for (const song of list.songs) {
      if (++processed % 100 == 0) yield
      const key = musicKey(song)
      const existing = facts.get(key)
      if (existing) { existing.liked ||= !!list.liked; continue }
      const added = addedDates.get(key)
      const ms = intervalToMs(song.interval)
      facts.set(key, {
        song,
        artist: song.singer,
        title: song.name,
        album: song.meta.albumName,
        source: song.source,
        playCount: 0,
        lastPlayed: null,
        liked: !!list.liked,
        addedDate: added != null && Number.isFinite(added) && added >= 0 ? added : null,
        duration: ms == null ? null : ms / 1000,
      })
    }
  }
  const seen = new Set<string>()
  for (const record of history) {
    if (++processed % 100 == 0) yield
    if (seen.has(record.id) || !Number.isFinite(record.startedAt) || record.startedAt < 0) continue
    seen.add(record.id)
    const fact = facts.get(songKey(record.song.source, record.song.songmid))
    if (!fact) continue
    fact.playCount++
    fact.lastPlayed = Math.max(fact.lastPlayed ?? 0, record.startedAt)
  }
  return [...facts.values()]
}
const drain = <T>(steps: Generator<void, T, void>): T => {
  let step = steps.next()
  while (!step.done) step = steps.next()
  return step.value
}
export const runStepsAsync = async<T>(steps: Generator<void, T, void>, check: () => void = () => {}): Promise<T> => {
  for (;;) {
    check()
    const step = steps.next()
    if (step.done) return step.value
    await new Promise<void>(resolve => { setTimeout(resolve, 0) })
  }
}
export const buildSongFacts = <T extends LibrarySong>(...args: Parameters<typeof buildFactsSteps<T>>) => drain(buildFactsSteps(...args))
export const buildSongFactsAsync = async<T extends LibrarySong>(lists: ReadonlyArray<LibraryList<T>>, history: readonly PlayRecord[], check?: () => void) => runStepsAsync(buildFactsSteps(lists, history), check)
const normalize = (value: string): string => value.normalize('NFKC').trim().toLowerCase()
export const matchesRule = (fact: SongFacts, rule: Rule, now: number): boolean => {
  const actual = fact[rule.field]
  // Missing dates/durations never satisfy even a negative comparison.
  if (actual == null) return false
  const expected = rule.value
  if (typeof actual == 'string' && typeof expected == 'string') {
    const a = normalize(actual)
    const b = normalize(expected)
    switch (rule.operator) {
      case 'equals': return a == b
      case 'notEquals': return a != b
      case 'contains': return a.includes(b)
      case 'notContains': return !a.includes(b)
      default: return false
    }
  }
  if (rule.operator == 'equals') return actual === expected
  if (rule.operator == 'notEquals') return actual !== expected
  if (typeof actual != 'number' || typeof expected != 'number') return false
  switch (rule.operator) {
    case 'gt': case 'after': return actual > expected
    case 'gte': return actual >= expected
    case 'lt': case 'before': return actual < expected
    case 'lte': return actual <= expected
    case 'withinDays': return actual <= now && actual >= now - expected * 86_400_000
    case 'notWithinDays': return actual <= now && actual < now - expected * 86_400_000
    default: return false
  }
}
/** Synchronous pure evaluation for snapshots. A future refresh service must batch/yield its work. */
const evaluateSteps = function * <T extends LibrarySong>(facts: ReadonlyArray<SongFacts<T>>, ruleSet: RuleSet, now: number): Generator<void, { songs: T[], matchCount: number }, void> {
  if (!isRuleSet(ruleSet) || !Number.isFinite(now)) throw new Error('Invalid smart playlist rules or clock')
  yield
  let matches: Array<SongFacts<T>> = []
  let processed = 0
  for (const fact of facts) {
    if (++processed % 50 == 0) yield
    if (!ruleSet.rules.length || (ruleSet.match == 'all'
      ? ruleSet.rules.every(rule => matchesRule(fact, rule, now))
      : ruleSet.rules.some(rule => matchesRule(fact, rule, now)))) matches.push(fact)
  }
  const { field, direction } = ruleSet.sort
  const compare = (a: SongFacts<T>, b: SongFacts<T>) => {
    const left = a[field as RuleField]
    const right = b[field as RuleField]
    if (left == null) return right == null ? 0 : 1
    if (right == null) return -1
    const l = typeof left == 'string' ? normalize(left) : left
    const r = typeof right == 'string' ? normalize(right) : right
    return (l < r ? -1 : l > r ? 1 : 0) * (direction == 'asc' ? 1 : -1)
  }
  // Stable bottom-up merge sort: yield during comparisons, never one giant native sort.
  if (field != 'library') {
    for (let width = 1; width < matches.length; width *= 2) {
      const sorted: Array<SongFacts<T>> = []
      for (let start = 0; start < matches.length; start += width * 2) {
        let a = start
        let b = Math.min(start + width, matches.length)
        const endA = b
        const endB = Math.min(start + width * 2, matches.length)
        while (a < endA || b < endB) {
          if (++processed % 100 == 0) yield
          sorted.push(b >= endB || (a < endA && compare(matches[a], matches[b]) <= 0) ? matches[a++] : matches[b++])
        }
      }
      matches = sorted
    }
  }
  const songs: T[] = []
  const count = Math.min(matches.length, ruleSet.limit ?? matches.length)
  for (let i = 0; i < count; i++) {
    if (++processed % 100 == 0) yield
    songs.push(matches[field == 'library' && direction == 'desc' ? matches.length - 1 - i : i].song)
  }
  return { matchCount: matches.length, songs }
}
export const evaluateRules = <T extends LibrarySong>(facts: ReadonlyArray<SongFacts<T>>, rules: RuleSet, now: number) => drain(evaluateSteps(facts, rules, now))
export const evaluateRulesAsync = async<T extends LibrarySong>(facts: ReadonlyArray<SongFacts<T>>, rules: RuleSet, now: number, check?: () => void) => runStepsAsync(evaluateSteps(facts, rules, now), check)
