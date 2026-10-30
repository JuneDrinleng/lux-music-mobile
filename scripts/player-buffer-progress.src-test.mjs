import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/plugins/player/hook.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText
const flush = async() => { for (let i = 0; i < 10; i++) await Promise.resolve() }

const fixture = () => {
  const State = { None: 'none', Buffering: 'buffering', Playing: 'playing', Paused: 'paused', Stopped: 'stopped' }
  const intervals = new Map()
  const updates = []
  let nextInterval = 0
  let resolveState
  let effect
  let listener
  let removed = false
  let buffered = 25
  let duration = 100
  const statePromise = new Promise(resolve => { resolveState = resolve })
  const player = {
    getState: () => statePromise,
    getBufferedPosition: async() => buffered,
    getDuration: async() => duration,
    addEventListener: (event, callback) => {
      assert.equal(event, 'playback-state')
      listener = callback
      return { remove: () => { removed = true } }
    },
  }
  const require = name => {
    if (name === 'react') {
      return {
        useState: initial => { assert.equal(initial, 0); return [initial, value => updates.push(value)] },
        useEffect: callback => { effect = callback },
      }
    }
    if (name === 'react-native-track-player') return { __esModule: true, default: player, State, Event: { PlaybackState: 'playback-state' } }
    throw new Error(`Unexpected import: ${name}`)
  }
  const module = { exports: {} }
  new Script(`(function(require,module,exports,setInterval,clearInterval) {${source}\n})`)
    .runInThisContext()(require, module, module.exports, (callback, delay) => {
      assert.equal(delay, 1000)
      const id = nextInterval++
      intervals.set(id, callback)
      return id
    }, id => intervals.delete(id))
  assert.equal(module.exports.useBufferProgress(), 0)
  const cleanup = effect()
  return {
    State,
    intervals,
    updates,
    cleanup,
    get removed() { return removed },
    resolveState,
    emit: state => listener({ state }),
    sample: async() => { for (const callback of [...intervals.values()]) await callback() },
    setBuffer: (value, length = 100) => { buffered = value; duration = length },
  }
}

test('buffer progress: cleanup before late initial Buffering state leaves no intervals or updates', async() => {
  const f = fixture()
  f.cleanup()
  f.resolveState(f.State.Buffering)
  await flush()
  assert.equal(f.removed, true)
  assert.equal(f.intervals.size, 0)
  assert.deepEqual(f.updates, [])
  // A callback already queued before listener removal must also be harmless.
  f.emit(f.State.Buffering)
  await flush()
  assert.equal(f.intervals.size, 0)
  assert.deepEqual(f.updates, [])
})

test('buffer progress: Buffering events and late initial state retain at most one interval', async() => {
  const f = fixture()
  f.emit(f.State.Buffering)
  assert.equal(f.intervals.size, 1)
  f.resolveState(f.State.Buffering)
  await flush()
  assert.equal(f.intervals.size, 1)
  for (let i = 0; i < 5; i++) {
    f.emit(f.State.Buffering)
    assert.equal(f.intervals.size, 1)
  }
  await flush()
  f.cleanup()
  assert.equal(f.intervals.size, 0)
})

test('buffer progress: leaving Buffering stops sampling and a stale initial state cannot restart it', async() => {
  for (const state of ['None', 'Playing', 'Paused', 'Stopped']) {
    const f = fixture()
    await flush()
    assert.deepEqual(f.updates, [0.25])
    f.emit(f.State.Buffering)
    assert.equal(f.intervals.size, 1)
    await flush()
    f.emit(f.State[state])
    assert.equal(f.intervals.size, 0, state)
    f.resolveState(f.State.Buffering)
    await flush()
    assert.equal(f.intervals.size, 0, state)
    assert.equal(f.updates.at(-1), state === 'None' ? 0 : 0.25)
    f.cleanup()
  }
})

test('buffer progress: initial Buffering samples ratios, skips duplicates, and stops at full buffer', async() => {
  const f = fixture()
  f.resolveState(f.State.Buffering)
  await flush()
  assert.equal(f.intervals.size, 1)
  assert.deepEqual(f.updates, [0.25])
  await f.sample()
  assert.deepEqual(f.updates, [0.25])
  f.setBuffer(50)
  await f.sample()
  assert.deepEqual(f.updates, [0.25, 0.5])
  f.setBuffer(100)
  await f.sample()
  assert.deepEqual(f.updates, [0.25, 0.5, 1])
  assert.equal(f.intervals.size, 0)
  f.cleanup()
})
