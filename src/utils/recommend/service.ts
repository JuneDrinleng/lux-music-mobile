/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { dateKey, localDateReader, type TimeZone } from '../memories/calendar'
import { type PlayRecord } from '../playHistory/types'
import { rankCandidates } from './engine'
import { collectCandidates, historySource, type SourceFailure } from './sources'
import { type CandidateSource, type Recommendation, type RecommendationExposure, type Song } from './types'

export interface RecommendationOptions { now?: number, limit?: number, timeZone?: TimeZone, timeoutMs?: number }
export interface RecommendationBatch {
  spaceId: string
  date: string
  items: Recommendation[]
  failures: SourceFailure[]
}
export interface RecommendationCache {
  version: 1
  date: string
  daily: Recommendation[]
  dailyFailures: SourceFailure[]
  exposures: RecommendationExposure[]
}
export interface RecommendationDependencies {
  getSpaceId: () => string
  getHistory: () => readonly PlayRecord[]
  isDisliked: (song: Song) => boolean
  getSources: () => readonly CandidateSource[]
  readCache: (spaceId: string) => Promise<RecommendationCache | null>
  writeCache: (spaceId: string, cache: RecommendationCache) => Promise<void>
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const validSong = (song: Song): boolean => !!song && typeof song.source == 'string' && typeof song.songmid == 'string' &&
  typeof song.name == 'string' && typeof song.singer == 'string'
const validCache = (cache: RecommendationCache | null): cache is RecommendationCache => !!cache && cache.version == 1 &&
  typeof cache.date == 'string' && Array.isArray(cache.daily) && Array.isArray(cache.dailyFailures) && Array.isArray(cache.exposures) &&
  cache.daily.every(item => validSong(item?.song) && typeof item.key == 'string' && Array.isArray(item.reasons) && Number.isFinite(item.score)) &&
  cache.exposures.every(item => validSong(item?.song) && Number.isFinite(item.at))

/** Independent factory for tests/consumers; default app bindings live in index.ts.
 * Serialize read/modify/write per captured data space, including concurrent radio requests. */
export const createRecommendationEngine = (deps: RecommendationDependencies) => {
  const queues = new Map<string, Promise<unknown>>()
  const memory = new Map<string, RecommendationCache>()
  const enqueue = async<T>(space: string, action: () => Promise<T>): Promise<T> => {
    const task = (queues.get(space) ?? Promise.resolve()).catch(() => {}).then(action)
    queues.set(space, task)
    try { return await task } finally { if (queues.get(space) == task) queues.delete(space) }
  }
  const request = async(kind: 'daily' | 'similar' | 'radio', anchor: Song | undefined, exclude: readonly Song[], opts: RecommendationOptions) => {
    const spaceId = deps.getSpaceId()
    const now = opts.now ?? Date.now()
    const readDate = localDateReader(opts.timeZone)
    const date = dateKey(readDate(now))
    const history = copy(deps.getHistory())
    const sources = [...deps.getSources()]
    const assertSpace = () => { if (deps.getSpaceId() != spaceId) throw new Error('Data space changed during recommendation request') }
    return enqueue(spaceId, async(): Promise<RecommendationBatch> => {
      assertSpace()
      let cache = memory.get(spaceId)
      if (!cache) {
        try {
          const stored = await deps.readCache(spaceId)
          if (validCache(stored)) cache = stored
        } catch { /* Storage failure must still allow local recommendations. */ }
      }
      assertSpace()
      cache ??= { version: 1, date: '', daily: [], dailyFailures: [], exposures: [] }
      // Retain only the repeat window, bounded to avoid unbounded radio storage growth.
      const exposures = cache.exposures.filter(item => item.at <= now && now - item.at < 3 * 86_400_000)
      const seed = `${date}:${spaceId}`
      let items: Recommendation[]
      let failures: SourceFailure[]
      if (kind == 'daily' && cache.date == date) {
        // Preserve cached order/scores; apply new dislikes and playback exclusions immediately.
        const allowed = new Set(rankCandidates(cache.daily, {
          now, seed, history, isDisliked: deps.isDisliked, limit: cache.daily.length,
        }).map(item => item.key))
        items = cache.daily.filter(item => allowed.has(item.key))
        failures = cache.dailyFailures
      } else {
        const collected = await collectCandidates([historySource, ...sources], { spaceId, now, seed, history, anchor }, opts.timeoutMs)
        assertSpace()
        items = rankCandidates(collected.candidates, {
          now,
          seed: kind == 'daily' ? seed : `${seed}:${kind}:${exposures.length}`,
          history,
          isDisliked: deps.isDisliked,
          anchor,
          exclude,
          recommended: exposures,
          limit: kind == 'daily' ? 100 : opts.limit ?? 20,
        })
        failures = collected.failures
        if (kind == 'daily') cache = { ...cache, date, daily: items, dailyFailures: failures }
      }
      const selected = items.slice(0, Math.max(0, opts.limit ?? (kind == 'daily' ? 30 : 20)))
      // Daily exposures are recorded once per song/day; cached reads do not extend the cooldown.
      for (const item of selected) {
        const alreadyRecordedToday = kind == 'daily' && exposures.some(exposure =>
          exposure.song.source == item.song.source && exposure.song.songmid == item.song.songmid && dateKey(readDate(exposure.at)) == date)
        if (!alreadyRecordedToday) {
          exposures.push({ song: item.song, at: now })
        }
      }
      cache = { ...cache, exposures: exposures.slice(-2000) }
      assertSpace()
      memory.set(spaceId, copy(cache))
      try { await deps.writeCache(spaceId, copy(cache)) } catch { /* Session cache remains usable if disk is unavailable. */ }
      assertSpace()
      return copy({ spaceId, date, items: selected, failures })
    })
  }
  return {
    clearSessionCache: () => { memory.clear() },
    getDailyRecommendations: async(opts: RecommendationOptions = {}) => request('daily', undefined, [], opts),
    getSimilar: async(song: Song, opts: RecommendationOptions = {}) => {
      const result = await request('similar', copy(song), [], opts)
      const bySource: Record<string, Recommendation[]> = {}
      for (const item of result.items) (bySource[item.song.source] ??= []).push(item)
      return { ...result, bySource }
    },
    /** Pass the current queue + played session songs to prevent any radio repeat. */
    getRadioNext: async(seed: Song, history: readonly Song[], opts: RecommendationOptions = {}) => request('radio', copy(seed), copy(history), opts),
  }
}
