/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script, createContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const music = (id = 'a', seconds = 100) => ({
  id,
  source: 'kw',
  name: id,
  singer: 'Artist',
  meta: { songId: id },
  interval: seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : undefined,
})

const harness = () => {
  let now = 100_000
  let nativePosition = 0
  let timer
  let pendingPosition
  const listeners = new Map()
  const finals = []
  const records = new Map()
  const disk = new Map()
  const state = {
    playMusicInfo: { musicInfo: music(), listId: 'list', isTempPlay: false },
    progress: { nowPlayTime: 0, maxPlayTime: 100 },
    playInfo: { playerListId: 'list', playerPlayIndex: 0, playIndex: 0 },
    musicInfo: { id: 'a' },
    isPlay: true,
    tempPlayList: [],
    playedList: [],
  }
  const emit = (event, ...args) => { for (const fn of [...(listeners.get(event) ?? [])]) fn(...args) }
  const appEvent = new Proxy({
    on: (event, fn) => { listeners.set(event, [...(listeners.get(event) ?? []), fn]) },
  }, { get: (target, key) => target[key] ?? ((...args) => emit(key, ...args)) })
  const background = { setInterval: fn => { timer = fn; return 1 }, clearInterval: () => { timer = null } }
  const deps = {
    '@/store/player/state': state,
    '@/store/setting/state': { setting: { 'player.togglePlayMethod': 'listLoop', 'player.volume': 1, 'player.playbackRate': 1 } },
    '@/utils/dataSpace': { onDataSpaceChanged: () => {}, onDataSpaceWillChange: () => {}, getActiveSpace: () => 'space', storageKey: key => key },
    '@/utils/playHistory/store': { getPlayDeviceId: () => 'device', upsertPlayRecord: record => records.set(record.id, record) },
    'react-native-background-timer': background,
    'react-native': { AppState: { addEventListener: () => {} } },
    '@/core/together/control': { blockTogetherMemberControl: () => false, isTogetherMemberLocked: () => false },
    '@/utils/tools': { debounceBackgroundTimer: () => () => {} },
    '@/config/constant': { LIST_IDS: { DOWNLOAD: 'download' }, storageDataPrefix: { playHistory: 'history', playHistoryDevice: 'device' } },
    '@/utils/listManage': { getListMusicSync: () => [music('a'), music('b')] },
    '@/core/player/progress': { setProgress: (position, duration) => { state.progress.nowPlayTime = position; state.progress.maxPlayTime = duration } },
    '@/store/player/action': {
      setPlayMusicInfo: (listId, info, isTempPlay) => { state.playMusicInfo = { listId, musicInfo: info, isTempPlay } },
      setMusicInfo: info => { state.musicInfo = info },
      updatePlayIndex: () => {},
    },
    '@/core/player/playStatus': { setStatusText: () => {}, setIsPlay: value => { state.isPlay = value } },
    '@/plugins/player': { getPosition: () => pendingPosition ?? Promise.resolve(nativePosition), isInitialized: () => true, setStop: async() => {}, setVolume: async() => {}, setPlaybackRate: async() => {} },
    '@/plugins/player/playList': {},
    '@/core/player/playedList': {},
    '@/core/player/tempPlayList': {},
    '@/core/music': {},
    '@/utils/message': {},
    '@/utils/common': {},
    '@/core/list': {},
    '@/core/dislikeList': {},
    '@/store/list/state': {},
    './utils': { filterList: async() => ({ filteredList: [music('a'), music('b')], playerIndex: 0 }) },
    '@/plugins/storage': { getData: async key => disk.get(key), saveData: async(key, value) => { disk.set(key, value) } },
    '@/utils/data': {},
  }
  deps['./store'] = deps['@/utils/playHistory/store']
  const context = createContext({
    global: { app_event: appEvent, lx: { isPlayedStop: false }, i18n: { t: key => key }, state_event: { on: () => {} } },
    Date: class extends Date { static now() { return now } },
    console,
    setTimeout: () => 1,
    clearTimeout: () => {},
  })
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const js = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInContext(context)(name => {
      if (name in deps) return deps[name]
      const path = name.startsWith('@/') ? join(root, 'src', name.slice(2)) : resolve(dirname(file), name)
      return load(`${path}.ts`)
    }, module, module.exports)
    return module.exports
  }
  const module = path => load(join(root, 'src', path))
  const tracker = module('utils/playHistory/tracker.ts')
  const playInfo = module('core/player/playInfo.ts')
  const player = module('core/player/player.ts')
  module('core/init/player/player.ts').default({})
  tracker.startPlayHistoryTracker((record, reason) => { if (reason == 'final') finals.push(record) })
  return {
    tracker,
    player,
    state,
    emit,
    finals,
    records,
    module,
    deps,
    disk,
    seek: position => { state.progress.nowPlayTime = nativePosition = position; emit('setProgress', position) },
    advance: async(ms, { ui = true } = {}) => {
      now += ms
      nativePosition += ms / 1000
      if (ui) state.progress.nowPlayTime = nativePosition
      timer?.()
      await Promise.resolve()
    },
    switchSong: (song = music('b')) => {
      playInfo.setPlayMusicInfo('list', song)
      nativePosition = 0
    },
    deferPosition: promise => { pendingPosition = promise },
  }
}

