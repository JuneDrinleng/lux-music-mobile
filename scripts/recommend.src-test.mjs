/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const moduleLoader = (dependencies = {}) => {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const js = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(name => {
      if (name in dependencies) return dependencies[name]
      const path = name.startsWith('@/') ? join(root, 'src', name.slice(2)) : resolve(dirname(file), name)
      return load(existsSync(`${path}.ts`) ? `${path}.ts` : existsSync(`${path}.tsx`) ? `${path}.tsx` : join(path, 'index.ts'))
    }, module, module.exports)
    return module.exports
  }
  return name => {
    const path = join(root, 'src/utils/recommend', name)
    return load(existsSync(`${path}.ts`) ? `${path}.ts` : `${path}.tsx`)
  }
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
  assert.deepEqual(await env.engine.getDailyRecommendations(dailyOpts), first)
  // A source that is no longer usable must not retain a stale failure/retry notice.
  assert.deepEqual(await serviceEnv(env.disk).engine.getDailyRecommendations(dailyOpts), { ...first, failures: [] })
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

const { recommendationReasonKey, groupSimilar, dailyStripItems } = moduleLoader()('viewModel')
test('recommendation reason text translates real scoring provenance in all three locales', () => {
  const locales = ['zh-cn', 'zh-tw', 'en-us'].map(locale => JSON.parse(readFileSync(join(root, 'src/lang', `${locale}.json`), 'utf8')))
  const reasons = ['artist-affinity', 'similar', 'artist', 'chart', 'frequent', 'completed', 'history', 'playlist', 'library']
  for (const reason of reasons) {
    const key = recommendationReasonKey({ reasons: [reason] })
    assert.equal(key, `recommend_reason_${reason}`)
    for (const locale of locales) {
      assert.equal(typeof locale[key], 'string')
      assert.ok(locale[key].trim())
      assert.doesNotMatch(locale[key], /常一起听|常一起聽|co.listen/i)
    }
  }
  assert.equal(recommendationReasonKey({ reasons: ['library', 'chart', 'artist-affinity'] }), 'recommend_reason_artist-affinity')
  assert.equal(recommendationReasonKey({ reasons: ['artist-affinity', 'chart', 'library'] }), 'recommend_reason_artist-affinity')
  assert.equal(recommendationReasonKey({ reasons: [] }), 'recommend_reason_library')
})

test('similar tabs group overlapping provenance, preserve order, and never infer co-listening', () => {
  const items = [
    { key: 'a', reasons: ['artist-affinity', 'history', 'similar'] },
    { key: 'b', reasons: ['artist'] },
    { key: 'c', reasons: ['frequent', 'completed'] },
    { key: 'd', reasons: ['chart', 'library'] },
  ]
  const before = structuredClone(items)
  const groups = groupSimilar(items)
  assert.deepEqual(groups.all, items)
  assert.notEqual(groups.all, items)
  assert.deepEqual(groups.artist.map(item => item.key), ['a', 'b'])
  assert.deepEqual(groups.history.map(item => item.key), ['a', 'c'])
  assert.deepEqual(groups.similar.map(item => item.key), ['a'])
  assert.deepEqual(items, before)
  assert.deepEqual(groupSimilar([]), { all: [], artist: [], history: [], similar: [] })
})

test('strip renders cached engine order across same-day reloads and rolls over with the engine', async() => {
  const env = serviceEnv()
  const first = await env.engine.getDailyRecommendations(dailyOpts)
  const later = await env.engine.getDailyRecommendations({ ...dailyOpts, now: now + 3600000 })
  assert.deepEqual(dailyStripItems(first.items), dailyStripItems(later.items))
  assert.notEqual(dailyStripItems(first.items), first.items)
  assert.deepEqual(dailyStripItems([]), [])
  const next = await env.engine.getDailyRecommendations({ ...dailyOpts, now: now + 86400000 })
  assert.deepEqual(dailyStripItems(next.items), next.items)
  assert.notDeepEqual(dailyStripItems(first.items), dailyStripItems(next.items))
})

