/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { withRecommendationTimeout } from './timeout'
import { dateKey, localDateReader, type TimeZone } from '../memories/calendar'
import { type PlayRecord } from '../playHistory/types'
import { rankCandidatesAsync, sameSong } from './engine'
import { collectCandidates, historySource, type SourceFailure } from './sources'
import { type CandidateSource, type Recommendation, type RecommendationExposure, type Song } from './types'

export interface RecommendationOptions { now?: number, limit?: number, timeZone?: TimeZone, timeoutMs?: number, retryFailedSources?: boolean, affinityWeight?: number, discoveryWeight?: number, overallTimeoutMs?: number, onProgress?: (batch: RecommendationBatch) => void }
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
  dailySourceIds?: string[]
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
  (cache.dailySourceIds == null || (Array.isArray(cache.dailySourceIds) && cache.dailySourceIds.every(id => typeof id == 'string'))) &&
  cache.daily.every(item => validSong(item?.song) && typeof item.key == 'string' && Array.isArray(item.reasons) && Number.isFinite(item.score)) &&
  cache.exposures.every(item => validSong(item?.song) && Number.isFinite(item.at))

/** Independent factory for tests/consumers; default app bindings live in index.ts.
 * Serialize read/modify/write per captured data space, including concurrent radio requests. */
