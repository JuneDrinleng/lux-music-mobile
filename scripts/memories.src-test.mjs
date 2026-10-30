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
const { onThisDay } = load('onThisDay')
const { evaluate, milestoneProgress, emptyMilestoneState, artistMilestoneId } = load('milestones')
const at = Date.parse
const record = (time, id, song = 'song', listenedMs = 60_000, singer = 'Artist') => ({
  id: String(id),
  deviceId: 'device',
  startedAt: at(time),
  endedAt: at(time) + listenedMs,
  listenedMs,
  song: { source: 'wy', songmid: song, name: song, singer, img: 'cover' },
})

test('anniversaries aggregate counts, duration, artists and retained first plays across years', () => {
  const old = record('2023-10-17T12:00:00Z', 'old', 'Lemon')
  const recent = [record('2025-10-17T12:00:00Z', 'a', 'Lemon'), record('2025-10-17T13:00:00Z', 'b', 'Lemon'), record('2025-10-17T14:00:00Z', 'c', 'Other', 600_000, 'Artist & Guest & Artist')]
  const history = [recent[2], old, ...recent, { ...recent[0], listenedMs: 120_000 }, record('2026-10-17T10:00:00Z', 'current'), record('2027-10-17T12:00:00Z', 'future')]
  const before = JSON.stringify(history)
  const days = onThisDay(history, at('2026-10-17T12:00:00Z'), 'UTC')
  assert.deepEqual(days.map(day => day.yearsAgo), [1, 3])
  const day = days[0]
  assert.equal(day.playCount, 3)
  assert.equal(day.minutes, 13)
  assert.equal(day.songs[0].song.name, 'Lemon')
  assert.equal(day.songs[0].playCount, 2)
  assert.equal(day.songs[0].firstPlayedAt, old.startedAt)
  assert.deepEqual(day.firstPlayed.map(song => song.song.name), ['Other'])
  assert.equal(day.artists[0].playCount, 3)
  assert.equal(JSON.stringify(history), before)
})

test('local midnight and year boundaries use the start instant, including crossing sessions', () => {
  const history = [record('2025-01-01T07:59:59Z', 'before'), record('2025-01-01T08:00:00Z', 'start'), record('2025-01-02T07:59:59Z', 'end'), record('2025-01-02T08:00:00Z', 'after')]
  const days = onThisDay(history, at('2026-01-01T08:00:00Z'), 'America/Los_Angeles')
  assert.deepEqual(days[0].records.map(item => item.id), ['start', 'end'])
  assert.equal(days[0].date, '2025-01-01')
  assert.deepEqual(onThisDay(history, at('2026-01-01T07:59:59Z'), 'America/Los_Angeles')[0].records.map(item => item.id), ['before'])
  assert.deepEqual(onThisDay([], at('2026-01-01'), 'UTC'), [])
})

test('Feb 29 maps to Feb 28 only in non-leap query years, with separate dated entries', () => {
  const history = [record('2024-02-28T12:00:00Z', '28'), record('2024-02-29T12:00:00Z', '29'), record('2023-02-28T12:00:00Z', '2023')]
  assert.deepEqual(onThisDay(history, at('2025-02-28T12:00:00Z'), 'UTC').map(day => day.date), ['2024-02-29', '2024-02-28', '2023-02-28'])
  assert.equal(onThisDay(history, at('2028-02-29T12:00:00Z'), 'UTC')[0].date, '2024-02-29')
  assert.equal(onThisDay(history, at('2028-02-28T12:00:00Z'), 'UTC').length, 2)
  assert.equal(onThisDay(history, at('2025-03-01T12:00:00Z'), 'UTC').length, 0)
})

