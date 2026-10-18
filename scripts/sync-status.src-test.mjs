/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const load = (file, deps = {}, globals = {}) => {
  const js = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports, ...Object.values(globals))
  return module.exports
}
const constants = load('src/plugins/sync/constants.ts')
const model = load('src/utils/syncStatus.ts', { '../plugins/sync/constants': constants })
const serverCheck = load('src/utils/serverCheck.ts')
const errors = load('src/plugins/sync/client/userErrors.ts')
const zh = JSON.parse(readFileSync(new URL('../src/lang/zh-cn.json', import.meta.url), 'utf8'))
const translate = (key, args = {}) => zh[key]?.replace(/{{(\w+)}}/g, (_, name) => args[name]) ?? key
const map = (status, overrides = {}) => model.mapSyncStatus({ enabled: true, mode: 'lux', status: { status: false, message: '', ...status }, now: 1000, ...overrides })

test('error mapping table: every message, LuxRequestError code/status and socket close yields its localized state', () => {
  for (const entry of model.SYNC_ERROR_MAPPING) {
    const expected = entry.kind === 'expired' ? '登录已失效' : entry.kind === 'incompatible' ? '版本不兼容' : '连不上服务器'
    for (const message of entry.messages) {
      const value = map({ message }, { mode: 'lx' })
      assert.equal(value.kind, entry.kind, message)
      assert.equal(translate(value.titleKey), expected)
    }
    for (const code of entry.codes) {
      const value = map({ error: new errors.LuxRequestError('failure', 0, code) })
      assert.equal(value.kind, entry.kind, code)
      assert.equal(translate(value.titleKey), expected)
    }
    for (const status of entry.statuses) {
      const value = map({ error: new errors.LuxRequestError('failure', status) })
      assert.equal(value.kind, entry.kind, `${status}`)
      assert.equal(translate(value.titleKey), expected)
    }
    for (const closeCode of entry.closes) assert.equal(map({ closeCode }).kind, entry.kind, `${closeCode}`)
  }
  for (const message of [constants.SYNC_CODE.authFailed, constants.SYNC_CODE.missingAuthCode]) assert.equal(map({ message }).kind, 'expired')
  for (const status of [403, 429, 500, 503]) assert.equal(map({ error: new errors.LuxRequestError('HTTP failure', status) }).kind, 'unreachable')
  for (const message of ['Network request failed', 'failed', 'Connect timeout, try reconnect...', constants.SYNC_CODE.connecting, 'Wait syncing...']) assert.equal(map({ message }).kind, 'unreachable')
})

test('serverCheck compatibility and actual version payload are retained; local/disabled/disconnected stay neutral', () => {
  const check = serverCheck.serverCheckReducer({ ...serverCheck.initialServerCheck, status: 'checking', requestId: 3 }, {
    type: 'result',
    requestId: 3,
    clientVersion: '1.0',
    latency: 20,
    info: { name: 'NAS', version: '1.9.0', minClientVersion: '2.1', registration: { enabled: false, inviteOnly: false } },
  })
  const value = map({}, { check })
  assert.equal(value.kind, 'incompatible')
  const text = model.syncStatusText(value, { name: 'June', host: 'https://lux.june-nas.cn', relative: '', unknown: '未知' })
  assert.equal(translate(text.detailKey, { version: text.version, minimum: text.minimum }), '服务器 1.9.0 < 需要 2.1')
  assert.equal(map({ status: true }, { enabled: false }), null)
  assert.equal(map({ message: 'failure' }, { local: true }), null)
  assert.equal(map({ closeCode: 1000 }), null)
  assert.equal(map({}), null)
  assert.equal(map({ message: constants.SYNC_CODE.luxSessionExpired }, { enabled: false }).kind, 'expired')
  assert.equal(map({ status: true, lastSyncedAt: 500 }).kind, 'synced')
})

test('countdown uses the existing backoff deadline, rounds up, caps at zero and never invents a retry', () => {
  assert.deepEqual([1, 2, 3, 4, 10, 18, 100].map(model.retryDelayMs), [2000, 5000, 5000, 8000, 17000, 29000, 30000])
  assert.deepEqual([0, 1, 999, 1000, 1999, 2000, 3000].map(now => model.retrySeconds(2000, now)), [2, 2, 2, 1, 1, 0, 0])
  assert.equal(model.retrySeconds(undefined, 0), null)
  assert.equal(map({ message: 'failure', attempts: 3, retryAt: 31000 }).seconds, 30)
  assert.equal(translate('sync_state_attempts', { count: 3, seconds: 30 }), '已尝试 3 次 · 下次 30 秒后')
  assert.equal(map({ message: 'failure' }).seconds, null)
})

