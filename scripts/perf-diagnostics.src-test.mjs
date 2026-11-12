/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/utils/perfDiagnostics/core.ts', import.meta.url), 'utf8')
const exports = {}
new Script(`(function(exports){${ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText}\n})`).runInThisContext()(exports)
const { createDiagnostics, sampleDrift, emptyDrift, sampleOperation, emptyOperation } = exports
const harness = () => {
  let now = 0
  let nextId = 0
  const timers = new Map()
  const callbacks = []
  const logs = []
  const capture = createDiagnostics({
    now: () => now,
    schedule: (fn, ms) => { assert.equal(ms, 100); callbacks.push(fn); timers.set(++nextId, fn); return nextId },
    cancel: id => timers.delete(id),
    write: line => { logs.push(line) },
  })
  return {
    capture,
    logs,
    timers,
    callbacks,
    advance: ms => { now += ms; for (const fn of timers.values()) fn() },
    minute: () => JSON.parse(logs.filter(line => line.startsWith('[perf] minute ')).at(-1).slice('[perf] minute '.length)),
  }
}

test('perf drift threshold is strictly >50ms, with sample count and maximum', () => {
  let stats = emptyDrift()
  for (const elapsed of [100, 150, 151, 290, 90]) stats = sampleDrift(stats, elapsed)
  assert.deepEqual(stats, { samples: 5, stalls: 2, maxDriftMs: 190 })
})

test('perf minute aggregates drift and clears all sampled counters', () => {
  const h = harness()
  h.capture.setEnabled(true, {})
  for (let i = 0; i < 599; i++) h.advance(100)
  assert.equal(h.logs.length, 1)
  h.advance(100)
  assert.deepEqual(h.minute().drift, { samples: 600, stalls: 0, maxDriftMs: 0 })
  h.capture.flush()
  assert.deepEqual(h.minute().drift, emptyDrift())
})

test('perf operation aggregation includes counts, duration, bytes and maxima', () => {
  assert.deepEqual(sampleOperation(sampleOperation(emptyOperation(), 5, 100), 12, 40), {
    count: 2, totalMs: 17, maxMs: 12, totalBytes: 140, maxBytes: 100,
  })
  const h = harness()
  h.capture.setEnabled(true, {})
  for (const name of ['saveData', 'saveDataMultiple', 'upsertPlayRecord']) {
    h.capture.operation(name, 5, 100, 10)
    h.capture.operation(name, 12, 40, 11)
  }
  h.capture.flush()
  for (const op of Object.values(h.minute().operations)) {
    assert.deepEqual(op, { count: 2, totalMs: 17, maxMs: 12, totalBytes: 140, maxBytes: 100 })
  }
  assert.equal(h.minute().recordCount, 11)
  h.capture.flush()
  assert.deepEqual(h.minute().operations, {})
})

test('perf commit counts aggregate independently and reset after summary', () => {
  const h = harness()
  h.capture.setEnabled(true, {})
  for (const name of ['HomeTab', 'PlaylistTab', 'SettingsTab', 'Dock', 'PlayDetail']) {
    h.capture.render(name)
    h.capture.render(name)
  }
  h.capture.flush()
  assert.deepEqual(h.minute().renders, { HomeTab: 2, PlaylistTab: 2, SettingsTab: 2, Dock: 2, PlayDetail: 2 })
  h.capture.flush()
  assert.deepEqual(h.minute().renders, {})
})

test('perf default OFF creates no timers, logs or measurements', () => {
  const h = harness()
  h.capture.setEnabled(false, {})
  h.capture.render('Dock')
  h.capture.operation('saveData', 50, 100)
  h.capture.flush()
  h.advance(120_000)
  assert.equal(h.timers.size, 0)
  assert.deepEqual(h.logs, [])
})

test('perf disable clears timers immediately and stale callbacks cannot count', () => {
  const h = harness()
  h.capture.setEnabled(true, { version: 'test' })
  const stale = h.callbacks[0]
  h.advance(100)
  h.capture.setEnabled(false, { version: 'test' })
  assert.equal(h.timers.size, 0)
  const count = h.logs.length
  stale()
  h.capture.render('Dock')
  h.advance(60_000)
  h.capture.flush()
  assert.equal(h.logs.length, count)
  assert.match(h.logs.at(-1), /^\[perf\] disabled /)
  h.capture.setEnabled(true, {})
  stale()
  h.capture.flush()
  assert.equal(h.minute().drift.samples, 0)
})

