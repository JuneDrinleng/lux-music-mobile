/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Script } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/components/lyric/LyricPreview.tsx', import.meta.url), 'utf8')
const jsx = (type, props) => ({ type, props })
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)]
const harness = () => {
  const slots = []; let cursor = 0; const pending = []; const cleanups = new Map(); let dirty = false
  const animations = []
  const react = {
    memo: fn => fn,
    useMemo: fn => fn(),
    useState: value => {
      const slot = cursor++; if (!(slot in slots)) slots[slot] = value
      return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; dirty = true }]
    },
    useRef: value => { const slot = cursor++; return slots[slot] ??= { current: value } },
    useLayoutEffect: (fn, deps) => {
      const slot = cursor++; const before = slots[slot]
      if (!before || deps.some((dep, i) => dep !== before[i])) { slots[slot] = deps; pending.push({ slot, fn }) }
    },
  }
  const deps = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      View: 'View',
      TouchableOpacity: 'TouchableOpacity',
      Easing: { cubic: 'cubic', out: value => value },
      Animated: {
        View: 'AnimatedView',
        Value: class {
          constructor(value) { this.value = value; this.listeners = new Map() }
          setValue(value) { this.value = value; this.listeners.forEach(fn => fn({ value })) }
          addListener(fn) { this.listeners.set('listener', fn); return 'listener' }
          removeListener(id) { this.listeners.delete(id) }
          stopAnimation() {}
          interpolate(config) { return config }
        },
        timing: (value, config) => {
          const animation = { config, value, start: fn => { animation.finish = fn; if (config.duration === 200) value.setValue(1) }, stop: () => { animation.stopped = true } }
          animations.push(animation); return animation
        },
      },
    },
    '@/components/common/Text': { default: 'Text' },
    '@/components/magazine': { SecondaryButton: 'Pill' },
    '@/lang': { useI18n: () => key => key },
    '@/plugins/lyricWords': { toggleLyricExtra: (value, available) => available ? !value : value },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: fn => () => fn() },
    '@/theme/magazineRoles': { magazineRoles: () => ({ faint: 'faint' }) },
    '@/utils/tools': { createStyle: value => value },
    './KaraokeLine': { default: 'KaraokeLine' },
  }
  const module = { exports: {} }
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => { assert.ok(name in deps, name); return deps[name] }, module, module.exports)
  return {
    animations,
    render: props => {
      let tree
      do {
        dirty = false; cursor = 0; tree = module.exports.default(props)
        for (const { slot, fn } of pending.splice(0)) { cleanups.get(slot)?.(); cleanups.set(slot, fn()) }
      } while (dirty)
      return walk(tree)
    },
  }
}

test('three preview rows keep first/last placeholders and use current sentence extras', () => {
  const h = harness()
  const lines = [{ text: 'first', translation: 'translation' }, { text: 'middle' }, { text: 'last' }]
  const props = { lines, index: 0, active: true, onPress() {} }
  const rows = nodes => nodes.filter(node => node.type === 'Text' && [14, 16, 17].includes(node.props.size))
  const height = nodes => nodes.find(node => Array.isArray(node.props?.style) && node.props.style[0]?.overflow === 'hidden').props.style[1].height
  const first = h.render(props)
  assert.deepEqual(rows(first).map(node => node.props.children), ['', 'middle'])
  assert.ok(rows(first).every(node => node.props.color === 'faint' && node.props.numberOfLines === 1))
  assert.equal(first.find(node => node.type === 'KaraokeLine').props.size, 22)
  const last = h.render({ ...props, index: 2 })
  assert.deepEqual(rows(last).map(node => node.props.children), ['middle', ''])
  assert.equal(height(first), height(last))
  assert.equal(h.animations.filter(animation => animation.config.duration === 280).length, 0, 'jump cuts without scrolling')
  assert.equal(h.animations[0].config.duration, 200, 'missing current extra resizes within the fixed viewport')
})

test('only foreground consecutive advances animate; cancellation and completion clean up', () => {
  const h = harness()
  const lines = Array.from({ length: 6 }, (_, i) => ({ text: String(i) }))
  let props = { lines, index: 0, active: true, onPress() {} }
  h.render(props)
  props = { ...props, index: 1 }; let nodes = h.render(props)
  assert.equal(h.animations.length, 1)
  assert.equal(h.animations[0].config.duration, 280)
  assert.equal(h.animations[0].config.useNativeDriver, true)
  assert.equal(nodes.filter(node => node.type === 'KaraokeLine').length, 1, 'only the live current line runs karaoke')
  assert.ok(nodes.some(node => node.type === 'Text' && node.props.size === 24 && node.props.children === '0'), 'completed outgoing line keeps its highlight while fading')
  props = { ...props, active: false }; nodes = h.render(props)
  assert.equal(h.animations[0].stopped, true)
  assert.equal(nodes.filter(node => node.type === 'KaraokeLine').length, 1)
  props = { ...props, index: 2 }; h.render(props)
  props = { ...props, active: true }; h.render(props)
  props = { ...props, index: 4 }; h.render(props)
  props = { ...props, index: 3 }; h.render(props)
  props = { ...props, lines: [...lines], index: 4 }; h.render(props)
  assert.equal(h.animations.length, 1, 'background, reentry, jump, reverse and replacement all cut')
  props = { ...props, index: 5 }; h.render(props)
  assert.equal(h.animations.length, 2)
  h.animations[1].finish({ finished: true })
  nodes = h.render(props)
  assert.equal(nodes.filter(node => node.type === 'KaraokeLine').length, 1)
  assert.match(source, /outputRange: \[0, -step\]/)
  assert.match(source, /outputRange: \[step \+ extraHeight, 0\]/)
})

