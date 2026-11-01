/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const settingsFile = 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx'
const parse = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const descendants = root => {
  const result = []
  const visit = node => { result.push(node); ts.forEachChild(node, visit) }
  visit(root)
  return result
}
const tag = node => ts.isJsxElement(node) ? node.openingElement.tagName.getText() : ts.isJsxSelfClosingElement(node) ? node.tagName.getText() : ''
const under = (node, name) => {
  for (let parent = node.parent; parent; parent = parent.parent) if (tag(parent) === name) return true
  return false
}
const attribute = (node, name) => (node.attributes ?? node.openingElement?.attributes)?.properties.find(prop => prop.name?.getText() === name)?.initializer?.getText()

// Explicit reviewed inventory. A new Settings entry MUST be audited here and in the spec.
const entries = {
  setting_basic_lang: 'handleOpenLanguageDetail',
  setting_lux_theme: 'handleOpenThemeDetail',
  setting_stats_page_style: 'handleOpenStatsPageStyleDetail',
  setting_search_source: 'handleOpenSearchSourceDetail',
  audio_effects_title: '() => { global.app_event.openAudioEffects() }',
  setting_basic_source: 'handleOpenPlayerDetail',
  together_layout: "() => { setActiveOptionDetail('togetherLayout') }",
  sync_state_address_format: 'handleOpenSyncDetail',
  ai_tokens_title: '() => { setAiTokensVisible(true) }',
  admin_console_entry_title: 'handleOpenAdminConsole',
  together_debug_panel_toggle: 'handleToggleTogetherDebugPanel',
  together_readiness_copy_settings: 'handleCopyTogetherDiagnostics',
  setting_sync_clear_conflict_mode: '() => { void handleClearSyncConflictMode() }',
  setting_cache_management: 'handleOpenResourceCacheDetail',
  setting_export_data: 'handleExportData',
  setting_import_data: 'handleImportData',
  version_label_current_ver: 'handleOpenChangelog',
  version_btn_check_update: 'handleCheckUpdate',
  'GitHub Releases': 'handleOpenReleasePage',
}
const options = ['language', 'theme', 'statsPageStyle', 'searchSource', 'player', 'togetherLayout', 'sync', 'resourceCache', 'changelog']

test('every Settings entry is enumerated; every option renderer is inside SettingsPage', () => {
  const ast = parse(settingsFile)
  const nodes = descendants(ast)
  const reviewedTags = ['AccountPage', 'AdminConsoleLayer', 'AiTokenStatusPage', 'ChoosePath', 'EmptyState', 'Hairline', 'IconButton', 'Image', 'MagDialog', 'MagTopBar', 'MdiIcon', 'OptionRow', 'ResourceCacheDetail', 'Rule', 'ScrollView', 'SectionHeader', 'ServerStep', 'SettingRow', 'SettingsPage', 'Source', 'SyncLogin', 'SyncStatusPage', 'SyncStatusPill', 'SyncConnectionInfo', 'Text', 'TouchableOpacity', 'UnderlineInput', 'VersionChangelogDetail', 'View']
  assert.deepEqual([...new Set(nodes.map(tag).filter(Boolean))].sort(), reviewedTags.sort(), 'New surface requires audit, including imports outside @/screens')
  const rows = nodes.filter(node => tag(node) === 'SettingRow')
  const seen = new Set()
  for (const row of rows) {
    const title = attribute(row, 'title')
    const key = title.match(/t\('([^']+)'\)/)?.[1] ?? JSON.parse(title)
    seen.add(key)
    assert.ok(key in entries, `Unaudited Settings entry: ${key}`)
    assert.equal(attribute(row, 'onPress'), `{${entries[key]}}`, `Changed navigation: ${key}`)
  }
  assert.deepEqual([...seen].sort(), Object.keys(entries).sort())
  const renders = nodes.filter(node => ts.isBinaryExpression(node) && node.left.getText() === 'activeOptionDetail' && node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(node.right))
  assert.deepEqual([...new Set(renders.map(node => node.right.text))].sort(), options.slice().sort())
  for (const render of renders) assert.ok(under(render, 'SettingsPage'), render.getText())
  const state = nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText() === '[activeOptionDetail, setActiveOptionDetail]')
  assert.deepEqual(descendants(state.initializer.typeArguments[0]).filter(ts.isStringLiteral).map(node => node.text).sort(), options.slice().sort())
  assert.doesNotMatch(read(settingsFile), /<Modal|Animated\.timing|navigations\.pushSyncLogin/)
})

