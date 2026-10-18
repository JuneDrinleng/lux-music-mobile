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
  return name => load(join(root, 'src/utils/recommend', `${name}.ts`))
}
const { rankCandidates, sameSong } = moduleLoader()('engine')
const now = new Date(2026, 9, 18, 12).getTime()
const song = (id, singer = `Artist ${id}`, source = 'wy') => ({ source, songmid: String(id), name: `Song ${id}`, singer })
const candidate = (id, singer, source) => ({ song: song(id, singer, source), origin: 'library' })
const pool = Array.from({ length: 40 }, (_, id) => candidate(id))
const record = (item, flags = {}, time = now - 10 * 86400000) => ({
  id: `d:${item.songmid}:${time}`, deviceId: 'd', startedAt: time, endedAt: time + 60000, listenedMs: 60000, song: item, ...flags,
})
const options = { now, seed: '2026-10-18:local', history: [], isDisliked: () => false, limit: 20 }

test('daily pure ranking is stable across input order and changes with date/space seeds', () => {
  const before = JSON.stringify(pool)
  const first = rankCandidates(pool, options)
  assert.deepEqual(first, rankCandidates([...pool].reverse(), options))
  assert.notDeepEqual(first, rankCandidates(pool, { ...options, seed: '2026-10-19:local' }))
  assert.notDeepEqual(first, rankCandidates(pool, { ...options, seed: '2026-10-18:lux:s:u' }))
  assert.equal(JSON.stringify(pool), before)
})

test('disliked candidates and their provider duplicates are excluded before scoring', () => {
  const duplicate = candidate(0, undefined, 'tx')
  const result = rankCandidates([...pool, duplicate], { ...options, isDisliked: item => item.source == 'tx' })
  assert.equal(result.some(item => item.song.name == 'Song 0'), false)
  assert.equal(result.length, 20)
})

test('dedupe uses history identity and normalized title/artist across sources, retaining versions', () => {
  const a = candidate(0, 'A & B')
  const b = { ...candidate(1, 'b / a', 'tx'), song: { ...song(1, 'b / a', 'tx'), name: ' SONG 0 ' } }
  const live = { ...a, song: { ...a.song, songmid: 'live', name: 'Song 0 (Live)' } }
  assert.equal(sameSong(a.song, b.song), true)
  const results = rankCandidates([a, b, live, a], options)
  assert.equal(results.length, 2)
  assert.equal(results.some(item => item.song.name.endsWith('(Live)')), true)
})

test('skips penalize, completions boost, duplicate records do not inflate scoring', () => {
  const c = candidate(0, 'A')
  const score = flags => rankCandidates([c], { ...options, history: [record(c.song, flags)] })[0].score
  assert.ok(score({ completed: true }) > score({}))
  assert.ok(score({ skipped: true }) < score({}))
  const history = [record(c.song, { completed: true })]
  assert.deepEqual(rankCandidates([c], { ...options, history }), rankCandidates([c], { ...options, history: [...history, ...history] }))
})

test('recent plays/recommendations and radio history suppress cross-source repeats without backfill', () => {
  const recent = record(song(0, undefined, 'tx'), {}, now - 1000)
  const recommended = [{ song: song(1, undefined, 'kg'), at: now - 1000 }]
  const results = rankCandidates(pool, { ...options, history: [recent], recommended, exclude: [song(2)], limit: 100 })
  assert.equal(results.length, 37)
  assert.deepEqual(results.filter(item => ['0', '1', '2'].includes(item.song.songmid)), [])
  assert.equal(rankCandidates([pool[0]], { ...options, history: [recent] }).length, 0)
})

test('artist affinity and repeated listening influence ranking; legacy and future history are safe', () => {
  const c = candidate(0, 'A')
  const base = rankCandidates([c], options)[0].score
  const history = [record(song('other', 'A'))]
  assert.ok(rankCandidates([c], { ...options, history })[0].score > base)
  assert.equal(rankCandidates([c], { ...options, history: [record(c.song, {}, now + 1)] })[0].score, base)
  const repeat = [record(c.song), record(c.song, {}, now - 11 * 86400000)]
  assert.ok(rankCandidates([c], { ...options, history: repeat })[0].score > rankCandidates([c], { ...options, history: repeat.slice(0, 1) })[0].score)
})

