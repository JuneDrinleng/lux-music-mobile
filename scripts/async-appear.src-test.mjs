/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const load = (file, mocks = {}) => {
  const source = ts.transpileModule(readFileSync(new URL(`../src/components/common/${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports) {${source}\n})`).runInThisContext()(name => {
    assert.ok(name in mocks, `Unexpected import ${name}`)
    return mocks[name]
  }, module, module.exports)
  return module.exports
}
const math = load('asyncAppearMath')

test('count interpolation is bounded, monotonic and fixed-duration for large counts and deletion to zero', () => {
  assert.ok(math.COUNT_ROLL_MS >= 600 && math.COUNT_ROLL_MS <= 900)
  for (const [from, to] of [[0, 1000000000], [72, 123], [123, 0], [0, 0]]) {
    const values = Array.from({ length: 61 }, (_, index) => math.interpolateCount(from, to, index / 60))
    assert.equal(values[0], from)
    assert.equal(values.at(-1), to)
    for (let i = 1; i < values.length; i++) {
      assert.ok(Number.isInteger(values[i]))
      assert.ok(values[i] >= Math.min(from, to) && values[i] <= Math.max(from, to))
      assert.ok(to >= from ? values[i] >= values[i - 1] : values[i] <= values[i - 1])
    }
    assert.equal(math.interpolateCount(from, to, -1), from)
    assert.equal(math.interpolateCount(from, to, 2), to)
  }
  assert.equal(math.interpolateCount(0, 1000, 0.5), 875)
})

test('stagger has 40ms gaps, 320ms rows, caps at 12 and finishes in 760ms', () => {
  for (let index = 0; index < 12; index++) {
    assert.deepEqual(math.staggerWindow(index), { start: index * 40, end: index * 40 + 320 })
  }
  assert.equal(math.staggerWindow(11).end, 760)
  assert.equal(math.staggerWindow(-1), null)
  assert.equal(math.staggerWindow(12), null)
  assert.equal(math.staggerWindow(100000), null)
})

// Minimal hook scheduler: effects are committed after rendering, refs/state persist.
const fixture = (file, exportName, native = {}) => {
  const slots = []
  let cursor = 0
  let pending = []
  const animations = []
  const react = {
    useRef: value => { const i = cursor++; return slots[i] ??= { current: value } },
    useState: initial => {
      const i = cursor++
      slots[i] ??= { value: initial }
      return [slots[i].value, value => { slots[i].value = value }]
    },
    useCallback: fn => fn,
    useEffect: (fn, deps) => {
      const i = cursor++
      const old = slots[i]
      if (old && deps.every((value, index) => Object.is(value, old.deps[index]))) return
      pending.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() } })
    },
  }
  class Value {
    listeners = new Map()
    setValue(value) { this.value = value }
    addListener(listener) { this.listeners.set('id', listener); return 'id' }
    removeListener(id) { this.listeners.delete(id) }
    stopAnimation() {}
    interpolate(config) { return config }
  }
  const Animated = {
    Value,
    timing: (value, config) => {
      const record = {
        config,
        stopped: false,
        tick: progress => { for (const listener of value.listeners.values()) listener({ value: progress }) },
        start: callback => { record.complete = callback },
        stop: () => { record.stopped = true },
      }
      animations.push(record)
      return record
    },
  }
  const hook = load(file, { react, 'react-native': { Animated, Easing: { linear: x => x }, ...native }, './asyncAppearMath': math })[exportName]
  return {
    animations,
    render: (...args) => {
      cursor = 0
      const result = hook(...args)
      const effects = pending
      pending = []
      for (const effect of effects) effect()
      return result
    },
    unmount: () => { for (const slot of slots) slot?.cleanup?.() },
  }
}

test('unknown count waits; refresh starts at current value; reduced motion snaps and cleans listeners', () => {
  const f = fixture('useRollingNumber', 'useRollingNumber')
  assert.equal(f.render(null, false), null)
  assert.equal(f.animations.length, 0)
  assert.equal(f.render(1000, false), 0)
  f.animations[0].tick(0.5)
  assert.equal(f.render(1000, false), 875)
  f.render(2000, false)
  assert.equal(f.animations[0].stopped, true)
  f.animations[1].tick(0)
  assert.equal(f.render(2000, false), 875)
  assert.equal(f.render(2000, true), 2000)
  assert.equal(f.animations[1].stopped, true)
  assert.equal(f.animations.length, 2)
  f.animations[1].tick(0.1)
  assert.equal(f.render(2000, true), 2000)
  f.unmount()
})

test('stagger claims one visible batch, uses native driver and never replays on refresh or virtual remount', () => {
  const f = fixture('useStaggeredAppear', 'useStaggeredAppear')
  let h = f.render(false)
  assert.deepEqual(h.styleFor('first', 0), { opacity: 0 })
  assert.equal(h.styleFor('later', 12), undefined)
  h.reveal(['first', 'second'])
  h = f.render(false)
  assert.equal(f.animations.length, 1)
  assert.equal(f.animations[0].config.useNativeDriver, true)
  assert.equal(f.animations[0].config.duration, 360)
  assert.deepEqual(h.styleFor('second', 1).opacity.inputRange, [40, 200, 360])
  assert.equal(h.styleFor('later', 2), undefined)
  h.reveal(['later'])
  f.render(false)
  assert.equal(f.animations.length, 1)
  h = f.render(true)
  assert.equal(h.styleFor('first', 0), undefined)
  assert.equal(f.animations[0].stopped, true)
  f.unmount()
})

test('empty first load and reduced motion consume the appearance without animating later imports', () => {
  for (const reduced of [true, false]) {
    const f = fixture('useStaggeredAppear', 'useStaggeredAppear')
    f.render(reduced).reveal([])
    const h = f.render(reduced)
    h.reveal(['imported'])
    assert.equal(f.render(false).styleFor('imported', 0), undefined)
    assert.equal(f.animations.length, 0)
    f.unmount()
  }
})


test('reduced motion starts conservatively, listens live, ignores stale query and removes listener', async() => {
  let resolveQuery
  let emit
  let removed = false
  const f = fixture('useReducedMotion', 'useReducedMotion', {
    AccessibilityInfo: {
      isReduceMotionEnabled: () => new Promise(resolve => { resolveQuery = resolve }),
      addEventListener: (name, callback) => {
        assert.equal(name, 'reduceMotionChanged')
        emit = callback
        return { remove: () => { removed = true } }
      },
    },
  })
  assert.equal(f.render(), true)
  emit(true)
  resolveQuery(false)
  await Promise.resolve()
  assert.equal(f.render(), true)
  emit(false)
  assert.equal(f.render(), false)
  f.unmount()
  assert.equal(removed, true)
  emit(true)
  assert.equal(f.render(), false)
})