test('Settings sections each use their own iconWrap consistently', () => {
  const nodes = descendants(parse(settingsFile))
  const expected = {
    setting_appearance: 'orange',
    setting_search_and_play: 'green',
    setting_data_and_sync: 'purple',
    setting_debug_section: 'blue',
    setting_about: 'amber',
  }
  const sections = nodes.filter(node => tag(node) === 'View' && attribute(node, 'style') === '{styles.sectionBlock}')
  const seen = new Map()
  for (const section of sections) {
    const children = descendants(section)
    const headers = children.filter(node => tag(node) === 'SectionHeader')
    assert.equal(headers.length, 1)
    const key = attribute(headers[0], 'title').match(/t\('([^']+)'\)/)[1]
    assert.ok(key in expected, `Unaudited section: ${key}`)
    assert.equal(seen.has(key), false, `Duplicate section: ${key}`)
    const rows = children.filter(node => tag(node) === 'SettingRow')
    assert.ok(rows.length > 0, `Empty section: ${key}`)
    const colors = new Set(rows.map(row => attribute(row, 'iconBg')))
    assert.deepEqual([...colors], [`{r.iconWrap.${expected[key]}}`], key)
    seen.set(key, [...colors][0])
  }
  assert.deepEqual([...seen.keys()].sort(), Object.keys(expected).sort())
  assert.equal(new Set(seen.values()).size, seen.size, 'Sections must not share iconWrap')
  assert.equal(nodes.filter(node => tag(node) === 'SettingRow').length,
    sections.reduce((count, section) => count + descendants(section).filter(node => tag(node) === 'SettingRow').length, 0))
})

test('profile avatar retains the complete AccountPage through shared SettingsPage', () => {
  const nodes = descendants(parse(settingsFile))
  const hero = nodes.find(node => tag(node) === 'View' && attribute(node, 'style') === '{styles.profileHeroRow}')
  assert.ok(hero)
  const accountControls = descendants(hero).filter(node => tag(node) === 'TouchableOpacity')
  assert.equal(accountControls.length, 3) // Avatar, combined nickname/signature, arrow.
  for (const control of accountControls) assert.equal(attribute(control, 'onPress'), '{handleOpenProfileDetail}')
  const pill = descendants(hero).find(node => tag(node) === 'SyncStatusPill')
  assert.ok(pill)
  assert.ok(!under(pill, 'TouchableOpacity'), 'pill must not bubble to an account button')
  assert.match(attribute(pill, 'onPress'), /statusModel.route === 'sync'.*handleOpenSyncDetail/s)
  assert.match(attribute(pill, 'onPress'), /else setStatusPage\(statusModel\)/)
  const open = nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText() === 'handleOpenProfileDetail')
  assert.match(open.initializer.getText(), /setProfileDetailVisible\(true\)/)
  const accounts = nodes.filter(node => tag(node) === 'AccountPage')
  assert.equal(accounts.length, 1)
  const account = accounts[0]
  const host = account.parent.parent.parent
  assert.equal(tag(host), 'SettingsPage')
  assert.equal(attribute(host, 'visible'), '{isProfileDetailVisible}')
  assert.equal(attribute(host, 'onBack'), '{handleCloseProfileDetail}')
  assert.equal(attribute(account, 'onBack'), '{back}')
  assert.equal(attribute(account, 'onLogout'), '{handleLogoutSyncAccount}')
  assert.equal(attribute(account, 'onManageData'), '{() => { handleCloseProfileDetail(); handleOpenResourceCacheDetail() }}')
  assert.doesNotMatch(read(settingsFile), /showAccountSection|t\('setting_account'\)|t\('settings_meta_account'\)/)
})

