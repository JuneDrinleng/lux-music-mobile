/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const load = (file, mocks = {}, globals = {}) => {
  const source = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${source}\n})`).runInNewContext(globals)(name => {
    assert.ok(name in mocks, `Unexpected dependency ${name}`)
    return mocks[name]
  }, module, module.exports)
  return module.exports
}
const math = load('src/components/common/dockLayoutMath.ts')

test('visible Dock space follows the rendering predicate, retains measured player/inset, and restores without a zero frame', () => {
  for (const autoHide of [false, true]) for (const keyboard of [false, true]) for (const keepPlayer of [false, true]) {
    const hidden = math.isDockHidden(autoHide, keyboard, keepPlayer)
    assert.equal(hidden, autoHide && keyboard && !keepPlayer)
    assert.equal(math.visibleDockHeight(hidden, 147.5, 123), hidden ? 0 : 147.5)
  }
  assert.equal(math.visibleDockHeight(false, 0, 136), 136)
  const cycle = [false, true, false, true, false].map(hidden => math.visibleDockHeight(hidden, 147.5, 136))
  assert.deepEqual(cycle, [147.5, 0, 147.5, 0, 147.5])
})

test('focus scrolling is minimal, includes an action when it fits, clamps at content limits, and prioritizes input on tiny viewports', () => {
  assert.equal(math.focusScrollOffset(0, 240, 800, 40, 80, 220), 0)
  assert.equal(math.focusScrollOffset(0, 240, 800, 180, 220, 280), 52)
  assert.equal(math.focusScrollOffset(80, 240, 800, -20, 20, 60), 48)
  assert.equal(math.focusScrollOffset(0, 160, 800, 180, 220, 480), 72)
  assert.equal(math.focusScrollOffset(0, 240, 280, 240, 280), 40)
  assert.equal(math.focusScrollOffset(0, 240, 100, 80, 110), 0)
  assert.equal(math.focusScrollOffset(20, 0, 800, 180, 220), 20)
})

const fixture = () => {
  const cleanup = []; const frames = new Map(); const keyboard = new Map(); let frameId = 0
  const jsx = (type, props) => ({ type, props })
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useRef: current => ({ current }), useCallback: fn => fn, useMemo: fn => fn(),
    useEffect: fn => { cleanup.push(fn()) },
  }
  const api = load('src/components/common/FocusVisibleScrollView.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './dockLayoutMath': math,
    'react-native': { View: 'View', ScrollView: 'ScrollView', Keyboard: { addListener(name, fn) { keyboard.set(name, fn); return { remove: () => keyboard.delete(name) } } } },
  }, { requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId }, cancelAnimationFrame: id => frames.delete(id) })
  const tree = api.FocusVisibleScrollView({})
  const provider = tree.props.children
  const scroll = provider.props.children
  let viewportHeight = 500; let contentOffset = 0; let inputContentY = 360; let focused = true
  const scrolls = []
  tree.props.ref.current = { measureInWindow: fn => fn(0, 20, 375, viewportHeight) }
  scroll.props.ref.current = { scrollTo({ y }) { contentOffset = y; scrolls.push(y); scroll.props.onScroll({ nativeEvent: { contentOffset: { y } } }) } }
  const input = { isFocused: () => focused, measureInWindow: fn => fn(0, 20 + inputContentY - contentOffset, 200, 40) }
  provider.props.value.action({ measureInWindow: fn => fn(0, 20 + 440 - contentOffset, 200, 40) })
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
  scroll.props.onContentSizeChange(375, 800)
  return { input, value: provider.props.value, tree, scroll, keyboard, scrolls, flush, cleanup: () => cleanup.forEach(fn => fn?.()), resize(h) { viewportHeight = h; tree.props.onLayout() }, setFocused(value) { focused = value }, setInputY(y) { inputContentY = y } }
}

test('form remeasures after resize, Dock layout and didShow; includes login action and cancels blur/unmount work', () => {
  const h = fixture()
  h.value.focus(h.input); h.flush()
  assert.deepEqual(h.scrolls, [])
  h.resize(240); h.keyboard.get('keyboardDidShow')(); h.flush()
  assert.deepEqual(h.scrolls, [252])
  // The group now fits: repeated IME/layout callbacks do not scroll again.
  h.keyboard.get('keyboardDidShow')(); h.flush()
  assert.deepEqual(h.scrolls, [252])
  h.resize(500); h.flush()
  assert.deepEqual(h.scrolls, [252])
  h.setInputY(760); h.value.focus(h.input); h.value.blur(h.input); h.flush()
  assert.deepEqual(h.scrolls, [252])
  h.value.focus(h.input); h.cleanup(); h.flush()
  assert.deepEqual(h.scrolls, [252])
  assert.equal(h.keyboard.size, 0)
})

test('all six settings forms subscribe to shared focus visibility; hidden Dock height reaches SettingsPage and together', () => {
  for (const file of ['Account/AccountPage', 'Login/ChangePassword', 'Login/ServerStep', 'Login/AuthFlow', 'SyncLogin/index', 'AdminConsole/AdminConsoleLayer']) {
    assert.match(read(`src/screens/${file}.tsx`), /<FocusVisibleScrollView/)
  }
  assert.match(read('src/components/common/SettingsPage.tsx'), /bottom: visibleDockHeight/)
  assert.match(read('src/screens/Home/Vertical/Tabs/SettingsTab.tsx'), /bottomDockHeight = useVisibleDockHeight\(dockHeight\)/)
  assert.match(read('src/screens/Home/Vertical/ListenTogether/ListenTogetherPage.tsx'), /bottomPadding = useVisibleDockHeight/)
  const shell = read('src/screens/Home/Vertical/index.tsx')
  assert.match(shell, /VisibleDockHeightContext.Provider value={bottomLayerHeight}/)
  assert.match(shell, /bottomLayerHeight = visibleDockHeight\(hideDock, measuredDockHeight/)
  const playlist = read('src/screens/Home/Vertical/Tabs/PlaylistTab.tsx')
  assert.match(playlist, /if \(!isSearchMode \|\| activeNavId !== 'nav_love'\) return/)
  assert.match(playlist, /return \(\) => \{ setKeepPlayBarOnKeyboard\(false\) \}/)
})


test('retention changes notify the shell while the keyboard remains open', () => {
  const lx = {}; let snapshot; let subscription
  const api = load('src/utils/hooks/useKeepPlayBarOnKeyboard.ts', {
    react: { useSyncExternalStore(subscribe, getSnapshot) { subscription = subscribe(() => { snapshot = getSnapshot() }); snapshot = getSnapshot(); return snapshot } },
  }, { global: { lx } })
  assert.equal(api.useKeepPlayBarOnKeyboard(), false)
  api.setKeepPlayBarOnKeyboard(true)
  assert.equal(snapshot, true)
  api.setKeepPlayBarOnKeyboard(false)
  assert.equal(snapshot, false)
  assert.equal(lx.keepPlayBarOnKeyboard, false)
  subscription()
  api.setKeepPlayBarOnKeyboard(true)
  assert.equal(snapshot, false)
})


test('UnderlineInput composes focus/blur visibility with caller callbacks (including LX secret masking)', () => {
  const events = []
  const node = { name: 'input' }
  const jsx = (type, props) => ({ type, props })
  const api = load('src/components/magazine/UnderlineInput.tsx', {
    react: { memo: fn => fn, useRef: () => ({ current: node }), useState: initial => [initial, value => events.push(`focused:${value}`)] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { TextInput: 'TextInput', View: 'View' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/FocusVisibleScrollView': { useFocusVisibility: () => ({ focus: input => { assert.equal(input, node); events.push('reveal') }, blur: input => { assert.equal(input, node); events.push('cancel') } }) },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/theme/magazineType': { magType: { eyebrow: { size: 11 } } },
  })
  const tree = api.UnderlineInput({ value: '', onChangeText() {}, onFocus: () => events.push('caller-focus'), onBlur: () => events.push('caller-blur') })
  const input = tree.props.children.find(child => child?.type === 'TextInput')
  input.props.onFocus({}); input.props.onBlur({})
  assert.deepEqual(events, ['focused:true', 'reveal', 'caller-focus', 'focused:false', 'cancel', 'caller-blur'])
})
