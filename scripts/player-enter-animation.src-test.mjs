/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const overlayFile = 'src/screens/Home/Vertical/PlayDetailOverlay.tsx'
const playerFile = 'src/screens/PlayDetail/index.tsx'
const load = (file, modules) => {
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in modules, name)
    return modules[name]
  }, module, module.exports)
  return module.exports
}
const harness = () => {
  let cursor = 0; let effects = []
  const slots = []; const animations = []; const listeners = new Map(); const closes = new Map()
  const common = { bgPic: 'original-cover', componentIds: {} }
  const jsx = (type, props) => ({ type, props })
  const effect = (fn, deps) => {
    const index = cursor++; const prev = slots[index]
    if (prev && deps.every((dep, i) => dep === prev.deps[i])) return
    effects.push(() => { prev?.cleanup?.(); slots[index] = { deps, cleanup: fn() } })
  }
  const react = {
    memo: fn => fn,
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value } },
    useState(value) { const index = cursor++; slots[index] ??= { value }; return [slots[index].value, next => { slots[index].value = next }] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: effect, useLayoutEffect: effect,
  }
  let hardware; let appear; let disappear; let pops = 0; let resolvePop
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Easing: { cubic: 'cubic', back: n => ['back', n], out: curve => ['out', curve] }, Animated: {
      View: 'AnimatedView', Value: class {
        constructor(value) { this.value = value }
        setValue(value) { this.value = value }
        interpolate(config) { return config }
        stopAnimation() {}
      },
      timing(value, config) {
        const animation = { config, value, finish(finished = true) { if (finished) value.setValue(config.toValue); this.done?.({ finished }) } }
        animations.push(animation)
        return { start(done) { animation.done = done } }
      },
    } },
    '@/screens/PlayDetail': { default: 'PlayDetail', __esModule: true },
    '@/config/constant': { APP_LAYER_INDEX: { playDetail: 30 }, COMPONENT_IDS: { playDetail: 'playDetail' } },
    '@/core/common': { setBgPic: value => { common.bgPic = value }, setComponentId: (key, value) => { common.componentIds[key] = value } },
    '@/utils/hooks': { useWindowSize: () => ({ height: 800 }), useHorizontalMode: () => false },
    '@/store/common/state': { default: common, __esModule: true },
    '@/theme/LuxTheme': { sharedLuxStyles: fn => () => fn({ scrim: { mask: 'theme-mask' } }) },
    '@/utils/hooks/useBackHandler': { useBackHandler: fn => { hardware = fn } },
    '@/store/common/hook': { useComponentIds: () => common.componentIds },
    '@/store/player/hook': { usePlayerMusicInfo: () => ({ pic: null }) },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0, __esModule: true },
    '@/navigation/pageTransitionRegistry': { registerPageClose(id, close) { closes.set(id, close); return () => closes.delete(id) } },
    '@/navigation': { pop: id => closes.get(id)() },
    'react-native-navigation': { Navigation: {
      pop: () => { pops++; return new Promise(resolve => { resolvePop = resolve }) },
      events: () => ({
        registerComponentDidAppearListener: fn => { appear = fn; return { remove() {} } },
        registerComponentDidDisappearListener: fn => { disappear = fn; return { remove() {} } },
      }),
    } },
  }
  for (const path of ['./Vertical', './Horizontal', '@/components/PageContent', '@/components/common/StatusBar', '@/screens/Home/Vertical/PlayQueueSheet']) modules[path] = { default: path, __esModule: true }
  modules['./context'] = { PlayDetailContext: { Provider: 'Provider' } }
  const api = load(overlayFile, modules).default
  const player = load(playerFile, modules).default
  const event = { on: (name, fn) => listeners.set(name, fn), off: name => listeners.delete(name) }
  return {
    animations, common, closes, player,
    render(fn = () => api({ componentId: 'home' })) {
      cursor = 0
      const saved = global.app_event; global.app_event = event
      try { const tree = fn(); const pending = effects; effects = []; pending.forEach(fn => fn()); return tree } finally { global.app_event = saved }
    },
    show: () => listeners.get('showPlayDetail')(), hide: () => listeners.get('hidePlayDetail')(),
    back: () => hardware(), disappear: () => disappear({ componentId: 'native-player' }), appear: () => appear({ componentId: 'native-player' }),
    get pops() { return pops }, finishPop: () => resolvePop(),
    unmount() { const saved = global.app_event; global.app_event = event; try { slots.forEach(slot => slot?.cleanup?.()) } finally { global.app_event = saved } },
  }
}