test('all imported Settings screens and nested pages use the shared transition, including EQ hosts', () => {
  const ast = parse(settingsFile)
  const screenNames = descendants(ast).filter(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text.startsWith('@/screens/'))
    .flatMap(node => descendants(node.importClause).filter(ts.isIdentifier).map(node => node.text))
  const controls = new Set(['SyncStatusPill', 'SyncConnectionInfo', 'Source', 'AdminConsoleLayer'])
  for (const node of descendants(ast).filter(node => screenNames.includes(tag(node)) && !controls.has(tag(node)))) {
    assert.ok(under(node, 'SettingsPage'), `Screen bypasses SettingsPage: ${tag(node)}`)
  }
  for (const [file, helper] of [
    ['src/screens/Account/AccountPage.tsx', 'useSettingsSubpage'], // account / edit / devices / spaces / password
    ['src/screens/Login/ChangePassword.tsx', 'useSettingsBack'], // parent's subpage surface
    ['src/screens/AdminConsole/AdminConsoleLayer.tsx', 'SettingsPage'], // dashboard / users / invites / playlists / service
    ['src/screens/AudioEffects/index.tsx', 'useSettingsTransition'], // EQ / loudness+gapless detail
    ['src/screens/SyncLogin/index.tsx', 'useSettingsSubpage'], // server / LX / Lux
    ['src/screens/Login/AuthFlow.tsx', 'useSettingsSubpage'], // login / register / forgot
  ]) {
    const source = read(file)
    assert.match(source, new RegExp(`import \\{[^}]*${helper}[^}]*\\} from '@/components/common/SettingsPage'`), file)
    assert.doesNotMatch(source, /<Modal|Animated\.timing/, file)
  }
  const admin = read('src/screens/AdminConsole/AdminConsoleLayer.tsx')
  assert.match(admin, /requestOpen\(\)/)
  assert.match(admin, /requestClose\(\(\) => \{ setRouteStack/)
  const audio = read('src/screens/AudioEffects/index.tsx')
  assert.match(audio, /else requestClose\(onBack\)/)
  assert.match(audio, /useSettingsSubpage\(false\)/)
  assert.match(audio, /bottom: bottomInset \?\? DOCK_BASE_HEIGHT \+ bottom/)
  for (const orientation of ['Vertical', 'Horizontal']) {
    const main = read(`src/screens/Home/${orientation}/Main.tsx`)
    assert.match(main, /app_event\.on\('openAudioEffects'/)
    assert.match(main, /<AudioEffectsPage/)
  }
})

const harness = () => {
  const slots = []; let cursor = 0; let effects = []
  const animations = []; let hardware; let home = true; let dockHeight = null
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  let sceneActive = true
  const react = {
    createContext: value => ({ Provider: 'ActiveProvider', value }),
    useContext: () => sceneActive,
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial } },
    useState: initial => {
      const i = cursor++
      if (!slots[i]) {
        const cell = { value: typeof initial === 'function' ? initial() : initial }
        cell.set = next => { cell.value = typeof next === 'function' ? next(cell.value) : next }
        slots[i] = cell
      }
      return [slots[i].value, slots[i].set]
    },
    useMemo: (fn, deps) => {
      const i = cursor++
      if (!slots[i] || !depsEqual(deps, slots[i].deps)) slots[i] = { value: fn(), deps }
      return slots[i].value
    },
    useCallback: (fn, deps) => react.useMemo(() => fn, deps),
    useEffect: (fn, deps) => {
      const i = cursor++; const prev = slots[i]
      if (!prev || !depsEqual(deps, prev.deps)) effects.push(() => { prev?.cleanup?.(); slots[i] = { deps, cleanup: fn() } })
    },
  }
  react.useLayoutEffect = react.useEffect
  const popped = []; let nativeBack; let disappear
  const jsx = (type, props) => ({ type, props })
  const native = {
    View: 'View',
    BackHandler: { addEventListener: (_event, fn) => { nativeBack = fn; return { remove() {} } } },
    useWindowDimensions: () => ({ width: 375 }),
    StyleSheet: { absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
    Animated: {
      View: 'AnimatedView',
      Value: class {
        constructor(value) { this.value = value }
        setValue(value) { this.value = value }
        stopAnimation() {}
        interpolate(config) { return config }
      },
      timing(value, config) {
        const animation = { value, config, finish(finished = true) { if (finished) value.setValue(config.toValue); this.done?.({ finished }) } }
        animations.push(animation)
        return { start(done) { animation.done = done } }
      },
    },
    Easing: { bezier: (...points) => points },
  }
  const modules = {
    react,
    './VisibleDockHeight': { VisibleDockHeightContext: { Provider: 'DockProvider' }, useVisibleDockHeight: fallback => dockHeight ?? fallback },
    'react-native': native,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/config/constant': { APP_LAYER_INDEX: { controls: 20 } },
    '@/store/common/state': { default: { componentIds: {} }, __esModule: true },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { bg: { app: 'paper' } } }) },
    '@/utils/homeBackHandler': { isHomeScreenActive: () => home },
    '@/utils/hooks/useBackHandler': { useBackHandler: fn => react.useEffect(() => { hardware = fn }, [fn]) },
  }
  const load = file => {
    const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const module = { exports: {} }
    new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => { assert.ok(name in modules, name); return modules[name] }, module, module.exports)
    return module.exports
  }
  modules['./overlaySlideTransition'] = load('src/components/common/overlaySlideTransition.ts')
  const api = load('src/components/common/SettingsPage.tsx')
  const registry = load('src/navigation/pageTransitionRegistry.ts')
  modules['./pageTransitionRegistry'] = registry
  modules['@/components/common/SettingsPage'] = api
  modules['react-native-navigation'] = {
    Navigation: {
      pop: async id => { popped.push(id); return id },
      events: () => ({
        registerComponentDidAppearListener: () => ({ remove() {} }),
        registerComponentDidDisappearListener: fn => { disappear = fn; return { remove() {} } },
      }),
    },
  }
  const nativeApi = load('src/navigation/SubpageScreen.tsx')
  return {
    api: { ...api, ...nativeApi },
    registry,
    popped,
    nativeBack: () => nativeBack(),
    disappear: id => disappear({ componentId: id }),
    overlay: modules['./overlaySlideTransition'],
    animations,
    render(fn) { cursor = 0; const value = fn(); const pending = effects; effects = []; pending.forEach(effect => effect()); return value },
    back: () => hardware(),
    setHome: value => { home = value },
    setSceneActive: value => { sceneActive = value },
    setDockHeight: value => { dockHeight = value },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  }
}

