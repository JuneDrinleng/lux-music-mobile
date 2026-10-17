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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}) {${source}\n})`, { filename: path })
    .runInThisContext()(require, module, module.exports, ...Object.values(globals))
  return module.exports
}
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
  const setting = { 'player.timeoutExitPlayed': wait, 'player.timeoutExitFade': true, 'player.playbackRate': 1 }
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

test('sleep timer fades before deadline, pauses before restore and exits', async() => {
  const f = await fixture()
  f.timer.startTimeoutExit(60)
  await f.advance(40)
  assert.equal(f.output.at(-1), 0.8)
  await f.advance(50)
  assert.equal(f.output.at(-1), 0.4)
  await f.expire()
  assert.deepEqual(f.events, ['pause', 'restore', 'exit'])
  assert.equal(f.output.at(-1), 0.8)
})

test('sleep timer cancel and replacement restore immediately without exiting', async() => {
  const f = await fixture()
  f.timer.startTimeoutExit(60)
  await f.advance(50)
  f.timer.stopTimeoutExit()
  await flush()
  assert.equal(f.output.at(-1), 0.8)
  assert.equal(f.events.includes('exit'), false)
  f.timer.startTimeoutExit(60)
  await f.advance(100)
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
  f.song(180, 200)
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

test('wait mode skips unknown duration and restores before song-end exit', async() => {
  const f = await fixture(true)
  f.timer.startTimeoutExit(60)
  f.song(50, 0)
  await f.expire()
  assert.equal(f.output.at(-1), 0.8)
  f.song(190, 200)
  await f.advance(65)
  assert.equal(f.output.at(-1), 0.4)
  await f.timer.finishTimeoutExit()
  assert.deepEqual(f.events, ['pause', 'restore', 'exit'])
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

test('disabling fade restores output on the next tick; disabled timers still exit', async() => {
  const f = await fixture()
  f.timer.startTimeoutExit(60)
  await f.advance(50)
  f.setting['player.timeoutExitFade'] = false
  await f.advance(51)
  assert.equal(f.output.at(-1), 0.8)
  await f.expire()
  assert.deepEqual(f.events, ['restore', 'pause', 'exit'])
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

test('wait mode exits immediately at deadline when playback is paused', async() => {
  const f = await fixture(true)
  f.player.isPlay = false
  f.timer.startTimeoutExit(60)
  await f.expire()
  assert.deepEqual(f.events, ['pause', 'exit'])
  assert.equal(f.lx.isPlayedStop, false)
})

test('cancel while deadline pause is pending restores and prevents exit', async() => {
  const f = await fixture()
  let resolve
  f.native.setPause = () => new Promise(_resolve => { resolve = _resolve })
  f.timer.startTimeoutExit(60)
  await f.advance(50)
  await f.expire()
  f.timer.stopTimeoutExit()
  resolve()
  await flush()
  assert.equal(f.output.at(-1), 0.8)
  assert.equal(f.events.includes('exit'), false)
})
