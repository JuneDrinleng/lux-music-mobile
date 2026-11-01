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
  for (const autoHide of [false, true]) {
    for (const keyboard of [false, true]) {
      for (const keepPlayer of [false, true]) {
        const hidden = math.isDockHidden(autoHide, keyboard, keepPlayer)
        assert.equal(hidden, autoHide && keyboard && !keepPlayer)
        assert.equal(math.visibleDockHeight(hidden, 147.5, 123), hidden ? 0 : 147.5)
      }
    }
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

const fixture = (props = {}) => {
  const cleanup = []; const frames = new Map(); const keyboard = new Map(); let frameId = 0
  const jsx = (type, props) => ({ type, props })
  const react = {
    forwardRef: fn => fn,
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => null,
    useRef: current => ({ current }),
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect: fn => { cleanup.push(fn()) },
  }
  const api = load('src/components/common/FocusVisibleScrollView.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    './dockLayoutMath': math,
    'react-native': { View: 'View', ScrollView: 'ScrollView', Keyboard: { addListener(name, fn) { keyboard.set(name, fn); return { remove: () => keyboard.delete(name) } } } },
  }, { requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId }, cancelAnimationFrame: id => frames.delete(id) })
  const tree = api.FocusVisibleScrollView(props)
  const provider = tree.props.children
  const scroll = provider.props.children
  let viewportHeight = 500; let contentOffset = 0; let inputContentY = 360; let focused = true
  const scrolls = []
  tree.props.ref.current = { measureInWindow: fn => fn(0, 20, 375, viewportHeight) }
  scroll.props.ref({ scrollTo({ y }) { contentOffset = y; scrolls.push(y); scroll.props.onScroll({ nativeEvent: { contentOffset: { y } } }) } })
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
  assert.doesNotMatch(playlist, /setKeepPlayBarOnKeyboard/)
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

test('shared subpage surface consumes visible Dock exactly once and native full-screen hosts cover it', () => {
  let height = 145
  const jsx = (type, props) => ({ type, props })
  const { SubpageSurface } = load('src/components/common/SubpageSurface.tsx', {
    'react/jsx-runtime': { jsx },
    'react-native': { KeyboardAvoidingView: 'Surface', Platform: { OS: 'android' } },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { bg: { app: 'paper' } } }) },
    './VisibleDockHeight': { VisibleDockHeightContext: { Provider: 'DockProvider' }, useVisibleDockHeight: () => height },
  })
  for (const next of [145, 0, 145, 0, 145]) {
    height = next
    const tree = SubpageSurface({ children: 'draft', style: { paddingTop: 22 } })
    assert.equal(tree.props.style.at(-1).paddingBottom, next)
    assert.equal(tree.props.style[0].backgroundColor, 'paper')
    assert.equal(tree.props.children.props.value, 0)
    assert.equal(tree.props.children.props.children, 'draft')
    assert.equal(tree.props.enabled, false, 'Android relies only on native resize')
  }
  assert.equal(SubpageSurface({ coversDock: true }).props.style.at(-1).paddingBottom, 0)
})

test('focus reveal includes actions above the field, but prioritizes input when the group does not fit', () => {
  assert.equal(math.focusScrollOffset(100, 240, 800, 10, 50, 0, 12, -30), 58)
  assert.equal(math.focusScrollOffset(100, 100, 800, 10, 50, -100, 12, -140), 98)
})

test('list scroll adapter forwards native scroll ref and caller events; late focus work is discarded', () => {
  const h = fixture()
  let finishMeasure
  h.input.measureInWindow = callback => { finishMeasure = callback }
  h.value.focus(h.input); h.flush()
  h.value.blur(h.input)
  finishMeasure(0, 700, 200, 40)
  assert.deepEqual(h.scrolls, [])
  h.cleanup()
})

test('full-screen import, local search and smart editor share reveal; search follows Dock settings', () => {
  for (const file of ['PlaylistImportFlow', 'PlaylistImportPanel', 'PlaylistSearchScene']) {
    assert.match(read(`src/components/playlist/${file}.tsx`), /renderScrollComponent={renderFocusVisibleScroll}/)
  }
  const smart = read('src/components/playlist/SmartPlaylistEditor.tsx')
  assert.match(smart, /<FocusVisibleScrollView/)
  assert.match(smart, /<FocusVisibleAction><TextButton/)
  assert.match(smart, /<SubpageSurface coversDock/)
  assert.doesNotMatch(read('src/components/playlist/PlaylistImportFlow.tsx'), /KeyboardAvoidingView|Platform.OS/)
  for (const file of ['src/screens/Home/Vertical/SearchPage.tsx', 'src/screens/Home/Vertical/Tabs/PlaylistTab.tsx']) {
    assert.doesNotMatch(read(file), /setKeepPlayBarOnKeyboard/)
  }
})


test('native list scroll ref and layout/content/scroll callbacks survive the adapter', () => {
  const events = []
  const ref = { current: null }
  const h = fixture({ scrollRef: ref, onLayout: () => events.push('layout'), onScroll: () => events.push('scroll'), onContentSizeChange: () => events.push('content') })
  assert.equal(typeof ref.current.scrollTo, 'function')
  h.scroll.props.onLayout({})
  h.scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 10 } } })
  assert.deepEqual(events, ['content', 'layout', 'scroll'])
  h.scroll.props.ref(null)
  assert.equal(ref.current, null)
  h.cleanup()
})

test('raw search input keeps its imperative ref and composes focus callbacks', () => {
  const events = []
  const node = {}
  let forwarded
  const jsx = (type, props) => ({ type, props })
  const { FocusVisibleInput } = load('src/components/common/FocusVisibleInput.tsx', {
    react: { forwardRef: fn => fn, useRef: () => ({ current: node }), useImperativeHandle: (_ref, get) => { forwarded = get() } },
    'react/jsx-runtime': { jsx },
    'react-native': { TextInput: 'TextInput' },
    './FocusVisibleScrollView': { useFocusVisibility: () => ({ focus: input => { assert.equal(input, node); events.push('focus') }, blur: () => events.push('blur') }) },
  })
  const tree = FocusVisibleInput({ onFocus: () => events.push('caller-focus'), onBlur: () => events.push('caller-blur') }, {})
  assert.equal(forwarded, node)
  tree.props.onFocus({}); tree.props.onBlur({})
  assert.deepEqual(events, ['focus', 'caller-focus', 'blur', 'caller-blur'])
})