const { collectCandidates, historySource } = moduleLoader()('sources')
test('sources reject/throw/timeout independently and degrade to pure local, including late rejection', async() => {
  const sources = [
    historySource,
    { id: 'local:library', load: async() => pool.slice(0, 5) },
    { id: 'reject', load: async() => { throw Error('offline') } },
    { id: 'throw', load: () => { throw Error('bad script') } },
    { id: 'hang', load: async() => new Promise(() => {}) },
    { id: 'late', load: async() => new Promise((resolve, reject) => setTimeout(() => reject(Error('late')), 25)) },
  ]
  const context = { ...options, spaceId: 'local', history: [record(song('history'))] }
  const result = await collectCandidates(sources, context, 10)
  assert.deepEqual(result.candidates, [{ song: song('history'), origin: 'history' }, ...pool.slice(0, 5)])
  assert.deepEqual(result.failures, [
    { id: 'reject', reason: 'failed' }, { id: 'throw', reason: 'failed' },
    { id: 'hang', reason: 'timeout' }, { id: 'late', reason: 'timeout' },
  ])
  await new Promise(resolve => setTimeout(resolve, 30))
})

const platformLoader = () => moduleLoader({
  '@/utils/musicSdk': { default: {} },
  '@/utils/musicSdk/kg/singer': { default: {} },
  '@/utils': { toNewMusicInfo: raw => ({ ...raw, id: `${raw.source}_${raw.songmid}`, meta: { songId: raw.songmid, albumName: raw.albumName, qualitys: raw.types, _qualitys: raw._types } }) },
  './local': { libraryCandidate: musicInfo => ({ song: { ...musicInfo, songmid: String(musicInfo.meta.songId) }, origin: 'library', musicInfo }) },
})('platform')

test('existing SDK adapter calls boards, playlist square/detail, artist catalog and singer songs with correct arguments', async() => {
  const calls = []
  const raw = { ...song(7, 'A', 'kg'), hash: 'playback-hash', types: [{ type: '128k' }], _types: {} }
  const result = { list: [raw] }
  const sdk = {
    leaderboard: {
      getBoards: async() => ({ list: [{ bangid: 'board' }] }),
      getList: async(...args) => { calls.push(['chart', ...args]); return result },
    },
    songList: {
      sortList: [{ id: 'hot' }],
      getList: async(...args) => { calls.push(['square', ...args]); return { list: [{ id: 'playlist' }] } },
      getListDetail: async(...args) => { calls.push(['detail', ...args]); return result },
    },
    musicSearch: {
      search: async(...args) => { calls.push(['search', ...args]); return result },
      musicSearch: async(...args) => { calls.push(['raw-search', ...args]); return { data: { lists: [{ Singers: [{ id: 123, name: 'A' }] }] } } },
    },
  }
  const singer = { getSingerSongList: async(...args) => { calls.push(['artist', ...args]); return result } }
  const { platformSources } = platformLoader()
  const sources = platformSources({ kg: sdk, tx: { songList: sdk.songList } }, singer)
  const loaded = await collectCandidates(sources, { ...options, spaceId: 'local', anchor: song(1, 'A') })
  assert.deepEqual(loaded.failures, [])
  assert.equal(loaded.candidates.length, 5)
  assert.ok(loaded.candidates.every(item => item.musicInfo.hash == 'playback-hash'))
  assert.ok(calls.some(call => JSON.stringify(call) == JSON.stringify(['artist', 123, 1, 30])))
  assert.ok(calls.some(call => JSON.stringify(call) == JSON.stringify(['detail', 'playlist', undefined])))
  assert.ok(calls.some(call => JSON.stringify(call) == JSON.stringify(['detail', 'playlist', 1])))
  assert.deepEqual([...new Set(loaded.candidates.map(item => item.origin))].sort(), ['artist', 'chart', 'playlist', 'similar'])
})

test('local adapter loads default/favorites/unloaded playlists independently and rejects cross-space reads', async() => {
  let active = 'local'
  const calls = []
  const musicInfo = { id: 'wy_1', source: 'wy', name: 'Song', singer: 'A', interval: '03:00', meta: { songId: 1, albumName: 'album' } }
  const { localSources } = moduleLoader({
    '@/config/constant': { LIST_IDS: { DEFAULT: 'default', LOVE: 'love' } },
    '@/utils/dataSpace': { getActiveSpace: () => active },
    '@/utils/listManage': {
      userLists: [{ id: 'unloaded' }],
      getListMusics: async id => { calls.push(id); if (id == 'love') throw Error('bad list'); return [musicInfo] },
    },
  })('local')
  const context = { ...options, spaceId: 'local' }
  const result = await collectCandidates(localSources(), context)
  assert.deepEqual(calls.sort(), ['default', 'love', 'unloaded'])
  assert.equal(result.candidates.length, 2)
  assert.equal(result.candidates[0].song.songmid, '1')
  assert.equal(result.candidates[0].musicInfo, musicInfo)
  active = 'lux:s:u'
  assert.deepEqual((await collectCandidates(localSources(), context)).candidates, [])
})

