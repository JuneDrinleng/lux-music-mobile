/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const moduleLoader = (dependencies = {}) => {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const js = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(name => {
      if (name in dependencies) return dependencies[name]
      const path = name.startsWith('@/') ? join(root, 'src', name.slice(2)) : resolve(dirname(file), name)
      return load(existsSync(`${path}.ts`) ? `${path}.ts` : join(path, 'index.ts'))
    }, module, module.exports)
    return module.exports
  }
  return name => load(join(root, 'src/utils/memories', `${name}.ts`))
}
const load = moduleLoader()
const { monthlyReport, monthlyBounds, switchReportMonth, monthAt, monthIndex } = load('monthly')
const at = Date.parse
const record = (time, id, song = 'song', listenedMs = 60_000, singer = 'Artist') => ({
  id: String(id),
  deviceId: 'device',
  startedAt: at(time),
  endedAt: at(time) + listenedMs,
  listenedMs,
  song: { source: 'wy', songmid: song, name: song, singer },
})
const report = (history, month = { year: 2025, month: 3 }, tz = 'UTC') => monthlyReport(history, month, at('2026-10-17T12:00:00Z'), tz)

test('monthly local midnight boundaries and crossing sessions belong to the start month', () => {
  const history = [
    record('2025-03-01T07:59:59Z', 'before'),
    record('2025-03-01T08:00:00Z', 'start'),
    record('2025-04-01T06:59:59Z', 'end'),
    record('2025-04-01T07:00:00Z', 'after'),
  ]
  const result = report(history, undefined, 'America/Los_Angeles')
  assert.equal(result.playCount, 2)
  assert.equal(result.previousListenedMs, 60_000)
  assert.equal(result.days[0].playCount, 1)
  assert.equal(result.days[30].playCount, 1)
  assert.equal(result.peakHour, 0) // Equal listening duration: earliest hour wins.
  assert.equal(report([record('2025-01-01T07:59:59Z', 'dec')], { year: 2024, month: 12 }, 'America/Los_Angeles').playCount, 1)
})

for (const [tz, month, times, day] of [
  ['America/Los_Angeles', 3, ['2025-03-09T09:59:59Z', '2025-03-09T10:00:00Z'], 9],
  ['America/Los_Angeles', 11, ['2025-11-02T08:30:00Z', '2025-11-02T09:30:00Z'], 2],
  ['Europe/Berlin', 3, ['2025-03-30T00:59:59Z', '2025-03-30T01:00:00Z'], 30],
  ['Europe/Berlin', 10, ['2025-10-26T00:30:00Z', '2025-10-26T01:30:00Z'], 26],
]) {
  test(`${tz}: monthly bars preserve spring/fall DST sessions in month ${month}`, () => {
    const result = report(times.map((time, i) => record(time, i)), { year: 2025, month }, tz)
    assert.equal(result.days.length, month === 11 ? 30 : 31)
    assert.equal(result.days[day - 1].playCount, 2)
    assert.equal(result.minutes, 2)
  })
}

test('month-over-month compares exact listening duration with explicit zero-denominator semantics', () => {
  const current = record('2025-03-02T12:00:00Z', 'c', 's', 118_000)
  const previous = record('2025-02-02T12:00:00Z', 'p', 's', 100_000)
  assert.equal(report([current, previous]).changePercent, 18)
  assert.equal(report([current]).changePercent, null)
  assert.equal(report([]).changePercent, 0)
  assert.equal(report([previous]).changePercent, -100)
  assert.equal(report([record('2024-12-20', 'dec')], { year: 2025, month: 1 }).previousListenedMs, 60_000)
})

test('top three count ties use duration then source/song identity and never mutate history', () => {
  const history = [
    record('2025-03-01', '1', 'a'), record('2025-03-02', '2', 'a'),
    record('2025-03-01', '3', 'b', 120_000), record('2025-03-02', '4', 'b'),
    record('2025-03-01', '5', 'c'), record('2025-03-02', '6', 'c'),
    record('2025-03-02', '7', 'd'),
  ]
  const before = JSON.stringify(history)
  const result = report(history)
  assert.deepEqual(result.topSongs.map(item => item.song.name), ['b', 'a', 'c'])
  assert.deepEqual(report([...history].reverse()).topSongs, result.topSongs)
  assert.equal(JSON.stringify(history), before)
  assert.equal(result.songCount, 4)
  assert.equal(result.artistCount, 1)
})

