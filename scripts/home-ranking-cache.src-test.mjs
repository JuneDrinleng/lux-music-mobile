import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const home = read('src/screens/Home/Vertical/Tabs/HomeTab.tsx')
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const normalization = home.slice(home.indexOf('const createLbSourceState ='), home.indexOf('const prewarmRuntimeCoverCache ='))
const normalize = new Script(`(function(){ const LB_FILTER_IDS = ['new', 'trending', 'top']; ${compile(normalization)}; return (all, other) => ({ lbAllData: normalizeCachedLbAllData(all), lbOtherData: normalizeCachedLbOtherData(other) }); })()`).runInThisContext()
const tick = async() => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const harness = () => {
  let now = 0
  let nextId = 0
  const timers = new Map()
  const module = { exports: {} }
  new Script(`(function(module,exports,setTimeout,clearTimeout){${compile(read('src/screens/Home/Vertical/Tabs/homeRankingCacheWriter.ts'))}\n})`).runInThisContext()(module, module.exports,
    (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id },
    id => timers.delete(id))
  const writes = []
  let disk
  let active = 0
  const writer = module.exports.createHomeRankingCacheWriter(payload => {
    assert.equal(++active, 1, 'writes must never overlap')
    return new Promise((resolve, reject) => {
      writes.push({ payload, finish(fail = false) { active--; if (fail) reject(Error('disk')); else { disk = JSON.stringify(payload); resolve() } } })
    })
  })
  return {
    writer,
    writes,
    disk: () => disk && JSON.parse(disk),
    async advance(ms) {
      now += ms
      for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn() }
      await tick()
    },
  }
}
const entry = (id, loading = false) => ({ boardId: id, boardName: id, songs: [{ id }], loading, loaded: !loading, error: false })

test('staggered sources coalesce normalization and skip persisted-equivalent loading changes', async() => {
  const h = harness()
  let normalized = 0
  const enqueue = all => h.writer.enqueue(() => { normalized++; return normalize(all, {}) })
  enqueue({ new: { kw: entry('kw') } })
  await h.advance(80)
  enqueue({ new: { kw: entry('kw'), kg: entry('kg') } })
  await h.advance(149)
  assert.equal(normalized, 0)
  await h.advance(1)
  assert.equal(h.writes.length, 1)
  h.writes[0].finish()
  await tick()
  enqueue({ new: { kw: entry('kw', true), kg: entry('kg', true) } })
  await h.advance(150)
  assert.equal(h.writes.length, 1)
  assert.equal(h.disk().lbAllData.new.kw.loading, false)
})

test('fast board switches during a slow write persist only the latest full snapshot; restart reads final data', async() => {
  const h = harness()
  const first = normalize({ new: { kw: entry('first') } }, {})
  h.writer.enqueue(() => first)
  await h.advance(150)
  h.writer.enqueue(() => normalize({ top: { kg: entry('superseded') } }, {}))
  const latest = normalize({ new: { kw: entry('first') }, top: { kg: entry('latest') } }, { wy: { entries: [entry('other', true)], boards: [], nextIndex: 1, done: true, loading: true, loadingMore: true } })
  h.writer.enqueue(() => latest)
  await h.writer.flush() // background / unmount cannot start a second channel
  assert.equal(h.writes.length, 1)
  h.writes[0].finish()
  await tick()
  assert.equal(h.writes.length, 2)
  assert.deepEqual(h.writes[1].payload, latest)
  h.writes[1].finish()
  await tick()
  assert.deepEqual(h.disk(), latest)
  assert.deepEqual(normalize(h.disk().lbAllData, h.disk().lbOtherData), latest)
})

test('background flush bypasses debounce; failed latest snapshot retries on foreground', async() => {
  const h = harness()
  h.writer.enqueue(() => ({ value: 'latest' }))
  const background = h.writer.flush()
  assert.equal(h.writes.length, 1)
  h.writes[0].finish(true)
  await background
  await h.advance(1000)
  assert.equal(h.writes.length, 1, 'failure must not spin')
  const foreground = h.writer.flush()
  h.writes[1].finish()
  await foreground
  assert.deepEqual(h.disk(), { value: 'latest' })
})

test('failed in-flight write drains newer data without replaying the stale snapshot', async() => {
  const h = harness()
  h.writer.enqueue(() => ({ value: 'old' }))
  await h.advance(150)
  h.writer.enqueue(() => ({ value: 'new' }))
  h.writes[0].finish(true)
  await tick()
  assert.equal(h.writes.length, 2)
  h.writes[1].finish()
  await tick()
  assert.deepEqual(h.disk(), { value: 'new' })
})

test('failure after storage removal invalidates dedupe even when returning to the previous value', async() => {
  const h = harness()
  h.writer.enqueue(() => ({ value: 'first' }))
  await h.advance(150)
  h.writes[0].finish()
  await tick()
  h.writer.enqueue(() => ({ value: 'second' }))
  await h.advance(150)
  h.writer.enqueue(() => ({ value: 'first' }))
  h.writes[1].finish(true)
  await tick()
  assert.equal(h.writes.length, 3)
  h.writes[2].finish()
  await tick()
  assert.deepEqual(h.disk(), { value: 'first' })
})

test('HomeTab uses a module channel and flushes on app state changes and unmount', () => {
  assert.ok(home.indexOf('const leaderboardHomeCacheWriter =') < home.indexOf('export default memo('))
  assert.match(home, /AppState\.addEventListener\('change',[\s\S]*?leaderboardHomeCacheWriter\.flush\(\)/)
  assert.match(home, /subscription\.remove\(\)\s+void leaderboardHomeCacheWriter\.flush\(\)/)
  assert.match(home, /AppState\.currentState !== 'active'/)
  assert.equal((home.match(/saveData\(LEADERBOARD_HOME_CACHE_KEY/g) ?? []).length, 1)
})