test('persistent player uses original vertical timing and mask; close completes before hiding and restoring background', () => {
  const h = harness()
  let tree = h.render()
  assert.equal(tree.props.children[1].props.children, null, 'lazy mount')
  h.show(); tree = h.render()
  assert.equal(h.common.bgPic, null)
  assert.equal(h.common.componentIds.playDetail, 'home')
  const [mask, content] = tree.props.children
  assert.equal(mask.props.style[0].backgroundColor, 'theme-mask')
  assert.deepEqual(content.props.style[1].transform[0].translateY.outputRange, [800, 0])
  const open = h.animations.at(-1)
  assert.equal(mask.props.style[1].opacity, open.value)
  assert.deepEqual(open.config, { toValue: 1, duration: 420, easing: ['out', ['back', 1.05]], useNativeDriver: true })
  h.show(); assert.equal(h.animations.length, 1)
  open.finish(); h.hide(); h.hide()
  const close = h.animations.at(-1)
  assert.equal(h.animations.length, 2)
  assert.deepEqual(close.config, { toValue: 0, duration: 300, easing: ['out', 'cubic'], useNativeDriver: true })
  assert.equal(h.render().props.pointerEvents, 'auto')
  assert.equal(h.common.bgPic, null)
  close.finish()
  tree = h.render()
  assert.equal(tree.props.pointerEvents, 'none')
  assert.ok(tree.props.children[1].props.children, 'retain player after first open')
  assert.equal(h.common.bgPic, 'original-cover')
  assert.equal(h.common.componentIds.playDetail, '')
  h.unmount()
})

test('same-tick open/close/reopen reverses current position and ignores stale completion; unmount cancels callbacks', () => {
  const h = harness(); h.render()
  h.show(); h.hide()
  const stale = h.animations.at(-1)
  stale.value.setValue(0.4)
  h.show()
  assert.equal(h.animations.at(-1).value.value, 0.4)
  stale.finish()
  assert.equal(h.render().props.pointerEvents, 'auto')
  assert.equal(h.common.componentIds.playDetail, 'home')
  h.hide(); const close = h.animations.at(-1)
  h.common.bgPic = 'new-init-cover'
  h.unmount(); close.finish()
  assert.equal(h.common.bgPic, 'new-init-cover')
})

test('native player button, registered pop and Android back share one native exit with no JS clock', async() => {
  const h = harness()
  const render = visible => h.render(() => h.player({ componentId: 'native-player', visible }))
  const tree = render(true)
  tree.props.value()
  h.back()
  const pending = h.closes.get('native-player')()
  assert.equal(h.pops, 1)
  assert.equal(h.animations.length, 0)
  h.finishPop(); await pending
  h.disappear(); assert.equal(h.back(), false)
  render(true); h.appear(); render(false); assert.equal(h.back(), false)
  h.unmount(); assert.equal(h.closes.size, 0)
})

test('native push overrides disabled defaults, uses vertical spring/alpha and honors skipAnimation', () => {
  const source = read('src/navigation/navigation.ts')
  const fn = source.slice(source.indexOf('export function pushPlayDetailScreen('), source.indexOf('export function pushCommentScreen('))
  assert.doesNotMatch(fn, /subpageNavigationOptions|translationX/)
  const js = ts.transpileModule(fn.replace('export function', 'function'), {}).outputText
  for (const skip of [false, true]) {
    let options
    new Script(`${js}\npushPlayDetailScreen('home', ${skip})`).runInNewContext({
      playerState: { musicInfo: {} }, requestAnimationFrame: fn => fn(), themeState: { theme: {} },
      PLAY_DETAIL_SCREEN: 'player', getStatusBarStyle: () => 'light',
      windowSizeTools: { getSize: () => ({ height: 800 }) },
      peekBootedLuxTheme: () => ({ colors: { shadow: { black: 'black-token' } } }),
      Navigation: { push: (_id, layout) => { options = layout.component.options } },
    })
    assert.equal(options.layout.componentBackgroundColor, 'black-token')
    assert.equal(options.popGesture, false)
    for (const [name, from, to, duration] of [['push', 800, 0, 420], ['pop', 0, 800, 300]]) {
      const animation = options.animations[name]
      assert.equal(animation.enabled, !skip)
      if (skip) { assert.equal(animation.content, undefined); continue }
      assert.deepEqual(JSON.parse(JSON.stringify(animation.content.translationY)), { from, to, duration, ...(name === 'push' ? { interpolation: { type: 'spring' } } : {}) })
      assert.equal(animation.content.alpha.from, name === 'push' ? 0.92 : 1)
      assert.equal(animation.content.alpha.to, name === 'push' ? 1 : 0.92)
    }
  }
  assert.match(read('src/navigation/registerScreens.tsx'), /PLAY_DETAIL_SCREEN, \(\) => WrappedComponent\(PlayDetail, false\)/)
  assert.doesNotMatch(read(overlayFile), /useSettingsTransition|translateX/)
  assert.match(read('src/screens/PlayDetail/Vertical/index.tsx'), /if \(!active\) return false/)
})