for (const [tz, spring, fall] of [
  ['America/Los_Angeles', ['2025-03-09T09:59:59Z', '2025-03-09T10:00:00Z'], ['2025-11-02T08:30:00Z', '2025-11-02T09:30:00Z']],
  ['Europe/Berlin', ['2025-03-30T00:59:59Z', '2025-03-30T01:00:00Z'], ['2025-10-26T00:30:00Z', '2025-10-26T01:30:00Z']],
]) {
  test(`${tz}: spring-forward and repeated fall-back hour both retain sessions`, () => {
    for (const times of [spring, fall]) {
      const history = times.map((time, index) => record(time, index))
      const now = times[0].replace('2025', '2026')
      assert.equal(onThisDay(history, at(now), tz)[0].playCount, 2)
    }
  })
  test(`${tz}: streak counts calendar days over DST, duplicates, gaps and year changes`, () => {
    for (const start of ['2025-02-20T12:00:00Z', '2025-10-15T12:00:00Z', '2025-12-15T12:00:00Z']) {
      const history = Array.from({ length: 30 }, (_, index) => record(new Date(at(start) + index * 86_400_000).toISOString(), index))
      const result = evaluate([...history, history[0]], emptyMilestoneState(), tz)
      assert.equal(result.newlyReached.find(item => item.kind === 'streak').reachedAt, history[29].startedAt)
      assert.equal(evaluate(history.slice(1), emptyMilestoneState(), tz).newlyReached.length, 0)
      assert.equal(evaluate(history.filter((_, index) => index !== 15), emptyMilestoneState(), tz).newlyReached.length, 0)
      assert.equal(evaluate(history, result.state, tz).newlyReached.length, 0)
    }
  })
}

test('1000 distinct source/song identities reach once with the exact triggering song', () => {
  const history = Array.from({ length: 1000 }, (_, index) => record(new Date(at('2025-01-01') + index * 1000).toISOString(), index, String(index)))
  assert.equal(evaluate(history.slice(1), emptyMilestoneState(), 'UTC').newlyReached.length, 0)
  const result = evaluate([...history].reverse(), emptyMilestoneState(), 'UTC')
  assert.equal(result.newlyReached[0].song.songmid, '999')
  assert.equal(result.newlyReached[0].reachedAt, history[999].startedAt)
  assert.equal(evaluate([...history, ...history], result.state, 'UTC').newlyReached.length, 0)
  assert.deepEqual(evaluate([], result.state, 'UTC').state, result.state)
  const repeats = history.map(item => ({ ...item, song: history[0].song }))
  assert.equal(evaluate(repeats, emptyMilestoneState(), 'UTC').newlyReached.length, 0)
})

test('artist 100-hour threshold uses actual audio milliseconds and independent artist identities', () => {
  const history = [record('2025-01-01', 'a', 'song', 360_000_000 - 1, 'A / B / A')]
  assert.equal(evaluate(history, emptyMilestoneState(), 'UTC').newlyReached.length, 0)
  assert.equal(milestoneProgress(history, 'UTC').find(item => item.artist === 'A').remaining > 0, true)
  history.push(record('2025-01-02', 'b', 'song', 1, 'A'))
  const before = emptyMilestoneState()
  const result = evaluate(history, before, 'UTC')
  assert.deepEqual(result.newlyReached.map(item => item.id), [artistMilestoneId('A')])
  assert.deepEqual(before, emptyMilestoneState())
  const progress = milestoneProgress([record('2025-01-01', 'a', 'song', 94 * 3_600_000)], 'UTC').find(item => item.kind === 'artistHours')
  assert.equal(progress.progress, 0.94)
  assert.equal(progress.remaining, 6)
})

