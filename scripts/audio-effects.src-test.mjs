import { settingsTransitionMock } from './settings-transition-mock.mjs'
/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const load = (path, require = name => { throw new Error(name) }) => {
  const module = { exports: {} }
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Script(`(function(require,module,exports){${js}\n})`, { filename: path }).runInThisContext()(require, module, module.exports)
  return module.exports
}
const api = load('src/utils/audioEffects.ts')
const defaults = api.AUDIO_EFFECT_DEFAULTS

test('audio capability checks require each callable bridge, never platform/rate/volume/queue support', async() => {
  for (const bridge of [undefined, null, {}, { setRate() {}, setVolume() {}, add() {} }, { setEqualizer: true, setGaplessPlayback: {}, setLoudnessNormalization: 'yes' }]) {
    const caps = api.audioEffectCapabilities(bridge)
    assert.deepEqual(caps, { equalizer: false, loudness: false, gapless: false })
    for (const [effect, supported] of Object.entries(caps)) {
      assert.equal(api.audioEffectStateKey(supported), 'audio_effects_unsupported')
      assert.equal(await api.commitAudioEffect(effect, defaults, bridge, () => assert.fail('Unsupported controls cannot persist')), false)
    }
  }
  for (const [effect, method] of [['equalizer', 'setEqualizer'], ['loudness', 'setLoudnessNormalization'], ['gapless', 'setGaplessPlayback']]) {
    const caps = api.audioEffectCapabilities({ [method]: async() => {} })
    assert.equal(caps[effect], true)
    assert.equal(Object.values(caps).filter(Boolean).length, 1)
    assert.equal(api.audioEffectStateKey(true), null)
  }
})

test('audio gains and loudness normalize malformed persisted values and format bounded units', () => {
  assert.deepEqual([-Infinity, NaN, Infinity, null, '4', -99, 99, 1.7].map(api.clampEqGain), [0, 0, 0, 0, 0, -12, 12, 2])
  assert.deepEqual([-99, 0, 1.7, 99].map(api.formatEqGain), ['-12 dB', '0 dB', '+2 dB', '+12 dB'])
  assert.deepEqual(api.LOUDNESS_TARGETS.map(api.formatLoudness), ['−18 LUFS', '−14 LUFS', '−11 LUFS'])
  for (const gains of ['broken', '{}', '[]', '[1,2]']) assert.equal(api.normalizeAudioEffects({ 'player.audio.equalizer.gains': gains })['player.audio.equalizer.gains'], defaults['player.audio.equalizer.gains'])
  const safe = api.normalizeAudioEffects({ 'player.audio.equalizer.enabled': 'true', 'player.audio.equalizer.preset': 'bad', 'player.audio.equalizer.gains': JSON.stringify([-100, 100, null, '4', 0, 1.7, 1, 2, 3, 4]), 'player.audio.loudness.target': -99 })
  assert.equal(safe['player.audio.equalizer.enabled'], false)
  assert.equal(safe['player.audio.equalizer.preset'], 'custom')
  assert.equal(safe['player.audio.loudness.target'], -14)
  assert.deepEqual(JSON.parse(safe['player.audio.equalizer.gains']), [-12, 12, 0, 0, 0, 2, 1, 2, 3, 4])
  for (const values of Object.values(api.PRESET_GAINS)) {
    assert.equal(values.length, 10)
    assert.ok(values.every(value => value === api.clampEqGain(value)))
  }
})

test('audio updates send complete sanitized configs before persistence and failures preserve settings', async() => {
  const events = []
  const bridge = {
    setEqualizer: async value => events.push(['eq', value]),
    setLoudnessNormalization: async value => events.push(['loudness', value]),
    setGaplessPlayback: async value => events.push(['gapless', value]),
  }
  const settings = { ...defaults, 'player.audio.equalizer.enabled': true, 'player.audio.loudness.enabled': true, 'player.audio.loudness.target': -18, 'player.audio.gapless.enabled': true }
  for (const effect of ['equalizer', 'loudness', 'gapless']) {
    assert.equal(await api.commitAudioEffect(effect, settings, bridge, value => events.push(['persist', value])), true)
    assert.equal(events.at(-1)[0], 'persist')
  }
  assert.deepEqual(events[0], ['eq', { enabled: true, preset: 'custom', gains: JSON.parse(defaults['player.audio.equalizer.gains']) }])
  assert.deepEqual(events[2], ['loudness', { enabled: true, target: -18, preventClipping: true }])
  assert.deepEqual(events[4], ['gapless', true])
  await assert.rejects(api.commitAudioEffect('gapless', settings, { setGaplessPlayback: async() => { throw new Error('native failure') } }, () => assert.fail('Failed calls must not persist')), /native failure/)
})

