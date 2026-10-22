/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type ImportSource, type ImportTrack } from './parser'
import { matchStatus, scoreTrack, type MatchSong, type MatchStatus } from './score'

export interface ScoredCandidate<T> { song: T, score: number }
export interface MatchRow<T> { track: ImportTrack, candidates: Array<ScoredCandidate<T>>, status: MatchStatus }
export interface SearchSong extends MatchSong { id: string, source: string }
export interface MatchOptions<T extends SearchSong> {
  sources: readonly ImportSource[]
  search: (query: string, source: ImportSource, signal: AbortSignal) => Promise<T[]>
  signal: AbortSignal
  concurrency?: number
  timeoutMs?: number
  onProgress?: (rows: Array<MatchRow<T>>, completed: number) => void
  minimumScore?: number
  candidateLimit?: number
  yieldThread?: () => Promise<void>
}
export const abortError = () => new Error('IMPORT_CANCELLED')
const check = (signal: AbortSignal) => { if (signal.aborted) throw abortError() }
export const yieldThread = async() => new Promise<void>(resolve => { setTimeout(resolve, 0) })

/** One request per source at a time. A timed-out source is retired for this run:
 * legacy SDK requests cannot all be physically aborted, so never start further
 * requests behind a hanging request. This also bounds actual outstanding work. */
export const matchTracks = async<T extends SearchSong>(tracks: readonly ImportTrack[], options: MatchOptions<T>): Promise<Array<MatchRow<T>>> => {
  const { signal, search } = options
  const concurrency = Math.max(1, Math.min(3, Math.floor(options.concurrency ?? 3)))
  const sources = [...new Set(options.sources)]
  const retired = new Set<ImportSource>()
  const results: Array<MatchRow<T>> = []
  const pause = options.yieldThread ?? yieldThread
  const request = async(query: string, source: ImportSource): Promise<T[]> => {
    check(signal)
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let abort: () => void = () => {}
    const interrupted = new Promise<T[]>((resolve, reject) => {
      abort = () => { controller.abort(); reject(abortError()) }
      signal.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => { retired.add(source); controller.abort(); resolve([]) }, Math.max(1, options.timeoutMs ?? 10000))
    })
    try {
      return await Promise.race([Promise.resolve().then(async() => { check(signal); return search(query, source, controller.signal) }), interrupted])
    } catch (error) {
      check(signal)
      return []
    } finally {
      if (timer) clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
  }
  check(signal)
  for (const track of tracks) {
    check(signal)
    await pause(); check(signal)
    const candidates: Array<ScoredCandidate<T>> = []
    const seen = new Set<string>()
    for (let start = 0; start < sources.length; start += concurrency) {
      const batch = sources.slice(start, start + concurrency).filter(source => !retired.has(source))
      const lists = await Promise.all(batch.map(async source => request(`${track.title} ${track.artist}`.trim(), source)))
      check(signal)
      for (const list of lists) {
        // Only rank a small result window; scoring yields every eight entries.
        for (const song of list.slice(0, 30)) {
          const key = `${song.source}_${song.id}`
          if (seen.has(key)) continue
          seen.add(key)
          candidates.push({ song, score: scoreTrack(track, song) })
          if (candidates.length % 8 === 0) { await pause(); check(signal) }
        }
      }
    }
    // Stable sort retains source preference for ties.
    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]
    // Identical recordings across providers aren't an ambiguous runner-up.
    const runner = candidates.find(candidate => candidate.song.name !== best?.song.name || candidate.song.singer !== best?.song.singer)
    results.push({ track, candidates: candidates.filter(candidate => candidate.score >= (options.minimumScore ?? 40)).slice(0, options.candidateLimit ?? 12), status: matchStatus(best?.score ?? 0, runner?.score) })
    check(signal)
    options.onProgress?.([...results], results.length)
  }
  return results
}

/** Deadline wrapper for provider operations which already return identified songs. */
export const withImportDeadline = async<T>(task: () => Promise<T>, signal: AbortSignal, timeoutMs = 15000): Promise<T> => {
  check(signal)
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: () => void = () => {}
  try {
    return await Promise.race([Promise.resolve().then(async() => { check(signal); return task() }), new Promise<T>((resolve, reject) => {
      abort = () => { reject(abortError()) }
      signal.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => { reject(new Error('IMPORT_TIMEOUT')) }, timeoutMs)
    })])
  } finally {
    if (timer) clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
