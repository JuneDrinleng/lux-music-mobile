import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const load = (path, require = () => ({}), globals = {}) => {
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}) {${source}\n})`, { filename: path })
    .runInThisContext()(require, module, module.exports, ...Object.values(globals))
  return module.exports
}
const flush = async() => { for (let i = 0; i < 40; i++) await Promise.resolve() }
const optionsFixture = (timer = true) => {
  const calls = []
  const Capability = Object.fromEntries(['Play', 'Pause', 'Stop', 'SeekTo', 'SkipToNext', 'SkipToPrevious', 'Like'].map((name, i) => [name, 2 ** i]))
  const deps = {
    'react-native': { NativeModules: { TrackPlayerModule: timer ? { CAPABILITY_SLEEP_TIMER: 2 ** 29 } : {} } },
    'react-native-track-player': { __esModule: true, default: { updateOptions: async options => { calls.push(options) } }, Capability },
    './volumeFade': { createVolumeFade: () => ({}) },
    '@/config': {},
  }
  const utils = load('src/plugins/player/utils.ts', name => deps[name] ?? {}, { global: { i18n: { t: key => key } } })
  return { utils, calls, Capability }
}

test('notification options retain love state through timer/general option refreshes and preserve transport capabilities', async() => {
  const { utils, calls, Capability } = optionsFixture()
  await utils.updateOptions({ likeOptions: { isActive: true } })
  await utils.updateOptions()
  assert.equal(calls.at(-1).likeOptions.isActive, true)
  assert.equal(calls.at(-1).likeOptions.title, 'notification_like')
  assert.equal(calls.at(-1).sleepTimerOptions.title, 'notification_sleep_timer')
  for (const capability of Object.values(Capability)) assert.ok(calls.at(-1).capabilities.includes(capability))
  assert.ok(calls.at(-1).capabilities.includes(2 ** 29))
  assert.deepEqual(calls.at(-1).compactCapabilities, [Capability.SkipToPrevious, Capability.Play, Capability.Pause, Capability.SkipToNext])
  await utils.updateOptions({ likeOptions: { isActive: false } })
  await utils.updateOptions()
  assert.equal(calls.at(-1).likeOptions.isActive, false)
  const unsupported = optionsFixture(false)
  await unsupported.utils.updateOptions()
  assert.equal(unsupported.calls[0].sleepTimerOptions, undefined)
})

test('remote notification events use real love toggling and existing timer engine; register once', async() => {
  const { utils, calls } = optionsFixture()
  const song = { id: 'one', source: 'kw' }
  const playerState = { playMusicInfo: { musicInfo: song } }
  let loved = []
  const player = load('src/core/player/player.ts', name => ({
    '@/plugins/player': { isInitialized: () => true, isNotificationLikeSupported: true, updateOptions: utils.updateOptions },
    '@/store/player/state': playerState,
    '@/utils/tools': { debounceBackgroundTimer: fn => fn },
    '@/store/setting/state': { setting: {} },
    '@/config/constant': { LIST_IDS: { LOVE: 'love' } },
    '@/core/list': {
      getListMusics: async() => loved,
      addListMusics: async(id, songs) => { assert.equal(id, 'love'); loved.push(...songs) },
      removeListMusics: async(id, ids) => { assert.equal(id, 'love'); loved = loved.filter(s => !ids.includes(s.id)) },
    },
  })[name] ?? {})
  const timerDeps = {
    'react-native-background-timer': { setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {} },
    '@/plugins/player/utils': { restoreSleepTimerVolume: async() => {} },
    '@/store/setting/state': { setting: {} },
    './sleepTimerOptions': load('src/core/player/sleepTimerOptions.ts'),
  }
  const lx = { isPlayedStop: false, playerStatus: {} }
  const timer = load('src/core/player/timeoutExit.ts', name => timerDeps[name] ?? {}, { global: { lx } })
  const listeners = new Map()
  let register
  const service = load('src/plugins/player/service.ts', name => ({
    'react-native-track-player': {
      __esModule: true,
      default: {
        registerPlaybackService: factory => { register = factory() },
        addEventListener: (event, callback) => { assert.ok(!listeners.has(event)); listeners.set(event, callback) },
      },
      Event: new Proxy({}, { get: (_, key) => key }),
      State: {},
    },
    './utils': { isNotificationLikeSupported: true, isNotificationSleepTimerSupported: true },
    '@/core/player/player': player,
    '@/core/player/timeoutExit': timer,
  })[name] ?? {}, { global: { lx } })
  service.default()
  await register()
  await register()
  listeners.get('RemoteLike')()
  await flush()
  assert.deepEqual(loved, [song])
  assert.equal(calls.at(-1).likeOptions.isActive, true)
  listeners.get('RemoteLike')()
  await flush()
  assert.deepEqual(loved, [])
  assert.equal(calls.at(-1).likeOptions.isActive, false)
  // External edits and track changes use the same reflection method.
  loved = [song]
  await player.syncNotificationLikeState()
  assert.equal(calls.at(-1).likeOptions.isActive, true)
  playerState.playMusicInfo.musicInfo = { id: 'two', source: 'kw' }
  await player.syncNotificationLikeState()
  assert.equal(calls.at(-1).likeOptions.isActive, false)
  const pressTimer = listeners.get('remote-sleep-timer')
  for (const minutes of [15, 30, 45, 60, 90]) {
    pressTimer()
    assert.equal(timer.getTimeoutExitTime(), minutes * 60)
  }
  pressTimer()
  assert.equal(timer.getTimeoutExitTime(), -1)
  timer.startTimeoutExit(22 * 60)
  pressTimer()
  assert.equal(timer.getTimeoutExitTime(), 30 * 60)
  lx.isPlayedStop = true
  pressTimer()
  assert.equal(lx.isPlayedStop, false)
  assert.equal(timer.getTimeoutExitTime(), -1)
})

test('notification artwork requests originals, preserves local/unknown URLs, and drops thumbnail limits', () => {
  const { notificationArtwork: cover } = load('src/plugins/player/notificationArtwork.ts')
  assert.equal(cover('https://p1.music.126.net/id.jpg?param=100y100'), 'https://p1.music.126.net/id.jpg')
  assert.equal(cover('https://p1.music.126.net/id.jpg?a=1&param=100y100&b=2'), 'https://p1.music.126.net/id.jpg?a=1&b=2')
  assert.equal(cover('https://y.gtimg.cn/music/photo_new/T002R300x300M000id.jpg'), 'https://y.gtimg.cn/music/photo_new/T002M000id.jpg')
  assert.equal(cover('https://img1.kuwo.cn/star/albumcover/120/a.jpg'), 'https://img1.kuwo.cn/star/albumcover/500/a.jpg')
  assert.equal(cover('https://imge.kugou.com/stdmusic/120/a.jpg'), 'https://imge.kugou.com/stdmusic/0/a.jpg')
  for (const url of ['file:///cover.jpg', '/storage/cover.jpg', 'content://media/1', 'https://example.com/cover?param=100y100&signature=abc']) assert.equal(cover(url), url)
  assert.equal(cover(null), undefined)
  assert.equal(cover(''), undefined)
})

test('notification labels are translated in all locales', () => {
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const strings = JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8'))
    assert.ok(strings.notification_like)
    assert.ok(strings.notification_sleep_timer)
  }
})