test('daily failed-source retry recovers without reordering existing cards or retrying healthy cache', async() => {
  let fail = true
  let calls = 0
  const env = serviceEnv(new Map(), {
    sources: [{
      id: 'remote',
      load: async() => {
        calls++
        if (fail) throw Error('offline')
        return [candidate('remote')]
      },
    }],
  })
  const first = await env.engine.getDailyRecommendations(dailyOpts)
  assert.equal(first.failures.length, 1)
  fail = false
  const recovered = await env.engine.getDailyRecommendations({ ...dailyOpts, retryFailedSources: true })
  assert.deepEqual(recovered.failures, [])
  assert.deepEqual(recovered.items.map(item => item.key), first.items.map(item => item.key))
  assert.equal(calls, 2)
  await env.engine.getDailyRecommendations({ ...dailyOpts, retryFailedSources: true })
  assert.equal(calls, 2)
  const larger = await env.engine.getDailyRecommendations({ ...dailyOpts, limit: 100 })
  assert.equal(larger.items.at(-1).song.songmid, 'remote')
})

const actionEnv = () => {
  const calls = []
  let activeSpace = 'local'
  let radioResult = { items: [], failures: [] }
  let onRadio = () => {}
  const queue = [{ source: 'wy', meta: { songId: 'queued' }, name: 'Queued', singer: 'A' }]
  const actions = moduleLoader({
    './radio': {
      radioSession: { stop: () => {} },
      beginRadioSession: () => {},
      playableRecommendation: item => item.musicInfo ?? { converted: true, ...item.song, types: [], _types: {} },
    },
    '@/config/constant': { LIST_IDS: { TEMP: 'temp' } },
    '@/utils/listManage': { userLists: [] },
    '@/core/list': { getListMusics: async id => { assert.equal(id, 'temp'); return queue } },
    '@/core/player/player': {
      playRecommendationQueue: async items => { calls.push(['play', items]) },
      appendRecommendationQueue: async items => { calls.push(['append', items]) },
    },
    '@/utils': { toNewMusicInfo: value => ({ converted: true, ...value }) },
    '@/utils/dataSpace': { getActiveSpace: () => activeSpace },
    '@/utils/recommend': { getRadioNext: async(seed, history) => { calls.push(['radio', seed, history]); onRadio(); return radioResult } },
  })('../../components/recommend/actions')
  return { actions, calls, setRadio: batch => { radioResult = batch }, changeDuringRadio: () => { onRadio = () => { activeSpace = 'other' } } }
}

test('recommendation playback/enqueue preserve SDK metadata and convert fallback songs', async() => {
  const env = actionEnv()
  const musicInfo = { id: 'hash', hash: 'playback-hash', meta: { qualitys: ['flac'] } }
  const items = [{ song: song('sdk'), musicInfo }, { song: song('fallback') }]
  await env.actions.playRecommendations(items)
  await env.actions.enqueueRecommendations(items)
  assert.equal(env.calls[0][0], 'play')
  assert.equal(env.calls[1][0], 'append')
  for (const [, payload] of env.calls) {
    assert.equal(payload[0], musicInfo)
    assert.equal(payload[1].converted, true)
    assert.equal(payload[1].songmid, 'fallback')
    assert.deepEqual(payload[1].types, [])
  }
})

test('radio plays engine candidates with current queue exclusions and rejects space changes', async() => {
  const env = actionEnv()
  const seed = song('seed')
  env.setRadio({ items: [{ song: song('next') }], failures: [] })
  await env.actions.startRecommendationRadio(seed)
  assert.equal(env.calls[0][0], 'radio')
  assert.equal(env.calls[0][1], seed)
  assert.equal(env.calls[0][2][0].songmid, 'queued')
  assert.equal(env.calls[1][0], 'play')
  assert.equal(env.calls[1][1][0].songmid, 'next')
  env.changeDuringRadio()
  await assert.rejects(env.actions.startRecommendationRadio(seed), /Data space changed/)
  assert.equal(env.calls.filter(call => call[0] == 'play').length, 1)
})