test('completion is inclusive at 90% actual listened; short and invalid durations', async() => {
  const h = harness()
  const { isCompletedPlay, qualifiesAsPlay } = h.module('utils/playHistory/threshold.ts')
  assert.equal(isCompletedPlay(89_999, 100_000), false)
  assert.equal(isCompletedPlay(90_000, 100_000), true)
  assert.equal(isCompletedPlay(899, 1000), false)
  assert.equal(isCompletedPlay(900, 1000), true)
  for (const duration of [null, 0, -1, NaN, Infinity]) assert.equal(isCompletedPlay(1_000_000, duration), false)
  assert.equal(qualifiesAsPlay(29_999, null), false)
  assert.equal(qualifiesAsPlay(30_000, null), true)
  await h.advance(89_999)
  assert.equal([...h.records.values()][0].completed, false)
  await h.advance(100)
  h.switchSong()
  assert.equal(h.finals[0].completed, true)
  assert.equal(h.finals[0].skipped, false)
})

test('explicit seeks, including plausible small jumps and backward scrubs, add no listened time', async() => {
  const h = harness()
  await h.advance(30_000)
  h.seek(98)
  await h.advance(1000)
  h.switchSong()
  assert.equal(h.finals[0].listenedMs, 31_000)
  assert.equal(h.finals[0].completed, false)
  assert.equal(h.finals[0].skipped, true)
  const other = harness()
  await other.advance(30_000)
  other.seek(31)
  other.seek(0)
  await other.advance(1000)
  other.switchSong()
  assert.equal(other.finals[0].listenedMs, 31_000)
})

test('pause/resume keeps one session and excludes paused wall time; stop is not a skip', async() => {
  const h = harness()
  await h.advance(30_000)
  const id = h.tracker.getOpenPlaySessionId()
  h.emit('pause')
  await h.advance(3_600_000)
  h.emit('play')
  await h.advance(1000)
  assert.equal(h.tracker.getOpenPlaySessionId(), id)
  h.emit('stop')
  assert.equal(h.finals[0].listenedMs, 31_000)
  assert.equal(h.finals[0].completed, false)
  assert.equal(h.finals[0].skipped, false)
})

test('real next/previous paths skip unfinished tracks; automatic error advance does not', async() => {
  for (const direction of ['playNext', 'playPrev']) {
    const h = harness()
    await h.advance(30_000)
    await h.player[direction]()
    assert.equal(h.finals.length, 1)
    assert.equal(h.finals[0].skipped, true, direction)
    assert.equal(h.finals[0].completed, false, direction)
  }
  const h = harness()
  await h.advance(30_000)
  h.emit('error')
  await h.player.playNext(true)
  assert.equal(h.finals[0].skipped, false)
})

test('natural end completes once before reset; repeat-one creates separate records', async() => {
  const h = harness()
  h.deps['@/store/setting/state'].setting['player.togglePlayMethod'] = 'singleLoop'
  await h.advance(30_000)
  h.emit('pause')
  h.emit('playerEnded')
  assert.equal(h.finals[0].completed, true)
  assert.equal(h.finals[0].skipped, false)
  // Let the real natural-end → playNext(true) → same-song transition finish.
  for (let index = 0; index < 15; index++) await Promise.resolve()
  h.seek(0)
  h.emit('play')
  await h.advance(30_000)
  h.emit('playerEnded')
  assert.equal(h.finals.length, 2)
  assert.notEqual(h.finals[0].id, h.finals[1].id)
  assert.equal(h.finals[1].listenedMs, 30_000)
  assert.equal(h.finals[1].completed, true)
})

test('screen-off native progress counts, paused screen-off time does not', async() => {
  const h = harness()
  await h.advance(90_000, { ui: false })
  h.emit('pause')
  h.emit('stop')
  assert.equal(h.finals[0].listenedMs, 90_000)
  assert.equal(h.finals[0].completed, true)
})