test('audio defaults merge with old settings, persist through existing settings flow and survive reload', async() => {
  const defaultSetting = load('src/config/defaultSetting.ts', name => {
    assert.equal(name, '@/utils/audioEffects'); return api
  }).default
  let stored = { 'player.playbackRate': 1.5, 'player.isHandleAudioFocus': false }
  const state = { setting: defaultSetting }
  const storage = { getData: async() => stored, saveData: async(key, data) => { assert.equal(key, 'setting'); stored = JSON.parse(JSON.stringify(data)) } }
  const config = load('src/config/setting.ts', name => {
    if (name === '@/config/constant') return { storageDataPrefix: { setting: 'setting' }, storageDataPrefixOld: {} }
    if (name === '@/config/defaultSetting') return { default: defaultSetting, __esModule: true }
    if (name === '@/plugins/storage') return storage
    if (name === '@/store/setting/state') return { default: state, __esModule: true }
    return {}
  })
  state.setting = (await config.initSetting()).setting
  for (const [key, value] of Object.entries(defaults)) assert.equal(state.setting[key], value)
  assert.equal(state.setting['player.playbackRate'], 1.5)
  assert.equal(state.setting['player.isHandleAudioFocus'], false)
  const common = load('src/core/common.ts', name => {
    if (name === '@/utils/common') return { throttle: fn => fn }
    if (name === '@/store/setting/action') return { default: { updateSetting: patch => { state.setting = config.updateSetting(patch).setting } }, __esModule: true }
    if (name === '@/store/setting/state') return { default: state, __esModule: true }
    if (name === '@/plugins/storage') return storage
    if (name === '@/config/constant') return { storageDataPrefix: { setting: 'setting' } }
    return {}
  })
  const changes = { ...defaults, 'player.audio.equalizer.enabled': true, 'player.audio.equalizer.preset': 'rock', 'player.audio.equalizer.gains': JSON.stringify(api.PRESET_GAINS.rock), 'player.audio.loudness.enabled': true, 'player.audio.loudness.target': -11, 'player.audio.loudness.preventClipping': false, 'player.audio.gapless.enabled': true }
  common.updateSetting(changes)
  state.setting = (await config.initSetting()).setting
  for (const [key, value] of Object.entries(changes)) assert.equal(state.setting[key], value)
  assert.equal(state.setting['player.playbackRate'], 1.5)
  assert.equal(state.setting['player.isHandleAudioFocus'], false)
})

