/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const load = (path, deps) => {
  const module = { exports: {} }
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const wrapped = value => ({ default: value, __esModule: true })
const flush = () => new Promise(resolve => setImmediate(resolve))
const song = id => ({ id, name: id, singer: 'Artist', source: 'kw', meta: { songId: id, albumName: 'Album' } })
const events = () => {
  const handlers = new Map()
  return { on: (key, fn) => handlers.set(key, fn), emit: (key, ...args) => handlers.get(key)?.(...args) }
}

const gaplessFixture = (enabled = true) => {
  const calls = []
  const current = song('one')
  const next = { musicInfo: song('two'), listId: 'queue', isTempPlay: false }
  const state = { playMusicInfo: { musicInfo: current } }
  const settings = { 'player.audio.gapless.enabled': enabled, 'player.timeoutExitPlayed': false }
  const together = { role: null }
  const app = events(); const states = events()
  global.lx = { isPlayedStop: false }
  global.app_event = { ...app, playerError: () => calls.push('error') }
  global.state_event = states
  const f = { calls, state, settings, together, next, track: { id: 'native-one' }, timer: -1, resolve: async() => 'file:///two.flac' }
  const bridge = {
    setGaplessPlayback: async() => {},
    setGaplessNext: async(id, track) => { calls.push(['stage', id, track]); return f.added !== false },
  }
  f.api = load('src/plugins/player/gapless.ts', {
    'react-native-track-player': wrapped({ pause: async() => calls.push('pause'), getCurrentTrack: async() => 1, remove: async indexes => calls.push(['remove', indexes]) }),
    'react-native': { NativeModules: { TrackPlayerModule: bridge } },
    '@/store/setting/state': wrapped({ setting: settings }),
    '@/store/player/state': wrapped(state),
    '@/store/together/state': wrapped(together),
    '@/store/together/action': { subscribeTogether: fn => { f.roleChanged = fn } },
    '@/core/music': { getMusicUrl: async() => { calls.push('url'); return f.resolve() } },
    '@/core/player/player': { getNextPlayMusicInfo: async() => f.next, acceptGaplessTrack: async info => { calls.push(['accept', info]); state.playMusicInfo.musicInfo = info.musicInfo }, playNext: async() => calls.push('next'), setMusicUrl: (...args) => calls.push(['retry', ...args]) },
    '@/core/player/timeoutExit': { finishTimeoutExit: async() => calls.push('timer-end'), getTimeoutExitTime: () => f.timer, onTimeUpdate: fn => { f.tick = fn } },
    './playList': { buildGaplessTrack: (music, url) => ({ id: `native-${music.id}`, url, musicId: music.id }), getCurrentTrack: async() => f.track, restoreLegacyTail: async() => calls.push('legacy-tail'), trackNativeQueue: () => calls.push('native-queue') },
  })
  return f
}

test('gapless off never resolves URLs, stages, pauses, accepts or retries; native default remains false', async() => {
  const f = gaplessFixture(false)
  f.api.initGapless()
  await f.api.preloadGapless(95, 100)
  f.api.invalidateGapless()
  await f.api.handleGaplessTransition('native-two')
  await f.api.handleGaplessFallback('native-one')
  global.app_event.emit('musicToggled')
  global.state_event.emit('playTempPlayListChanged')
  f.tick(-1, false)
  await flush()
  assert.deepEqual(f.calls, [])
  assert.match(read('src/utils/audioEffects.ts'), /'player.audio.gapless.enabled': false/)
  assert.match(read('dependency-patches/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/player/LocalPlayback.java'), /boolean gaplessEnabled = false/)
})

test('native preloading starts only near the end, stages a resolved real track once, and adopts without pause', async() => {
  const f = gaplessFixture()
  for (const [position, duration] of [[10, 100], [0, 0], [5, 9], [100, 100]]) await f.api.preloadGapless(position, duration)
  assert.deepEqual(f.calls, [])
  await f.api.preloadGapless(95, 100)
  await f.api.preloadGapless(96, 100)
  assert.deepEqual(f.calls, ['url', 'native-queue', ['stage', 'native-one', { id: 'native-two', url: 'file:///two.flac', musicId: 'two' }]])
  f.track = { id: 'native-two' }
  await f.api.handleGaplessTransition('native-two')
  await f.api.handleGaplessTransition('native-two')
  assert.equal(f.calls.filter(call => call[0] === 'accept').length, 1)
  assert.equal(f.calls.includes('pause'), false)
  assert.equal(f.calls.includes('next'), false)
  assert.deepEqual(f.calls.at(-1), ['remove', [0]])
})

for (const mutation of ['seek', 'play-later', 'remove', 'temp-list', 'mode', 'member', 'timer', 'switch']) {
  test(`late URL is discarded after ${mutation}`, async() => {
    const f = gaplessFixture()
    f.api.initGapless()
    let finish
    f.resolve = () => new Promise(resolve => { finish = resolve })
    const preload = f.api.preloadGapless(95, 100)
    await flush()
    if (mutation === 'seek') global.app_event.emit('setProgress')
    if (mutation === 'play-later') global.state_event.emit('playTempPlayListChanged')
    if (mutation === 'remove' || mutation === 'temp-list') global.app_event.emit('myListMusicUpdate', ['queue'])
    if (mutation === 'mode') global.state_event.emit('configUpdated', ['player.togglePlayMethod'])
    if (mutation === 'member') { f.together.role = 'member'; f.roleChanged() }
    if (mutation === 'timer') { global.lx.isPlayedStop = true; f.tick(0, true) }
    if (mutation === 'switch') { f.state.playMusicInfo.musicInfo = song('other'); global.app_event.emit('musicToggled') }
    finish('file:///late.flac')
    await preload
    assert.equal(f.calls.some(call => call[0] === 'stage' && call[2] != null), false)
    assert.equal(f.calls.some(call => call[0] === 'accept'), false)
  })
}

test('finish-song timers and together members retain ordinary switching; timer ticks do not repeatedly clear a queue', async() => {
  for (const mode of ['member', 'finish-song', 'stopped']) {
    const f = gaplessFixture()
    if (mode === 'member') f.together.role = 'member'
    if (mode === 'finish-song') { f.settings['player.timeoutExitPlayed'] = true; f.timer = 30 }
    if (mode === 'stopped') global.lx.isPlayedStop = true
    await f.api.preloadGapless(95, 100)
    assert.deepEqual(f.calls, [])
  }
  const f = gaplessFixture()
  f.api.initGapless()
  f.tick(60, false)
  await flush()
  f.calls.length = 0
  f.tick(59, false); f.tick(58, false)
  await flush()
  assert.deepEqual(f.calls, [])
})

test('missing, rejected and expired URLs quietly leave normal auto-next available', async() => {
  for (const mode of ['empty', 'error', 'native-rejected']) {
    const f = gaplessFixture()
    if (mode === 'empty') f.resolve = async() => ''
    if (mode === 'error') f.resolve = async() => { throw Error('offline') }
    if (mode === 'native-rejected') f.added = false
    await f.api.preloadGapless(95, 100)
    await f.api.handleGaplessTransition('native-two')
    assert.equal(f.calls.some(call => call[0] === 'accept'), false)
    assert.equal(f.calls.includes('error'), false)
  }
})

test('renderer/source failure retries the accepted song silently once and ignores stale native errors', async() => {
  const f = gaplessFixture()
  await f.api.preloadGapless(95, 100)
  f.track = { id: 'native-two' }
  await f.api.handleGaplessFallback('native-two')
  assert.equal(f.calls.filter(call => call[0] === 'accept').length, 1)
  assert.deepEqual(f.calls.find(call => call[0] === 'retry'), ['retry', f.next.musicInfo, true])
  await f.api.handleGaplessFallback('stale')
  assert.equal(f.calls.filter(call => call[0] === 'retry').length, 1)
  await f.api.handleGaplessFallback('native-two')
  assert.ok(f.calls.includes('error'))
})

const coreFixture = (enabled = false, mode = 'listLoop') => {
  const songs = [song('one'), song('two'), song('three')]
  const calls = []
  const lists = { queue: songs, temp: [] }
  const state = { isPlay: true, playedList: [], tempPlayList: [], progress: { nowPlayTime: 95, maxPlayTime: 100 }, musicInfo: { id: songs[0].id }, playMusicInfo: { listId: 'queue', musicInfo: songs[0], isTempPlay: false }, playInfo: { playerListId: 'queue', playerPlayIndex: 0 } }
  const setting = { 'player.audio.gapless.enabled': enabled, 'player.togglePlayMethod': mode, 'player.volume': 0.8, 'player.playbackRate': 1 }
  const timers = new Map(); let timerId = 0
  const bg = { setTimeout: fn => { timers.set(++timerId, fn); return timerId }, clearTimeout: id => timers.delete(id) }
  global.lx = { gettingUrlId: '', isPlayedStop: false, restorePlayInfo: null }
  global.i18n = { t: key => key }
  global.app_event = Object.fromEntries(['pause', 'playerPlaying', 'play', 'picUpdated', 'lyricUpdated', 'error'].map(key => [key, () => { calls.push(key); if (key === 'pause') state.isPlay = false }]))
  const deps = {
    '@/plugins/player': { isInitialized: () => true, isNotificationLikeSupported: false, setStop: async() => calls.push('stop'), setVolume: async() => {}, setPlaybackRate: async() => {}, setResource: (music, url) => calls.push(['resource', music.id, url]) },
    '@/core/player/playStatus': { setStatusText: () => {} },
    '@/store/player/state': wrapped(state),
    '@/store/setting/state': wrapped({ setting }),
    '@/core/player/playInfo': {
      getList: id => lists[id] ?? [],
      setPlayListId: id => { state.playInfo.playerListId = id },
      setPlayMusicInfo: (listId, music, temp, reason) => {
        calls.push(['history', reason]); state.playMusicInfo = { listId, musicInfo: music, isTempPlay: temp }; state.musicInfo = { id: music?.id }; state.progress = { nowPlayTime: 0, maxPlayTime: 0 }
        if (!temp) state.playInfo.playerPlayIndex = lists[listId]?.indexOf(music) ?? -1
        calls.push('musicToggled')
      },
      setMusicInfo: () => {},
    },
    '@/core/player/playedList': { addPlayedList: info => state.playedList.push(info), clearPlayedList: () => { state.playedList = [] }, removePlayedList: i => state.playedList.splice(i, 1) },
    '@/core/player/tempPlayList': { clearTempPlayeList: () => { state.tempPlayList = [] }, removeTempPlayList: i => state.tempPlayList.splice(i, 1) },
    '@/core/music': { getMusicUrl: async({ musicInfo }) => `file:///${musicInfo.id}.flac`, getPicPath: async() => '', getLyricInfo: async() => ({ rawlrcInfo: {} }) },
    '@/utils/message': { requestMsg: {} },
    '@/utils/common': { getRandom: () => 2 },
    './utils': { filterList: async({ list, playerMusicInfo }) => ({ filteredList: list, playerIndex: list.indexOf(playerMusicInfo) }) },
    'react-native-background-timer': wrapped(bg),
    '@/utils/tools': { debounceBackgroundTimer: fn => (...args) => bg.setTimeout(() => fn(...args)), checkNotificationPermission: async() => {}, checkIgnoringBatteryOptimization: async() => {} },
    '@/config/constant': { LIST_IDS: { TEMP: 'temp', LOVE: 'love' } },
    '@/core/list': { getListMusics: async id => lists[id] ?? [], setTempList: async(id, musics) => { lists.temp = musics }, addListMusics: async(id, musics) => lists[id].push(...musics) },
    '@/core/dislikeList': {},
    '@/store/list/state': wrapped({ tempListMeta: { id: '' } }),
    '@/core/together/control': { blockTogetherMemberControl: () => false, isTogetherMemberLocked: () => false },
  }
  const api = load('src/core/player/player.ts', deps)
  return { api, state, calls, lists, songs, async drain() { for (const [id, fn] of [...timers]) { if (timers.delete(id)) fn() }; await flush(); await flush() } }
}

for (const enabled of [false, true]) {
  test(`next/prev/auto-next/random/single loop preserve existing selection and accounting (gapless=${enabled})`, async() => {
    for (const [mode, action, expected] of [['listLoop', 'next', 1], ['listLoop', 'prev', 2], ['listLoop', 'auto', 1], ['random', 'auto', 2], ['singleLoop', 'auto', 0], ['singleLoop', 'next', 1]]) {
      const f = coreFixture(enabled, mode)
      if (action === 'prev') await f.api.playPrev()
      else await f.api.playNext(action === 'auto')
      await f.drain()
      assert.equal(f.state.playMusicInfo.musicInfo.id, f.songs[expected].id)
      assert.deepEqual(f.calls.find(call => call[0] === 'history'), ['history', action === 'auto' ? 'interrupted' : 'switch'])
      assert.ok(f.calls.includes('stop'))
      assert.deepEqual(f.calls.find(call => call[0] === 'resource'), ['resource', f.songs[expected].id, `file:///${f.songs[expected].id}.flac`])
    }
  })
  test(`play-later, deleted next song and isolated temporary queues select current data (gapless=${enabled})`, async() => {
    const f = coreFixture(enabled)
    const later = { musicInfo: song('later'), listId: 'other', isTempPlay: true }
    f.state.tempPlayList.push(later)
    assert.equal(await f.api.getNextPlayMusicInfo(), later)
    await f.api.playNext(true); await f.drain()
    assert.equal(f.state.tempPlayList.length, 0)
    assert.equal(f.state.playMusicInfo.musicInfo.id, 'later')
    const removed = coreFixture(enabled)
    removed.lists.queue.splice(1, 1)
    assert.equal((await removed.api.getNextPlayMusicInfo()).musicInfo.id, 'three')
    const temp = coreFixture(enabled)
    await temp.api.playListAsQueue('queue', 1); await temp.drain()
    assert.equal(temp.state.playInfo.playerListId, 'temp')
    assert.equal(temp.state.playMusicInfo.musicInfo.id, 'two')
    assert.notEqual(temp.lists.temp, temp.lists.queue)
    assert.equal(temp.lists.queue.length, 3)
  })
}

test('native adoption finishes history as end, consumes play-later, resets progress, refreshes notifications and never stops/reloads URL', async() => {
  const f = coreFixture(true, 'random')
  const later = { musicInfo: song('later'), listId: 'other', isTempPlay: true }
  f.state.tempPlayList.push(later)
  await f.api.acceptGaplessTrack(later)
  await f.drain()
  assert.deepEqual(f.calls.find(call => call[0] === 'history'), ['history', 'end'])
  assert.equal(f.state.tempPlayList.length, 0)
  assert.equal(f.state.progress.nowPlayTime, 0)
  assert.equal(f.calls.includes('stop'), false)
  assert.equal(f.calls.some(call => call[0] === 'resource'), false)
  assert.ok(f.calls.includes('musicToggled'))
  assert.ok(f.calls.includes('play'))
  const off = coreFixture(false)
  await off.api.acceptGaplessTrack(later)
  assert.deepEqual(off.calls, [])
})

const playlistFixture = enabled => {
  let active = 0
  const queue = [{ id: 'existing', url: 'file:///existing.flac' }]
  const calls = []
  const settings = { 'player.audio.gapless.enabled': enabled }
  const music = song('two')
  const tp = {
    getCurrentTrack: async() => active,
    getTrack: async index => queue[index],
    getQueue: async() => [...queue],
    add: async tracks => { calls.push(['add', tracks.map(t => t.url)]); queue.push(...tracks) },
    skip: async index => { calls.push(['skip', index]); active = index },
    pause: async() => calls.push('pause'),
    seekTo: async time => calls.push(['seek', time]),
    play: async() => calls.push('play'),
    removeUpcomingTracks: async() => { calls.push('remove-upcoming'); queue.splice(active + 1) },
    remove: async indexes => { calls.push(['remove', indexes]); for (const index of [...indexes].reverse()) { queue.splice(index, 1); if (index < active) active-- } },
  }
  global.lx = { restorePlayInfo: null }
  const api = load('src/plugins/player/playList.ts', {
    'react-native-track-player': { ...wrapped(tp), State: { Playing: 3 } },
    'react-native-background-timer': wrapped({ setTimeout: () => 1, clearTimeout() {} }),
    '@/config': { defaultUrl: 'file:///dummy.mp3' },
    '@/store/setting/state': wrapped({ setting: settings }),
    '@/store/player/state': wrapped({ playMusicInfo: { musicInfo: music }, musicInfo: {} }),
    './cache': { getTrackCacheKey: m => m.id },
    './notificationArtwork': {},
    './gapless': { isGaplessEnabled: () => settings['player.audio.gapless.enabled'] },
    '@/utils/cachedSongInfo': { rememberPlayingCacheSong: async() => {} },
  })
  return { api, calls, queue, settings, music }
}

test('flag-off backend retains exact dummy/add/skip/pause/seek/play behavior; flag-on queues one real item', async() => {
  const off = playlistFixture(false)
  off.api.playMusic(off.music, 'file:///two.flac', 4)
  await flush(); await flush()
  assert.deepEqual(off.calls, [['add', ['file:///two.flac', 'file:///dummy.mp3']], ['skip', 1], 'pause', ['seek', 4], 'play', ['remove', [0]]])
  assert.equal(off.queue.length, 2)
  assert.match(off.queue[1].id, /\/\/default$/)
  const on = playlistFixture(true)
  on.api.playMusic(on.music, 'file:///two.flac', 4)
  await flush(); await flush()
  assert.deepEqual(on.calls, ['remove-upcoming', ['add', ['file:///two.flac']], ['skip', 1], ['seek', 4], 'play', ['remove', [0]]])
  assert.equal(on.queue.length, 1)
  assert.equal(await on.api.getCurrentTrackId(), on.queue[0].id)
  on.settings['player.audio.gapless.enabled'] = false
  await on.api.restoreLegacyTail()
  assert.match(on.queue[1].id, /\/\/default$/)
  on.calls.length = 0
  on.api.playMusic(on.music, 'file:///three.flac', 0)
  await flush(); await flush()
  assert.deepEqual(on.calls.slice(0, 5), [['add', ['file:///three.flac', 'file:///dummy.mp3']], ['skip', 2], 'pause', ['seek', 0], 'play'])
  assert.equal(await on.api.getCurrentTrackId(), on.queue[0].id)
})

test('native API wiring uses Media3 1.8.0 signatures, real native playlist preloading and existing session listeners', () => {
  const prefix = 'dependency-patches/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/'
  const native = read(`${prefix}service/player/LocalPlayback.java`)
  const module = read(`${prefix}module/MusicModule.java`)
  assert.match(native, /new ExoPlayer.PreloadConfiguration\(5_000_000L\)/)
  assert.match(native, /player.addMediaSource\(index, source\);/)
  assert.match(native, /currentId.equals\(current.originalItem.getString\("id"\)\)/)
  assert.match(native, /MEDIA_ITEM_TRANSITION_REASON_AUTO/)
  assert.match(native, /compatible \? "gapless-transition" : "gapless-fallback"/)
  assert.match(native, /equalizer.attach\(player\)/)
  assert.match(native, /loudness.attach\(player\)/)
  assert.match(module, /promise.resolve\(\(\(LocalPlayback\) playback\).setGaplessNext\(currentId, next\)\)/)
  assert.match(module, /void setGaplessPlayback\(final boolean enabled, final Promise promise\)/)
  assert.match(read('node_modules/react-native-track-player/android/build.gradle'), /def media3Version = '1.8.0'/)
})

test('white noise regression: gapless path never touches the noise mixer and sleep envelope still drives noise', () => {
  const prefix = 'dependency-patches/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/'
  const gapless = read('src/plugins/player/gapless.ts')
  assert.doesNotMatch(gapless, /noise/i)
  const local = read(`${prefix}service/player/LocalPlayback.java`)
  const gaplessNative = local.slice(local.indexOf('private boolean gaplessEnabled'), local.indexOf('public void setLoudnessNormalization'))
  assert.ok(gaplessNative.length > 0)
  assert.doesNotMatch(gaplessNative, /Noise/)
  assert.match(read(`${prefix}service/MusicService.java`), /NoiseMixer/)
})
