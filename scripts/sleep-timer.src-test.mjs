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

const fixture = async(wait = false) => {
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
  const setting = { 'player.timeoutExitPlayed': wait, 'player.timeoutExitFade': true, 'player.playbackRate': 1, 'player.timeoutExitFadeDuration': 10 }
  const native = {
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
      case '@/core/common': return { exitApp: () => { events.push('exit') } }
      case '@/store/player/state': return player
      case '@/store/setting/state': return { setting }
      case '@/plugins/player/utils': return native
      case '@/plugins/player/volumeFade': return math
      case './sleepTimerOptions': return options
      default: throw new Error(name)
    }
  }, { global: { lx }, performance: { now: () => now } })
  return {
    timer,
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
  assert.equal(nodes.some(n => n.props?.children === '到点后同时关闭白噪音'), false)
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

test('finish-current-song ignores playback state changes and pauses on the track boundary before advancing', async() => {
  const f = await fixture(true)
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

test('custom input cancel keeps the running timer; confirm validates and restarts with entered minutes', () => {
  const starts = []
  const patches = []
  let stops = 0
  let hidden = false
  let input = '22'
  let refIndex = 0
  const deps = {
    react: {
      forwardRef: fn => fn,
      useState: value => [typeof value === 'boolean' ? true : value, () => {}],
      useImperativeHandle() {},
      useEffect() {},
      useRef: () => (++refIndex % 2 === 1 ? { current: { setVisible: v => { hidden = !v } } } : { current: { getText: () => input } }),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View' },
    '@/components/common/ConfirmAlert': 'ConfirmAlert',
    '@/components/common/Text': 'Text',
    '@/components/common/Input': 'Input',
    '@/components/common/MdiIcon': {},
    '@/theme/LuxTheme': {},
    '@/utils/tools': { createStyle: x => x, toast() {} },
    '@/store/theme/hook': {},
    '@/lang': { useI18n: () => t },
    './common/CheckBox': 'CheckBox',
    '@/store/setting/hook': {},
    '@/core/common': { updateSetting: p => patches.push(p) },
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
})