test('approved audio surfaces retain all controls, localized unsupported reasons and conditional mounting', () => {
  const page = read('src/screens/AudioEffects/index.tsx')
  const settings = read('src/screens/Home/Vertical/Tabs/SettingsTab.tsx')
  assert.match(settings, /global\.app_event\.openAudioEffects\(\)/)
  assert.match(read('src/screens/Home/Vertical/Main.tsx'), /audioEffectsVisible \? <AudioEffectsPage/)
  assert.match(page, /NativeModules\.TrackPlayerModule/)
  assert.doesNotMatch(page, /\bModal\b/)
  assert.match(page, /useBackHandler/)
  assert.match(page, /<OptionRow[^>]+leading/)
  assert.match(page, /<Toggle compact/)
  assert.match(page, /EQ_PRESETS\.map/)
  assert.match(page, /EQ_FREQUENCIES\.map/)
  assert.doesNotMatch(page, /#[0-9a-fA-F]{3,8}\b/)
  const languages = ['zh-cn', 'zh-tw', 'en-us'].map(lang => JSON.parse(read(`src/lang/${lang}.json`)))
  const keys = Object.keys(languages[0]).filter(key => key.startsWith('audio_effects_'))
  for (const language of languages) {
    for (const key of keys) assert.ok(language[key], key)
    for (const effect of ['equalizer', 'loudness', 'gapless']) assert.ok(language[`audio_effects_${effect}_unsupported`])
    assert.match(language.audio_effects_target_1, /\{value\}/)
    assert.doesNotMatch(language.audio_effects_loudness_description, /\{\{/)
  }
  assert.equal(languages[0].audio_effects_unsupported, '不支持')
})

test('equalizer-only bridge capability enables only EQ and a creation failure never persists', async() => {
  const bridge = { setEqualizer: async() => { throw Error('Device has no Equalizer') } }
  assert.deepEqual(api.audioEffectCapabilities(bridge), { equalizer: true, loudness: false, gapless: false })
  await assert.rejects(api.commitAudioEffect('equalizer', { ...defaults, 'player.audio.equalizer.enabled': true }, bridge, () => assert.fail('Failed EQ must not persist')), /Device has no Equalizer/)
  const native = read('dependency-patches/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/module/MusicModule.java')
  assert.match(native, /@ReactMethod\s+public void setEqualizer\(ReadableMap config, final Promise promise\)/)
  assert.match(native, /@ReactMethod\s+public void setGaplessPlayback\(final boolean enabled, final Promise promise\)/)
})

test('player startup restores saved EQ and loudness only after setup and tolerates missing or failing devices', async() => {
  const originalGlobal = global.lx
  try {
    for (const mode of ['supported', 'missing', 'failing']) {
      const events = []
      const saved = { ...defaults, 'player.audio.equalizer.enabled': true, 'player.audio.equalizer.preset': 'rock', 'player.audio.equalizer.gains': JSON.stringify(api.PRESET_GAINS.rock), 'player.audio.loudness.enabled': true, 'player.audio.loudness.target': -11, 'player.audio.gapless.enabled': true }
      const before = structuredClone(saved)
      const bridge = mode === 'missing' ? {} : {
        setGaplessPlayback: async enabled => {
          events.push(['gapless', enabled])
          if (mode === 'failing') throw Error('Gapless unavailable')
        },
        setLoudnessNormalization: async config => {
          events.push(['loudness', config])
          if (mode === 'failing') throw Error('Loudness creation failed')
        },
        setEqualizer: async config => {
          events.push(['eq', config])
          if (mode === 'failing') throw Error('Equalizer creation failed')
        },
      }
      let completeSetup
      const setup = new Promise(resolve => { completeSetup = resolve })
      const utils = Object.fromEntries(['updateOptions', 'setVolume', 'setPlaybackRate', 'migratePlayerCache'].map(name => [name, async() => events.push([name])]))
      const player = load('src/plugins/player/index.ts', name => {
        if (name === 'react-native-track-player') return { default: { setupPlayer: async() => { events.push(['setup']); await setup; events.push(['ready']) } }, __esModule: true }
        if (name === 'react-native') return { NativeModules: { TrackPlayerModule: bridge } }
        if (name === '@/store/setting/state') return { default: { setting: saved }, __esModule: true }
        if (name === '@/utils/audioEffects') return api
        if (name === './utils') return utils
        assert.fail(`Unexpected dependency ${name}`)
      })
      global.lx = { playerStatus: { isIniting: false, isInitialized: false } }
      const start = player.initial({ volume: 1, playRate: 1, cacheSize: 0, isHandleAudioFocus: true, isEnableAudioOffload: false })
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(events.some(([name]) => name === 'eq'), false)
      assert.equal(events.some(([name]) => name === 'loudness'), false)
      assert.equal(events.some(([name]) => name === 'gapless'), false)
      assert.equal(global.lx.playerStatus.isInitialized, false)
      completeSetup()
      await start
      assert.equal(global.lx.playerStatus.isInitialized, true)
      assert.equal(global.lx.playerStatus.isIniting, false)
      assert.deepEqual(saved, before)
      if (mode !== 'missing') {
        assert.deepEqual(events.find(([name]) => name === 'gapless'), ['gapless', true])
        assert.ok(events.findIndex(([name]) => name === 'loudness') < events.findIndex(([name]) => name === 'gapless'))
        assert.deepEqual(events.find(([name]) => name === 'loudness')[1], { enabled: true, target: -11, preventClipping: true })
        assert.ok(events.findIndex(([name]) => name === 'eq') < events.findIndex(([name]) => name === 'loudness'))
        assert.deepEqual(events.find(([name]) => name === 'eq')[1], { enabled: true, preset: 'rock', gains: api.PRESET_GAINS.rock })
        assert.ok(events.findIndex(([name]) => name === 'ready') < events.findIndex(([name]) => name === 'eq'))
      }
      assert.ok(events.some(([name]) => name === 'setVolume'))
      assert.ok(events.some(([name]) => name === 'setPlaybackRate'))
    }
  } finally {
    global.lx = originalGlobal
  }
})

test('loudness native capability enables loudness and failures never persist', async() => {
  const bridge = { setEqualizer: async() => {}, setLoudnessNormalization: async() => { throw Error('Loudness creation failed') } }
  assert.deepEqual(api.audioEffectCapabilities(bridge), { equalizer: true, loudness: true, gapless: false })
  await assert.rejects(api.commitAudioEffect('loudness', { ...defaults, 'player.audio.loudness.enabled': true }, bridge, () => assert.fail('Failed loudness must not persist')), /Loudness creation failed/)
  const native = read('dependency-patches/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/module/MusicModule.java')
  assert.match(native, /@ReactMethod\s+public void setLoudnessNormalization\(ReadableMap config, final Promise promise\)/)
  assert.match(native, /@ReactMethod\s+public void setGaplessPlayback\(final boolean enabled, final Promise promise\)/)
})

test('gain composition keeps targets, EQ headroom, ducking and sleep fade independent', () => {
  const settings = { ...defaults, 'player.audio.loudness.enabled': true }
  for (const [target, expected] of [[-18, 0], [-14, 400], [-11, 700]]) {
    assert.deepEqual(api.composeAudioGain({ ...settings, 'player.audio.loudness.target': target }, 0.8, 0.5, 0.25), { playerVolume: 0.1, loudnessMillibels: expected })
  }
  const eq = { ...settings, 'player.audio.equalizer.enabled': true, 'player.audio.equalizer.gains': JSON.stringify([5, -12, 0, 0, 0, 0, 0, 0, 0, 0]) }
  assert.equal(api.composeAudioGain(eq).loudnessMillibels, 200)
  assert.equal(api.composeAudioGain({ ...eq, 'player.audio.equalizer.enabled': false }).loudnessMillibels, 400)
  assert.equal(api.composeAudioGain({ ...eq, 'player.audio.loudness.preventClipping': false }).loudnessMillibels, 400)
  assert.equal(api.composeAudioGain({ ...eq, 'player.audio.equalizer.gains': JSON.stringify(api.PRESET_GAINS.bass) }).loudnessMillibels, 0)
  assert.equal(api.composeAudioGain({ ...eq, 'player.audio.loudness.enabled': false }).loudnessMillibels, 0)
  assert.equal(api.composeAudioGain(eq, 0.8, 0, 0.25).playerVolume, 0)
  assert.equal(api.composeAudioGain(eq, 0.8, 0.5, 0).playerVolume, 0)
  assert.equal(api.composeAudioGain(eq, 0.8, 0.5, 1).playerVolume, 0.4)
  // Updating effects during a fade leaves the envelope untouched; cancellation restores base * duck.
  assert.equal(api.composeAudioGain(settings, 0.8, 0.5, 0.25).playerVolume, api.composeAudioGain(eq, 0.8, 0.5, 0.25).playerVolume)
  assert.equal(api.composeAudioGain({ ...eq, 'player.audio.equalizer.gains': JSON.stringify(Array(10).fill(-6)) }).loudnessMillibels, 400)
})

// Render production JSX with hook/native adapters, following the src-test harness pattern.
// These test JS events, geometry and setting acknowledgement; native Android layout needs a device.
const hookHost = () => {
  const slots = []
  let cursor = 0
  let dirty = false
  let effects = []
  const state = initial => {
    const i = cursor++
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
    return [slots[i], next => {
      const value = typeof next === 'function' ? next(slots[i]) : next
      if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true }
    }]
  }
  const effect = (fn, deps) => {
    const i = cursor++
    if (slots[i] && deps && deps.every((value, index) => Object.is(value, slots[i].deps[index]))) return
    effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() } })
  }
  return {
    react: {
      useState: state,
      useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial } },
      useCallback: fn => fn,
      useEffect: effect,
      useLayoutEffect: effect,
    },
    render(component, props = {}) {
      let tree
      do {
        dirty = false; cursor = 0; effects = []
        tree = component(props)
        effects.forEach(fn => fn())
      } while (dirty)
      return tree
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()) },
  }
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
const jsx = (type, props) => type?.name === 'SettingsSubpage' ? type(props) : ({ type, props })
const flush = async() => { for (let i = 0; i < 30; i++) await Promise.resolve() }
// Band top sits at pageY 1000; locationY is only trusted at grant (Android may report it relative to another view on move).
const eventAt = (y, locationY = y) => ({ nativeEvent: { locationY, locationX: 500, pageY: 1000 + y } })
const setupAudio = (setEqualizer = async() => {}) => {
  let currentHost
  let back
  let activeHome = true
  const state = { setting: { ...defaults, 'player.audio.equalizer.enabled': true } }
  const writes = []
  const bridgeCalls = []
  const common = { navActiveId: 'nav_setting', componentIds: { home: 'home' } }
  const dependencies = {
    react: new Proxy({}, { get: (_, name) => (...args) => currentHost.react[name](...args) }),
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': {
      View: 'View',
      ScrollView: 'ScrollView',
      TouchableOpacity: 'TouchableOpacity',
      StyleSheet: { absoluteFillObject: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } },
      Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value } setValue(value) { this.value = value } } },
      NativeModules: { TrackPlayerModule: { setEqualizer: config => { bridgeCalls.push(config); return setEqualizer(config) }, setLoudnessNormalization: async() => {}, setGaplessPlayback: async() => {} } },
    },
    '@/components/common/Text': { default: 'Text', __esModule: true },
    '@/components/common/StatusBar': { default: 'StatusBar', __esModule: true },
    '@/components/magazine': { DOCK_BASE_HEIGHT: 122, MagTopBar: 'MagTopBar', OptionRow: 'OptionRow', Rule: 'Rule', TextButton: 'TextButton', Toggle: 'Toggle' },
    '@/config/constant': { APP_LAYER_INDEX: { controls: 10 } },
    '@/core/common': { updateSetting: patch => { writes.push(patch); state.setting = { ...state.setting, ...patch } } },
    '@/lang': { useI18n: () => key => key },
    '@/store/common/hook': { useStatusbarHeight: () => 24 },
    '@/store/common/state': { default: common, __esModule: true },
    '@/store/setting/hook': { useSetting: () => state.setting },
    '@/store/setting/state': { default: state, __esModule: true },
    '@/theme/LuxTheme': { sharedLuxStyles: fn => () => fn({}), useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({ paper: 'paper', ink: 'ink', accent: 'accent' }) },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 8, __esModule: true },
    '@/utils/hooks/useBackHandler': { useBackHandler: fn => { back = fn } },
    '@/utils/homeBackHandler': { isHomeScreenActive: () => activeHome },
    '@/utils/tools': { createStyle: value => value },
    '@/utils/audioEffects': api,
  }
  dependencies['@/components/common/SettingsPage'] = settingsTransitionMock(dependencies.react)
  const page = load('src/screens/AudioEffects/index.tsx', name => {
    assert.ok(name in dependencies, name)
    return dependencies[name]
  })
  return {
    ...page,
    dependencies,
    writes,
    bridgeCalls,
    state,
    common,
    render(host, component, props) { currentHost = host; return host.render(component, props) },
    back: () => back(),
    setActiveHome: value => { activeHome = value },
  }
}
const thumbPosition = band => {
  const thumb = nodes(band).find(n => n.type === 'AnimatedView')
  assert.ok(thumb, 'thumb uses a pixel transform instead of percentage relayout')
  const style = Object.assign({}, ...thumb.props.style)
  assert.equal(style.top, 0)
  return style.transform[0].translateY.value
}

