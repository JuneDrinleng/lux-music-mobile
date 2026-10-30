/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { artistNames, songKey } from '../memories/onThisDay'
import { mergePlayRecords } from '../playHistory/merge'
import { type Candidate, type RankOptions, type Recommendation, type Song } from './types'

const normalize = (value: string): string => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
export const artists = (song: Song): string[] => [...new Set(artistNames(song.singer).map(normalize))].sort()
/** Reuse the history identity for exact matches; conservative title + artist identity
 * unifies providers without stripping live/remix/version suffixes. */
export const exactKey = (song: Song): string => songKey({ song, id: '', deviceId: '', startedAt: 0, endedAt: 0, listenedMs: 0 })
export const contentKey = (song: Song): string => song.name.trim() && artists(song).length
  ? JSON.stringify([normalize(song.name), artists(song)]) : exactKey(song)
export const sameSong = (a: Song, b: Song): boolean => exactKey(a) == exactKey(b) || contentKey(a) == contentKey(b)

export const seededRandom = (seed: string): (() => number) => {
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619)
  return () => {
    state += 0x6D2B79F5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Pure, order-independent ranking. Repeat windows are hard exclusions, even for small pools. */
function * rankSteps(candidates: readonly Candidate[], opts: RankOptions): Generator<void, Recommendation[]> {
  yield
  const history = mergePlayRecords(opts.history).filter(record => record.startedAt <= opts.now)
  const blocked = [...(opts.exclude ?? [])]
  for (const record of history) {
    if (opts.now - record.startedAt < (opts.recentPlayMs ?? 6 * 3_600_000)) blocked.push(record.song)
  }
  for (const item of opts.recommended ?? []) {
    if (item.at <= opts.now && opts.now - item.at < (opts.recentRecommendationMs ?? 3 * 86_400_000)) blocked.push(item.song)
  }
  if (opts.anchor) blocked.push(opts.anchor)
  const affinity = new Map<string, number>()
  let processed = 0
  for (const record of history) {
    if (++processed % 100 == 0) yield
    const age = Math.max(0, opts.now - record.startedAt) / 86_400_000
    const weight = (record.skipped ? -2 : record.completed ? 2 : 1) / (1 + age / 30)
    for (const artist of artists(record.song)) affinity.set(artist, (affinity.get(artist) ?? 0) + weight)
  }
  // Stable representative: complete music metadata first, then local provenance, then exact identity.
  const sorted = [...candidates].sort((a, b) => Number(!!b.musicInfo) - Number(!!a.musicInfo) ||
    Number(b.origin == 'library') - Number(a.origin == 'library') || exactKey(a.song).localeCompare(exactKey(b.song)) || a.origin.localeCompare(b.origin))
  // Index both identities. Union roots preserve transitive provider duplicates without
  // scanning every existing group for every candidate (which blocked Home's JS thread).
  const identities = new WeakMap<Song, string[]>()
  const keys = (song: Song) => {
    let value = identities.get(song)
    if (!value) { value = [exactKey(song), contentKey(song)]; identities.set(song, value) }
    return value
  }
  const parent = sorted.map((_, index) => index)
  const root = (index: number): number => {
    while (parent[index] != index) { parent[index] = parent[parent[index]]; index = parent[index] }
    return index
  }
  const owners = new Map<string, number>()
  for (const [index, candidate] of sorted.entries()) {
    if (++processed % 100 == 0) yield
    for (const key of keys(candidate.song)) {
      const previous = owners.get(key)
      if (previous != null) {
        const a = root(previous)
        const b = root(index)
        parent[Math.max(a, b)] = Math.min(a, b)
      }
      owners.set(key, index)
    }
  }
  const groups = new Map<number, Candidate[]>()
  sorted.forEach((candidate, index) => {
    const id = root(index)
    const group = groups.get(id) ?? []
    group.push(candidate)
    groups.set(id, group)
  })
  const blockedKeys = new Set(blocked.flatMap(keys))
  const recordsByKey = new Map<string, typeof history>()
  for (const record of history) {
    for (const key of keys(record.song)) {
      const records = recordsByKey.get(key) ?? []
      records.push(record)
      recordsByKey.set(key, records)
    }
  }
  const result: Recommendation[] = []
  for (const group of groups.values()) {
    if (++processed % 50 == 0) yield
    if (group.some(item => opts.isDisliked(item.song) || keys(item.song).some(key => blockedKeys.has(key)))) continue
    const candidate = group[0]
    const records = [...new Set(group.flatMap(item => keys(item.song).flatMap(key => recordsByKey.get(key) ?? [])))]
    const completed = records.filter(record => record.completed && !record.skipped).length
    const skipped = records.filter(record => record.skipped).length
    const positive = records.length - skipped
    const artistScore = artists(candidate.song).reduce((sum, artist) => sum + (affinity.get(artist) ?? 0), 0)
    const latest = records.reduce((time, record) => Math.max(time, record.startedAt), 0)
    const recency = latest ? 2 / (1 + (opts.now - latest) / (7 * 86_400_000)) : 0
    const overlap = opts.anchor && artists(candidate.song).some(artist => artists(opts.anchor!).includes(artist))
    const score = (Math.log1p(positive) * 3 + completed * 3 +
      Math.max(-6, Math.min(6, artistScore)) + recency + (overlap ? 6 : 0)) * (opts.affinityWeight ?? 1) - skipped * 6 +
      (!positive && artistScore <= 0 && !overlap ? opts.discoveryWeight ?? 0 : 0) +
      seededRandom(`${opts.seed}:${contentKey(candidate.song)}`)() * 4
    const reasons: Recommendation['reasons'] = [candidate.origin]
    if (artistScore > 0 || overlap) reasons.push('artist-affinity')
    if (positive > 1) reasons.push('frequent')
    if (completed) reasons.push('completed')
    result.push({ ...candidate, key: contentKey(candidate.song), score, reasons })
  }
  return result.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).slice(0, Math.max(0, opts.limit ?? 30))
}

/** Pure synchronous API for small callers/tests. Mobile loads yield between chunks. */
export const rankCandidates = (candidates: readonly Candidate[], opts: RankOptions): Recommendation[] => {
  const steps = rankSteps(candidates, opts)
  let next = steps.next()
  while (!next.done) next = steps.next()
  return next.value
}
export const rankCandidatesAsync = async(candidates: readonly Candidate[], opts: RankOptions): Promise<Recommendation[]> => {
  const steps = rankSteps(candidates, opts)
  let next = steps.next()
  while (!next.done) {
    await new Promise<void>(resolve => { setTimeout(resolve, 0) })
    next = steps.next()
  }
  return next.value
}