const { createRecommendationEngine } = moduleLoader()('service')
const serviceEnv = (disk = new Map(), hooks = {}) => {
  let space = 'local'
  let history = []
  let disliked = () => false
  let loads = 0
  const deps = {
    getSpaceId: () => space,
    getHistory: () => history,
    isDisliked: item => disliked(item),
    getSources: () => [{ id: 'local:library', load: async() => { loads++; await hooks.load?.(); return hooks.pool ?? pool } }, ...(hooks.sources ?? [])],
    readCache: async id => { await hooks.read?.(); if (hooks.diskFail) throw Error('disk'); return structuredClone(disk.get(id) ?? null) },
    writeCache: async(id, value) => { if (hooks.diskFail) throw Error('disk'); disk.set(id, structuredClone(value)) },
  }
  return {
    engine: createRecommendationEngine(deps),
    disk,
    loads: () => loads,
    switchTo: id => { space = id },
    setHistory: value => { history = value },
    dislike: fn => { disliked = fn },
  }
}
const dailyOpts = { now, limit: 10, timeZone: 'America/Los_Angeles' }

test('daily API stays stable later the same local day, across reloads and concurrent callers, regardless of first limit', async() => {
  const env = serviceEnv()
  const [small, full] = await Promise.all([
    env.engine.getDailyRecommendations({ ...dailyOpts, limit: 3 }),
    env.engine.getDailyRecommendations(dailyOpts),
  ])
  assert.equal(env.loads(), 1)
  assert.deepEqual(small.items, full.items.slice(0, 3))
  assert.deepEqual(await env.engine.getDailyRecommendations({ ...dailyOpts, now: now + 3600000 }), full)
  full.items[0].song.name = 'caller mutation'
  const restarted = serviceEnv(env.disk)
  const again = await restarted.engine.getDailyRecommendations(dailyOpts)
  assert.notEqual(again.items[0].song.name, 'caller mutation')
  assert.equal(restarted.loads(), 0)
  assert.equal(again.date, '2026-10-18')
  const nextDay = await restarted.engine.getDailyRecommendations({ ...dailyOpts, now: now + 86400000 })
  assert.notDeepEqual(again.items, nextDay.items)
  assert.ok(nextDay.items.every(item => !again.items.some(old => sameSong(old.song, item.song))))
})

test('daily cache separates local/user/server spaces and seeds; reads use captured space', async() => {
  const env = serviceEnv()
  const local = await env.engine.getDailyRecommendations(dailyOpts)
  for (const id of ['lux:s:alice', 'lux:s:bob', 'lux:other:alice']) {
    env.switchTo(id)
    const result = await env.engine.getDailyRecommendations(dailyOpts)
    assert.equal(result.spaceId, id)
    assert.notDeepEqual(local.items, result.items)
  }
  assert.equal(env.disk.size, 4)
  env.switchTo('local')
  assert.deepEqual(await env.engine.getDailyRecommendations(dailyOpts), local)
})

test('new dislikes and recent plays remove cached songs immediately without reordering remaining songs', async() => {
  const env = serviceEnv()
  const first = await env.engine.getDailyRecommendations(dailyOpts)
  env.dislike(item => sameSong(item, first.items[0].song))
  env.setHistory([record(first.items[1].song, {}, now - 1000)])
  const next = await env.engine.getDailyRecommendations(dailyOpts)
  assert.deepEqual(next.items.slice(0, 8), first.items.slice(2))
  assert.equal(next.items.some(item => first.items.slice(0, 2).some(old => sameSong(item.song, old.song))), false)
  assert.equal(env.loads(), 1)
})

test('daily source failure returns and persists local-only recommendations and failure diagnostics', async() => {
  const env = serviceEnv(new Map(), { sources: [{ id: 'wy:chart', load: async() => { throw Error('offline') } }] })
  const first = await env.engine.getDailyRecommendations(dailyOpts)
  assert.equal(first.items.length, 10)
  assert.ok(first.items.every(item => item.origin == 'library'))
  assert.deepEqual(first.failures, [{ id: 'wy:chart', reason: 'failed' }])
  assert.deepEqual(await serviceEnv(env.disk).engine.getDailyRecommendations(dailyOpts), first)
})

