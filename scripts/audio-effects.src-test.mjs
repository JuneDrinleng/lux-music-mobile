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