test('daily empty-state retry can discover newly added library songs on the same day', async() => {
  const hooks = { pool: [] }
  const env = serviceEnv(new Map(), hooks)
  assert.deepEqual((await env.engine.getDailyRecommendations(dailyOpts)).items, [])
  hooks.pool = pool
  const recovered = await env.engine.getDailyRecommendations({ ...dailyOpts, retryFailedSources: true })
  assert.equal(recovered.items.length, dailyOpts.limit)
  assert.deepEqual(dailyStripItems(recovered.items), (await env.engine.getDailyRecommendations(dailyOpts)).items)
})

const { createRadioSession, radioTasteParameters } = moduleLoader()('../../components/recommend/radioSession')
const radioEnv = () => {
  let snapshot = { active: true, index: 0, songs: [song('a'), song('b'), song('c'), song('d')] }
  const calls = { next: [], append: [], dislike: [], remove: [] }
  let batch = [candidate('new')]
  let wait = async() => {}
  const disliked = []
  const session = createRadioSession({
    snapshot: async() => snapshot,
    next: async(...args) => { calls.next.push(args); await wait(); return { items: batch } },
    append: async items => { calls.append.push(items); snapshot = { ...snapshot, songs: [...snapshot.songs, ...items.map(item => item.song)] } },
    writeDislike: async item => { calls.dislike.push(item); disliked.push(item) },
    remove: async item => { calls.remove.push(item); snapshot = { ...snapshot, songs: snapshot.songs.filter(other => !sameSong(item, other)) } },
    isDisliked: item => disliked.some(other => sameSong(item, other)),
  })
  return {
    session,
    calls,
    start: () => session.start(song('seed'), snapshot.songs),
    setSnapshot: update => { snapshot = { ...snapshot, ...update } },
    setBatch: items => { batch = items },
    setWait: fn => { wait = fn },
  }
}
test('radio threshold counts upcoming tracks, replenishes once at <=2 and never while off', async() => {
  const env = radioEnv()
  await env.session.replenish()
  assert.equal(env.calls.next.length, 0)
  env.start()
  await env.session.replenish()
  assert.equal(env.calls.next.length, 0) // 3 upcoming
  env.setSnapshot({ index: 1 })
  await env.session.replenish()
  assert.equal(env.calls.next.length, 1) // 2 upcoming
  assert.equal(env.calls.append[0].length, 1)
  assert.equal(env.session.getState().played, 1)
  await env.session.replenish()
  assert.equal(env.calls.next.length, 1) // now 3 upcoming
  env.session.stop()
  env.setSnapshot({ index: 4 })
  await env.session.replenish()
  assert.equal(env.calls.next.length, 1)
  for (const index of [2, 3]) {
    const other = radioEnv(); other.start(); other.setSnapshot({ index }); await other.session.replenish()
    assert.equal(other.calls.next.length, 1)
  }
})
test('radio excludes queue, cross-source and within-batch duplicates, and removed session songs', async() => {
  const env = radioEnv(); env.start(); env.setSnapshot({ index: 2 })
  env.setBatch([candidate('a'), candidate('a', undefined, 'tx'), candidate('new'), candidate('new', undefined, 'kg')])
  await env.session.replenish()
  assert.deepEqual(env.calls.append[0].map(item => item.song.songmid), ['new'])
  assert.equal(env.session.getState().added.length, 1)
  env.setSnapshot({ songs: [song('c'), song('d')], index: 0 })
  env.setBatch([candidate('a'), candidate('new')])
  await env.session.replenish()
  assert.equal(env.calls.append.length, 1)
  assert.ok(env.calls.next[1][1].some(item => item.songmid == 'new'))
})
test('radio dislike writes existing feedback and removes the row, excluding future aliases', async() => {
  const env = radioEnv(); env.start()
  await env.session.dislike(song('b'))
  assert.deepEqual(env.calls.dislike, [song('b')])
  assert.deepEqual(env.calls.remove, [song('b')])
  env.setBatch([candidate('b', undefined, 'tx'), candidate('fresh')])
  await env.session.replenish()
  assert.deepEqual(env.calls.append[0].map(item => item.song.songmid), ['fresh'])
  assert.ok(env.calls.next[0][1].some(item => item.songmid == 'b'))
})
test('radio pending request is single-flight, rejects stop/queue-switch/taste-change results and recovers failures', async() => {
  for (const change of [env => env.session.stop(), env => env.setSnapshot({ active: false }), env => env.setSnapshot({ songs: [song('replacement')] }), env => env.session.setTaste('explore')]) {
    const env = radioEnv(); env.start(); env.setSnapshot({ index: 2 })
    let release
    env.setWait(() => new Promise(resolve => { release = resolve }))
    const pending = env.session.replenish()
    await new Promise(resolve => setImmediate(resolve))
    await env.session.replenish()
    assert.equal(env.calls.next.length, 1)
    change(env); release(); await pending
    assert.equal(env.calls.append.length, 0)
  }
  const env = radioEnv(); env.start(); env.setSnapshot({ index: 2 })
  env.setWait(async() => { throw Error('offline') })
  await assert.rejects(env.session.replenish(), /offline/)
  env.setWait(async() => {})
  await env.session.replenish()
  assert.equal(env.calls.append.length, 1)
})
test('three radio tastes map to real ranking parameters and change familiarity/discovery order', async() => {
  assert.deepEqual(radioTasteParameters('balanced'), { limit: 10, affinityWeight: 1, discoveryWeight: 2 })
  assert.deepEqual(radioTasteParameters('familiar'), { limit: 10, affinityWeight: 2, discoveryWeight: 0 })
  assert.deepEqual(radioTasteParameters('explore'), { limit: 10, affinityWeight: 0.25, discoveryWeight: 8 })
  const songs = [candidate('known', 'A'), candidate('unknown', 'B')]
  const opts = { ...options, anchor: song('seed', 'A'), history: [record(song('old', 'A'))] }
  assert.equal(rankCandidates(songs, { ...opts, ...radioTasteParameters('familiar') })[0].song.songmid, 'known')
  assert.equal(rankCandidates(songs, { ...opts, ...radioTasteParameters('explore') })[0].song.songmid, 'unknown')
  const env = radioEnv(); env.start(); env.setSnapshot({ index: 2 }); env.session.setTaste('explore')
  await env.session.replenish()
  assert.deepEqual(env.calls.next[0][2], radioTasteParameters('explore'))
})