test('similar API excludes seed aliases, exposes provider groups/reasons; radio excludes queue and recent recommendations', async() => {
  const env = serviceEnv(new Map(), { pool: Array.from({ length: 50 }, (_, i) => candidate(i, 'A', i % 2 ? 'wy' : 'tx')) })
  const similar = await env.engine.getSimilar(song(0, 'A', 'kg'), dailyOpts)
  assert.equal(similar.items.length, 10)
  assert.deepEqual(Object.keys(similar.bySource).sort(), ['tx', 'wy'])
  assert.ok(similar.items.every(item => item.reasons.includes('artist-affinity') && item.song.name != 'Song 0'))
  const [a, b] = await Promise.all([
    env.engine.getRadioNext(song(0, 'A'), [song(1, 'A')], dailyOpts),
    env.engine.getRadioNext(song(0, 'A'), [song(1, 'A')], dailyOpts),
  ])
  for (const result of [a, b]) {
    assert.equal(result.items.length, 10)
    assert.ok(result.items.every(item => !['Song 0', 'Song 1'].includes(item.song.name)))
    assert.ok(result.items.every(item => !similar.items.some(old => sameSong(item.song, old.song))))
  }
  assert.ok(b.items.every(item => !a.items.some(old => sameSong(item.song, old.song))))
})

test('switching spaces during source or cache await rejects and never persists into the new account', async() => {
  for (const stage of ['load', 'read']) {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const env = serviceEnv(new Map(), { [stage]: () => gate })
    const pending = env.engine.getDailyRecommendations(dailyOpts)
    await new Promise(resolve => setTimeout(resolve, 5))
    env.switchTo('lux:s:bob')
    release()
    await assert.rejects(pending, /Data space changed/)
    assert.equal(env.disk.size, 0)
  }
})

test('storage failures preserve session stability and empty history/pool returns an empty batch', async() => {
  const env = serviceEnv(new Map(), { diskFail: true })
  const first = await env.engine.getDailyRecommendations(dailyOpts)
  assert.equal(first.items.length, 10)
  assert.deepEqual(await env.engine.getDailyRecommendations(dailyOpts), first)
  assert.equal(env.loads(), 1)
  const empty = serviceEnv(new Map(), { pool: [] })
  assert.deepEqual((await empty.engine.getDailyRecommendations(dailyOpts)).items, [])
})

test('daily local date uses DST/midnight calendar boundaries rather than UTC date', async() => {
  const env = serviceEnv()
  const before = await env.engine.getDailyRecommendations({ ...dailyOpts, now: Date.parse('2026-11-01T06:59:59Z') })
  assert.equal(before.date, '2026-10-31')
  const after = await env.engine.getDailyRecommendations({ ...dailyOpts, now: Date.parse('2026-11-01T07:00:00Z') })
  assert.equal(after.date, '2026-11-01')
  const repeatedHour = await env.engine.getDailyRecommendations({ ...dailyOpts, now: Date.parse('2026-11-01T09:30:00Z') })
  assert.deepEqual(after, repeatedHour)
  assert.equal(env.loads(), 2)
})

test('default public API reuses actual dislike rules (title, singer, combination) and registers captured space storage', async() => {
  const action = moduleLoader({
    '@/config/constant': { SPLIT_CHAR: { DISLIKE_NAME: '@', DISLIKE_NAME_ALIAS: '#' } },
    './event': { event: { dislike_changed: () => {} } },
  })('../../store/dislikeList/action')
  action.setDislikeInfo({ musicNames: new Set(['song 0']), singerNames: new Set(['artist 1']), names: new Set(['song 2@artist 2']), rules: '' })
  const disk = new Map()
  let listener
  const api = moduleLoader({
    '@/config/constant': { storageDataPrefix: { recommendations: '@recommendations_v1' } },
    '@/core/dislikeList': { hasDislike: action.hasDislike },
    '@/plugins/storage': {
      getData: async key => structuredClone(disk.get(key) ?? null),
      saveData: async(key, value) => { disk.set(key, structuredClone(value)) },
    },
    '@/utils': { toNewMusicInfo: item => item },
    '@/utils/dataSpace': {
      getActiveSpace: () => 'local',
      namespacedKey: (key, space) => `${key}@${space}`,
      onDataSpaceWillChange: fn => { listener = fn },
    },
    '../playHistory/store': { getPlayRecords: () => [] },
    './local': { localSources: () => [{ id: 'local', load: async() => pool }] },
    './platform': { platformSources: () => [] },
  })('index')
  const result = await api.getDailyRecommendations({ ...dailyOpts, limit: 100 })
  assert.equal(result.items.length, 37)
  assert.equal(result.items.some(item => ['Song 0', 'Song 1', 'Song 2'].includes(item.song.name)), false)
  assert.equal(disk.has('@recommendations_v1@local'), true)
  assert.equal(typeof listener, 'function')
  listener()
  assert.deepEqual(await api.getDailyRecommendations({ ...dailyOpts, limit: 100 }), result)
})