test('EQ grant/move updates native thumb geometry; release writes once, holds draft until setting acknowledgement', async() => {
  let finish
  const h = setupAudio(() => new Promise(resolve => { finish = resolve }))
  const pageHost = hookHost(); const bandHost = hookHost()
  let page
  const renderPage = () => { page = h.render(pageHost, h.default, { onBack() {} }); return page }
  renderPage()
  const bandProps = () => nodes(page).find(n => n.type === h.EqBand).props
  const renderBand = () => h.render(bandHost, h.EqBand, bandProps())
  let band = renderBand()
  band.props.onLayout({ nativeEvent: { layout: { height: 128 } } })
  band = renderBand()
  const original = thumbPosition(band)
  band.props.onResponderGrant(eventAt(64)); renderPage(); band = renderBand()
  assert.equal(nodes(page).find(n => n.type === 'ScrollView').props.scrollEnabled, false)
  assert.equal(thumbPosition(band), 64)
  band.props.onResponderMove(eventAt(16)); band = renderBand()
  assert.equal(thumbPosition(band), 16)
  // Move with a stale/foreign locationY (relative to a child view) still follows the finger via pageY.
  band.props.onResponderMove(eventAt(48, 3)); band = renderBand()
  assert.equal(thumbPosition(band), 48)
  band.props.onResponderMove(eventAt(16, 120)); band = renderBand()
  assert.equal(thumbPosition(band), 16)
  assert.notEqual(thumbPosition(band), original)
  assert.equal(band.props.accessibilityValue.now, 9)
  assert.equal(h.bridgeCalls.length, 1)
  assert.equal(h.writes.length, 0)
  assert.equal(band.props.onResponderTerminationRequest(), false)
  band.props.onResponderRelease(); renderPage(); band = renderBand()
  assert.equal(thumbPosition(band), 16, 'no old-value frame during native write')
  assert.equal(h.writes.length, 0)
  assert.equal(h.bridgeCalls.length, 1)
  finish(); await flush()
  assert.equal(h.bridgeCalls.length, 2)
  assert.deepEqual(h.bridgeCalls[1].gains, [9, ...JSON.parse(defaults['player.audio.equalizer.gains']).slice(1)])
  assert.equal(band.props.accessibilityState.disabled, true, 'busy after release only')
  assert.equal(nodes(page).find(n => n.type === 'ScrollView').props.scrollEnabled, true)
  finish(); await flush()
  // The promise can finish before the subscribed setting prop arrives; hold the draft in that gap too.
  band = renderBand(); assert.equal(thumbPosition(band), 16)
  renderPage(); band = renderBand()
  assert.equal(h.writes.length, 1)
  const saved = JSON.parse(h.state.setting['player.audio.equalizer.gains'])[0]
  assert.equal(saved, 9)
  assert.equal(thumbPosition(band), (12 - saved) / 24 * 128)
  assert.equal(h.state.setting['player.audio.equalizer.preset'], 'custom')
  // An external preset must be visible after acknowledgement (no retained draft).
  h.state.setting['player.audio.equalizer.gains'] = JSON.stringify(Array(10).fill(-6))
  renderPage(); band = renderBand(); assert.equal(thumbPosition(band), 96)
})