test('Settings button and Android back reverse the same 248ms curve and retain content until completion', () => {
  for (const input of ['button', 'android']) {
    const h = harness(); let visible = true; let closeCount = 0; let back
    const render = () => h.render(() => h.api.SettingsPage({ visible, bottomInset: 130, onBack() { visible = false; closeCount++ }, children: callback => { back = callback; return 'AI content' } }))
    let tree = render()
    assert.equal(tree.props.style[1].bottom, 130)
    const open = h.animations.at(-1)
    assert.equal(open.config.toValue, 1)
    assert.equal(open.config.duration, 248)
    open.finish()
    h.setHome(false); assert.equal(h.back(), false); h.setHome(true)
    if (input === 'button') back()
    else assert.equal(h.back(), true)
    const close = h.animations.at(-1)
    assert.equal(close.config.toValue, 0)
    assert.equal(close.config.duration, open.config.duration)
    assert.equal(close.config.easing, open.config.easing)
    assert.deepEqual(tree.props.style[2].transform[0].translateX.outputRange, [375, 0])
    assert.deepEqual(tree.props.style[2].opacity.outputRange, [0.92, 1])
    const count = h.animations.length
    back(); h.back(); assert.equal(h.animations.length, count, 'repeat back is coalesced')
    tree = render(); assert.equal(tree.props.children.props.children, 'AI content'); assert.equal(closeCount, 0)
    close.finish(); assert.equal(closeCount, 1); assert.equal(render(), null)
    h.unmount()
  }
})