test('malformed persisted cache is disposable and cannot break local fallback', async() => {
  const disk = new Map([['local', { version: 1, date: '2026-10-18', daily: [{ song: {}, key: 'bad', reasons: [], score: 0 }], dailyFailures: [], exposures: [] }]])
  const env = serviceEnv(disk)
  assert.equal((await env.engine.getDailyRecommendations(dailyOpts)).items.length, 10)
  assert.equal(env.loads(), 1)
})

test('leaving and returning to the same space cancels old work even when the space ID matches again', async() => {
  let release
  let entered
  const loading = new Promise(resolve => { entered = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const env = serviceEnv(new Map(), { load: async() => { entered(); await gate } })
  const pending = env.engine.getDailyRecommendations(dailyOpts)
  await loading
  env.engine.clearSessionCache()
  env.switchTo('lux:s:bob')
  env.engine.clearSessionCache()
  env.switchTo('local')
  release()
  await assert.rejects(pending, /Data space changed/)
  assert.equal(env.disk.size, 0)
  assert.equal((await env.engine.getDailyRecommendations(dailyOpts)).items.length, 10)
})

test('plays and dislikes arriving while sources load are excluded before returning a batch', async() => {
  const env = serviceEnv(new Map(), {
    load: () => {
      env.setHistory([record(song(0), {}, now - 1000)])
      env.dislike(item => sameSong(item, song(1)))
    },
  })
  const result = await env.engine.getDailyRecommendations({ ...dailyOpts, limit: 100 })
  assert.equal(result.items.length, 38)
  assert.ok(result.items.every(item => !['Song 0', 'Song 1'].includes(item.song.name)))
})

test('all public APIs dedupe aliases, exclude dislikes and apply completion/skip scoring', async() => {
  const candidates = [candidate(0, 'A'), candidate(0, 'A', 'tx'), candidate(1, 'A'), candidate(2, 'A')]
  const env = serviceEnv(new Map(), { pool: candidates })
  env.setHistory([record(song(0, 'A'), { completed: true }), record(song(1, 'A'), { skipped: true })])
  env.dislike(item => sameSong(item, song(2, 'A')))
  for (const run of [
    () => env.engine.getDailyRecommendations(dailyOpts),
    () => env.engine.getSimilar(song('seed', 'A'), dailyOpts),
    () => env.engine.getRadioNext(song('seed', 'A'), [], dailyOpts),
  ]) {
    // Independent sessions exercise the same persisted boundary without previous exposures.
    env.disk.clear()
    env.engine.clearSessionCache()
    const result = await run()
    assert.deepEqual(result.items.map(item => item.song.name), ['Song 0', 'Song 1'])
    assert.ok(result.items[0].score > result.items[1].score)
    assert.ok(result.items[0].reasons.includes('completed'))
  }
})

test('similar and radio degrade to local candidates when every catalog source fails or times out', async() => {
  for (const kind of ['similar', 'radio']) {
    const env = serviceEnv(new Map(), {
      sources: [
        { id: 'wy:similar', load: async() => { throw Error('offline') } },
        { id: 'kg:artist', load: async() => new Promise(() => {}) },
      ],
    })
    const opts = { ...dailyOpts, timeoutMs: 5 }
    const result = kind == 'similar'
      ? await env.engine.getSimilar(song('seed'), opts)
      : await env.engine.getRadioNext(song('seed'), [], opts)
    assert.equal(result.items.length, 10)
    assert.ok(result.items.every(item => item.origin == 'library'))
    assert.deepEqual(result.failures, [{ id: 'wy:similar', reason: 'failed' }, { id: 'kg:artist', reason: 'timeout' }])
  }
})
