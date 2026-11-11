/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { createDiagnostics, type Dependencies } from './core'

export let perfEnabled = false
export const perfNow = () => global.performance?.now?.() ?? Date.now()
// RN's performance clock is relative to JS runtime startup when available.
const jsStartedAt = perfNow()
let bootPending = true
let bootMarks: Array<[string, number]> = []
let writer: Dependencies['write'] | undefined
let diagnostics: ReturnType<typeof createDiagnostics> | undefined
let session = 0
let readRecords: (() => number) | undefined
export const registerRecordCount = (read: () => number) => { readRecords = read }

export const configureDiagnostics = (deps: Dependencies) => {
  writer = deps.write
  diagnostics = createDiagnostics({ ...deps, records: () => readRecords?.() ?? 0 })
}
export const setDiagnosticsEnabled = (next: boolean, metadata: unknown) => {
  if (next === perfEnabled) return
  session++
  perfEnabled = next
  diagnostics?.setEnabled(next, metadata)
}
export const setDiagnosticsForeground = (active: boolean) => diagnostics?.setForeground(active)
export const flushDiagnostics = () => diagnostics?.flush()
export const countRender = (name: string) => { diagnostics?.render(name) }
export const beginOperation = () => ({ startedAt: perfNow(), session })
export const endOperation = (name: string, start: ReturnType<typeof beginOperation>, bytes = 0, records?: number) => {
  // A write that outlives OFF → ON must not enter the new capture.
  if (perfEnabled && start.session === session) diagnostics?.operation(name, perfNow() - start.startedAt, bytes, records)
}

export const bootTimestamp = (label: string) => {
  const atMs = perfNow()
  if (bootPending) bootMarks.push([label, atMs])
  else if (perfEnabled) writer?.(`[perf] boot ${JSON.stringify({ label, atMs, sinceModuleMs: atMs - jsStartedAt })}`)
  return atMs
}
export const finishBootBuffer = () => {
  bootPending = false
  if (perfEnabled) {
    const steps = bootMarks.flatMap(([label, endedAt]) => {
      if (!label.startsWith('init:') || !label.endsWith(':end')) return []
      const name = label.slice(5, -4)
      const start = bootMarks.find(([mark]) => mark === `init:${name}:start`)
      return start ? [{ name, durationMs: endedAt - start[1] }] : []
    })
    writer?.(`[perf] boot-buffer ${JSON.stringify({ clock: typeof global.performance?.now === 'function' ? 'JS performance.now' : 'Date.now', moduleStartedAt: jsStartedAt, marks: bootMarks, steps })}`)
  }
  bootMarks = []
}
export const bootStep = (name: string, startedAt: number) => {
  const endedAt = bootTimestamp(`init:${name}:end`)
  if (perfEnabled) writer?.(`[perf] init ${JSON.stringify({ name, startedAt, endedAt, durationMs: endedAt - startedAt })}`)
}
export const bootReveal = (launchStartedAt: number, deadline: number) => {
  if (!perfEnabled) return
  const revealedAt = Date.now()
  writer?.(`[perf] reveal ${JSON.stringify({ launchStartedAt, deadline, revealedAt, totalMs: revealedAt - launchStartedAt, deadlineDeltaMs: revealedAt - deadline })}`)
}