const jsx = (type, props) => ({ type, props })
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]
const settle = async() => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const hookHarness = () => {
  const slots = []; let cursor = 0; let effects = []
  const react = {
    memo: value => value,
    useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef: value => { const i = cursor++; return slots[i] ??= { current: value } },
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useEffect: (fn, deps) => { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) { effects.push(fn); slots[i] = deps } },
  }
  return { react, render(Component, props = {}) { cursor = 0; const tree = Component(props); const pending = effects; effects = []; pending.forEach(fn => fn()); return tree } }
}
const magazine = Object.fromEntries(['BackButton', 'PrimaryButton', 'SecondaryButton', 'DOCK_BASE_HEIGHT', 'EmptyState', 'Hairline', 'IconButton', 'MagDialog', 'MagTopBar', 'OptionRow', 'SectionHeader', 'SettingRow', 'UnderlineInput'].map(key => [key, key]))
magazine.DOCK_BASE_HEIGHT = 122
const commonDeps = h => ({
  react: h.react,
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', Modal: 'Modal', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', BackHandler: { addEventListener: () => ({ remove() {} }) } },
  '@/components/common/Text': { default: 'Text' },
  '@/components/common/StatusBar': { default: 'StatusBar' },
  '@/components/magazine': magazine,
  '@/lang': { useI18n: () => translate },
  '@/theme/LuxTheme': { sharedLuxStyles: () => () => ({}), useLuxTheme: () => ({ colors: {}, id: 'lime' }) },
  '@/theme/magazineRoles': { magazineRoles: () => ({ iconWrap: {} }) },
  '@/store/common/hook': { useStatusbarHeight: () => 0, useNavActiveId: () => 'nav_setting' },
  '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0 },
  '@/utils/tools': { createStyle: value => value, clipboardWriteText() {} },
  '@/utils/syncStatus': model,
  '@/utils/accountPage': load('src/utils/accountPage.ts'),
})
const settingsHarness = (status = { status: true, message: '', lastSyncedAt: 1000 }) => {
  const h = hookHarness(); const events = []; const deps = commonDeps(h)
  Object.assign(deps['react-native'], {
    Animated: { View: 'AnimatedView', Value: class { interpolate() {} setValue() {} }, timing: () => ({ start() {} }) },
    Dimensions: { get: () => ({ width: 390 }) },
    Easing: { out: x => x, cubic() {}, bezier() {} },
    StyleSheet: { absoluteFillObject: {} },
  })
  const noop = () => {}; const asyncNoop = async() => {}
  Object.assign(deps, {
    '@/screens/SyncStatus': { default: 'SyncStatusPage', SyncStatusRow: 'SyncStatusRow' },
    '@/screens/Login/ServerStep': { default: 'ServerStep' },
    '@/plugins/sync/client/client': { reconnectNow: () => { events.push(['retry']); return true } },
    '@/utils/enterLocalSpace': { enterLocalSpace: async value => { events.push(['local', value]) } },
    '@/plugins/sync/client/sessionExpired': { showSessionExpiredDialog: asyncNoop, expiredAccountUsername: () => 'june' },
    '@/utils/accountDataDialogs': { showLogoutOptions: asyncNoop },
    '@/screens/Account/AccountPage': { default: 'AccountPage' },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/common/Image': { default: 'Image' },
    '@/utils/syncLogout': {},
    '@/store/sync/hook': { useStatus: () => status },
    '@/plugins/sync/constants': constants,
    '@/core/sync': {},
    '@/utils': {},
    '@/utils/hooks/useBackHandler': { useBackHandler: noop },
    '@/utils/hooks': { useSystemGestureInsetBottom: () => 0 },
    '@/config/constant': { APP_LAYER_INDEX: { controls: 1 } },
    '@/screens/Home/Views/Setting/settings/Basic/Source': { default: 'Source' },
    '@/utils/musicSdk/api-source-info': { default: [] },
    '@/store/userApi': { useUserApiList: () => [], state: { list: [] } },
    '@/core/userApi': {},
    '@/store/setting/state': { default: {} },
    '@/utils/data': {
      DEFAULT_USER_NAME: 'June',
      DEFAULT_USER_AVATAR: 'avatar',
      getUserAvatar: async() => null,
      getUserName: async() => 'June',
      getUserSignature: async() => '',
      getSyncHost: async() => 'https://server',
      reloadSyncHostFromStorage: async() => 'https://server',
      getSyncMode: async() => 'lux',
      findLuxAuthForHost: async() => ({ user: { username: 'june' } }),
      setSyncHost: async host => { events.push(['saveHost', host]) },
      addSyncHostHistory: asyncNoop,
      setSyncMode: async mode => { events.push(['mode', mode]) },
    },
    '@/utils/syncLoginPrefill': { loadSyncLoginFormSnapshot: async() => ({ host: 'https://server', luxUsername: 'june' }) },
    '@/plugins/sync/data': { getSyncHostHistory: async() => ['https://server'] },
    '@/plugins/sync/client/credentials': {},
    '@/plugins/sync/client/userErrors': {},
    '@/plugins/sync': { connectLuxServer: asyncNoop },
    '@/store/setting/hook': { useSettingValue: key => key === 'sync.enable' },
    '@/core/common': { updateSetting: noop, setNavActiveId: value => { events.push(['nav', value]) } },
    '@/core/apiSource': {},
    '@/store/version/hook': { useVersionInfo: () => ({}), useVersionDownloadProgressUpdated: () => ({}) },
    '@/core/version': {},
    '@/store/version/state': {},
    '@/core/together/debugPanelPreference': { getTogetherDebugPanelEnabled: () => false, isTogetherDebugPanelBuild: () => false, loadTogetherDebugPanelPreference: asyncNoop, subscribeTogetherDebugPanel: noop },
    '@/core/together/debugTelemetry': {},
    '@/utils/releaseChannel': { resolveChannel: () => 'dev' },
    '@/navigation': { navigations: { pushSyncLoginScreen: async props => { events.push(['login', props]) } } },
    './ResourceCacheSection': { useResourceCache: () => ({}) },
    './VersionChangelogDetail': { default: 'VersionChangelogDetail' },
    '@/components/common/ChoosePath': { default: 'ChoosePath' },
    '@/utils/playHistory/backupIO': {},
    '@/theme/magazineType': { magType: new Proxy({}, { get: () => ({ size: 12 }) }) },
    '@/theme/luxTokens': { LUX_THEME_IDS: [], luxThemeRegistry: {} },
    '@/utils/playHistory/statsPageStyle': {},
    '@/components/stats/useListeningStatsModel': { useStatsPageStylePreference: () => ({}) },
    '@/screens/AdminConsole': { AdminConsoleLayer: 'AdminConsoleLayer' },
  })
  const screen = load('src/screens/Home/Vertical/Tabs/SettingsTab.tsx', deps, { setInterval: () => 1, clearInterval() {} }).default
  let tree
  return {
    events,
    render() {
      const previous = global.app_event
      global.app_event = { on() {}, off() {} }
      try { tree = h.render(screen); return tree } finally { global.app_event = previous }
    },
    find(type, predicate = () => true) { return nodes(tree).find(node => node.type === type && predicate(node.props))?.props },
  }
}

