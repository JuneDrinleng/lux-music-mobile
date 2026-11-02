import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (path, require = () => { throw new Error('Unexpected import') }, globals = {}) => {
  const source = ts.transpileModule(readFileSync(join(root, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}) {${source}\n})`, { filename: path })
    .runInThisContext()(require, module, module.exports, ...Object.values(globals))
  return module.exports
}
const options = load('src/core/player/sleepTimerOptions.ts')
const math = load('src/plugins/player/volumeFade.ts')
const flush = async() => { for (let i = 0; i < 40; i++) await Promise.resolve() }

const fixture = async(wait = false, nativeSupported = false, noiseSupported = false) => {
  let now = 0
  let deadline
  let tick
  let position = 0
  let duration = 200
  const output = []
  const events = []
  const volume = math.createVolumeFade(async value => { output.push(value) })
  await volume.setVolume(0.8)
  const lx = { isPlayedStop: false }
  const player = { isPlay: true, playRate: 1 }
  const setting = { 'player.timeoutExitPlayed': wait, 'player.timeoutExitFade': true, 'player.playbackRate': 1, 'player.timeoutExitFadeDuration': 10, 'player.timeoutExitStopNoise': true }
  const noiseCalls = []
  const nativeCalls = []
  const native = {
    isNativeFadeOutSupported: nativeSupported,
    startNativeFadeOut: async(durationMs, endAtMs, finishSong, requestId) => {
      nativeCalls.push({ durationMs, endAtMs, finishSong, requestId })
      // Stand-in for the service's restore-before-restart contract.
      await volume.restore()
    },
    cancelNativeFadeOut: async() => {
      events.push('native-cancel')
      await volume.restore()
    },
    setSleepTimerGain: volume.setGain,
    restoreSleepTimerVolume: async() => { events.push('restore'); await volume.restore() },
    setPause: async() => { events.push('pause') },
    getPosition: async() => position,
    getDuration: async() => duration,
  }
  const timer = load('src/core/player/timeoutExit.ts', name => {
    switch (name) {
      case 'react': return {}
      case 'react-native-background-timer': return {
        setTimeout: fn => { deadline = fn; return 0 },
        clearTimeout: () => { deadline = undefined },
        setInterval: fn => { tick = fn; return 1 },
        clearInterval: () => { tick = undefined },
      }
      case '@/core/common': return { exitApp: reason => { assert.equal(reason, 'Timeout Exit'); events.push('exit') } }
      case '@/store/player/state': return player
      case '@/store/setting/state': return { setting }
      case '@/plugins/player/noise': return { noise: { supported: noiseSupported, timer: async(stop, gain = 1) => { noiseCalls.push(['gain', stop, gain]) } } }
      case './whiteNoise': return { stopWhiteNoise: async() => { noiseCalls.push('stop') } }
      case '@/plugins/player/utils': return native
      case '@/plugins/player/volumeFade': return math
      case './sleepTimerOptions': return options
      default: throw new Error(name)
    }
  }, { global: { lx }, performance: { now: () => now }, Date: { now: () => now } })
  return {
    timer,
    nativeCalls,
    noiseCalls,
    volume,
    native,
    output,
    events,
    lx,
    player,
    setting,
    async advance(seconds) { now = seconds * 1000; tick?.(); await flush() },
    async expire() { deadline?.(); await flush() },
    song(pos, length) { position = pos; duration = length },
  }
}

test('sleep fade clamps its linear ramp and skips invalid/live song durations', () => {
  assert.deepEqual([30, 20, 10, 0, -5].map(n => math.fadeGain(n, 20)), [1, 1, 0.5, 0, 0])
  assert.equal(math.fadeGain(Infinity, 20), 1)
  assert.equal(math.fadeGain(NaN, 20), 1)
  assert.equal(math.fadeGain(10, 0), 1)
  assert.equal(math.songRemainingSeconds(180, 200, 2), 10)
  assert.equal(math.songRemainingSeconds(180, 0, 1), Infinity)
  assert.equal(math.songRemainingSeconds(NaN, 200, 1), Infinity)
})

test('sleep fade restores the latest user volume and serializes cancellation after pending native writes', async() => {
  const writes = []
  let release
  const volume = math.createVolumeFade(async value => {
    if (value === 0.4) await new Promise(resolve => { release = resolve })
    writes.push(value)
  })
  await volume.setVolume(0.8)
  const fade = volume.setGain(0.5)
  await flush()
  const changed = volume.setVolume(0.6)
  const restored = volume.restore()
  release()
  await Promise.all([fade, changed, restored])
  assert.deepEqual(writes, [0.8, 0.4, 0.3, 0.6])
})

test('sleep timer fades before deadline, pauses before restoring volume for resume', async() => {
  const f = await fixture()
  f.timer.startTimeoutExit(60)
  await f.advance(40)
  assert.equal(f.output.at(-1), 0.8)
  await f.advance(55)
  assert.equal(f.output.at(-1), 0.4)
  await f.expire()
  assert.deepEqual(f.events, ['pause', 'restore'])
  assert.equal(f.output.at(-1), 0.8)
})

test('sleep timer cancel and replacement restore immediately without pausing', async() => {
  const f = await fixture()
  f.timer.startTimeoutExit(60)
  await f.advance(55)
  f.timer.stopTimeoutExit()
  await flush()
  assert.equal(f.output.at(-1), 0.8)
  assert.equal(f.events.includes('exit'), false)
  f.timer.startTimeoutExit(60)
  await f.advance(110)
  assert.equal(f.output.at(-1), 0.4)
  f.timer.startTimeoutExit(120)
  await flush()
  assert.equal(f.output.at(-1), 0.8)
})

test('wait mode fades only after expiry at song end, accounts for speed and restores on cancel', async() => {
  const f = await fixture(true)
  f.timer.startTimeoutExit(60)
  await f.advance(55)
  assert.equal(f.output.at(-1), 0.8)
  f.song(190, 200)
  f.setting['player.playbackRate'] = 2
  await f.expire()
  assert.equal(f.lx.isPlayedStop, true)
  assert.equal(f.output.at(-1), 0.4)
  f.timer.cancelTimeoutExit()
  await flush()
  assert.equal(f.lx.isPlayedStop, false)
  assert.equal(f.output.at(-1), 0.8)
  assert.equal(f.events.includes('exit'), false)
})

test('wait mode skips unknown duration and restores before song-end pause', async() => {
  const f = await fixture(true)
  f.timer.startTimeoutExit(60)
  f.song(50, 0)
  await f.expire()
  assert.equal(f.output.at(-1), 0.8)
  f.song(195, 200)
  await f.advance(65)
  assert.equal(f.output.at(-1), 0.4)
  await f.timer.finishTimeoutExit()
  assert.deepEqual(f.events, ['pause', 'restore'])
  assert.equal(f.lx.isPlayedStop, false)
})

test('cancelling while native progress is pending prevents late fade writes', async() => {
  const f = await fixture(true)
  let resolve
  f.native.getPosition = () => new Promise(_resolve => { resolve = _resolve })
  f.timer.startTimeoutExit(60)
  await f.expire()
  f.timer.cancelTimeoutExit()
  resolve(195)
  await flush()
  assert.deepEqual(f.output, [0.8])
})

test('disabling fade restores output on the next tick; disabled timers still pause', async() => {
  const f = await fixture()
  f.timer.startTimeoutExit(60)
  await f.advance(55)
  f.setting['player.timeoutExitFade'] = false
  await f.advance(56)
  assert.equal(f.output.at(-1), 0.8)
  await f.expire()
  assert.deepEqual(f.events, ['restore', 'pause'])
})


test('failed native volume writes do not prevent restoration', async() => {
  const writes = []
  const volume = math.createVolumeFade(async value => {
    if (value === 0.4) throw new Error('native failure')
    writes.push(value)
  })
  await volume.setVolume(0.8)
  await assert.rejects(volume.setGain(0.5), /native failure/)
  await volume.restore()
  assert.deepEqual(writes, [0.8, 0.8])
})

test('wait mode pauses immediately at deadline when playback is paused', async() => {
  const f = await fixture(true)
  f.player.isPlay = false
  f.timer.startTimeoutExit(60)
  await f.expire()
  assert.deepEqual(f.events, ['pause'])
  assert.equal(f.lx.isPlayedStop, false)
})

test('cancel while deadline pause is pending restores and keeps restored volume', async() => {
  const f = await fixture()
  let resolve
  f.native.setPause = () => new Promise(_resolve => { resolve = _resolve })
  f.timer.startTimeoutExit(60)
  await f.advance(55)
  await f.expire()
  f.timer.stopTimeoutExit()
  resolve()
  await flush()
  assert.equal(f.output.at(-1), 0.8)
  assert.equal(f.events.includes('exit'), false)
})

test('restart during fade restores, then fades the new countdown; pause and resume preserve user volume', async() => {
  const f = await fixture()
  f.timer.startTimeoutExit(60)
  await f.advance(55)
  assert.equal(f.output.at(-1), 0.4)
  f.timer.startTimeoutExit(120)
  await flush()
  assert.equal(f.output.at(-1), 0.8)
  await f.advance(170)
  assert.equal(f.output.at(-1), 0.4)
  f.player.isPlay = false
  await f.advance(171)
  assert.equal(f.output.at(-1), 0.8)
  f.player.isPlay = true
  await f.advance(172)
  assert.ok(Math.abs(f.output.at(-1) - 0.24) < 1e-8)
  await f.expire()
  assert.equal(f.output.at(-1), 0.8)
})

test('all fade duration choices drive the ramp; invalid persisted durations fall back to 30s', async() => {
  assert.deepEqual(options.SLEEP_TIMER_FADE_SECONDS, [10, 30, 60])
  for (const seconds of [10, 30, 60, 0, NaN]) {
    const f = await fixture()
    f.setting['player.timeoutExitFadeDuration'] = seconds
    f.timer.startTimeoutExit(120)
    await f.advance(120 - options.sleepTimerFadeSeconds(seconds) / 2)
    assert.equal(f.output.at(-1), 0.4)
    f.timer.cancelTimeoutExit()
    await flush()
  }
})

test('native capability arms the whole countdown immediately and avoids JS gain writes', async() => {
  const f = await fixture(false, true)
  f.timer.startTimeoutExit(60)
  await flush()
  assert.deepEqual(f.nativeCalls, [{ durationMs: 10000, endAtMs: 60000, finishSong: false, requestId: '1:60000:10000:false:true' }])
  await f.advance(55)
  assert.ok(f.output.every(value => value === 0.8))
  assert.equal(f.nativeCalls.length, 1)
  await f.expire()
  assert.deepEqual(f.events, ['pause', 'native-cancel'])
})

test('native cancel restores, restart replaces the deadline, and stale completion is ignored', async() => {
  const f = await fixture(false, true)
  f.timer.startTimeoutExit(60)
  await f.volume.setGain(0.5)
  f.timer.cancelTimeoutExit()
  await flush()
  assert.equal(f.output.at(-1), 0.8)
  f.timer.startTimeoutExit(60)
  await f.advance(55)
  await f.volume.setGain(0.5)
  f.timer.startTimeoutExit(120)
  await flush()
  assert.equal(f.output.at(-1), 0.8)
  assert.deepEqual(f.nativeCalls.at(-1), { durationMs: 10000, endAtMs: 175000, finishSong: false, requestId: '4:175000:10000:false:true' })
  f.timer.onNativeFadeEnded('1:60000:10000:false:true')
  await flush()
  assert.equal(f.events.includes('pause'), false)
  f.timer.onNativeFadeEnded(f.nativeCalls.at(-1).requestId)
  await flush()
  assert.equal(f.events.includes('pause'), true)
})

test('native finish-song mode is armed before expiry; settings changes replace or cancel the envelope', async() => {
  const f = await fixture(true, true)
  f.timer.startTimeoutExit(60)
  await flush()
  assert.equal(f.nativeCalls[0].finishSong, true)
  await f.expire()
  assert.equal(f.lx.isPlayedStop, true)
  assert.equal(f.nativeCalls.length, 1)
  f.setting['player.timeoutExitFadeDuration'] = 30
  await f.advance(61)
  assert.equal(f.nativeCalls.at(-1).durationMs, 30000)
  f.setting['player.timeoutExitFade'] = false
  await f.advance(62)
  assert.ok(f.events.includes('native-cancel'))
  f.timer.cancelTimeoutExit()
})

test('failed native scheduling cancels native work and uses the existing JS ramp', async() => {
  const f = await fixture(false, true)
  f.native.startNativeFadeOut = async() => { throw new Error('unavailable service') }
  f.timer.startTimeoutExit(60)
  await flush()
  await f.advance(55)
  assert.equal(f.output.at(-1), 0.4)
  f.timer.cancelTimeoutExit()
  await flush()
  assert.equal(f.output.at(-1), 0.8)
})

test('native bridge requires both methods and the capability, and forwards deadline/mode/request identity', async() => {
  for (const variant of ['supported', 'no-capability', 'no-start', 'no-cancel', 'no-module']) {
    const calls = []
    const module = {
      CAPABILITY_NATIVE_FADE_OUT: variant !== 'no-capability',
      startFadeOut: async(...args) => { calls.push(args) },
      cancelFadeOut: async() => { calls.push('cancel') },
    }
    if (variant === 'no-start') delete module.startFadeOut
    if (variant === 'no-cancel') delete module.cancelFadeOut
    const deps = {
      'react-native': { NativeModules: { TrackPlayerModule: variant === 'no-module' ? undefined : module } },
      'react-native-track-player': { __esModule: true, default: {}, Capability: {} },
      './volumeFade': math,
    }
    const utils = load('src/plugins/player/utils.ts', name => name === '@/utils/sessionFence' ? { sessionGeneration: () => 0, sessionWritesFrozen: () => false } : deps[name] ?? {})
    assert.equal(utils.isNativeFadeOutSupported, variant === 'supported')
    await utils.startNativeFadeOut(30000, 90000, true, 'request-1')
    await utils.cancelNativeFadeOut()
    assert.deepEqual(calls, variant === 'supported' ? [[30000, 90000, true, 'request-1'], 'cancel'] : [])
  }
})

test('late failure from a replaced native request cannot cancel the new countdown', async() => {
  const f = await fixture(false, true)
  let reject
  const start = f.native.startNativeFadeOut
  f.native.startNativeFadeOut = () => new Promise((resolve, _reject) => { reject = _reject })
  f.timer.startTimeoutExit(60)
  f.native.startNativeFadeOut = start
  f.timer.startTimeoutExit(120)
  await flush()
  const events = [...f.events]
  reject(new Error('old request failed'))
  await flush()
  assert.deepEqual(f.events, events)
  await f.advance(115)
  assert.ok(f.output.every(value => value === 0.8))
  assert.equal(f.nativeCalls.length, 1)
  f.timer.cancelTimeoutExit()
})

test('same-deadline restart rejects a previous native completion identity', async() => {
  const f = await fixture(false, true)
  f.timer.startTimeoutExit(60)
  const previous = f.nativeCalls.at(-1).requestId
  f.timer.startTimeoutExit(60)
  await flush()
  assert.notEqual(previous, f.nativeCalls.at(-1).requestId)
  f.timer.onNativeFadeEnded(previous)
  await flush()
  assert.equal(f.events.includes('pause'), false)
  f.timer.cancelTimeoutExit()
})

const zh = JSON.parse(readFileSync(join(root, 'src/lang/zh-cn.json'), 'utf8'))
const t = (key, args = {}) => zh[key].replace(/\{(\w+)\}/g, (_, name) => args[name])
const jsx = (type, props) => ({ type, props })
const walk = node => {
  if (!node || typeof node !== 'object') return []
  return [node, ...[node.props?.children].flat(Infinity).flatMap(walk)]
}
const uiFixture = () => {
  const settings = { 'player.timeoutExit': '', 'player.timeoutExitPlayed': true, 'player.timeoutExitFade': true, 'player.timeoutExitFadeDuration': 30 }
  const starts = []
  const info = { time: -1, isPlayedStop: false }
  let cancels = 0
  let customOpened = 0
  const refs = []
  const roles = { ink: 'ink', onInk: 'paper' }
  const deps = {
    react: {
      useRef: () => { const ref = { current: { show: () => { customOpened++ } } }; refs.push(ref); return ref },
      useState: value => [value, () => {}],
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ScrollView: 'ScrollView', View: 'View', TouchableOpacity: 'TouchableOpacity' },
    '@/components/common/Text': 'Text',
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/TimeoutExitEditModal': { __esModule: true, default: 'CustomInput', useTimeInfo: () => ({}) },
    '@/components/magazine': Object.fromEntries(['MagazineSheet', 'MagSegmented', 'PrimaryButton', 'SecondaryButton', 'Toggle'].map(name => [name, name])),
    '@/core/common': { updateSetting: patch => Object.assign(settings, patch) },
    '@/core/player/timeoutExit': { startTimeoutExit: n => starts.push(n), cancelTimeoutExit: () => { cancels++ }, useTimeoutExitTimeInfo: () => info },
    '@/core/player/sleepTimerOptions': options,
    '@/lang': { useI18n: () => t },
    '@/store/setting/hook': { useSettingValue: name => settings[name] },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { ink: { strong: 'ink' } } }), sharedLuxStyles: () => () => ({}) },
    '@/theme/magazineRoles': { magazineRoles: () => roles },
    '@/utils/tools': { createStyle: value => value },
    './SleepTimerSheet': 'SleepTimerSheet',
  }
  const sheet = load('src/screens/PlayDetail/Vertical/SleepTimerSheet.tsx', name => { assert.ok(name in deps, name); return deps[name] }).default
  const button = load('src/screens/PlayDetail/Vertical/SleepTimerBtn.tsx', name => { assert.ok(name in deps, name); return deps[name] }).default
  return { settings, starts, info, render: () => walk(sheet({ visible: true, onClose() {}, info })), button: () => walk(button()), get cancels() { return cancels }, get customOpened() { return customOpened } }
}

test('7D chips start/restart, persist selected duration, retain custom input and expose all fade options', () => {
  const f = uiFixture()
  let nodes = f.render()
  const sheet = () => nodes.find(n => n.type === 'MagazineSheet').props
  assert.equal(sheet().figure.value, '30:00')
  assert.equal(sheet().headerAction, undefined)
  assert.equal(sheet().eyebrow, '睡眠定时')
  assert.equal(sheet().title, '定时停止播放')
  for (const minutes of [15, 30, 45, 60, 90]) {
    nodes.find(n => n.props?.label === `${minutes} 分`).props.onPress()
    assert.equal(f.starts.at(-1), minutes * 60)
    nodes = f.render()
    assert.equal(nodes.find(n => n.props?.label === `${minutes} 分`).props.selected, true)
    assert.equal(sheet().figure.value, `${minutes}:00`)
  }
  nodes.find(n => n.props?.label === '自定义').props.onPress()
  assert.equal(f.customOpened, 1)
  assert.equal(nodes.find(n => n.type === 'CustomInput').props.customOnly, true)
  f.settings['player.timeoutExit'] = '22'
  nodes = f.render()
  assert.equal(nodes.find(n => n.props?.label === '自定义').props.selected, true)
  assert.equal(sheet().figure.value, '22:00')
  const segmented = nodes.find(n => n.type === 'MagSegmented').props
  assert.deepEqual(segmented.items.map(item => item.label), ['10s', '30s', '60s'])
  for (const seconds of [10, 30, 60]) {
    segmented.onChange(String(seconds))
    nodes = f.render()
    assert.equal(nodes.find(n => n.type === 'MagSegmented').props.value, String(seconds))
    assert.ok(nodes.some(n => n.props?.children === `最后 ${seconds} 秒渐弱`))
  }
  const toggle = nodes.find(n => n.props?.accessibilityLabel === '播完当前这首再停')
  toggle.props.onChange(false)
  assert.equal(f.settings['player.timeoutExitPlayed'], false)
  assert.equal(nodes.some(n => n.props?.accessibilityLabel === '同时退出 App'), false)
  assert.equal(nodes.some(n => n.props?.children === '到点后同时关闭白噪音'), true)
  f.info.time = 1421
  nodes = f.render()
  assert.equal(sheet().figure.value, '23:41')
  sheet().headerAction.onPress()
  assert.equal(f.cancels, 1)
})

test('7B top-bar button renders idle moon and live mm:ss outline pill, including wait-at-zero', () => {
  const f = uiFixture()
  assert.equal(f.button().find(n => n.type === 'MdiIcon').props.name, 'weather-night')
  for (const [time, waiting, text] of [[1421, false, '☾ 23:41'], [1420, false, '☾ 23:40'], [5400, false, '☾ 90:00'], [-1, true, '☾ 00:00']]) {
    Object.assign(f.info, { time, isPlayedStop: waiting })
    const nodes = f.button()
    assert.ok(nodes.some(n => n.props?.children === text))
    const tap = nodes.find(n => n.type === 'TouchableOpacity').props
    assert.equal(tap.accessibilityState.selected, true)
    assert.equal(tap.style[0].height + tap.hitSlop.top + tap.hitSlop.bottom, 44)
    assert.equal(tap.style[1].borderWidth, 1.5)
  }
})

test('three languages contain every sleep timer label', () => {
  for (const language of ['zh-cn', 'zh-tw', 'en-us']) {
    const lang = JSON.parse(readFileSync(join(root, `src/lang/${language}.json`), 'utf8'))
    for (const key of Object.keys(zh).filter(key => key.startsWith('sleep_timer'))) assert.ok(lang[key], `${language}: ${key}`)
  }
})

for (const [exit, gapless] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`finish-current-song ignores playback states and handles track boundary before advancing (exit=${exit}, gapless=${gapless})`, async() => {
    const f = await fixture(true)
    f.setting['player.timeoutExitApp'] = exit
    f.setting['player.audio.gapless.enabled'] = gapless
    const listeners = {}
    const events = ['RemotePlay', 'RemotePause', 'RemoteNext', 'RemotePrevious', 'RemoteStop', 'PlaybackError', 'RemoteSeek', 'PlaybackState', 'PlaybackTrackChanged']
    const states = ['None', 'Ready', 'Stopped', 'Paused', 'Playing', 'Buffering', 'Connecting']
    let service
    const lx = { isPlayedStop: false, playerStatus: {}, playerTrackId: 'song', gettingUrlId: null }
    const deps = {
      'react-native-track-player': {
        __esModule: true,
        default: { registerPlaybackService: factory => { service = factory() }, addEventListener: (name, callback) => { listeners[name] = callback } },
        Event: Object.fromEntries(events.map(name => [name, name])),
        State: Object.fromEntries(states.map(name => [name, name])),
      },
      './gapless': { isGaplessEnabled: () => gapless },
      './utils': { isTempId: () => false, isEmpty: () => false, isNotificationLikeSupported: false },
      '@/core/common': { exitApp: () => { throw new Error('Sleep timer must pause without quitting') } },
      '@/core/player/timeoutExit': { finishTimeoutExit: async() => { lx.isPlayedStop = false; await f.timer.finishTimeoutExit() } },
      './playList': { getCurrentTrackId: async() => 'boundary' },
      '@/core/player/player': { syncNotificationLikeState: async() => {}, playNext: () => { throw new Error('Must not advance') } },
      '@/core/together/control': { blockTogetherMemberControl: () => false },
      '@/utils/imageCache': { scheduleImageCacheTrim() {} },
    }
    const mod = load('src/plugins/player/service.ts', name => { assert.ok(name in deps, name); return deps[name] }, {
      global: { lx, app_event: Object.fromEntries(['playerPause', 'pause', 'playerPlaying', 'play', 'playerWaiting', 'playerLoadstart'].map(name => [name, () => {}])) }, console: { log() {} },
    })
    mod.default()
    await service()
    f.timer.startTimeoutExit(60)
    await f.expire()
    lx.isPlayedStop = f.lx.isPlayedStop
    assert.equal(lx.isPlayedStop, true)
    for (const state of states) await listeners.PlaybackState({ state })
    assert.deepEqual(f.events, [])
    await listeners.PlaybackTrackChanged({ track: 'song' })
    assert.deepEqual(f.events, ['pause'])
    assert.equal(lx.isPlayedStop, false)
    assert.equal(f.lx.isPlayedStop, false)
    assert.equal(f.output.at(-1), 0.8)
  })
}

test('custom input cancel keeps the running timer; confirm validates and restarts with entered minutes', () => {
  const starts = []
  const patches = []
  let stops = 0
  let hidden = false
  let input = '22'
  let refIndex = 0
  const settings = {}
  const deps = {
    react: {
      forwardRef: fn => fn,
      useState: value => [typeof value === 'boolean' ? true : value, () => {}],
      useImperativeHandle() {},
      useEffect() {},
      useRef: () => (++refIndex % 2 === 1 ? { current: { setVisible: v => { hidden = !v } } } : { current: { getText: () => input } }),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', TouchableOpacity: 'TouchableOpacity' },
    '@/components/common/ConfirmAlert': 'ConfirmAlert',
    '@/components/common/Text': 'Text',
    '@/components/common/Input': 'Input',
    '@/components/common/MdiIcon': {},
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { ink: { strong: 'ink' } } }) },
    '@/utils/tools': { createStyle: x => x, toast() {} },
    '@/store/theme/hook': {},
    '@/lang': { useI18n: () => t },
    './common/CheckBox': 'CheckBox',
    '@/store/setting/hook': { useSettingValue: name => settings[name] },
    '@/core/common': { updateSetting: p => { patches.push(p); Object.assign(settings, p) } },
    '@/store/setting/state': { setting: {} },
    '@/core/player/sleepTimerOptions': options,
    '@/core/player/timeoutExit': { cancelTimeoutExit: () => { stops++ }, stopTimeoutExit: () => { stops++ }, startTimeoutExit: seconds => starts.push(seconds), getTimeoutExitTime: () => 1320 },
  }
  const modal = load('src/components/TimeoutExitEditModal.tsx', name => { assert.ok(name in deps, name); return deps[name] }).default
  const nodes = walk(modal({ customOnly: true, timeInfo: { active: true } }, {}))
  const alert = nodes.find(n => n.type === 'ConfirmAlert').props
  alert.onCancel()
  assert.equal(stops, 0)
  input = '1441'
  alert.onConfirm()
  assert.equal(starts.length, 0)
  input = '22'
  alert.onConfirm()
  assert.deepEqual(starts, [1320])
  assert.deepEqual(patches, [{ 'player.timeoutExit': '22' }])
  assert.equal(hidden, true)
  const full = walk(modal({ timeInfo: { active: true } }, {}))
  const settingNode = full.find(n => typeof n.type === 'function' && n.type.name === 'Setting')
  const controls = walk(settingNode.type())
  assert.equal(controls.some(n => n.props?.accessibilityLabel === '同时退出 App'), false)
  const fadeToggle = controls.find(n => n.type === 'TouchableOpacity')
  fadeToggle.props.onPress()
  assert.deepEqual(patches.at(-1), { 'player.timeoutExitFade': true })
})

for (const exit of [false, true]) {
  for (const wait of [false, true]) {
    for (const fade of [false, true]) {
      test(`timeout stops playback with ignored legacy exit=${exit}, finish song=${wait}, fade=${fade}`, async() => {
        const f = await fixture(wait)
        Object.assign(f.setting, { 'player.timeoutExitApp': exit, 'player.timeoutExitFade': fade })
        f.timer.startTimeoutExit(60)
        await f.advance(55)
        assert.equal(f.output.at(-1), fade && !wait ? 0.4 : 0.8)
        f.song(195, 200)
        await f.expire()
        if (wait) {
          assert.equal(f.lx.isPlayedStop, true)
          assert.equal(f.events.includes('exit'), false)
          assert.equal(f.events.includes('pause'), false)
          assert.equal(f.output.at(-1), fade ? 0.4 : 0.8)
          await f.timer.finishTimeoutExit()
          await flush()
        }
        assert.equal(f.events.includes('exit'), false)
        assert.equal(f.events.includes('pause'), true)
        assert.equal(f.output.at(-1), 0.8)
        assert.equal(f.lx.isPlayedStop, false)
        assert.equal(f.timer.getTimeoutExitTime(), -1)
      })
    }
  }
}

test('timer pauses without exiting even when native restoration never completes or rejects', async() => {
  for (const fail of [false, true]) {
    const f = await fixture()
    f.setting['player.timeoutExitApp'] = true
    f.timer.startTimeoutExit(60)
    await f.advance(55)
    f.native.restoreSleepTimerVolume = () => fail ? Promise.reject(new Error('restore failure')) : new Promise(() => {})
    await f.expire()
    assert.deepEqual(f.events, ['pause'])
  }
})

const migration = load('src/config/migrateSetting.ts', name => {
  assert.equal(name, '@/utils')
  return { compareVer: version => version === '1.0' ? -1 : 0 }
})
const defaults = load('src/config/defaultSetting.ts').default

test('legacy settings migration preserves timer preferences without enabling app exit', () => {
  assert.equal(migration.migrateSleepTimerExit, undefined)
  const result = migration.default({ version: '1.0', player: { timeoutExit: '45', timeoutExitPlayed: false } })
  assert.equal(result['player.timeoutExit'], '45')
  assert.equal(result['player.timeoutExitPlayed'], false)
  assert.equal(result['player.timeoutExitApp'], undefined)
  assert.equal(result['player.timeoutExitAppMigrated'], undefined)
})

test('settings initialization silently ignores removed timer keys and preserves unrelated preferences', async() => {
  for (const exit of [undefined, false, true]) {
    for (const marker of [undefined, false, true]) {
      // Cover both merge paths: sparse old storage and a full persisted settings object.
      for (const base of [{}, defaults]) {
        const raw = {
          ...base,
          version: '2.0',
          'player.timeoutExit': '22',
          'player.timeoutExitPlayed': false,
          'player.timeoutExitFade': false,
          'player.timeoutExitFadeDuration': 60,
          'player.volume': 0.3,
          'common.langId': 'en-us',
          ...(exit === undefined ? {} : { 'player.timeoutExitApp': exit }),
          ...(marker === undefined ? {} : { 'player.timeoutExitAppMigrated': marker }),
        }
        let stored = { ...raw }
        const deps = {
          '@/config/constant': { storageDataPrefix: { setting: 'new' }, storageDataPrefixOld: { setting: 'old' } },
          '@/config/defaultSetting': defaults,
          '@/plugins/storage': { getData: async key => key === 'new' ? stored : null, saveData: async(key, value) => { stored = { ...value } } },
          './migrateSetting': migration,
          '@/store/setting/state': { setting: defaults },
          './migrate': {},
          '@/utils/tools': {},
        }
        const config = load('src/config/setting.ts', name => { assert.ok(name in deps, name); return deps[name] }, {
          console: {
            log: () => assert.fail('Unexpected log during settings load'),
            warn: () => assert.fail('Unexpected warning during settings load'),
            error: () => assert.fail('Unexpected error during settings load'),
          },
        })
        const expected = { ...defaults, ...raw }
        delete expected['player.timeoutExitApp']
        delete expected['player.timeoutExitAppMigrated']
        for (let launch = 0; launch < 2; launch++) {
          const result = await config.initSetting()
          assert.deepEqual(result.setting, expected)
          assert.deepEqual(stored, expected)
          assert.equal(result.updatedSettingKeys.includes('player.timeoutExitApp'), false)
          assert.equal(result.updatedSettingKeys.includes('player.timeoutExitAppMigrated'), false)
        }
      }
    }
  }
})

test('fresh settings never enable or persist the removed exit preference', async() => {
  let stored = null
  const deps = {
    '@/config/constant': { storageDataPrefix: { setting: 'new' }, storageDataPrefixOld: { setting: 'old' } },
    '@/config/defaultSetting': defaults,
    '@/plugins/storage': { getData: async() => stored, saveData: async(key, value) => { stored = value } },
    './migrateSetting': migration,
    '@/store/setting/state': { setting: defaults },
    './migrate': {},
    '@/utils/tools': {},
  }
  const config = load('src/config/setting.ts', name => deps[name])
  const result = await config.initSetting()
  assert.deepEqual(result.setting, defaults)
  assert.equal('player.timeoutExitApp' in stored, false)
  assert.equal('player.timeoutExitAppMigrated' in stored, false)
})


test('white noise follows JS timer fade, cancellation restores gain and completion stops noise', async() => {
  const f = await fixture(false, false, true)
  f.timer.startTimeoutExit(60)
  await f.advance(55)
  assert.deepEqual(f.noiseCalls.at(-1), ['gain', true, 0.5])
  f.timer.cancelTimeoutExit()
  await flush()
  assert.deepEqual(f.noiseCalls.at(-1), ['gain', true, 1])
  f.timer.startTimeoutExit(60)
  await f.expire()
  assert.equal(f.noiseCalls.includes('stop'), true)
  assert.equal(f.events.includes('pause'), true)
})

test('native timer stays armed when fade is disabled and includes noise-link changes', async() => {
  const f = await fixture(false, true, true)
  f.setting['player.timeoutExitFade'] = false
  f.timer.startTimeoutExit(60)
  await flush()
  assert.equal(f.nativeCalls.at(-1).durationMs, 1)
  assert.deepEqual(f.noiseCalls.at(-1), ['gain', true, 1])
  f.setting['player.timeoutExitStopNoise'] = false
  await f.advance(30)
  assert.deepEqual(f.noiseCalls.at(-1), ['gain', false, 1])
  await f.expire()
  assert.equal(f.noiseCalls.includes('stop'), false)
  assert.equal(f.events.includes('pause'), true)
})