test('radio bindings run with the sheet closed, clean listeners on stop/space change, and write existing dislike rules', async() => {
  const previousApp = global.app_event
  const previousState = global.state_event
  global.app_event = new EventEmitter()
  global.state_event = new EventEmitter()
  const state = { playInfo: { playerListId: 'temp' }, musicInfo: { id: 'a' } }
  const lists = { tempListMeta: { id: 'radio-queue' } }
  let queue = ['a', 'b', 'c', 'd'].map(id => ({ id, source: 'wy', name: `Song ${id}`, singer: `Artist ${id}`, meta: { songId: id } }))
  let nextCalls = 0
  let changeSpace
  const feedback = []
  const radio = moduleLoader({
    '@/config/constant': { LIST_IDS: { TEMP: 'temp' } },
    '@/utils/listManage': { userLists: [] },
    '@/core/list': {
      getListMusics: async() => queue,
      removeListMusics: async(id, ids) => { assert.equal(id, 'temp'); queue = queue.filter(item => !ids.includes(item.id)) },
    },
    '@/core/dislikeList': { addDislikeInfo: async infos => { feedback.push(...infos) }, hasDislike: () => false },
    '@/core/player/player': { appendRecommendationQueue: async() => {} },
    '@/store/player/state': { default: state, __esModule: true },
    '@/store/list/state': { default: lists, __esModule: true },
    '@/utils': { toNewMusicInfo: value => value },
    '@/utils/dataSpace': { onDataSpaceWillChange: fn => { changeSpace = fn } },
    '@/utils/recommend': { getRadioNext: async() => { nextCalls++; return { items: [] } } },
  })('../../components/recommend/radio')
  const tick = () => new Promise(resolve => setImmediate(resolve))
  try {
    radio.beginRadioSession(song('seed'), queue.map(item => song(item.id)))
    await tick()
    assert.equal(nextCalls, 0)
    state.musicInfo.id = 'b'
    global.state_event.emit('playerMusicInfoChanged')
    await tick()
    assert.equal(nextCalls, 1)
    await radio.radioSession.dislike(song('c'))
    assert.deepEqual(feedback, [{ name: 'Song c', singer: 'Artist c' }])
    assert.equal(queue.some(item => item.id == 'c'), false)
    lists.tempListMeta.id = 'replacement-with-overlapping-songs'
    global.app_event.emit('myListMusicUpdate', ['temp'])
    await tick()
    assert.equal(radio.radioSession.getState().seed, null)
    assert.equal(nextCalls, 1)
    assert.equal(global.state_event.listenerCount('playerMusicInfoChanged'), 0)
    assert.equal(global.app_event.listenerCount('myListMusicUpdate'), 0)
    radio.beginRadioSession(song('seed'), queue.map(item => song(item.id)))
    changeSpace()
    await tick()
    assert.equal(radio.radioSession.getState().seed, null)
    assert.equal(global.state_event.listenerCount('playInfoChanged'), 0)
  } finally {
    radio.radioSession.stop()
    global.app_event = previousApp
    global.state_event = previousState
  }
})