test('actual Settings row routes each current state to the specified page/settings', async() => {
  for (const [status, target] of [[{ status: true, message: '' }, 'sync'], [{ status: false, message: 'offline' }, 'unreachable'], [{ status: false, message: constants.SYNC_CODE.lowServiceVersion }, 'incompatible'], [{ status: false, message: constants.SYNC_CODE.luxSessionExpired }, 'expired']]) {
    const h = settingsHarness(status)
    h.render(); await settle(); h.render()
    const row = h.find('SyncStatusRow')
    assert.equal(row.model.route, target)
    row.onPress(); h.render(); await settle(); h.render()
    if (target === 'sync') assert.ok(h.find('OptionRow', p => p.label === zh.setting_sync_format_lux))
    else assert.equal(h.find('SyncStatusPage').model.kind, target)
  }
})

test('merged address/format entry opens editable current host and keeps both protocol choices', async() => {
  const h = settingsHarness()
  h.render(); await settle(); h.render()
  assert.equal(h.find('SettingRow', p => p.title === zh.setting_sync_format), undefined)
  h.find('SettingRow', p => p.title === '同步地址与格式').onPress()
  h.render(); await settle(); h.render()
  assert.ok(h.find('OptionRow', p => p.label === zh.setting_sync_format_lx))
  assert.ok(h.find('OptionRow', p => p.label === zh.setting_sync_format_lux))
  const edit = nodes(h.render()).find(node => node.type === 'TouchableOpacity' && nodes(node).some(child => child.type === 'Text' && child.props.children === zh.setting_fill_sync_address))
  edit.props.onPress(); h.render()
  const dialog = h.find('MagDialog', p => p.title === zh.setting_sync_host_label)
  assert.equal(dialog.visible, true)
  assert.equal(dialog.children.props.value, 'https://server')
  dialog.children.props.onChangeText('https://edited'); h.render()
  h.find('MagDialog', p => p.title === zh.setting_sync_host_label).onConfirm(); await settle()
  assert.ok(h.events.some(([name, value]) => name === 'saveHost' && value === 'https://edited'))
  h.find('OptionRow', p => p.label === zh.setting_sync_format_lx).onPress(); await settle()
  assert.ok(h.events.some(([name, value]) => name === 'mode' && value === 'lx'))
})

