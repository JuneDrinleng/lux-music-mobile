/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export const emptyDrift = () => ({ samples: 0, stalls: 0, maxDriftMs: 0 })
export type Drift = ReturnType<typeof emptyDrift>
export const sampleDrift = (stats: Drift, elapsedMs: number): Drift => {
  const drift = Math.max(0, elapsedMs - 100)
  return { samples: stats.samples + 1, stalls: stats.stalls + (drift > 50 ? 1 : 0), maxDriftMs: Math.max(stats.maxDriftMs, drift) }
}
export const emptyOperation = () => ({ count: 0, totalMs: 0, maxMs: 0, totalBytes: 0, maxBytes: 0 })
export type Operation = ReturnType<typeof emptyOperation>
export const sampleOperation = (stats: Operation, ms: number, bytes: number): Operation => ({
  count: stats.count + 1,
  totalMs: stats.totalMs + ms,
  maxMs: Math.max(stats.maxMs, ms),
  totalBytes: stats.totalBytes + bytes,
  maxBytes: Math.max(stats.maxBytes, bytes),
})

export interface Dependencies {
  records?: () => number
  now: () => number
  schedule: (callback: () => void, ms: number) => unknown
  cancel: (timer: unknown) => void
  write: (line: string) => void
}

/** No native/React imports: deterministic timers and logging can be injected in tests. */
export const createDiagnostics = (deps: Dependencies) => {
  let enabled = false
  let foreground = true
  let epoch = 0
  let timer: unknown
  let drift = emptyDrift()
  let operations: Record<string, Operation> = {}
  let renders: Record<string, number> = {}
  let recordCount = 0
  const reset = () => {
    drift = emptyDrift()
    operations = {}
    renders = {}
  }
  const write = (kind: string, data: unknown) => { deps.write(`[perf] ${kind} ${JSON.stringify(data)}`) }
  const flush = () => {
    if (!enabled) return
    write('minute', { drift, operations, renders, recordCount: deps.records?.() ?? recordCount })
    reset()
  }
  const stop = () => {
    epoch++
    if (timer !== undefined) deps.cancel(timer)
    timer = undefined
  }
  const start = () => {
    if (!enabled || !foreground || timer !== undefined) return
    const generation = epoch
    let last = deps.now()
    let minute = last
    timer = deps.schedule(() => {
      if (!enabled || !foreground || generation !== epoch) return
      const now = deps.now()
      drift = sampleDrift(drift, now - last)
      last = now
      if (now - minute >= 60_000) {
        flush()
        minute = now
      }
    }, 100)
  }
  return {
    flush,
    setEnabled(next: boolean, metadata: unknown) {
      if (next === enabled) return
      stop()
      reset()
      enabled = next
      write(next ? 'enabled' : 'disabled', metadata)
      start()
    },
    setForeground(next: boolean) {
      if (next === foreground) return
      foreground = next
      stop()
      // Preserve partial aggregates; restarting the baseline excludes background time.
      start()
    },
    operation(name: string, ms: number, bytes = 0, records?: number) {
      if (!enabled) return
      operations[name] = sampleOperation(operations[name] ?? emptyOperation(), ms, bytes)
      if (records !== undefined) recordCount = records
    },
    render(name: string) {
      if (!enabled) return
      renders[name] = (renders[name] ?? 0) + 1
    },
  }
}
