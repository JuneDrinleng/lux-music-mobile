/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type Candidate, type CandidateSource, type SourceContext } from './types'

export interface SourceFailure { id: string, reason: 'failed' | 'timeout' }
/** Bound every source independently. Late completion/rejection has no effect on results. */
export const collectCandidates = async(sources: readonly CandidateSource[], context: SourceContext, timeoutMs = 3000, onResult?: (candidates: Candidate[], failures: SourceFailure[]) => void | Promise<void>) => {
  const candidates: Candidate[] = []
  const failures: SourceFailure[] = []
  let progress = Promise.resolve()
  const results = await Promise.all(sources.map(async(source): Promise<{ candidates: Candidate[], failure: SourceFailure | null }> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = Symbol('timeout')
    try {
      const result = await Promise.race([
        Promise.resolve().then(async() => source.load(context)),
        new Promise<typeof timeout>(resolve => { timer = setTimeout(() => { resolve(timeout) }, Math.max(1, timeoutMs)) }),
      ])
      if (result === timeout) return { candidates: [], failure: { id: source.id, reason: 'timeout' } }
      return { candidates: result.slice(0, 300), failure: null }
    } catch {
      return { candidates: [], failure: { id: source.id, reason: 'failed' } }
    } finally { if (timer) clearTimeout(timer) }
  }).map(async pending => {
    const result = await pending
    progress = progress.then(async() => {
      candidates.push(...result.candidates.slice(0, Math.max(0, 1500 - candidates.length)))
      if (result.failure) failures.push(result.failure)
      await onResult?.(candidates, failures)
    })
    await progress
    return result
  }))
  return {
    candidates,
    failures: results.flatMap(result => result.failure ? [result.failure] : []),
  }
}

export const historySource: CandidateSource = {
  id: 'local:history',
  load: async({ history }) => history.slice(-300).map(record => ({ song: { ...record.song }, origin: 'history' })),
}
