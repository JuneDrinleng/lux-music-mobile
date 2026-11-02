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
  const slots = []; let cursor = 0; let pending; let cleanup; let dirty = false
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
      if (!before || deps.some((dep, i) => dep !== before[i])) { slots[slot] = deps; pending = fn }
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
        Value: class { setValue() {} stopAnimation() {} interpolate(config) { return config } },
        timing: (value, config) => {
          const animation = { config, start: fn => { animation.finish = fn }, stop: () => { animation.stopped = true } }
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
        if (pending) { const effect = pending; pending = null; cleanup?.(); cleanup = effect() }
      } while (dirty)
      return walk(tree)
    },
  }
}

test('three preview rows keep first/last placeholders and stable extra slots', () => {
  const h = harness()
  const lines = [{ text: 'first', translation: 'translation' }, { text: 'middle' }, { text: 'last' }]
  const props = { lines, index: 0, active: true, onPress() {} }
  const rows = nodes => nodes.filter(node => node.type === 'Text' && node.props.size === 14)
  const height = nodes => nodes.find(node => Array.isArray(node.props?.style) && node.props.style[0]?.overflow === 'hidden').props.style[1].height
  const first = h.render(props)
  assert.deepEqual(rows(first).map(node => node.props.children), ['', 'middle'])
  assert.ok(rows(first).every(node => node.props.color === 'faint' && node.props.numberOfLines === 1))
  assert.equal(first.find(node => node.type === 'KaraokeLine').props.size, 19)
  const last = h.render({ ...props, index: 2 })
  assert.deepEqual(rows(last).map(node => node.props.children), ['middle', ''])
  assert.equal(height(first), height(last))
  assert.equal(h.animations.length, 0, 'jump cuts without animation')
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
  assert.ok(nodes.some(node => node.type === 'Text' && node.props.size === 19 && node.props.children === '0'), 'completed outgoing line keeps its highlight while fading')
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
