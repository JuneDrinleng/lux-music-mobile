import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const load = (path, deps) => {
  const source = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${source}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected import (including history): ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const model = load('src/plugins/player/noise.ts', { 'react-native': { NativeModules: {} } })

test('noise capability requires the constant and every method; fallback never calls native', async() => {
  for (const bridge of [undefined, {}, { CAPABILITY_WHITE_NOISE: true }, { setNoise() { throw Error() }, stopNoise() { throw Error() } }]) {
    const controller = model.createNoiseController(bridge)
    assert.equal(controller.supported, false)
    await controller.set('rain', { enabled: true, volume: 1 })
    await controller.stop()
    await controller.timer(true, 0)
  }
  const calls = []
  const controller = model.createNoiseController({ CAPABILITY_WHITE_NOISE: true, setNoise: async(...args) => calls.push(args), stopNoise: async() => calls.push('stop'), setNoiseTimer: async(...args) => calls.push(args) })
  assert.equal(controller.supported, true)
  await controller.set('rain', { enabled: true, volume: 8 })
  await controller.timer(true, -3)
  await controller.stop()
  assert.deepEqual(calls, [['rain', true, 1], [true, 0], 'stop'])
})

test('saved noise values normalize all five sounds and clamp untrusted settings', () => {
  const saved = model.normalizeNoiseSettings({ rain: { enabled: true, volume: 7 }, fire: { enabled: 'true', volume: -2 }, cafe: { enabled: true, volume: NaN } })
  assert.deepEqual(Object.keys(saved), ['rain', 'fire', 'ocean', 'cafe', 'fan'])
  assert.deepEqual(saved.rain, { enabled: true, volume: 1 })
  assert.deepEqual(saved.fire, { enabled: false, volume: 0 })
  assert.equal(saved.cafe.volume, 0.5)
  for (const bad of [null, undefined, 'bad', [], Infinity]) assert.equal(model.normalizeNoiseSettings(bad).fan.volume, 0.5)
  assert.deepEqual(model.normalizeNoiseSettings(JSON.parse(JSON.stringify(saved))), saved)
})

const fixture = (supported = true) => {
  const state = { setting: { 'player.whiteNoise': {} } }
  const calls = []
  const api = load('src/core/player/whiteNoise.ts', {
    '@/core/common': { updateSetting: patch => Object.assign(state.setting, patch) },
    '@/store/setting/state': { default: state },
    '@/plugins/player/noise': { ...model, noise: { supported, set: async(...args) => calls.push(args), stop: async() => calls.push('stop') } },
  })
  return { api, state, calls }
}
test('noise starts, adjusts, persists and stops without any history or music-player dependency', async() => {
  const f = fixture()
  await f.api.changeNoise('rain', { enabled: true, volume: 0.7 })
  await f.api.changeNoise('cafe', { enabled: true, volume: 0.35 })
  await f.api.changeNoise('rain', { volume: 9 })
  assert.deepEqual(f.state.setting['player.whiteNoise'].rain, { enabled: true, volume: 1 })
  assert.equal(f.state.setting['player.whiteNoise'].cafe.enabled, true)
  await f.api.stopWhiteNoise()
  assert.equal(f.calls.at(-1), 'stop')
  assert.ok(Object.values(f.state.setting['player.whiteNoise']).every(sound => !sound.enabled))
  assert.equal(f.state.setting['player.whiteNoise'].cafe.volume, 0.35)
  const fallback = fixture(false)
  await fallback.api.changeNoise('fan', { enabled: true })
  assert.deepEqual(fallback.calls, [])
  assert.deepEqual(fallback.state.setting['player.whiteNoise'], {})
})

test('native synthesizer stays outside queue, history and focus, runs PCM in worker and is copied for CI', () => {
  const path = 'android/src/main/java/com/guichaguri/trackplayer/service/player/NoiseMixer.java'
  const source = read(`dependency-patches/react-native-track-player/${path}`)
  assert.match(source, /new Thread\(this::generate/)
  assert.match(source, /AudioTrack\.MODE_STREAM/)
  assert.match(source, /finally[\s\S]*track\.release\(\)/)
  assert.doesNotMatch(source, /requestAudioFocus|ExoPlayer|emit\(|playHistory|\.wav|\.mp3/i)
  assert.equal(read('dependencies-patch.js').split(path).length - 1, 2)
})

test('mixer mounts conditionally above content, leaves Dock accessible, and all text is localized', () => {
  const home = read('src/screens/Home/Vertical/index.tsx')
  assert.match(home, /whiteNoiseOpen\s*\? <View pointerEvents="box-none"/)
  assert.match(home, /bottom: bottomLayerHeight/)
  const sheet = read('src/screens/PlayDetail/Vertical/SleepTimerSheet.tsx')
  assert.match(sheet, /global.app_event.openWhiteNoise\(\)/)
  assert.match(sheet, /player.timeoutExitStopNoise/)
  const ui = read('src/screens/Home/Vertical/WhiteNoisePage.tsx')
  const keys = [...ui.matchAll(/t\('(noise_\w+)'/g)].map(match => match[1])
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const lang = JSON.parse(read(`src/lang/${locale}.json`))
    for (const key of [...keys, ...model.NOISE_SOUNDS.map(id => `noise_${id}`)]) assert.ok(lang[key], `${locale}: ${key}`)
  }
})


test('concurrent sound actions retain both selections and stopped selections survive serialization', async() => {
  const f = fixture()
  await Promise.all([
    f.api.changeNoise('rain', { enabled: true, volume: 0.7 }),
    f.api.changeNoise('fan', { enabled: true, volume: 0.4 }),
  ])
  const saved = JSON.parse(JSON.stringify(f.state.setting['player.whiteNoise']))
  assert.equal(saved.rain.enabled, true)
  assert.equal(saved.fan.enabled, true)
  assert.equal(saved.rain.volume, 0.7)
  await Promise.all([f.api.changeNoise('fire', { enabled: true }), f.api.stopWhiteNoise()])
  assert.ok(Object.values(f.state.setting['player.whiteNoise']).every(sound => !sound.enabled))
})

test('native timer envelope controls noise, honors opt-out, restores on cancel and releases on destroy', () => {
  const service = read('dependency-patches/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java')
  assert.match(service, /if \(stopNoiseWithTimer\) noiseMixer.setTimerGain/)
  assert.match(service, /if \(stopNoiseWithTimer\) noiseMixer.stopAll\(\)/)
  assert.match(service, /restoreFadeVolume\(\) \{\s*noiseMixer.setTimerGain\(1\)/)
  assert.match(service, /noiseMixer.release\(\)/)
  const playback = read('dependency-patches/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/player/ExoPlayback.java')
  assert.match(playback, /noiseMixer.setTimerGain\(stop \? gain : 1\)/)
})