test('new discoveries require the first retained play ever to be in the selected local month', () => {
  const history = [
    record('2024-01-01', 'old', 'old'), record('2025-03-01T08:00:00Z', 'replay', 'old'),
    record('2025-03-01T07:59:59Z', 'boundary', 'boundary'), record('2025-03-02T08:00:00Z', 'again', 'boundary'),
    record('2025-03-03T08:00:00Z', 'new', 'new'), record('2025-03-04T08:00:00Z', 'new2', 'new'),
  ]
  const result = report(history, undefined, 'America/Los_Angeles')
  assert.deepEqual(result.discoveries.map(item => item.song.name), ['new'])
  assert.equal(result.discoveries[0].playCount, 2)
  const otherSource = { ...history[0], id: 'source', startedAt: at('2025-03-05'), song: { ...history[0].song, source: 'kg' } }
  assert.equal(report([...history, otherSource], undefined, 'America/Los_Angeles').discoveries.length, 2)
})

test('deduplication, empty/leap months, future records and independent space inputs', () => {
  const item = record('2025-03-03', 'duplicate', 'x', 60_000, 'A & B & A')
  const history = [item, { ...item, listenedMs: 120_000 }, record('2027-03-03', 'future')]
  assert.equal(report(history).minutes, 2)
  assert.equal(report(history).playCount, 1)
  assert.equal(report(history).artistCount, 2)
  assert.equal(report([]).playCount, 0)
  assert.equal(report([]).peakHour, null)
  assert.equal(report([]).peakDay, null)
  assert.equal(report([], { year: 2024, month: 2 }).days.length, 29)
  assert.equal(report([], { year: 2025, month: 2 }).days.length, 28)
  assert.equal(report(history).minutes, 2)
})

test('month switcher clamps oldest/current month, crosses years, allows gaps and stays bounded after history changes', () => {
  const now = at('2025-03-01T07:00:00Z') // Still February in LA.
  const history = [record('2024-12-01T08:00:00Z', 'start'), record('2026-01-01', 'future')]
  const bounds = monthlyBounds(history, now, 'America/Los_Angeles')
  assert.deepEqual(bounds, { min: monthIndex({ year: 2024, month: 12 }), max: monthIndex({ year: 2025, month: 2 }) })
  assert.deepEqual(switchReportMonth({ year: 2024, month: 12 }, -1, bounds), { year: 2024, month: 12 })
  assert.deepEqual(switchReportMonth({ year: 2024, month: 12 }, 1, bounds), { year: 2025, month: 1 })
  assert.deepEqual(switchReportMonth({ year: 2025, month: 2 }, 1, bounds), { year: 2025, month: 2 })
  const empty = monthlyBounds([], now, 'America/Los_Angeles')
  assert.deepEqual(switchReportMonth({ year: 2024, month: 12 }, 0, empty), { year: 2025, month: 2 })
  assert.deepEqual(monthAt(monthIndex({ year: 2024, month: 12 })), { year: 2024, month: 12 })
})

test('history subscriptions clear the previous space immediately while the next space loads', async() => {
  let space = 'local'
  let changeSpace
  let release
  let blockRead = false
  const waiting = new Promise(resolve => { release = resolve })
  const historyKey = 'history'
  const disk = new Map([
    ['local:history', [record('2025-03-01', 'local', 'local-song')]],
    ['account:history', [record('2025-03-01', 'account', 'account-song', 120_000)]],
  ])
  const store = moduleLoader({
    '@/config/constant': { storageDataPrefix: { playHistory: historyKey, playHistoryDevice: 'device', playHistoryCursor: 'cursor' } },
    '@/utils/dataSpace': {
      getActiveSpace: () => space,
      storageKey: key => `${space}:${key}`,
      onDataSpaceChanged: listener => { changeSpace = listener },
    },
    '@/plugins/storage': {
      getData: async key => {
        const value = structuredClone(disk.get(`${space}:${key}`))
        if (blockRead) await waiting
        return value
      },
      saveData: async(key, value) => { disk.set(`${space}:${key}`, structuredClone(value)) },
    },
  })('../playHistory/store')
  await store.loadPlayHistoryStore()
  assert.equal(report(store.getPlayRecords()).topSongs[0].song.name, 'local-song')
  const updates = []
  const unsubscribe = store.subscribePlayHistory(() => { updates.push(report(store.getPlayRecords())) })
  space = 'account'
  blockRead = true
  const pending = changeSpace()
  assert.equal(store.getPlayRecords().length, 0)
  assert.equal(updates[0].playCount, 0)
  release()
  await pending
  assert.equal(updates.at(-1).minutes, 2)
  assert.equal(updates.at(-1).topSongs[0].song.name, 'account-song')
  unsubscribe()
})
