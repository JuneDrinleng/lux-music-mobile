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
  const reviewedTags = ['AccountPage', 'AdminConsoleLayer', 'AiTokenStatusPage', 'BackButton', 'ChoosePath', 'EmptyState', 'Hairline', 'IconButton', 'Image', 'MagDialog', 'MagTopBar', 'MdiIcon', 'OptionRow', 'ResourceCacheDetail', 'Rule', 'ScrollView', 'SectionHeader', 'ServerStep', 'SettingRow', 'SettingsPage', 'Source', 'SyncLogin', 'SyncStatusPage', 'SyncStatusRow', 'Text', 'TouchableOpacity', 'UnderlineInput', 'VersionChangelogDetail', 'View']
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
  const hero = nodes.find(node => tag(node) === 'TouchableOpacity' && attribute(node, 'style') === '{styles.profileHeroRow}')
  assert.ok(hero)
  assert.equal(attribute(hero, 'onPress'), '{handleOpenProfileDetail}')
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
  const controls = new Set(['SyncStatusRow', 'Source', 'AdminConsoleLayer'])
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
  const animations = []; let hardware; let home = true
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const react = {
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
  const jsx = (type, props) => ({ type, props })
  const native = {
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
  return {
    api,
    animations,
    render(fn) { cursor = 0; const value = fn(); const pending = effects; effects = []; pending.forEach(effect => effect()); return value },
    back: () => hardware(),
    setHome: value => { home = value },
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
    tree = render(); assert.equal(tree.props.children, 'AI content'); assert.equal(closeCount, 0)
    close.finish(); assert.equal(closeCount, 1); assert.equal(render(), null)
    h.unmount()
  }
})

test('external close retains old page; reopen cancels stale completion; unmount cancels back callbacks', () => {
  const h = harness(); let visible = true; let label = 'cache'; let back; let closed = 0
  const render = () => h.render(() => h.api.SettingsPage({ visible, onBack: () => { closed++ }, children: callback => { back = callback; return label } }))
  render(); h.animations.at(-1).finish()
  visible = false; label = 'empty'
  assert.equal(render().props.children, 'cache')
  const staleClose = h.animations.at(-1)
  visible = true; label = 'themes'; render()
  staleClose.finish(); assert.equal(render().props.children, 'themes')
  back(); const pending = h.animations.at(-1)
  h.unmount(); pending.finish(); assert.equal(closed, 0)
})

test('nested Settings routes slide forward, reverse before restoring parent, and keep root unchanged on no-op', () => {
  const h = harness()
  const render = () => h.render(() => h.api.useSettingsSubpage('account'))
  let page = render(); page.setPage('account'); assert.equal(h.animations.length, 0)
  page.setPage('devices'); page = render(); assert.equal(page.page, 'devices')
  const open = h.animations.at(-1); open.finish()
  page.setPage('account'); page = render(); assert.equal(page.page, 'devices')
  const close = h.animations.at(-1)
  assert.equal(close.config.duration, open.config.duration); assert.equal(close.config.easing, open.config.easing)
  close.finish(); page = render(); assert.equal(page.page, 'account')
  assert.equal(close.value.value, 1)
  h.unmount()
})