test('default app bindings never construct or call remote sources in local/disconnected mode', async() => {
  let space = 'local'
  const sync = { status: { status: false } }
  let remoteLoads = 0
  const engine = moduleLoader({
    '@/store/sync/state': { default: sync, __esModule: true },
    '@/config/constant': { storageDataPrefix: { recommendations: 'recommendations' } },
    '@/core/dislikeList': { hasDislike: () => false },
    '@/plugins/storage': { getData: async() => null, saveData: async() => {} },
    '@/utils': { toNewMusicInfo: song => song },
    '@/utils/dataSpace': { getActiveSpace: () => space, namespacedKey: (key, id) => `${key}@${id}`, onDataSpaceWillChange: () => {} },
    '../playHistory/store': { getPlayRecords: () => [] },
    './local': { localSources: () => [{ id: 'local:library', load: async() => pool }] },
    './platform': { platformSources: () => { remoteLoads++; return [] } },
  })('index')
  for (const id of ['local', 'lux:s:u']) {
    space = id
    const batch = await engine.getDailyRecommendations(dailyOpts)
    assert.equal(batch.items.length, 10)
    assert.deepEqual(batch.failures, [])
    assert.equal(remoteLoads, 0)
  }
  sync.status.status = true
  space = 'lux:s:connected'
  await engine.getDailyRecommendations(dailyOpts)
  assert.equal(remoteLoads, 1)
})

test('local empty/nonempty history ends loading without auth, server, or failure notices', async() => {
  const { createRecommendationLoader } = moduleLoader()('loadState')
  for (const history of [[], [record(song('history'))]]) {
    const env = serviceEnv(new Map(), { pool: [] })
    env.setHistory(history)
    const states = []
    const loader = createRecommendationLoader(state => states.push(state), 500)
    await loader.load(onProgress => env.engine.getDailyRecommendations({ ...dailyOpts, onProgress }))
    const final = states.at(-1)
    assert.equal(final.loading, false)
    assert.equal(final.failed, false)
    assert.equal(final.batch.items.length, history.length)
    assert.deepEqual(final.batch.failures, [])
  }
})