test('EQ termination commits final draft; increments retain 1 dB and bounds; failures revert', async() => {
  for (const outcome of ['resolveFalse', 'reject']) {
    const h = setupAudio(); const host = hookHost(); const changes = []; const drags = []
    let props = { frequency: '31', value: 0, disabled: false, onDraggingChange: value => drags.push(value), onChange: async value => { changes.push(value); if (changes.length === 1 && outcome === 'reject') throw Error('failed'); return false } }
    const render = () => h.render(host, h.EqBand, props)
    let band = render()
    band.props.onLayout({ nativeEvent: { layout: { height: 120 } } }); band = render()
    band.props.onResponderGrant(eventAt(30)); band = render(); assert.equal(thumbPosition(band), 30)
    band.props.onResponderTerminate(); await flush(); band = render()
    assert.equal(thumbPosition(band), 60)
    assert.deepEqual(drags, [true, false]); assert.deepEqual(changes, [6])
    band.props.onResponderRelease(); assert.deepEqual(changes, [6])
    band.props.onResponderGrant(eventAt(-100)); band = render(); assert.equal(thumbPosition(band), 0)
    band.props.onResponderRelease(); await flush(); band = render(); assert.equal(thumbPosition(band), 60)
    assert.deepEqual(changes, [6, 12])
    band.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }); await flush()
    assert.equal(changes.at(-1), 1)
    props = { ...props, value: 12 }; band = render()
    band.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }); await flush(); assert.equal(changes.at(-1), 12)
    band.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }); await flush(); assert.equal(changes.at(-1), 11)
    // Releasing at the existing saved value must not retain a draft over future presets.
    props = { ...props, value: 0, onChange: async() => true }; band = render()
    band.props.onResponderGrant(eventAt(60)); band = render(); band.props.onResponderRelease(); await flush(); band = render()
    props = { ...props, value: -6 }; band = render(); assert.equal(thumbPosition(band), 90)
    props = { ...props, disabled: true }; band = render(); const count = changes.length
    assert.equal(band.props.onStartShouldSetResponder(), false)
    band.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }); await flush(); assert.equal(changes.length, count)
  }
})