test('perf background suspends timers and excludes background from drift', () => {
  const h = harness()
  h.capture.setEnabled(true, {})
  h.advance(160)
  h.capture.setForeground(false)
  assert.equal(h.timers.size, 0)
  h.advance(120_000)
  h.capture.setForeground(true)
  h.advance(100)
  h.capture.flush()
  assert.deepEqual(h.minute().drift, { samples: 2, stalls: 1, maxDriftMs: 60 })
})

test('perf record count provider reflects load, imports and account reset without upserts', () => {
  let records = 42
  const lines = []
  const capture = createDiagnostics({ now: () => 0, records: () => records, schedule: () => 1, cancel: () => {}, write: line => lines.push(line) })
  capture.setEnabled(true, {})
  capture.flush()
  assert.equal(JSON.parse(lines.at(-1).slice('[perf] minute '.length)).recordCount, 42)
  records = 0
  capture.flush()
  assert.equal(JSON.parse(lines.at(-1).slice('[perf] minute '.length)).recordCount, 0)
})

const loadModule = (path, deps, globals = {}) => {
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports, ...Object.values(globals))
  return module.exports
}

const moduleHarness = () => {
  let now = 10
  const lines = []
  const module = loadModule('../src/utils/perfDiagnostics/index.ts', { './core': exports }, {
    global: { performance: { now: () => now } },
  })
  module.configureDiagnostics({ now: () => now, schedule: () => 1, cancel: () => {}, write: line => lines.push(line) })
  return { module, lines, time: value => { now = value } }
}

test('perf boot buffers early await durations and named bootLog timestamps until settings load', () => {
  const h = moduleHarness()
  const started = h.module.bootTimestamp('init:early:start')
  h.time(35)
  h.module.bootStep('early', started)
  h.module.bootTimestamp('Font size setting loaded.')
  assert.deepEqual(h.lines, [])
  h.module.setDiagnosticsEnabled(true, {})
  h.module.finishBootBuffer()
  const summary = JSON.parse(h.lines.find(line => line.startsWith('[perf] boot-buffer ')).slice('[perf] boot-buffer '.length))
  assert.deepEqual(summary.steps, [{ name: 'early', durationMs: 25 }])
  assert.deepEqual(summary.marks.at(-1), ['Font size setting loaded.', 35])
  h.time(55)
  h.module.bootStep('later', 35)
  assert.equal(JSON.parse(h.lines.at(-1).slice('[perf] init '.length)).durationMs, 20)
})

test('perf boot buffer is discarded when OFF, enabling later does not recover old capture', () => {
  const h = moduleHarness()
  h.module.bootTimestamp('early')
  h.module.finishBootBuffer()
  h.module.bootTimestamp('still off')
  assert.deepEqual(h.lines, [])
  h.module.setDiagnosticsEnabled(true, {})
  h.module.finishBootBuffer()
  assert.deepEqual(JSON.parse(h.lines.at(-1).slice('[perf] boot-buffer '.length)).marks, [])
})

test('perf writes crossing OFF and ON cannot enter the next capture session', () => {
  const h = moduleHarness()
  h.module.setDiagnosticsEnabled(true, {})
  const pending = h.module.beginOperation()
  h.module.setDiagnosticsEnabled(false, {})
  h.module.setDiagnosticsEnabled(true, {})
  h.module.endOperation('saveData', pending, 100)
  const current = h.module.beginOperation()
  h.time(20)
  h.module.endOperation('saveData', current, 40)
  h.module.flushDiagnostics()
  assert.deepEqual(JSON.parse(h.lines.at(-1).slice('[perf] minute '.length)).operations.saveData,
    { count: 1, totalMs: 10, maxMs: 10, totalBytes: 40, maxBytes: 40 })
})

