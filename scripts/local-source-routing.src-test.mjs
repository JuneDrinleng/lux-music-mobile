/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const asDefault = value => ({ default: value })

const loadModule = (relativePath, dependencies, globals = {}) => {
  const filename = join(root, relativePath)
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: false },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const require = (specifier) => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected dependency in ${relativePath}: ${specifier}`)
    return dependencies[specifier]
  }
  const evaluate = new Script(`(function(require, module, exports, global) {\n${source}\n})`, { filename }).runInThisContext()
  evaluate(require, module, module.exports, globals)
  return module.exports
}

const createMusicHarness = (mode) => {
  const calls = []
  const song = { id: 'kw_123', source: 'kw', name: 'Song', singer: 'Singer', meta: { songId: '123', albumName: '', picUrl: '', _qualitys: { '320k': {} } } }
  const lyric = { lyric: '[00:01.00]Device lyric', tlyric: '' }
  const settings = { setting: { 'common.apiSource': 'user_api_device', 'player.playQuality': '320k', 'player.isS2t': false } }
  const globals = {
    lx: {
      apiInitPromise: [Promise.resolve(true)],
      qualityList: { kw: ['128k', '320k'] },
      apis: {
        kw: {
          getMusicUrl(info, quality) {
            calls.push(['script', info.id, quality])
            return { promise: Promise.resolve({ url: 'https://device.example/song.mp3', type: quality }) }
          },
        },
      },
    },
  }
  const apiSource = loadModule('src/utils/musicSdk/api-source.js', {
    './api-source-info': asDefault([]),
    '@/store/setting/state': asDefault(settings),
  }, globals)
  const kwDependencies = Object.fromEntries(['./musicInfo', './tipSearch', './musicSearch', './util', './leaderboard', './songList', './hotSearch', './comment'].map(name => [name, {}]))
  const kw = loadModule('src/utils/musicSdk/kw/index.js', {
    ...kwDependencies,
    '../api-source': apiSource,
    './pic': asDefault({ getPic: async(info) => { calls.push(['cover', info.id]); return 'https://device.example/cover.jpg' } }),
    './lyric': asDefault({ getLyric: (info) => { calls.push(['lyric', info.id]); return { promise: Promise.resolve(lyric) } } }),
  }, globals).default
  const data = {
    getSyncMode: async() => mode,
    getMusicUrl: async() => null,
    getPlayerLyric: async() => ({}),
    saveMusicUrl: async(info, quality, url) => { calls.push(['saveUrl', info.id, quality, url]) },
    saveLyric: async(info, value) => { calls.push(['saveLyric', info.id, value.lyric]) },
  }
  const listState = { allList: [], tempListMeta: {} }
  const utils = loadModule('src/core/music/utils.ts', {
    '@/utils/musicSdk': { default: { kw }, findMusic: async() => [] },
    '@/utils/data': data,
    '@/utils': { toOldMusicInfo: info => info, toNewMusicInfo: info => info },
    '@/utils/tools': { assertApiSupport: () => true },
    '@/config/constant': { LIST_IDS: { TEMP: 'temp' } },
    '@/store/setting/state': asDefault(settings),
    '@/store/player/state': asDefault({}),
    '@/store/list/state': asDefault(listState),
    '@/utils/message': { requestMsg: { tooManyRequests: 'too many requests' } },
    'react-native-background-timer': asDefault({ setTimeout, clearTimeout }),
    '@/utils/musicSdk/api-source': apiSource,
  }, globals)
  const online = loadModule('src/core/music/online.ts', {
    '@/utils/data': data,
    './reuseMusicUrl': { readReusableMusicUrl: async() => null },
    '@/core/list': { updateListMusics: async() => {} },
    '@/utils/listManage': { getListMusicSync: () => [] },
    '@/store/list/state': asDefault(listState),
    '@/store/setting/state': asDefault(settings),
    './utils': utils,
  }, globals)
  const fileResolver = kind => ({
    getMusicUrl: async() => `${kind}:audio`,
    getPicUrl: async() => `${kind}:cover`,
    getLyricInfo: async() => ({ lyric: `${kind}:lyric` }),
  })
  const music = loadModule('src/core/music/index.ts', {
    './online': online,
    './local': fileResolver('local'),
    './download': fileResolver('download'),
  }, globals)
  return { music, utils, song, calls }
}

test('Lux and LX resolve online music through the device user API and built-in metadata providers', async() => {
  for (const mode of ['lux', 'lx']) {
    const { music, utils, song, calls } = createMusicHarness(mode)
    assert.equal(await music.getMusicUrl({ musicInfo: song }), 'https://device.example/song.mp3', mode)
    assert.equal(await music.getPicPath({ musicInfo: song }), 'https://device.example/cover.jpg', mode)
    assert.equal((await music.getLyricInfo({ musicInfo: song })).lyric, '[00:01.00]Device lyric', mode)
    assert.equal(await music.getOnlineSongPicUrl({ musicInfo: song, isRefresh: true }), 'https://device.example/cover.jpg', mode)
    assert.equal(await utils.fetchAltCoverUrl(song), 'https://device.example/cover.jpg', mode)
    assert.deepEqual(calls, [
      ['script', 'kw_123', '320k'],
      ['saveUrl', 'kw_123', '320k', 'https://device.example/song.mp3'],
      ['cover', 'kw_123'],
      ['lyric', 'kw_123'],
      ['saveLyric', 'kw_123', '[00:01.00]Device lyric'],
      ['cover', 'kw_123'],
      ['cover', 'kw_123'],
    ], mode)
  }
})

test('local and downloaded tracks retain their existing resolvers', async() => {
  const { music, calls } = createMusicHarness('lux')
  for (const [kind, musicInfo] of [['local', { source: 'local' }], ['download', { source: 'kw', progress: 1 }]]) {
    assert.equal(await music.getMusicUrl({ musicInfo }), `${kind}:audio`)
    assert.equal(await music.getPicPath({ musicInfo }), `${kind}:cover`)
    assert.deepEqual(await music.getLyricInfo({ musicInfo }), { lyric: `${kind}:lyric` })
  }
  assert.deepEqual(calls, [])
})

test('a server offering source still completes feature negotiation for supported sync features', async() => {
  const ready = loadModule('src/plugins/sync/client/moduleReadys.ts', {})
  const modules = loadModule('src/plugins/sync/client/modules/index.ts', {
    './list': { handler: {} },
    './dislike': { handler: {} },
    './together': { handler: {} },
  })
  for (const mode of ['lux', 'lx']) {
    const flags = {}
    const handler = loadModule('src/plugins/sync/client/sync/handler.ts', {
      '@/utils/data': { getSyncMode: async() => mode },
      '../../playHistoryFlag': { setPlayHistoryFeatureEnabled: value => { flags.playHistory = value } },
      '../../togetherFlag': { setTogetherFeatureEnabled: value => { flags.together = value } },
      '../syncReady': { notifySyncReady: () => {} },
      '../moduleReadys': ready,
      '../modules': modules,
    }).default
    for (const serverType of ['server', 'desktop-app']) {
      const socket = { moduleReadys: ready.createInitialModuleReadys() }
      const features = await handler.getEnabledFeatures(socket, serverType, { list: 1, dislike: 1, playHistory: 1, together: 1, source: 1 })
      assert.deepEqual(features, {
        list: { skipSnapshot: false },
        dislike: { skipSnapshot: false },
        ...(mode == 'lux' ? { playHistory: true, together: true } : {}),
      }, `${mode}/${serverType}`)
      assert.deepEqual(flags, { playHistory: mode == 'lux', together: mode == 'lux' })
      assert.equal(socket.moduleReadys.together, mode == 'lux')
    }
  }
})
