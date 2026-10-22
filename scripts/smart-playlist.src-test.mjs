/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const evaluate = (file, deps = {}, sandbox) => {
  const js = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  const script = new Script(`(function(require,module,exports){${js}\n})`)
  const run = sandbox ? script.runInNewContext(sandbox) : script.runInThisContext()
  run(name => {
    assert.ok(name in deps, `Unexpected dependency ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const model = evaluate('src/utils/smartPlaylist/model.ts')
const evaluator = evaluate('src/utils/smartPlaylist/evaluator.ts', {
  './model': model,
  '../playHistory/threshold': evaluate('src/utils/playHistory/threshold.ts'),
})
const { buildSongFacts, evaluateRules, songKey } = evaluator
const day = 86400000
const now = 100 * day
const song = (id, source = 'wy', extra = {}) => ({ id: `${source}_${id}`, source, name: '晴天', singer: '周杰伦', interval: '03:20', meta: { songId: id, albumName: '叶惠美' }, ...extra })
const record = (id, music, startedAt = now) => ({ id, deviceId: 'device', startedAt, endedAt: startedAt + 30000, listenedMs: 30000, song: { source: music.source, songmid: String(music.meta.songId), name: music.name, singer: music.singer } })
const rules = (conditions = [], extra = {}) => ({ match: 'all', rules: conditions, sort: { field: 'library', direction: 'asc' }, ...extra })
const condition = (field, operator, value) => ({ field, operator, value })
const definition = id => ({ playlistId: id, name: '最近循环', autoRefresh: true, ruleSet: rules([condition('playCount', 'gte', 5)], { sort: { field: 'playCount', direction: 'desc' }, limit: 50 }) })

test('4A example intersects play count, rolling last played, source and artist; counts before limit', () => {
  const a = song('a'); const b = song('b'); const c = song('c', 'mg'); const old = song('old')
  const history = [a, b, c, old].flatMap(music => Array.from({ length: 5 }, (_, i) => record(`${music.id}:${i}`, music, music === old ? now - 31 * day : now - i * day)))
  const facts = buildSongFacts([{ songs: [a, b, c, old] }], history)
  const before = JSON.stringify({ facts, history })
  const spec = rules([condition('playCount', 'gte', 5), condition('lastPlayed', 'withinDays', 30), condition('source', 'notEquals', 'mg'), condition('artist', 'contains', '周杰伦')], { limit: 1, sort: { field: 'playCount', direction: 'desc' } })
  assert.deepEqual(evaluateRules(facts, spec, now), { matchCount: 2, songs: [a] })
  assert.equal(JSON.stringify({ facts, history }), before)
  assert.deepEqual(evaluateRules(facts, rules(spec.rules, { match: 'any' }), now).songs, [a, b, c, old])
})

test('library facts dedupe across lists by provider/id, join unique history, union likes, retain actual song objects', () => {
  const a = song(123); const same = song('123', 'wy', { name: 'Alternate metadata' }); const other = song(123, 'kg'); const unsaved = song('unsaved')
  const r = record('r', a, now - day)
  const facts = buildSongFacts([{ songs: [a, other] }, { songs: [same], liked: true }], [r, r, record('new', a), record('other', other), record('missing', unsaved)], new Map([[songKey('wy', 123), now - 2 * day]]))
  assert.equal(facts.length, 2)
  assert.equal(facts[0].song, a)
  assert.deepEqual([facts[0].playCount, facts[0].lastPlayed, facts[0].liked, facts[0].duration, facts[0].addedDate], [2, now, true, 200, now - 2 * day])
  assert.equal(facts[1].playCount, 1)
  assert.equal(facts[1].liked, false)
  assert.equal(facts[1].addedDate, null)
  assert.notEqual(songKey('a:b', 'c'), songKey('a', 'b:c'))
})

test('all field types and every supported operator have behavior coverage', () => {
  const facts = buildSongFacts([{ songs: [song('a')], liked: true }], [])
  const fact = { ...facts[0], title: '  Ｈｅｌｌｏ World  ', playCount: 5, lastPlayed: now - day, addedDate: now - 2 * day }
  const cases = [
    ['title', 'contains', 'HELLO', true], ['title', 'notContains', 'world', false],
    ['title', 'equals', 'hello world', true], ['title', 'notEquals', 'hello', true],
    ['artist', 'contains', '周', true], ['album', 'equals', '叶惠美', true],
    ['source', 'equals', 'WY', true], ['source', 'notEquals', 'wy', false],
    ['playCount', 'equals', 5, true], ['playCount', 'notEquals', 4, true],
    ['playCount', 'gt', 5, false], ['playCount', 'gte', 5, true],
    ['playCount', 'lt', 5, false], ['playCount', 'lte', 5, true],
    ['duration', 'gte', 200, true], ['duration', 'lt', 201, true],
    ['lastPlayed', 'before', now, true], ['lastPlayed', 'after', now, false],
    ['lastPlayed', 'withinDays', 1, true], ['lastPlayed', 'notWithinDays', 1, false],
    ['addedDate', 'withinDays', 1, false], ['addedDate', 'notWithinDays', 1, true],
    ['liked', 'equals', true, true], ['liked', 'notEquals', false, true],
  ]
  for (const [field, operator, value, expected] of cases) {
    assert.equal(evaluateRules([fact], rules([condition(field, operator, value)]), now).matchCount, Number(expected), `${field}/${operator}`)
  }
})

test('unknown duration/dates and future dates do not match rolling conditions; empty rules match the library', () => {
  const a = song('a', 'local', { interval: null })
  const facts = buildSongFacts([{ songs: [a] }], [record('bad', a, NaN)])
  for (const rule of [condition('duration', 'notEquals', 1), condition('lastPlayed', 'notWithinDays', 30), condition('addedDate', 'before', now)]) {
    assert.equal(evaluateRules(facts, rules([rule]), now).matchCount, 0)
  }
  for (const match of ['all', 'any']) assert.equal(evaluateRules(facts, rules([], { match }), now).matchCount, 1)
  const future = buildSongFacts([{ songs: [a] }], [record('future', a, now + day)])
  for (const op of ['withinDays', 'notWithinDays']) assert.equal(evaluateRules(future, rules([condition('lastPlayed', op, 30)]), now).matchCount, 0)
  assert.deepEqual(evaluateRules([], rules(), now), { matchCount: 0, songs: [] })
})

test('sorts in both directions, keeps ties stable and unknowns last, without mutating facts', () => {
  const songs = [song('a'), song('b'), song('c')]
  const facts = buildSongFacts([{ songs }], [record('a', songs[0], now), record('b', songs[1], now - day)])
  for (const [field, direction, expected] of [
    ['lastPlayed', 'asc', [songs[1], songs[0], songs[2]]],
    ['lastPlayed', 'desc', songs], ['playCount', 'desc', songs], ['library', 'desc', [...songs].reverse()],
  ]) assert.deepEqual(evaluateRules(facts, rules([], { sort: { field, direction } }), now).songs, expected)
  assert.deepEqual(facts.map(f => f.song), songs)
})

test('invalid persisted rules reject unsupported field/operator/value and unsafe sort/limits', () => {
  const bad = [null, {}, rules([condition('title', 'gte', 3)]), rules([condition('source', 'contains', 'wy')]),
    rules([condition('liked', 'equals', 'true')]), rules([condition('playCount', 'gte', 1.5)]),
    rules([condition('duration', 'gte', NaN)]), rules([condition('lastPlayed', 'withinDays', -1)]),
    rules([condition('artist', 'contains', '')]), rules([condition('__proto__', 'equals', 'x')]),
    rules([], { match: 'maybe' }), rules([], { sort: { field: 'bogus', direction: 'asc' } }),
    rules([], { sort: { field: 'title', direction: 'random' } }), ...[0, -1, 1.5, Infinity].map(limit => rules([], { limit })),
    rules(Array.from({ length: 101 }, () => condition('liked', 'equals', true))),
  ]
  for (const spec of bad) {
    assert.equal(model.isRuleSet(spec), false)
    assert.throws(() => evaluateRules([], spec, now), /Invalid/)
  }
  assert.throws(() => evaluateRules([], rules(), NaN), /Invalid/)
})

const storageEnv = () => {
  let space = 'local'
  const disk = new Map()
  let fail = false
  const store = evaluate('src/utils/smartPlaylist/store.ts', {
    './model': model,
    '@/config/constant': { storageDataPrefix: { smartPlaylistRules: '@smart_playlist_rules_v1' } },
    '@/utils/dataSpace': { getActiveSpace: () => space, namespacedKey: (key, id) => `${key}@${id}` },
    '@/plugins/storage': {
      getData: async key => JSON.parse(disk.get(key) ?? 'null'),
      saveData: async(key, value) => { if (fail) throw Error('disk failed'); disk.set(key, JSON.stringify(value)) },
    },
  })
  return { store, disk, switch: id => { space = id }, fail: value => { fail = value } }
}

test('rule storage captures spaces before awaiting, snapshots inputs and serializes concurrent upserts/removal', async() => {
  const env = storageEnv()
  assert.deepEqual(await env.store.loadSmartPlaylistRules(), [])
  const first = definition('a')
  const a = env.store.saveSmartPlaylistRule(first)
  first.name = 'mutated after invocation'
  const b = env.store.saveSmartPlaylistRule(definition('b'))
  env.switch('lux:s:alice')
  const account = env.store.saveSmartPlaylistRule(definition('account'))
  await Promise.all([a, b, account])
  assert.deepEqual((await env.store.loadSmartPlaylistRules()).map(item => item.playlistId), ['account'])
  env.switch('local')
  assert.deepEqual(await env.store.loadSmartPlaylistRules(), [definition('a'), definition('b')])
  const remove = env.store.removeSmartPlaylistRule('a')
  const replace = env.store.saveSmartPlaylistRule({ ...definition('b'), autoRefresh: false })
  await Promise.all([remove, replace])
  assert.deepEqual(await env.store.loadSmartPlaylistRules(), [{ ...definition('b'), autoRefresh: false }])
  assert.equal(env.disk.size, 2)
  assert.ok([...env.disk.keys()].every(key => key.startsWith('@smart_playlist_rules_v1@')))
})

test('invalid storage is preserved; failed writes do not poison later operations', async() => {
  const env = storageEnv()
  await assert.rejects(env.store.saveSmartPlaylistRule({ ...definition('a'), name: '' }), /Invalid/)
  assert.equal(env.disk.size, 0)
  env.fail(true)
  await assert.rejects(env.store.saveSmartPlaylistRule(definition('a')), /disk failed/)
  env.fail(false)
  await env.store.saveSmartPlaylistRule(definition('a'))
  assert.equal((await env.store.loadSmartPlaylistRules()).length, 1)
  for (const corrupt of [{ version: 2, playlists: [] }, { version: 1, playlists: [definition('a'), definition('a')] }, { version: 1, playlists: [{}] }]) {
    const bytes = JSON.stringify(corrupt)
    env.disk.set('@smart_playlist_rules_v1@local', bytes)
    await assert.rejects(env.store.loadSmartPlaylistRules(), /Invalid/)
    await assert.rejects(env.store.saveSmartPlaylistRule(definition('b')), /Invalid/)
    assert.equal(env.disk.get('@smart_playlist_rules_v1@local'), bytes)
  }
})

const service = evaluate('src/utils/smartPlaylist/service.ts')
test('materialization preserves evaluator order, removes stale songs and is idempotent', async() => {
  const a = song('a'); const b = song('b'); const c = song('c')
  let current = [a, c]
  let writes = 0
  const write = async next => { current = next; writes++ }
  assert.equal(await service.materializeSongs(current, [b, a], write), true)
  assert.deepEqual(current, [b, a])
  assert.equal(await service.materializeSongs(current, [b, a], write), false)
  assert.equal(writes, 1)
  await service.materializeSongs(current, [], write)
  assert.deepEqual(current, [])
})
test('auto refresh debounces bursts, serializes work and keeps one follow-up while busy', async() => {
  let calls = 0
  let release
  const refresh = service.createSmartRefresh(async() => { calls++; if (calls == 1) await new Promise(resolve => { release = resolve }) }, 5)
  refresh.trigger(); refresh.trigger(); refresh.trigger()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 1)
  refresh.trigger(); refresh.trigger()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(calls, 1)
  release()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 2)
  refresh.trigger(); refresh.stop()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 2)
})
test('async evaluation yields, cancels obsolete work and matches synchronous stable ordering', async() => {
  const songs = Array.from({ length: 550 }, (_, i) => song(String(i)))
  const lists = [{ songs }]
  let ticked = false
  setTimeout(() => { ticked = true }, 0)
  const facts = await evaluator.buildSongFactsAsync(lists, [])
  assert.equal(ticked, true)
  const spec = rules([], { sort: { field: 'title', direction: 'desc' }, limit: 150 })
  assert.deepEqual(await evaluator.evaluateRulesAsync(facts, spec, now), evaluateRules(facts, spec, now))
  let checks = 0
  await assert.rejects(evaluator.buildSongFactsAsync(lists, [], () => { if (++checks == 3) throw Error('cancelled') }), /cancelled/)
})

test('runtime history/library events refresh once; own playlist writes never schedule another refresh; disabled rules stay unchanged', async() => {
  const listeners = new Map()
  const hub = { on: (event, fn) => listeners.set(event, fn), off: event => listeners.delete(event) }
  let historyTrigger
  let writes = 0
  let current = []
  const a = song('a')
  const def = { ...definition('smart'), ruleSet: rules([]) }
  const deps = {
    '@/core/list': {
      getListMusics: async id => id == 'smart' ? current : [a],
      overwriteListMusics: async(id, songs) => { writes++; current = songs; listeners.get('myListMusicUpdate')?.([id]) },
    },
    '@/store/list/state': { default: { allList: [{ id: 'library' }, { id: 'smart' }], userList: [{ id: 'smart' }] } },
    '@/config/constant': { LIST_IDS: { LOVE: 'love' } },
    '@/utils/dataSpace': { getActiveSpace: () => 'local', onDataSpaceChanged: () => () => {} },
    '@/utils/playHistory/store': { getPlayRecords: () => [], subscribePlayHistory: fn => { historyTrigger = fn; return () => {} } },
    './evaluator': evaluator,
    './store': { loadSmartPlaylistRules: async() => [def], removeSmartPlaylistRule: async() => {} },
    './service': { ...service, createSmartRefresh: run => service.createSmartRefresh(run, 5) },
  }
  const runtime = evaluate('src/utils/smartPlaylist/index.ts', deps, { global: { app_event: hub, state_event: hub }, setTimeout, clearTimeout })
  const stop = runtime.startSmartPlaylists()
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(writes, 1)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(writes, 1)
  current = []
  historyTrigger(); historyTrigger(); listeners.get('myListMusicUpdate')(['library'])
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(writes, 2)
  def.autoRefresh = false
  current = []
  historyTrigger()
  await new Promise(resolve => setTimeout(resolve, 40))
  assert.equal(writes, 2)
  stop()
  assert.equal(listeners.size, 0)
})