test('perf lifecycle OFF installs no native listeners, timers or log lines; toggles clean up', () => {
  const events = []
  let stateChanged
  const module = loadModule('../src/utils/perfDiagnostics/index.ts', { './core': exports })
  const lifecycle = loadModule('../src/utils/perfDiagnostics/lifecycle.ts', {
    './index': module,
    '@/utils/log': { log: { info: line => events.push(line) } },
    'react-native': {
      Platform: { OS: 'android', constants: { Model: 'test device' } },
      AppState: {
        currentState: 'active',
        addEventListener: (event, fn) => {
          stateChanged = fn
          events.push('listen')
          return { remove: () => events.push('remove') }
        },
      },
    },
  }, {
    setInterval: () => { events.push('timer'); return 1 },
    clearInterval: () => events.push('cancel'),
  })
  lifecycle.applyDiagnosticsSetting(false)
  assert.deepEqual(events, [])
  lifecycle.applyDiagnosticsSetting(true)
  assert.equal(events.filter(event => event === 'timer').length, 1)
  assert.match(events.find(event => event.startsWith('[perf] enabled ')), /"model":"test device"/)
  stateChanged('background')
  assert.equal(events.at(-1), 'cancel')
  stateChanged('active')
  assert.equal(events.at(-1), 'timer')
  lifecycle.applyDiagnosticsSetting(false)
  assert.deepEqual(events.slice(-3).map(event => event.startsWith('[perf]') ? 'disabled' : event), ['cancel', 'disabled', 'remove'])
  const count = events.length
  lifecycle.applyDiagnosticsSetting(false)
  assert.equal(events.length, count)
})

test('perf export flushes aggregates and waits for log writes before reading and sharing', async() => {
  const events = []
  let finishWrites
  const lifecycle = loadModule('../src/utils/perfDiagnostics/lifecycle.ts', {
    './index': { flushDiagnostics: () => events.push('aggregate') },
    '@/utils/log': {
      flushLogs: async() => { events.push('flush'); await new Promise(resolve => { finishWrites = resolve }) },
      getLogs: async() => { events.push('read'); return 'application log with [perf] lines' },
    },
    'react-native': { Share: { share: async payload => { events.push(payload) } } },
  })
  const pending = lifecycle.exportDiagnosticsLog()
  assert.deepEqual(events, ['aggregate', 'flush'])
  finishWrites()
  await pending
  assert.deepEqual(events, ['aggregate', 'flush', 'read', { message: 'application log with [perf] lines' }])
})

test('perf render hook counts committed effects and skips abandoned renders and OFF', () => {
  const effects = []
  const counts = []
  const state = { perfEnabled: false, countRender: name => counts.push(name) }
  const { useRenderCount } = loadModule('../src/utils/perfDiagnostics/useRenderCount.ts', {
    react: { useEffect: fn => effects.push(fn) },
    './index': state,
  })
  useRenderCount('HomeTab')
  effects.pop()()
  assert.deepEqual(counts, [])
  state.perfEnabled = true
  useRenderCount('HomeTab')
  assert.deepEqual(counts, [])
  effects.pop()()
  assert.deepEqual(counts, ['HomeTab'])
  useRenderCount('abandoned')
  assert.deepEqual(counts, ['HomeTab'])
})

test('perf storage reuses serialized payloads, counts both save paths and preserves OFF output', async() => {
  for (const enabled of [false, true]) {
    const operations = []
    const written = []
    let serializations = 0
    const value = { toJSON: () => { serializations++; return { value: 42 } } }
    const storage = loadModule('../src/plugins/storage.ts', {
      '@/utils/perfDiagnostics': {
        perfEnabled: enabled,
        beginOperation: () => ({ startedAt: 0 }),
        endOperation: (name, start, bytes) => operations.push({ name, bytes }),
      },
      '@react-native-async-storage/async-storage': {
        default: {
          getItem: async() => null,
          removeItem: async() => {},
          multiGet: async keys => keys.map(key => [key, null]),
          multiRemove: async() => {},
          multiSet: async data => written.push(data),
        },
      },
      '@/utils/log': { log: { error: () => assert.fail('unexpected storage error') } },
      '@/utils/dataSpace': { storageKey: key => key },
    })
    await storage.saveData('one', value)
    await storage.saveDataMultiple([['two', value], ['three', value]])
    assert.equal(serializations, 3)
    assert.deepEqual(written, [[['one', '{"value":42}']], [['two', '{"value":42}'], ['three', '{"value":42}']]])
    assert.deepEqual(operations, enabled ? [{ name: 'saveData', bytes: 12 }, { name: 'saveDataMultiple', bytes: 24 }] : [])
  }
})