test('audio overlay has Dock clearance, no Modal, and hardware back returns detail → page → close', () => {
  const h = setupAudio(); const host = hookHost(); let closed = 0
  const render = () => h.render(host, h.default, { onBack: () => closed++ })
  let page = render()
  assert.equal(page.type, 'AnimatedView')
  assert.equal(page.props.style[0].zIndex, 9)
  const scroll = nodes(page).find(n => n.type === 'ScrollView')
  assert.equal(scroll.props.contentContainerStyle[1].paddingBottom, 28)
  assert.equal(scroll.props.contentContainerStyle[1].paddingTop, 24)
  assert.equal(page.props.style[1].bottom, 130)
  const eq = nodes(page).find(n => n.props.style?.[0]?.height === 130)
  assert.ok(eq, 'EQ keeps its 130 height')
  nodes(page).find(n => n.props.accessibilityHint === 'audio_effects_detail_hint').props.onPress()
  page = render(); assert.equal(nodes(page).filter(n => n.type === 'OptionRow').length, 3)
  h.setActiveHome(false); assert.equal(h.back(), false); assert.equal(closed, 0)
  h.setActiveHome(true); assert.equal(h.back(), true); page = render()
  assert.equal(closed, 0); assert.equal(nodes(page).filter(n => n.type === h.EqBand).length, 10)
  assert.equal(h.back(), true); assert.equal(closed, 1)
})

