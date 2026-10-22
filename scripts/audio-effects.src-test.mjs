/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const load = (path, require = name => { throw new Error(name) }) => {
  const module = { exports: {} }
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
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
  assert.match(settings, /audioEffectsVisible \? <AudioEffectsPage/)
  assert.match(settings, /setAudioEffectsVisible\(false\)/)
  assert.match(page, /NativeModules\.TrackPlayerModule/)
  assert.match(page, /<Modal visible/)
  assert.match(page, /onRequestClose={back}/)
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
  assert.doesNotMatch(native, /void setGaplessPlayback/)
})

test('player startup restores saved EQ and loudness only after setup and tolerates missing or failing devices', async() => {
  const originalGlobal = global.lx
  try {
    for (const mode of ['supported', 'missing', 'failing']) {
      const events = []
      const saved = { ...defaults, 'player.audio.equalizer.enabled': true, 'player.audio.equalizer.preset': 'rock', 'player.audio.equalizer.gains': JSON.stringify(api.PRESET_GAINS.rock), 'player.audio.loudness.enabled': true, 'player.audio.loudness.target': -11 }
      const before = structuredClone(saved)
      const bridge = mode === 'missing' ? {} : {
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
      assert.equal(global.lx.playerStatus.isInitialized, false)
      completeSetup()
      await start
      assert.equal(global.lx.playerStatus.isInitialized, true)
      assert.equal(global.lx.playerStatus.isIniting, false)
      assert.deepEqual(saved, before)
      if (mode !== 'missing') {
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
  assert.doesNotMatch(native, /void setGaplessPlayback/)
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