test('daily source timeout resolves with local results and overall timeout includes queued/storage waits', async() => {
  const never = () => new Promise(() => {})
  const env = serviceEnv(new Map(), { sources: [{ id: 'remote:hang', load: never }] })
  const start = performance.now()
  const batch = await env.engine.getDailyRecommendations({ ...dailyOpts, timeoutMs: 15, overallTimeoutMs: 500 })
  assert.equal(batch.items.length, 10)
  assert.deepEqual(batch.failures, [{ id: 'remote:hang', reason: 'timeout' }])
  assert.ok(performance.now() - start < 500)
  const hung = serviceEnv(new Map(), { read: never })
  await assert.rejects(hung.engine.getDailyRecommendations({ ...dailyOpts, overallTimeoutMs: 15 }), /timed out/)
  await assert.rejects(hung.engine.getDailyRecommendations({ ...dailyOpts, overallTimeoutMs: 15 }), /timed out/)
})

test('local cards publish before remote starts; supplements and final/cache preserve their positions', async() => {
  let finishRemote
  let started
  const remoteReady = new Promise(resolve => { started = resolve })
  let remoteStarted = false
  const env = serviceEnv(new Map(), {
    pool: pool.slice(0, 3),
    sources: [{
      id: 'remote:catalog',
      load: async() => { remoteStarted = true; return new Promise(resolve => { finishRemote = resolve; started() }) },
    }],
  })
  const updates = []
  const pending = env.engine.getDailyRecommendations({
    ...dailyOpts,
    onProgress: batch => {
      updates.push(batch)
      if (batch.items.length && !remoteStarted) assert.equal(batch.items.length, 3)
    },
  })
  await remoteReady
  const first = updates.find(batch => batch.items.length)
  assert.ok(first)
  finishRemote(pool.slice(3))
  const final = await pending
  assert.deepEqual(final.items.slice(0, 3), first.items)
  assert.equal(final.items.length, 10)
  for (const update of updates.filter(batch => batch.items.length)) {
    assert.deepEqual(update.items.slice(0, 3), first.items)
  }
  assert.deepEqual((await env.engine.getDailyRecommendations(dailyOpts)).items, final.items)
})

test('loader exits loading on thrown error, timeout, and space invalidation; ignores late progress', async() => {
  const { createRecommendationLoader } = moduleLoader()('loadState')
  const states = []
  const loader = createRecommendationLoader(state => states.push(state), 15)
  await loader.load(async() => { throw Error('bad') })
  assert.deepEqual(states.at(-1), { batch: null, loading: false, failed: true })
  let progress
  await loader.load(async publish => { progress = publish; return new Promise(() => {}) })
  assert.equal(states.at(-1).loading, false)
  assert.equal(states.at(-1).failed, true)
  const length = states.length
  progress({ items: pool })
  assert.equal(states.length, length)
  const pending = loader.load(async publish => { progress = publish; return new Promise(() => {}) })
  await new Promise(resolve => setImmediate(resolve))
  loader.invalidate()
  await pending
  assert.deepEqual(states.at(-1), { batch: null, loading: false, failed: false })
  progress({ items: pool })
  assert.equal(states.at(-1).batch, null)
})

test('large ranking yields to navigation callbacks and preserves synchronous ranking output', async() => {
  const { rankCandidatesAsync } = moduleLoader()('engine')
  const candidates = Array.from({ length: 2000 }, (_, i) => candidate(i))
  const opts = { ...options, history: candidates.map(item => record(item.song)) }
  let navigated = false
  const pending = rankCandidatesAsync(candidates, opts)
  setTimeout(() => { navigated = true }, 0)
  const result = await pending
  assert.equal(navigated, true)
  assert.deepEqual(result, rankCandidates(candidates, opts))
})