test('external close retains old page; reopen cancels stale completion; unmount cancels back callbacks', () => {
  const h = harness(); let visible = true; let label = 'cache'; let back; let closed = 0
  const render = () => h.render(() => h.api.SettingsPage({ visible, onBack: () => { closed++ }, children: callback => { back = callback; return label } }))
  render(); h.animations.at(-1).finish()
  visible = false; label = 'empty'
  assert.equal(render().props.children.props.children, 'cache')
  const staleClose = h.animations.at(-1)
  visible = true; label = 'themes'; render()
  staleClose.finish(); assert.equal(render().props.children.props.children, 'themes')
  back(); const pending = h.animations.at(-1)
  h.unmount(); pending.finish(); assert.equal(closed, 0)
})

test('nested Settings routes slide forward, reverse before restoring parent, and keep root unchanged on no-op', () => {
  const h = harness()
  const render = () => h.render(() => h.api.useSettingsSubpage('account'))
  let page = render(); page.setPage('account'); assert.equal(h.animations.length, 0)
  page.setPage('devices'); page = render(); assert.equal(page.page, 'devices')
  const open = h.animations.at(-1); open.finish()
  let cleaned = false
  page.setPage('account', () => { cleaned = true }); page = render(); assert.equal(page.page, 'devices')
  assert.equal(cleaned, false)
  const close = h.animations.at(-1)
  assert.equal(close.config.duration, open.config.duration); assert.equal(close.config.easing, open.config.easing)
  close.finish(); page = render(); assert.equal(page.page, 'account')
  assert.equal(close.value.value, 1)
  assert.equal(cleaned, true)
  h.unmount()
})


test('settings B has no root back, H1 and search share a row and input pushes content below', () => {
  const nodes = descendants(parse(settingsFile))
  const top = nodes.find(node => tag(node) === 'MagTopBar')
  assert.equal(attribute(top, 'masthead'), "{t('sync_state_settings_eyebrow')}")
  assert.equal(attribute(top, 'leading'), undefined)
  assert.equal(attribute(top, 'onBack'), undefined)
  const row = nodes.find(node => tag(node) === 'View' && attribute(node, 'style') === '{styles.titleActionRow}')
  const title = descendants(row).find(node => tag(node) === 'Text')
  assert.equal(attribute(title, 'size'), '{magType.h1.size}')
  const search = descendants(row).find(node => tag(node) === 'IconButton')
  assert.equal(attribute(search, 'size'), '{28}')
  assert.equal(attribute(search, 'onPress'), '{handleToggleSettingsSearch}')
  const input = nodes.find(node => tag(node) === 'UnderlineInput' && attribute(node, 'value') === '{settingsSearchQuery}')
  assert.ok(input.pos > row.end)
  assert.doesNotMatch(read(settingsFile), /SyncStatusRow|<BackButton/)
  assert.match(read(settingsFile), /const SETTINGS_SECTION_GAP = 22/)
  const pillSource = read('src/screens/SyncStatus/index.tsx')
  assert.match(pillSource, /pillTarget:.*minHeight: 44.*paddingVertical: 8/)
  assert.match(pillSource, /pill:.*minHeight: 28.*paddingHorizontal: 8/)
  assert.doesNotMatch(pillSource, /hitSlop|ActivityIndicator/)
})