test('Main mounts audio above Pager, preserves Dock navigation, and restores swiping on every close path', () => {
  const previousApp = global.app_event; const previousState = global.state_event
  const emitter = () => {
    const handlers = new Map()
    const bus = {
      on(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn) },
      off(name, fn) { handlers.get(name)?.delete(fn) },
      emit(name, value) { handlers.get(name)?.forEach(fn => fn(value)) },
    }
    return new Proxy(bus, { get: (target, name) => name in target ? target[name] : value => target.emit(name, value) })
  }
  global.app_event = emitter(); global.state_event = emitter()
  try {
    const h = setupAudio(); const host = hookHost()
    const dependencies = {
      ...h.dependencies,
      'react-native-pager-view': { default: 'Pager', __esModule: true },
      '@/screens/AudioEffects': { default: 'AudioEffectsPage', __esModule: true },
      '@/components/recommend/DailyRecommendationPage': { DailyRecommendationPage: 'DailyRecommendationPage' },
      './SearchPage': { default: 'SearchPage', __esModule: true },
      './Tabs/HomeTab': { default: 'HomeTab', __esModule: true },
      './Tabs/PlaylistTab': { default: 'PlaylistTab', __esModule: true },
      './Tabs/SettingsTab': { default: 'SettingsTab', __esModule: true },
    }
    const Main = load('src/screens/Home/Vertical/Main.tsx', name => { assert.ok(name in dependencies, name); return dependencies[name] }).default
    const render = () => h.render(host, Main)
    const pager = tree => nodes(tree).find(n => n.type === 'Pager')
    const audio = tree => nodes(tree).find(n => n.type === 'AudioEffectsPage')
    let tree = render(); assert.equal(pager(tree).props.scrollEnabled, true); assert.equal(audio(tree), undefined)
    global.app_event.openAudioEffects(); tree = render()
    assert.equal(pager(tree).props.scrollEnabled, false); assert.ok(audio(tree))
    assert.ok(tree.props.children.indexOf(audio(tree)) > tree.props.children.indexOf(pager(tree)), 'overlay is a sibling above Pager')
    audio(tree).props.onBack(); tree = render(); assert.equal(audio(tree), undefined); assert.equal(pager(tree).props.scrollEnabled, true)
    global.app_event.openAudioEffects(); tree = render()
    // Dock emits this existing navigation event; its tab handler remains available above Content.
    global.state_event.emit('navActiveIdUpdated', 'nav_love'); tree = render()
    assert.equal(audio(tree), undefined); assert.equal(pager(tree).props.scrollEnabled, true)
    global.app_event.openAudioEffects(); tree = render(); assert.ok(audio(tree))
    global.app_event.openDailyRecommendations(); tree = render(); assert.equal(audio(tree), undefined)
    global.app_event.closeDailyRecommendations(); tree = render(); assert.equal(pager(tree).props.scrollEnabled, true)
    host.unmount(); global.app_event.openAudioEffects(); tree = render(); assert.equal(audio(tree), undefined, 'event listeners removed on unmount')
    // Composition contract: the real shell renders Dock after Content with its live navigation/player callbacks.
    const shell = read('src/screens/Home/Vertical/index.tsx')
    assert.ok(shell.indexOf('<Content />') < shell.indexOf('<Dock'))
    assert.match(shell, /onNavPress={handleNavPress}/)
    assert.match(shell, /<DockPlayerSlot/)
    assert.match(shell, /style={styles.bottomLayer}[\s\S]*?pointerEvents="box-none"/)
    assert.match(read('src/screens/AudioEffects/index.tsx'), /zIndex: APP_LAYER_INDEX.controls - 1/)
  } finally { global.app_event = previousApp; global.state_event = previousState }
})

test('failed native release preserves saved settings and clears the optimistic thumb', async() => {
  const h = setupAudio(async() => { throw Error('native failure') })
  const pageHost = hookHost(); const bandHost = hookHost()
  let page
  const renderPage = () => { page = h.render(pageHost, h.default, { onBack() {} }) }
  const renderBand = () => h.render(bandHost, h.EqBand, nodes(page).find(n => n.type === h.EqBand).props)
  renderPage(); let band = renderBand(); const original = thumbPosition(band)
  band.props.onResponderGrant(eventAt(0)); band = renderBand(); assert.equal(thumbPosition(band), 0)
  band.props.onResponderRelease(); await flush(); renderPage(); band = renderBand()
  assert.equal(thumbPosition(band), original); assert.equal(h.bridgeCalls.length, 2); assert.equal(h.writes.length, 0)
  assert.ok(nodes(page).find(n => n.props.accessibilityLiveRegion === 'polite'))
})

test('EQ reset reads defaults, patches only preset/gains, keeps all other settings and disables correctly', async() => {
  assert.deepEqual(api.equalizerDefaultPatch(), {
    'player.audio.equalizer.preset': defaults['player.audio.equalizer.preset'],
    'player.audio.equalizer.gains': defaults['player.audio.equalizer.gains'],
  })
  const h = setupAudio(); const host = hookHost()
  const render = () => h.render(host, h.default, { onBack() {} })
  const button = () => nodes(render()).find(n => n.type === 'TextButton')
  assert.equal(button().props.disabled, true)
  h.state.setting = { ...h.state.setting, 'player.audio.equalizer.preset': 'rock', 'player.audio.equalizer.gains': JSON.stringify(api.PRESET_GAINS.rock), 'player.audio.loudness.enabled': true, 'player.audio.loudness.target': -11, 'player.audio.loudness.preventClipping': false, 'player.audio.gapless.enabled': true }
  const before = { ...h.state.setting }
  assert.equal(button().props.disabled, false)
  assert.equal(button().props.compact, true)
  assert.equal(button().props.style[0].minHeight, 28)
  button().props.onPress()
  assert.equal(button().props.disabled, true, 'busy disables reset')
  await flush()
  assert.equal(h.writes.length, 1)
  assert.deepEqual(h.state.setting, { ...before, ...api.equalizerDefaultPatch() })
  assert.equal(h.bridgeCalls.length, 1)
  assert.deepEqual(h.bridgeCalls[0], { enabled: true, preset: defaults['player.audio.equalizer.preset'], gains: JSON.parse(defaults['player.audio.equalizer.gains']) })
  assert.equal(button().props.disabled, true)
  for (const disabled of [false, true]) assert.equal(api.equalizerResetDisabled(defaults, disabled), true)
  const modified = { ...before, 'player.audio.equalizer.enabled': false }
  h.state.setting = modified
  assert.equal(button().props.disabled, true)
  assert.equal(button().props.style[1].opacity, 0.4)
  h.state.setting['player.audio.equalizer.enabled'] = true
  delete h.dependencies['react-native'].NativeModules.TrackPlayerModule.setEqualizer
  assert.equal(button().props.disabled, true, 'unsupported disables reset')
  const labels = ['zh-cn', 'zh-tw', 'en-us'].map(lang => JSON.parse(read(`src/lang/${lang}.json`)))
  assert.deepEqual(labels.map(lang => lang.audio_effects_equalizer_reset), ['恢复默认', '恢復預設', 'Reset'])
  for (const lang of labels) assert.deepEqual(Object.keys(lang).filter(key => key.startsWith('audio_effects_')).sort(), Object.keys(labels[0]).filter(key => key.startsWith('audio_effects_')).sort())
})