// Minimal hook host exercises the real Sheet lifecycle without a native renderer.
export const hookHost = () => {
  const hooks = []
  let cursor = 0
  let effects = []
  let dirty = false
  const sameDeps = (a, b) => a && b && a.length == b.length && a.every((value, index) => Object.is(value, b[index]))
  const react = {
    memo: value => value,
    useState: initial => {
      const id = cursor++
      hooks[id] ??= { value: typeof initial == 'function' ? initial() : initial }
      return [hooks[id].value, value => {
        const next = typeof value == 'function' ? value(hooks[id].value) : value
        if (!Object.is(next, hooks[id].value)) { hooks[id].value = next; dirty = true }
      }]
    },
    useRef: initial => {
      const id = cursor++
      hooks[id] ??= { current: initial }
      return hooks[id]
    },
    useMemo: (create, deps) => {
      const id = cursor++
      if (!sameDeps(hooks[id]?.deps, deps)) hooks[id] = { deps, value: create() }
      return hooks[id].value
    },
    useCallback: (callback, deps) => react.useMemo(() => callback, deps),
    useEffect: (effect, deps) => {
      const id = cursor++
      if (sameDeps(hooks[id]?.deps, deps)) return
      effects.push(() => {
        hooks[id]?.cleanup?.()
        hooks[id] = { deps, cleanup: effect() }
      })
    },
  }
  return {
    react,
    dispose: () => { hooks.forEach(hook => hook.cleanup?.()) },
    render: (component, props) => {
      let result
      do {
        dirty = false; cursor = 0; effects = []
        result = component(props)
        effects.forEach(effect => effect())
      } while (dirty)
      return result
    },
  }
}

test('invisible Sheet mounts no Modal; interrupted close releases it and stale close cannot hide reopening', () => {
  const host = hookHost()
  const animations = []
  const jsx = (type, props) => ({ type, props })
  const { MagazineSheet } = moduleLoader({
    react: host.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      Animated: {
        Value: class { setValue() {} interpolate() { return 0 } },
        View: 'AnimatedView',
        timing: (value, config) => {
          const animation = { config, start: callback => { animation.callback = callback }, stop: () => { animation.callback?.({ finished: false }) } }
          animations.push(animation)
          return animation
        },
      },
      Easing: { out: value => value, cubic: 0 },
      Keyboard: { addListener: () => ({ remove() {} }) },
      Platform: { OS: 'android' },
      Modal: 'Modal',
      View: 'View',
      TouchableOpacity: 'TouchableOpacity',
      useWindowDimensions: () => ({ height: 800 }),
    },
    '@/components/common/Text': { default: 'Text', __esModule: true },
    '@/components/common/MdiIcon': { MdiIcon: 'Icon' },
    '@/lang': { useI18n: () => key => key },
    '@/theme/LuxTheme': { sharedLuxStyles: () => () => ({}), useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/theme/magazineType': { PAGE_GUTTER: 22, magType: { eyebrow: { size: 11 }, sheetTitle: { size: 22 } } },
    '@/utils/tools': { createStyle: value => value },
    './EmptyState': { EmptyState: 'EmptyState' },
    './Hairline': { Hairline: 'Hairline' },
    './PrimaryButton': { PrimaryButton: 'PrimaryButton' },
    './TextButton': { TextButton: 'TextButton' },
  })('../../components/magazine/MagazineSheet')
  const props = { visible: false, onClose() {}, title: 'Sheet' }
  assert.equal(host.render(MagazineSheet, props), null)
  assert.equal(host.render(MagazineSheet, { ...props, visible: true }).type, 'Modal')
  host.render(MagazineSheet, props)
  animations.at(-1).callback({ finished: false })
  assert.equal(host.render(MagazineSheet, props), null)
  host.render(MagazineSheet, { ...props, visible: true })
  host.render(MagazineSheet, props)
  const stale = animations.at(-1).callback
  host.render(MagazineSheet, { ...props, visible: true })
  stale({ finished: true })
  assert.equal(host.render(MagazineSheet, { ...props, visible: true }).type, 'Modal')
})