test('SettingsPage replaces fixed bottom with shared visible height across keyboard cycles without remount or replay', () => {
  const h = harness()
  const render = () => h.render(() => h.api.SettingsPage({ visible: true, bottomInset: 130, onBack() {}, children: () => 'profile draft' }))
  assert.equal(render().props.style[1].bottom, 130)
  h.animations.at(-1).finish()
  const animationCount = h.animations.length
  for (const height of [147, 0, 147, 0, 147]) {
    h.setDockHeight(height)
    const tree = render()
    assert.equal(tree.props.style[1].bottom, height)
    assert.equal(tree.props.children.props.children, 'profile draft')
    assert.equal(h.animations.length, animationCount)
  }
  h.unmount()
})


test('all depths and module adapters use the Settings curve, opacity, width and native driver', () => {
  for (const kind of ['settings', 'overlay-default', 'overlay-compat']) {
    const h = harness()
    const page = h.render(() => kind === 'settings' ? h.api.useSettingsTransition() : h.overlay.useOverlaySlideTransition(375, kind === 'overlay-compat' ? { symmetric: false } : undefined))
    const open = h.animations.at(-1); open.finish()
    page.requestClose()
    const close = h.animations.at(-1)
    assert.equal(open.config.duration, 248, kind)
    assert.equal(close.config.duration, open.config.duration, kind)
    assert.equal(close.config.easing, open.config.easing, kind)
    assert.deepEqual(open.config.easing, [0.22, 0.84, 0.22, 1])
    assert.equal(open.config.useNativeDriver, true)
    assert.equal(close.config.useNativeDriver, true)
    assert.deepEqual(page.style.opacity.outputRange, [0.92, 1])
    assert.deepEqual(page.style.transform[0].translateX.outputRange, [375, 0])
    h.unmount()
  }
  for (const file of [
    'src/screens/Home/Vertical/SearchPage.tsx',
    'src/screens/Home/Vertical/PlayDetailOverlay.tsx',
    'src/components/playlist/PlaylistDetailOverlay.tsx',
    'src/components/playlist/detailSceneTransition.ts',
    'src/components/playlist/SmartPlaylistEditor.tsx',
    'src/components/playlist/PlaylistImportFlow.tsx',
    'src/components/shareCard/ShareCardPage.tsx',
    'src/navigation/SubpageScreen.tsx',
    'src/components/recommend/DailyRecommendationPage.tsx',
    'src/screens/Home/Vertical/WhiteNoisePage.tsx',
  ]) {
    assert.match(read(file), /useSettingsTransition/)
    assert.doesNotMatch(read(file), /Animated.timing|animationType="slide"/, file)
  }
  const library = read('src/screens/Home/Vertical/Tabs/PlaylistTab.tsx')
  assert.doesNotMatch(library, /animateDetailScene|detailSceneTranslateX|homeSceneTranslateX/)
  assert.match(library, /useSettingsSubpage\(false\)/)
})