// Deterministic clock: exercise throttling and cancellation without wall-clock sleeps.
const withPreviewClock = async run => {
  const original = { now: Date.now, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout }
  let now = 0; let id = 0
  const timers = new Map()
  Date.now = () => now
  global.setTimeout = (fn, delay) => { const key = ++id; timers.set(key, { fn, at: now + delay }); return key }
  global.clearTimeout = key => timers.delete(key)
  const tick = async ms => {
    now += ms
    for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.fn() }
    await flush()
  }
  try { await run({ tick, timers }) } finally { Date.now = original.now; global.setTimeout = original.setTimeout; global.clearTimeout = original.clearTimeout }
}
const eqSettings = gain => ({ ...defaults, 'player.audio.equalizer.enabled': true, 'player.audio.equalizer.gains': JSON.stringify([gain, ...api.PRESET_GAINS.custom.slice(1)]) })

test('live EQ previews throttle rounded gains, coalesce slow bridge calls and never persist', async() => withPreviewClock(async({ tick, timers }) => {
  const calls = []; let finish
  const preview = api.createEqualizerPreview({ setEqualizer: config => { calls.push(config); return new Promise(resolve => { finish = resolve }) } })
  preview.push(eqSettings(1.1)); preview.push(eqSettings(1.4))
  assert.equal(calls.length, 1)
  preview.push(eqSettings(2)); preview.push(eqSettings(3))
  await tick(200)
  assert.equal(calls.length, 1, 'only one native call in flight')
  finish(); await flush()
  assert.equal(calls.length, 2)
  assert.equal(calls[1].gains[0], 3, 'drop intermediates, keep latest')
  finish(); await flush()
  preview.push(eqSettings(4)); preview.push(eqSettings(5))
  await tick(69); assert.equal(calls.length, 2)
  await tick(1); assert.equal(calls.length, 3); assert.equal(calls[2].gains[0], 5)
  finish(); await flush()
  preview.push(eqSettings(5.1)); await tick(100)
  assert.equal(calls.length, 3, 'same rounded value does not reapply')
  await preview.cancel(); assert.equal(timers.size, 0)
  preview.push(defaults); assert.equal(calls.length, 3, 'disabled EQ never previews')
  await api.createEqualizerPreview({}).cancel()
}))

test('release and termination cancel trailing preview and persist final gain exactly once', async() => withPreviewClock(async({ tick, timers }) => {
  for (const end of ['onResponderRelease', 'onResponderTerminate']) {
    const h = setupAudio(); const pageHost = hookHost(); const bandHost = hookHost()
    let page
    const renderPage = () => { page = h.render(pageHost, h.default, { onBack() {} }) }
    const renderBand = () => h.render(bandHost, h.EqBand, nodes(page).find(n => n.type === h.EqBand).props)
    renderPage(); let band = renderBand()
    band.props.onResponderGrant(eventAt(65)); await flush()
    assert.equal(h.bridgeCalls.length, 1); assert.equal(h.writes.length, 0)
    band.props.onResponderMove(eventAt(10)); band = renderBand()
    assert.equal(timers.size, 1)
    band.props[end](); await flush(); renderPage(); band = renderBand()
    assert.equal(timers.size, 0)
    assert.equal(h.bridgeCalls.length, 2)
    assert.equal(h.bridgeCalls.at(-1).gains[0], api.clampEqGain(12 - 10 / 130 * 24))
    assert.equal(h.writes.length, 1)
    assert.equal(h.state.setting['player.audio.equalizer.gains'], JSON.stringify(h.bridgeCalls.at(-1).gains))
    band.props.onResponderRelease(); await tick(200)
    assert.equal(h.bridgeCalls.length, 2, 'no stale timer after release')
    assert.equal(h.writes.length, 1)
    pageHost.unmount(); bandHost.unmount()
  }
}))
