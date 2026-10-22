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
export const buildSongFacts = <T extends LibrarySong>(lists: ReadonlyArray<LibraryList<T>>, history: readonly PlayRecord[], addedDates: ReadonlyMap<string, number> = new Map()): Array<SongFacts<T>> => {
  const facts = new Map<string, SongFacts<T>>()
  for (const list of lists) {
    for (const song of list.songs) {
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
    if (seen.has(record.id) || !Number.isFinite(record.startedAt) || record.startedAt < 0) continue
    seen.add(record.id)
    const fact = facts.get(songKey(record.song.source, record.song.songmid))
    if (!fact) continue
    fact.playCount++
    fact.lastPlayed = Math.max(fact.lastPlayed ?? 0, record.startedAt)
  }
  return [...facts.values()]
}
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
export const evaluateRules = <T extends LibrarySong>(facts: ReadonlyArray<SongFacts<T>>, ruleSet: RuleSet, now: number): { songs: T[], matchCount: number } => {
  if (!isRuleSet(ruleSet) || !Number.isFinite(now)) throw new Error('Invalid smart playlist rules or clock')
  const matches = facts.filter(fact => !ruleSet.rules.length || (ruleSet.match == 'all'
    ? ruleSet.rules.every(rule => matchesRule(fact, rule, now))
    : ruleSet.rules.some(rule => matchesRule(fact, rule, now))))
  const { field, direction } = ruleSet.sort
  if (field != 'library') {
    matches.sort((a, b) => {
      const left = a[field as RuleField]
      const right = b[field as RuleField]
      // Unknown values stay last in both directions; stable sort keeps library order on ties.
      if (left == null) return right == null ? 0 : 1
      if (right == null) return -1
      const l = typeof left == 'string' ? normalize(left) : left
      const r = typeof right == 'string' ? normalize(right) : right
      return (l < r ? -1 : l > r ? 1 : 0) * (direction == 'asc' ? 1 : -1)
    })
  } else if (direction == 'desc') matches.reverse()
  return { matchCount: matches.length, songs: matches.slice(0, ruleSet.limit).map(fact => fact.song) }
}