const makeStore = (disk = new Map(), hooks = {}) => {
  let space = 'local'
  let writes = 0
  const store = moduleLoader({
    '@/config/constant': { storageDataPrefix: { memoriesMilestones: '@memories_milestones_v1' } },
    '@/utils/dataSpace': { getActiveSpace: () => space, namespacedKey: (key, id) => `${key}@${id}` },
    '../playHistory/store': { getPlayRecords: () => hooks.history ?? [] },
    '@/plugins/storage': {
      getData: async key => { await hooks.read?.(); return structuredClone(disk.get(key) ?? null) },
      saveData: async(key, value) => { if (hooks.fail) throw Error('disk full'); disk.set(key, structuredClone(value)); writes++ },
    },
  })('store')
  return { store, disk, switchTo: id => { space = id }, writes: () => writes }
}
const hours = [record('2025-01-01', 'a', 'song', 360_000_000)]
test('reach/ignore persist per local/account/server space across reloads and concurrent evaluations', async() => {
  const env = makeStore(new Map(), { history: hours })
  const id = artistMilestoneId('Artist')
  const results = await Promise.all([env.store.evaluateMilestones(), env.store.evaluateMilestones()])
  assert.deepEqual(results.map(item => item.newlyReached.length), [1, 0])
  assert.equal(env.writes(), 1)
  env.switchTo('lux:server:alice')
  await Promise.all([env.store.ignoreMilestone(id), env.store.ignoreMilestone(id)])
  assert.equal(env.writes(), 2)
  assert.equal((await env.store.evaluateMilestones(hours)).newlyReached.length, 0)
  env.switchTo('lux:server:bob')
  assert.equal((await env.store.evaluateMilestones(hours)).newlyReached.length, 1)
  env.switchTo('lux:other:alice')
  assert.equal((await env.store.evaluateMilestones(hours)).newlyReached.length, 1)
  const restarted = makeStore(env.disk)
  assert.equal((await restarted.store.evaluateMilestones(hours)).newlyReached.length, 0)
  restarted.switchTo('lux:server:alice')
  assert.deepEqual((await restarted.store.loadMilestoneState()).ignored, [id])
  assert.equal((await restarted.store.evaluateMilestones(hours)).newlyReached.length, 0)
})

test('in-flight storage stays in the captured space; failed writes retry without losing achievements', async() => {
  let release
  const waiting = new Promise(resolve => { release = resolve })
  const hooks = { read: () => waiting }
  const env = makeStore(new Map(), hooks)
  const pending = env.store.evaluateMilestones(hours)
  env.switchTo('lux:s:u')
  release()
  await pending
  assert.equal(env.disk.has('@memories_milestones_v1@local'), true)
  assert.equal((await env.store.loadMilestoneState()).ignored.length, 0)
  hooks.fail = true
  await assert.rejects(env.store.evaluateMilestones(hours), /disk full/)
  hooks.fail = false
  assert.equal((await env.store.evaluateMilestones(hours)).newlyReached.length, 1)
  await env.store.ignoreMilestone(artistMilestoneId('Artist'))
  const state = await env.store.loadMilestoneState()
  assert.equal(Object.keys(state.achieved).length, 1)
  assert.equal(state.ignored.length, 1)
})

for (const [tz, date, start, end] of [
  ['America/Los_Angeles', '2025-03-09', '2025-03-09T08:00:00Z', '2025-03-10T07:00:00Z'],
  ['America/Los_Angeles', '2025-11-02', '2025-11-02T07:00:00Z', '2025-11-03T08:00:00Z'],
  ['Europe/Berlin', '2025-03-30', '2025-03-29T23:00:00Z', '2025-03-30T22:00:00Z'],
  ['Europe/Berlin', '2025-10-26', '2025-10-25T22:00:00Z', '2025-10-26T23:00:00Z'],
]) {
  test(`${tz}: exact midnight bounds on the DST date ${date}`, () => {
    const history = [at(start) - 1, at(start), at(end) - 1, at(end)].map((time, index) => record(new Date(time).toISOString(), index))
    const result = onThisDay(history, at(`${date.replace('2025', '2026')}T12:00:00Z`), tz)
    assert.deepEqual(result[0].records.map(item => item.id), ['1', '2'])
  })
}

test('milestone identities keep music sources distinct and preserve unknown-version storage', async() => {
  const history = [record('2025-01-01', '1'), { ...record('2025-01-01', '2'), song: { ...hours[0].song, source: 'kg' } }]
  assert.equal(milestoneProgress(history, 'UTC')[0].value, 2)
  const disk = new Map([['@memories_milestones_v1@local', { version: 2 }]])
  const env = makeStore(disk)
  await assert.rejects(env.store.evaluateMilestones(hours), /Invalid memories/)
  assert.equal(env.writes(), 0)
  assert.deepEqual(disk.get('@memories_milestones_v1@local'), { version: 2 })
})