test('native stack registration defaults to shared pages and every native push disables platform animation', () => {
  const register = read('src/navigation/registerScreens.tsx')
  assert.match(register, /subpage = true/)
  assert.match(register, /<SubpageScreen componentId={props.componentId}/)
  const ast = parse('src/navigation/navigation.ts')
  for (const call of descendants(ast).filter(node => ts.isCallExpression(node) && node.expression.getText() === 'Navigation.push')) {
    assert.match(call.arguments[1].getText(), /\.\.\.subpageNavigationOptions/)
    assert.doesNotMatch(call.arguments[1].getText(), /translation[XY]|duration:/)
  }
  assert.match(read('src/navigation/utils.ts'), /const close = getRegisteredPageClose\(compId\)[\s\S]*close \? close\(\) : Navigation.pop\(compId\)/)
  const host = read('src/navigation/SubpageScreen.tsx')
  assert.match(host, /useLayoutEffect/)
  assert.match(host, /requestClose\(\(\) => \{ resolve\(Navigation.pop\(componentId\)\)/)
  assert.match(host, /if \(!active.current\) return false/)
  assert.match(host, /back.remove\(\); appear.remove\(\); disappear.remove\(\)/)
})

test('shared hardware listener keeps mount priority across parent rerenders and invokes the latest callback', () => {
  const ref = { current: null }; let effect; let listener; let registrations = 0; let removed = 0
  const module = { exports: {} }
  const source = ts.transpileModule(read('src/utils/hooks/useBackHandler.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const deps = {
    react: { useRef: () => ref, useEffect: fn => { effect ??= fn } },
    'react-native': { BackHandler: { addEventListener: (_event, callback) => { registrations++; listener = callback; return { remove() { removed++ } } } } },
  }
  new Script(`(function(require,module,exports){${source}\n})`).runInThisContext()(name => deps[name], module, module.exports)
  module.exports.useBackHandler(() => false)
  const cleanup = effect()
  assert.equal(listener(), false)
  module.exports.useBackHandler(() => true)
  assert.equal(listener(), true)
  assert.equal(registrations, 1)
  cleanup(); assert.equal(removed, 1)
})


test('native screen button and system back wait for shared exit before popping; background screens do not consume back', async() => {
  for (const input of ['button', 'system']) {
    const h = harness()
    const tree = h.render(() => h.api.SubpageScreen({ componentId: 'comment', children: 'comments' }))
    const open = h.animations.at(-1); open.finish()
    assert.deepEqual(tree.props.style[1].opacity.outputRange, [0.92, 1])
    let done
    if (input === 'button') done = h.registry.getRegisteredPageClose('comment')()
    else assert.equal(h.nativeBack(), true)
    const close = h.animations.at(-1)
    assert.equal(close.config.duration, open.config.duration)
    assert.equal(close.config.easing, open.config.easing)
    assert.equal(h.popped.length, 0)
    h.nativeBack()
    assert.equal(h.animations.at(-1), close, 'duplicate native back must be coalesced')
    close.finish(); await done
    assert.deepEqual(h.popped, ['comment'])
    h.disappear('comment'); assert.equal(h.nativeBack(), false)
    h.unmount()
    assert.equal(h.registry.getRegisteredPageClose('comment'), undefined)
  }
})

test('ancestor scenes stay mounted, opaque and stationary throughout open/back at every depth', () => {
  const h = harness()
  let state
  const render = () => h.render(() => {
    state = h.api.useSettingsSubpage('account')
    return h.api.SettingsSubpage({ pages: state.pages, style: state.style, children: page => ({ type: 'Page', props: { children: page } }) })
  })
  const layers = tree => tree.props.children
  const labels = tree => layers(tree).map(scene => scene.props.children.props.children.props.children)
  const assertUnderlay = (tree, expected) => {
    assert.deepEqual(labels(tree), expected)
    assert.equal(tree.props.style.overflow, 'hidden')
    for (const scene of layers(tree).slice(0, -1)) {
      assert.equal(scene.props.collapsable, false, 'retain native underlay view')
      assert.equal(scene.props.style[1].backgroundColor, 'paper')
      assert.equal(scene.props.style[2], null, 'ancestor never slides/fades or uses display:none')
      assert.equal(scene.props.pointerEvents, 'none')
      assert.equal(scene.props.accessibilityElementsHidden, true)
      assert.equal(scene.props.importantForAccessibility, 'no-hide-descendants')
    }
    assert.equal(layers(tree).at(-1).props.pointerEvents, 'auto')
  }
  let tree = render()
  assert.deepEqual(labels(tree), ['account'])
  for (const next of ['edit', 'third-child', 'fourth-child']) {
    const previous = labels(tree)
    state.setPage(next)
    tree = render()
    assertUnderlay(tree, [...previous, next])
    const open = h.animations.at(-1)
    assert.equal(open.config.duration, 248)
    open.value.setValue(0.5)
    assertUnderlay(render(), [...previous, next])
    open.finish()
  }
  for (const parent of ['third-child', 'edit', 'account']) {
    const previous = labels(tree)
    state.setPage(parent)
    const close = h.animations.at(-1)
    const count = h.animations.length
    state.setPage(parent)
    assert.equal(h.animations.length, count, 'continuous back during one exit is coalesced')
    close.value.setValue(0.5)
    tree = render()
    assertUnderlay(tree, previous)
    assert.equal(close.config.duration, 248)
    assert.deepEqual(close.config.easing, [0.22, 0.84, 0.22, 1])
    close.finish()
    tree = render()
    assertUnderlay(tree, previous.slice(0, -1))
  }
  assert.equal(layers(tree)[0].props.style[2], null, 'root remains stationary after the last pop')
  h.unmount()
})

test('nested return cancelled by a new push cannot discard the live ancestor stack', () => {
  const h = harness()
  const render = () => h.render(() => h.api.useSettingsSubpage('root'))
  let state = render()
  state.setPage('child'); state = render(); h.animations.at(-1).finish()
  let staleCallback = false
  state.setPage('root', () => { staleCallback = true })
  const stale = h.animations.at(-1)
  state.setPage('grandchild'); state = render()
  stale.finish()
  assert.deepEqual(render().pages, ['root', 'child', 'grandchild'])
  assert.equal(staleCallback, false)
  h.unmount()
})

test('deep initial route includes its parent; standalone flows keep their immediate navigation', () => {
  for (const enabled of [true, false]) {
    const h = harness()
    const render = () => h.render(() => h.api.useSettingsSubpage('server', enabled, 'auth'))
    let state = render()
    assert.deepEqual(state.pages, enabled ? ['server', 'auth'] : ['auth'])
    state.setPage('server'); state = render()
    if (enabled) {
      assert.deepEqual(state.pages, ['server', 'auth'])
      h.animations.at(-1).finish()
      assert.deepEqual(render().pages, ['server'])
    } else {
      assert.deepEqual(state.pages, ['server'])
      assert.equal(h.animations.length, 0)
    }
    h.unmount()
  }
})

test('all conditional internal routes render through the shared ancestor scene host', () => {
  for (const file of [
    'src/screens/Account/AccountPage.tsx',
    'src/screens/Login/AuthFlow.tsx',
    'src/screens/SyncLogin/index.tsx',
    'src/screens/AudioEffects/index.tsx',
    'src/screens/AdminConsole/AdminConsoleLayer.tsx',
    'src/components/stats/ListeningStatsPage.tsx',
    'src/screens/Home/Vertical/Tabs/PlaylistTab.tsx',
  ]) {
    const host = descendants(parse(file)).find(node => tag(node) === 'SettingsSubpage')
    assert.ok(host, file)
    assert.ok(attribute(host, 'pages'), file)
    assert.ok(attribute(host, 'style'), file)
  }
  const scene = read('src/components/common/SettingsPage.tsx')
  assert.match(scene, /key=\{index\} collapsable=\{false\}/)
  assert.match(scene, /active && index > 0 \? style : null/)
  assert.doesNotMatch(scene, /display:|opacity: 0|height: 0/)
  assert.match(read('src/screens/Account/AccountPage.tsx'), /<KeyboardAvoidingView/)
  assert.match(read('src/screens/Account/AccountPage.tsx'), /<IconButton name="check" size=\{28\}/)
})

test('retained background scenes cannot intercept system back, including nested inactive hosts', () => {
  const h = harness()
  let count = 0
  const renderBack = () => h.render(() => h.api.useSettingsBack(() => { count++ }))
  renderBack()
  h.setSceneActive(false); renderBack()
  assert.equal(h.back(), false)
  assert.equal(count, 0)
  const tree = h.api.SettingsSubpage({ pages: ['server', 'auth'], style: {}, children: page => page })
  for (const scene of tree.props.children) {
    assert.equal(scene.props.pointerEvents, 'none')
    assert.equal(scene.props.children.props.value, false, 'inactive ancestor propagates through nested hosts')
  }
  h.setSceneActive(true); renderBack()
  assert.equal(h.back(), true)
  assert.equal(count, 1)
  for (const file of ['src/screens/Login/ServerStep.tsx', 'src/screens/Login/AuthFlow.tsx', 'src/screens/SyncLogin/index.tsx']) {
    assert.match(read(file), /if \(!pageActive\) return false/, file)
  }
  h.unmount()
})
