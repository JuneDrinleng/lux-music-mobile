// HomeTab only: keep one channel across unmounts / orientation changes.
export const sameRankingCachePayload = (left: unknown, right: unknown): boolean => {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && sameRankingCachePayload(a[key], b[key]))
}

export const createHomeRankingCacheWriter = <T>(write: (payload: T) => Promise<void>, delay = 150) => {
  let pending: (() => T | null) | undefined
  const channel = { saved: undefined as T | undefined, running: false }
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = async() => {
    clearTimeout(timer)
    timer = undefined
    if (channel.running) return
    channel.running = true
    try {
      while (pending) {
        const snapshot = pending
        pending = undefined
        const payload = snapshot()
        if (payload === null || sameRankingCachePayload(payload, channel.saved)) continue
        try {
          await write(payload)
          channel.saved = payload
        } catch {
          // saveData may already have removed the previous disk snapshot.
          channel.saved = undefined
          // Storage logs errors. Retain failed data for the next update / lifecycle
          // flush, but do not spin on a persistent error or replay stale data.
          if (!pending) {
            pending = snapshot
            break
          }
        }
      }
    } finally {
      channel.running = false
    }
  }

  return {
    enqueue(snapshot: () => T | null) {
      pending = snapshot
      if (channel.running) return
      clearTimeout(timer)
      timer = setTimeout(() => { void flush() }, delay)
    },
    flush,
  }
}