test('a native read crossing a seek or track boundary cannot add false listening', async() => {
  const h = harness()
  await h.advance(30_000)
  let release
  h.deferPosition(new Promise(resolve => { release = resolve }))
  await h.advance(1000, { ui: false })
  h.seek(98)
  release(31)
  await Promise.resolve()
  h.switchSong()
  assert.equal(h.finals[0].listenedMs, 30_000)
})

test('subsecond tracks use proportional thresholds; unknown length requires natural end', async() => {
  const short = harness()
  short.switchSong(music('short', 0))
  short.state.progress.maxPlayTime = 0.5
  short.emit('play')
  await short.advance(450)
  short.switchSong()
  assert.equal(short.finals[0].completed, true)
  assert.equal(short.finals[0].listenedMs, 450)
  for (const end of [false, true]) {
    const h = harness()
    h.switchSong(music('live', 0))
    h.state.progress.maxPlayTime = 0
    h.emit('play')
    await h.advance(90_000)
    if (end) {
      h.deps['@/core/together/control'].isTogetherMemberLocked = () => true
      h.emit('playerEnded')
    } else h.switchSong()
    assert.equal(h.finals[0].completed, end)
    assert.equal(h.finals[0].skipped, !end)
  }
})

test('wire payload preserves flags, rejects invalid booleans, and old records load unchanged', async() => {
  const h = harness()
  await h.advance(30_000)
  h.switchSong()
  const record = h.finals[0]
  const wire = h.module('utils/playHistory/wire.ts')
  const payload = { records: wire.chunkWireRecords([record])[0] }
  assert.equal(payload.records[0].completed, false)
  assert.equal(payload.records[0].skipped, true)
  assert.equal(wire.toWireRecord({ ...record, completed: 'false' }), null)
  const { completed, skipped, ...old } = record
  h.disk.set('history', [old])
  h.disk.set('device', 'device')
  const store = h.module('utils/playHistory/store.ts')
  await store.loadPlayHistoryStore()
  assert.equal(store.getPlayRecords().length, 1)
  assert.equal(store.getPlayRecords()[0].completed, undefined)
  assert.equal(wire.toWireRecord(old).skipped, undefined)
  const merge = h.module('utils/playHistory/merge.ts')
  const progress = { ...record, skipped: false }
  assert.equal(merge.mergePlayRecords([progress], [record])[0].skipped, true)
})


test('actual immediate and bulk sync RPC payloads include completed/skipped; pull retains them', async() => {
  const h = harness()
  await h.advance(30_000)
  h.switchSong()
  const record = h.finals[0]
  const calls = []
  let pulledRecords
  const socket = {
    remote: {
      'playHistory:push': async payload => { calls.push(payload); return { accepted: 1, ignored: 0, cursor: 1 } },
      'playHistory:pull': async() => ({ records: [{ ...record, id: 'remote:1', deviceId: 'remote', startedAt: 1, completed: true, skipped: false }], cursor: 1, hasMore: false }),
    },
  }
  Object.assign(h.deps['@/utils/playHistory/store'], {
    getPlayHistoryCursor: () => null,
    getPlayRecords: () => [record],
    replacePlayRecords: async records => { pulledRecords = records },
    savePlayHistoryCursor: async() => {},
  })
  Object.assign(h.deps, {
    '@/utils/data': { getLuxAuth: async() => ({ user: { id: 'user' } }), getSyncHost: async() => 'host', getSyncMode: async() => 'lux' },
    '@/utils/log': { log: { warn: () => {} } },
    './client/client': { getReadySyncSocket: () => socket, onSyncSocketReady: () => {} },
    './playHistoryFlag': { isPlayHistoryFeatureEnabled: () => true },
  })
  const sync = h.module('plugins/sync/playHistorySync.ts')
  sync.pushPlayRecord(record)
  // Drain the immediate push's asynchronous identity lookup and RPC.
  for (let index = 0; index < 10; index++) await Promise.resolve()
  await sync.syncPlayHistory()
  assert.equal(calls.length, 2)
  for (const payload of calls) {
    assert.equal(payload.records[0].completed, false)
    assert.equal(payload.records[0].skipped, true)
  }
  const remote = pulledRecords.find(record => record.deviceId == 'remote')
  assert.equal(remote.completed, true)
  assert.equal(remote.skipped, false)
})


test('history eligibility stays unchanged for early switches and short tracks', async() => {
  const h = harness()
  await h.advance(10_000)
  h.switchSong()
  assert.equal(h.records.size, 0)
  assert.equal(h.finals.length, 0)
  h.switchSong(music('short', 10))
  h.emit('play')
  await h.advance(5000)
  h.switchSong()
  assert.equal(h.finals[0].completed, false)
  assert.equal(h.finals[0].skipped, true)
})