test('three-line preview keeps its full height independently of the historical disc budget', () => {
  const pic = readFileSync(new URL('../src/screens/PlayDetail/Vertical/Pic.tsx', import.meta.url), 'utf8')
  assert.match(pic, /const PLAYER_RESERVED_LYRIC = 124\b/)
  assert.match(pic, /flexGapLyric: \{\s*flexGrow: 0,\s*flexShrink: 0,\s*minHeight: 0,\s*\}/)
  const h = harness()
  const lines = [{ text: 'current', translation: 'translation', roma: 'roma' }]
  const props = { lines, index: 0, active: true, onPress() {} }
  let nodes = h.render(props)
  nodes.find(node => node.type === 'Pill' && node.props.label === 'player_lyric_roma_pill').props.onPress()
  nodes = h.render(props)
  const viewport = nodes.find(node => Array.isArray(node.props?.style) && node.props.style[0]?.overflow === 'hidden')
  assert.equal(viewport.props.style[1].height, 22 + 28 + 22 + 18 + 18)
  const actions = nodes.find(node => node.props?.style?.minHeight === 44)
  assert.equal(actions.props.style.marginTop, 8)
  assert.equal(viewport.props.style[1].height + actions.props.style.marginTop + actions.props.style.minHeight, 160)
})

test('June 2026-11-12: all actual-extra tiers fill 160 and use matching scroll steps', () => {
  for (const [extras, neighborHeight, currentHeight, neighborSize, currentSize] of [
    [0, 32, 44, 17, 24], [1, 27, 36, 16, 22], [2, 22, 28, 14, 19],
  ]) {
    const h = harness()
    const lines = Array.from({ length: 3 }, (_, i) => ({ text: 'long '.repeat(100) + i, translation: extras > 0 ? 'translation' : undefined, roma: extras > 1 ? 'roma' : undefined }))
    const props = { lines, index: 0, active: true, onPress() {} }
    let nodes = h.render(props)
    if (extras === 2) {
      nodes.find(node => node.type === 'Pill' && node.props.label === 'player_lyric_roma_pill').props.onPress()
      nodes = h.render(props)
    }
    const neighbors = nodes.filter(node => node.type === 'Text' && node.props.color === 'faint')
    assert.ok(neighbors.every(node => node.props.size === neighborSize && node.props.numberOfLines === 1))
    assert.equal(nodes.find(node => node.type === 'KaraokeLine').props.size, currentSize)
    assert.equal(nodes.find(node => node.type === 'KaraokeLine').props.singleLine, true)
    assert.equal(nodes.find(node => node.props?.style?.height === neighborHeight).props.style.justifyContent, 'center')
    assert.equal(nodes.find(node => Array.isArray(node.props?.style) && node.props.style[0]?.height === currentHeight && node.props.style[1]?.height === currentHeight).props.style[1].height, currentHeight)
    assert.equal(neighborHeight * 2 + currentHeight + extras * 18 + 8 + 44, 160)
    nodes = h.render({ ...props, index: 1 })
    const step = (neighborHeight + currentHeight) / 2
    const layers = nodes.filter(node => node.type === 'AnimatedView')
    assert.deepEqual(layers[0].props.style[1].transform[0].translateY.outputRange, [0, -step])
    assert.deepEqual(layers[1].props.style[1].transform[0].translateY.outputRange, [step + extras * 18, 0])
  }
})

test('resize stays within 108 plus fixed actions; rapid toggles and replacement cancel from the current frame', () => {
  const h = harness()
  let props = { lines: [{ text: 'current', translation: 'translated', roma: 'roma' }], index: 0, active: true, onPress() {} }
  let nodes = h.render(props)
  nodes.find(node => node.type === 'Pill' && node.props.label === 'player_lyric_translation_pill').props.onPress()
  nodes = h.render(props)
  const animation = h.animations.at(-1)
  assert.equal(animation.config.duration, 200)
  assert.equal(animation.config.useNativeDriver, false)
  for (const frame of [0, 0.25, 0.5, 0.75, 1]) {
    animation.value.setValue(frame)
    nodes = h.render(props)
    const layer = nodes.find(node => node.type === 'AnimatedView')
    const rows = walk(layer.props.children).filter(node => node.type === 'View')
    const total = rows.reduce((sum, node) => sum + (Array.isArray(node.props.style) ? node.props.style[1].height : node.props.style.height), 0)
    assert.equal(total, 108)
    assert.ok(rows.every(node => (Array.isArray(node.props.style) ? node.props.style[1].height : node.props.style.height) >= 0))
    const actions = nodes.find(node => node.props?.style?.minHeight === 44)
    assert.equal(total + actions.props.style.marginTop + actions.props.style.minHeight, 160)
  }
  animation.value.setValue(0.5); nodes = h.render(props)
  const midSize = nodes.find(node => node.type === 'KaraokeLine').props.size
  nodes.find(node => node.type === 'Pill' && node.props.label === 'player_lyric_translation_pill').props.onPress()
  h.render(props)
  assert.equal(animation.stopped, true)
  const replacement = h.animations.at(-1)
  replacement.value.setValue(0)
  nodes = h.render(props)
  assert.equal(nodes.find(node => node.type === 'KaraokeLine').props.size, midSize)
  props = { ...props, lines: [{ text: 'new song' }] }; h.render(props)
  assert.equal(replacement.stopped, true)
  assert.equal(h.animations.at(-1).config.duration, 200)
})