export const createRecommendationEngine = (deps: RecommendationDependencies) => {
  const queues = new Map<string, Promise<unknown>>()
  const memory = new Map<string, RecommendationCache>()
  let snapshot: { batch: RecommendationBatch, sources: string[] } | null = null
  let generation = 0
  const enqueue = async<T>(space: string, action: () => Promise<T>, timeoutMs: number, expire: () => void): Promise<T> => {
    const task = (queues.get(space) ?? Promise.resolve()).catch(() => {}).then(async() => withRecommendationTimeout(action(), timeoutMs, expire))
    queues.set(space, task)
    try { return await task } finally { if (queues.get(space) == task) queues.delete(space) }
  }
  const request = async(kind: 'daily' | 'similar' | 'radio', anchor: Song | undefined, exclude: readonly Song[], opts: RecommendationOptions) => {
    const spaceId = deps.getSpaceId()
    const startedGeneration = generation
    const now = opts.now ?? Date.now()
    const readDate = localDateReader(opts.timeZone)
    const date = dateKey(readDate(now))
    const sources = [...deps.getSources()]
    let expired = false
    const assertSpace = () => {
      if (expired || deps.getSpaceId() != spaceId || generation != startedGeneration) throw new Error('Data space changed during recommendation request')
    }
    return withRecommendationTimeout(enqueue(spaceId, async(): Promise<RecommendationBatch> => {
      assertSpace()
      let cache = memory.get(spaceId)
      if (!cache) {
        try {
          const stored = await withRecommendationTimeout(deps.readCache(spaceId), 250)
          // The per-space queue serializes cache reads and writes.
          // eslint-disable-next-line require-atomic-updates
          if (validCache(stored)) cache = stored
        } catch { /* Storage failure must still allow local recommendations. */ }
      }
      assertSpace()
      cache ??= { version: 1, date: '', daily: [], dailyFailures: [], exposures: [] }
      // Retain only the repeat window, bounded to avoid unbounded radio storage growth.
      const exposures = cache.exposures.filter(item => item.at <= now && now - item.at < 3 * 86_400_000)
      const seed = `${date}:${spaceId}`
      let history = copy(deps.getHistory().slice(-2000))
      let items: Recommendation[]
      let failures: SourceFailure[]
      const previousDaily = cache.daily
      const sourceIds = cache.dailySourceIds ?? []
      const retryRequested = opts.retryFailedSources === true && (cache.dailyFailures.length > 0 || !previousDaily.length)
      const sourcesAdded = sources.some(source => !sourceIds.includes(source.id))
      const retryDaily = kind == 'daily' && cache.date == date && (retryRequested || sourcesAdded)
      if (kind == 'daily' && cache.date == date && !retryDaily) {
        // Preserve cached order/scores; apply new dislikes and playback exclusions immediately.
        const allowed = new Set((await rankCandidatesAsync(cache.daily, {
          now, seed, history, isDisliked: deps.isDisliked, limit: cache.daily.length,
        })).map(item => item.key))
        items = cache.daily.filter(item => allowed.has(item.key))
        failures = cache.dailyFailures.filter(failure => sources.some(source => source.id == failure.id) || failure.id == historySource.id)
      } else {
        const context = { spaceId, now, seed, history, anchor }
        let shown: Recommendation[] = retryDaily ? previousDaily : []
        const retainOrder = (ranked: Recommendation[]) => {
          const remaining = new Map(ranked.map(item => [item.key, item]))
          const retained = shown.flatMap(item => {
            const next = remaining.get(item.key)
            remaining.delete(item.key)
            return next ? [next] : []
          })
          return [...retained, ...remaining.values()]
        }
        const progress = async(candidates: Parameters<typeof rankCandidatesAsync>[0], failures: SourceFailure[]) => {
          assertSpace()
          if (kind != 'daily' || !opts.onProgress) return
          const ranked = await rankCandidatesAsync([...candidates, ...shown], {
            now,
            seed,
            history,
            isDisliked: deps.isDisliked,
            limit: candidates.length + shown.length,
            recommended: exposures.filter(exposure => !shown.some(item => sameSong(item.song, exposure.song))),
          })
          assertSpace()
          // Progress callbacks are serialized by collectCandidates.
          // eslint-disable-next-line require-atomic-updates
          shown = retainOrder(ranked).slice(0, 100)
          const batch = { spaceId, date, items: shown.slice(0, opts.limit ?? 30), failures }
          snapshot = { batch: copy(batch), sources: sources.map(source => source.id) }
          opts.onProgress(copy(batch))
        }
        const local = await collectCandidates([historySource, ...sources.filter(source => source.id.startsWith('local:'))], context, opts.timeoutMs, progress)
        // Local cards are published before even starting the usable remote sources.
        const remote = await collectCandidates(sources.filter(source => !source.id.startsWith('local:')), context, opts.timeoutMs,
          async(candidates, failures) => { await progress([...local.candidates, ...candidates], [...local.failures, ...failures]) })
        const collected = { candidates: [...local.candidates, ...remote.candidates], failures: [...local.failures, ...remote.failures] }
        assertSpace()
        // This request owns its history snapshot.
        // eslint-disable-next-line require-atomic-updates
        history = copy(deps.getHistory().slice(-2000))
        items = await rankCandidatesAsync(retryDaily ? [...collected.candidates, ...previousDaily] : collected.candidates, {
          now,
          seed: kind == 'daily' ? seed : `${seed}:${kind}:${exposures.length}`,
          history,
          isDisliked: deps.isDisliked,
          anchor,
          affinityWeight: opts.affinityWeight,
          discoveryWeight: opts.discoveryWeight,
          exclude,
          recommended: retryDaily ? exposures.filter(exposure => !previousDaily.some(item => sameSong(item.song, exposure.song))) : exposures,
          limit: kind == 'daily' ? collected.candidates.length + previousDaily.length : opts.limit ?? 20,
        })
        failures = collected.failures
        if (retryDaily || shown.length > 0) {
          // Recovery appends newly available candidates without shuffling today's existing strip.
          const remaining = new Map(items.map(item => [item.key, item]))
          const retained = shown.flatMap(item => {
            const next = remaining.get(item.key)
            remaining.delete(item.key)
            return next ? [next] : []
          })
          items = [...retained, ...remaining.values()]
        }
        if (kind == 'daily') cache = { ...cache, date, daily: items.slice(0, 100), dailyFailures: failures, dailySourceIds: sources.map(source => source.id) }
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
      try { await withRecommendationTimeout(deps.writeCache(spaceId, copy(cache)), 250) } catch { /* Session cache remains usable if disk is unavailable. */ }
      assertSpace()
      const batch = { spaceId, date, items: selected, failures }
      if (kind == 'daily') snapshot = { batch: copy(batch), sources: sources.map(source => source.id) }
      return copy(batch)
    }, opts.overallTimeoutMs ?? 9000, () => { expired = true }), opts.overallTimeoutMs ?? 9000, () => { expired = true })
  }
  return {
    clearSessionCache: () => { generation++; memory.clear(); snapshot = null },
    /** Only reuse the current space/day/source identity; never reuse similar/radio results. */
    peekDailyRecommendations: (): RecommendationBatch | null => {
      if (!snapshot || snapshot.batch.spaceId != deps.getSpaceId() ||
        snapshot.batch.date != dateKey(localDateReader()(Date.now()))) return null
      const ids = deps.getSources().map(source => source.id)
      if (ids.length != snapshot.sources.length || ids.some((id, index) => id != snapshot?.sources[index])) return null
      const batch = copy(snapshot.batch)
      batch.items = batch.items.filter(item => !deps.isDisliked(item.song))
      return batch
    },
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
