/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type RecommendationBatch } from './service'
import { withRecommendationTimeout } from './timeout'

export interface RecommendationLoadState { batch: RecommendationBatch | null, loading: boolean, failed: boolean }
/** One owner for progressive results, cancellation and terminal loading states. */
export const createRecommendationLoader = (publish: (state: RecommendationLoadState) => void, timeoutMs = 9000) => {
  let generation = 0
  let cancel: (() => void) | undefined
  const invalidate = () => {
    generation++
    cancel?.()
    cancel = undefined
    publish({ batch: null, loading: false, failed: false })
  }
  return {
    invalidate,
    load: async(load: (progress: (batch: RecommendationBatch) => void) => Promise<RecommendationBatch>, initial: RecommendationBatch | null = null) => {
      cancel?.()
      const request = ++generation
      let batch: RecommendationBatch | null = initial
      publish({ batch, loading: !batch, failed: false })
      const progress = (next: RecommendationBatch) => {
        if (generation != request) return
        batch = next
        publish({ batch, loading: false, failed: false })
      }
      let release: (() => void) | undefined
      const cancelled = new Promise<never>((resolve, reject) => { release = () => { reject(new Error('Recommendation load cancelled')) } })
      cancel = release
      try {
        const next = await withRecommendationTimeout(Promise.race([Promise.resolve().then(async() => load(progress)), cancelled]), timeoutMs)
        progress(next)
      } catch {
        if (generation == request) publish({ batch, loading: false, failed: true })
      } finally {
        if (generation == request) {
          generation++
          // Only the current request can release its cancellation callback.
          // eslint-disable-next-line require-atomic-updates
          cancel = undefined
        }
      }
    },
  }
}