test('Dock tabs receive presses while the recommendation carousel and its real load hook remain mounted', async() => {
  const host = hookHost()
  const previousStateEvent = global.state_event
  global.state_event = new EventEmitter()
  const jsx = (type, props) => ({ type, props })
  const env = serviceEnv(new Map(), { sources: [{ id: 'remote:hang', load: async() => new Promise(() => {}) }] })
  const dependencies = {
    react: host.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      View: 'View',
      ScrollView: 'ScrollView',
      TouchableOpacity: 'TouchableOpacity',
      AppState: { addEventListener: () => ({ remove() {} }) },
    },
    '@/components/common/Text': { default: 'Text', __esModule: true },
    '@/components/common/Image': { default: 'Image', __esModule: true },
    '@/components/common/MdiIcon': { MdiIcon: 'Icon' },
    '@/lang': { useI18n: () => key => key },
    '@/theme/LuxTheme': { sharedLuxStyles: () => () => ({}), useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/theme/magazineType': { PAGE_GUTTER: 22 },
    '@/utils/tools': { createStyle: value => value },
    '@/utils/recommend': { getDailyRecommendations: opts => env.engine.getDailyRecommendations({ ...dailyOpts, ...opts, timeoutMs: 30 }) },
    '@/utils/dataSpace': { onDataSpaceWillChange: () => () => {}, onDataSpaceChanged: () => () => {} },
    './actions': {},
    '@/components/magazine': { SectionHeader: 'SectionHeader' },
    './DailyCover': { DailyCover: 'DailyCover' },
    './WeeklyCover': { WeeklyCover: 'WeeklyCover' },
    './RecommendationViews': { useRecommendationStyles: () => ({}), useRecommendationAction: () => ({ run() {}, pending: false }) },
    './Hairline': { Hairline: 'Hairline' },
    './IconButton': { IconButton: 'IconButton' },
    './Chip': { StatusChip: 'StatusChip' },
  }
  const { useRecommendations } = moduleLoader(dependencies)('../../components/recommend/useRecommendations')
  let loadState
  const { RecommendationSection } = moduleLoader({ ...dependencies, './useRecommendations': { useRecommendations: () => { loadState = useRecommendations(); return loadState } } })('../../components/recommend/RecommendationSection')
  const { Dock } = moduleLoader(dependencies)('../../components/magazine/Dock')
  const selected = []
  const dock = Dock({ navItems: ['nav_search', 'nav_love', 'nav_setting'].map(id => ({ id, label: id, icon: id })), onNavPress: id => selected.push(id) })
  const tabs = []
  const visit = node => {
    if (!node || typeof node != 'object') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node.props?.accessibilityRole == 'tab') tabs.push(node)
    visit(node.props?.children)
  }
  visit(dock)
  try {
    host.render(RecommendationSection, { discover: { cover: null, title: 'Weekly', sourceListId: null } })
    assert.equal(loadState.loading, true)
    tabs[1].props.onPress()
    for (let tick = 0; tick < 100; tick++) {
      await new Promise(resolve => setTimeout(resolve, 1))
      host.render(RecommendationSection, { discover: { cover: null, title: 'Weekly', sourceListId: null } })
      if (!loadState.loading && loadState.batch?.items.length) break
    }
    assert.equal(loadState.loading, false)
    assert.ok(loadState.batch.items.length)
    const rendered = host.render(RecommendationSection, { discover: { cover: null, title: 'Weekly', sourceListId: null } })
    const dailyCard = rendered.props.children[1].props.children[0]
    assert.deepEqual(dailyCard.props.cover.props.items, loadState.batch.items)
    assert.equal(rendered.props.children[3].props.loading, false)
    assert.equal(rendered.props.children[3].props.empty, false)
    tabs[2].props.onPress()
    tabs[0].props.onPress()
    assert.deepEqual(selected, ['nav_love', 'nav_setting', 'nav_search'])
  } finally {
    host.dispose()
    global.state_event = previousStateEvent
  }
})