test('unreachable actions use immediate reconnect, prefilled ServerStep and Home without pausing sync', async() => {
  const h = settingsHarness({ status: false, message: 'offline', attempts: 3, retryAt: Date.now() + 30000 })
  h.render(); await settle(); h.render()
  h.find('SyncStatusRow').onPress(); h.render()
  h.find('SyncStatusPage').onRetry()
  assert.deepEqual(h.events, [['retry']])
  h.find('SyncStatusPage').onCheckAddress(); h.render()
  assert.equal(h.find('ServerStep').initialHost, 'https://server')
  h.find('ServerStep').onBack(); h.render()
  h.find('SyncStatusPage').onHome()
  assert.deepEqual(h.events.at(-1), ['nav', 'nav_search'])
})

test('preview pages expose exact copy and button callbacks, including version copy and local user', () => {
  const h = hookHarness(); const deps = commonDeps(h); const copied = []
  deps['@/utils/tools'].clipboardWriteText = value => copied.push(value)
  const Page = load('src/screens/SyncStatus/index.tsx', deps).default
  const events = []; const actions = Object.fromEntries(['onBack', 'onHome', 'onRetry', 'onCheckAddress', 'onLogin', 'onLocal'].map(key => [key, () => events.push(key)]))
  const render = value => h.render(Page, { model: value, host: 'https://lux.june-nas.cn', username: 'june', ...actions })
  let tree = render(map({ message: 'offline', attempts: 3, retryAt: 31000 }))
  assert.ok(nodes(tree).some(node => node.props?.children === zh.sync_state_unreachable_body))
  for (const label of ['重试', '检查地址', '先离线使用']) nodes(tree).find(node => node.props?.label === label).props.onPress()
  assert.deepEqual(events, ['onRetry', 'onCheckAddress', 'onHome'])
  tree = render(map({ error: { message: constants.SYNC_CODE.lowServiceVersion, serverVersion: '1.9.0', requiredVersion: '2.1' } }))
  nodes(tree).find(node => node.props?.label === '复制提示发给管理员').props.onPress()
  assert.deepEqual(copied, ['服务器版本 1.9.0，这个 App 需要 2.1 或更高。\n请管理员升级服务器，或暂时使用旧版 App。'])
  tree = render(map({ message: constants.SYNC_CODE.luxSessionExpired }))
  for (const label of ['重新登录', '切换到本地用户']) nodes(tree).find(node => node.props?.label === label).props.onPress()
  assert.deepEqual(events.slice(-2), ['onLogin', 'onLocal'])
})

test('synced row shows one action and exact name/host/relative text; expired relogin uses cached username', async() => {
  const hooks = hookHarness()
  const Row = load('src/screens/SyncStatus/index.tsx', commonDeps(hooks)).SyncStatusRow
  let taps = 0
  const tree = hooks.render(Row, { model: map({ status: true, lastSyncedAt: 1000 }), name: 'June', host: 'https://lux.june-nas.cn', now: 61000, onPress: () => { taps++ } })
  assert.equal(nodes(tree).filter(node => node.type === 'TouchableOpacity').length, 1)
  assert.ok(nodes(tree).some(node => node.props?.children === 'June · lux.june-nas.cn · 1 分钟前'))
  nodes(tree).find(node => node.type === 'TouchableOpacity').props.onPress()
  assert.equal(taps, 1)
  const h = settingsHarness({ status: false, message: constants.SYNC_CODE.luxSessionExpired })
  h.render(); await settle(); h.render()
  h.find('SyncStatusRow').onPress(); h.render()
  assert.equal(h.find('SyncStatusPage').username, 'june')
  h.find('SyncStatusPage').onLogin(); await settle(); h.render()
  assert.equal(h.find('SyncStatusPage'), undefined)
  assert.deepEqual(h.events.at(-1), ['login', { onboarding: false, initialHost: 'https://server', initialUsername: 'june' }])
})
