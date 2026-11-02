/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import ts from 'typescript'
import { settingsTransitionMock } from './settings-transition-mock.mjs'
import { load } from './secure-credentials-test-support.mjs'
const gate = load('src/utils/loginGate.ts')
const server = load('src/utils/serverCheck.ts')
const lux = { id: 'lux-a', provider: 'lux', server: { serverId: 'nas', url: 'https://nas' }, account: { userId: 'a', username: 'alice', displayName: 'Alice' }, spaceId: 'lux:nas:a', credentialRef: { kind: 'luxRefresh', id: '["nas","a"]' }, avatar: { initial: 'A' }, lastUsedAt: 1000 }
const lx = { id: '["lx","nas","https://nas","device"]', provider: 'lx', server: lux.server, spaceId: 'local', credentialRef: { kind: 'syncKey', id: '["nas","lx",""]' }, avatar: { initial: 'L' } }
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const settle = async() => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const nodes = root => !root || typeof root !== 'object' ? [] : [root, ...[root.props?.children].flat(Infinity).flatMap(nodes)]
function harness({ serverInfo = { name: 'Lux', version: '1.0', minClientVersion: null, registration: { enabled: true, inviteOnly: true } }, recents = [], available = true, previous = null, intent = { reason: 'boot', returnPolicy: 'none' } } = {}) {
  let values = []; let cursor = 0; let effects = []; let hardware; let keyboard = false
  const events = []
  const hooks = {
    useState(initial) { const id = cursor++; if (!(id in values)) values[id] = typeof initial === 'function' ? initial() : initial; return [values[id], next => { values[id] = typeof next === 'function' ? next(values[id]) : next }] },
    useRef(value) { const [ref] = hooks.useState(() => ({ current: value })); return ref },
    useCallback(fn, deps) { const [memo] = hooks.useState(() => ({ fn, deps })); if (!deps.every((value, i) => Object.is(value, memo.deps[i]))) { memo.fn = fn; memo.deps = deps } return memo.fn },
    useEffect(fn, deps) { const [memo] = hooks.useState(() => ({ deps: null })); if (!memo.deps || !deps || !deps.every((value, i) => Object.is(value, memo.deps[i]))) { memo.deps = deps; effects.push(fn) } },
  }
  const jsx = (type, props) => type?.name === 'SettingsSubpage' ? type(props) : ({ type, props })
  const session = { pending: { previous, intent }, selectTarget: async target => { events.push(['target', target]) } }
  const translate = (key, params) => key + (params?.name ? `:${params.name}` : '')
  const deps = {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Keyboard: { isVisible: () => keyboard, dismiss: () => { keyboard = false; events.push(['dismiss']) } }, KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' }, TouchableOpacity: 'TouchableOpacity', View: 'View' },
    '@/components/common/SettingsPage': settingsTransitionMock(hooks),
    '@/utils/hooks/useBackHandler': { useBackHandler: handler => { hardware = handler } },
    '@/components/common/FocusVisibleScrollView': { FocusVisibleScrollView: 'ScrollView', FocusVisibleAction: 'Action' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/magazine': Object.fromEntries(['BackButton', 'PrimaryButton', 'SecondaryButton', 'TextButton', 'TextTabs', 'UnderlineInput'].map(name => [name, name])),
    '@/core/common': { setLanguage() {} },
    '@/theme/LuxTheme': { sharedLuxStyles: fn => fn, useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/store/common/hook': { useStatusbarHeight: () => 24 },
    '@/lang': { useI18n: () => translate },
    '@/utils/tools': { createStyle: value => value, confirmDialog: async props => { events.push(['confirm', props]); return true } },
    '@/core/appSession': { appSession: session, subscribeAppSessionAuthentication: () => () => {}, getLoginIntent: () => intent, connectAppSession: async(...args) => { events.push(['connect', ...args]) }, enterLocalAppSession: async label => { events.push(['local', label]) }, cancelAppSessionSwitch: async() => { events.push(['cancel']) }, cancelAppSessionAuthentication: async() => { events.push(['cancelAuth']) }, enterOfflineAppSession: async() => { events.push(['offline']) } },
    '@/utils/data': { getLoginRecents: async() => ({ recents }), getLoginCredentialAvailability: async() => available ? 'available' : 'missing', removeRecentLogin: async id => { events.push(['remove', id]); recents = recents.filter(item => item.id !== id) }, getSyncHostHistory: async() => ['https://old'], removeSyncHostHistory: async id => { events.push(['removeHistory', id]) } },
    '@/utils/syncLoginCredentialPersistence': { clearSavedSyncLoginCredentialsForMode: async mode => { events.push(['clear', mode]) } },
    '@/utils/syncLoginPrefill': { loadSyncLoginFormSnapshot: async() => ({ host: 'https://old', luxUsername: 'old' }), rememberSyncLoginForm: async form => { events.push(['remember', form]) } },
    '@/utils/loginGate': gate,
    '@/utils/serverCheck': server,
    '../Login/AuthFlow': { default: 'AuthFlow' },
  }
  const js = ts.transpileModule(read('src/screens/SyncLogin/LoginGate.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,fetch){${js}\n})`).runInThisContext()(name => { assert.ok(name in deps, name); return deps[name] }, module, module.exports, async url => { events.push(['probe', url]); return { ok: true, json: async() => serverInfo } })
  let tree
  return {
    events,
    render(Component = module.exports.default, props = { intent }) { cursor = 0; tree = Component(props); const pending = effects; effects = []; pending.forEach(fn => fn()); return tree },
    find(name, label) { return nodes(tree).find(node => (typeof node.type === 'function' ? node.type.name : node.type) === name && (!label || node.props.label?.startsWith(label))) },
    reset() { values = []; effects = [] },
    keyboard(value) { keyboard = value },
    back() { return hardware() },
  }
}

test('L1 empty recent state removes the whole recent section and exposes all three ways', async() => {
  const h = harness(); h.render(); await settle(); h.render()
  assert.equal(h.find('RecentRow'), undefined)
  for (const provider of ['lux', 'lx', 'local']) {
    const ways = nodes(h.render()).filter(node => node.type?.name === 'GateWay')
    const way = ways[['lux', 'lx', 'local'].indexOf(provider)]
    way.props.onPress(); h.render()
    if (provider === 'local') assert.ok(h.find('LocalDetails'))
    else assert.equal(h.find('GateForm').props.provider, provider)
    h.find('GateScene').props.onBack(); h.render()
  }
  assert.deepEqual(h.events, [], 'choosing a method never probes or commits identity')
})
for (const available of [true, false]) {
  test(`L1 recent account button ${available ? 'continues through coordinator' : 'opens a prefilled reauthentication form'}`, async() => {
    const h = harness({ recents: [lux], available }); h.render(); await settle(); h.render()
    assert.equal(h.find('RecentRow').props.name, 'Alice')
    h.find('PrimaryButton', available ? 'continue_account' : 'login_gate_reauth_account').props.onPress(); await settle(); h.render()
    if (available) { assert.equal(h.events.at(-1)[0], 'connect'); assert.equal(h.events[0][1].targetIdentity.account.userId, 'a') } else { assert.equal(h.find('GateForm').props.selected.account.username, 'alice'); assert.deepEqual(h.events, []) }
  })
}
test('local use requires confirmation and performs no server request; explicit cancel and offline keep original identity', async() => {
  const h = harness({ previous: gate.recentIdentity(lux), intent: { reason: 'switch', returnPolicy: 'restorePrevious', targetProvider: 'local' } }); h.render(); await settle(); h.render()
  assert.deepEqual(h.events, [])
  h.find('PrimaryButton', 'continue_local_no_sync').props.onPress(); await settle()
  assert.deepEqual(h.events.map(row => row[0]), ['target', 'local'])
  h.render(); h.find('GateScene').props.onBack(); h.render(); h.find('SecondaryButton', 'cancel_switch_to_account').props.onPress(); await settle()
  assert.equal(h.events.at(-1)[0], 'cancel')
  const offline = harness({ previous: gate.recentIdentity(lux), intent: { reason: 'reauth', targetProvider: 'lux', returnPolicy: 'none' } }); offline.render(); await settle(); offline.render()
  offline.find('SecondaryButton', 'view_account_offline').props.onPress(); await settle()
  assert.equal(offline.events.at(-1)[0], 'offline')
})
test('recent management removal is metadata only; provider credential clearing requires explicit scope confirmation', async() => {
  const h = harness({ recents: [lux, lx] }); h.render(); await settle(); h.render()
  h.find('TextButton', 'login_gate_manage').props.onPress(); h.render()
  h.find('RecentRow').props.action.props.onPress(); await settle(); h.render()
  assert.deepEqual(h.events, [['remove', 'lux-a']])
  h.find('TextButton', 'login_gate_clear_lx').props.onPress(); await settle()
  assert.equal(h.events.at(-2)[0], 'confirm'); assert.deepEqual(h.events.at(-1), ['clear', 'lx'])
})
test('null host never borrows a previous server, protocol drafts stay isolated and recent identity remains exact', () => {
  const snapshot = { host: 'https://old', luxUsername: 'old' }
  assert.deepEqual(gate.gateDraft('lux', { targetProvider: 'lux', initialHost: null }, snapshot), { host: '', username: '' })
  assert.deepEqual(gate.gateDraft('lux', { targetProvider: 'lx', initialHost: 'https://lx' }, snapshot), { host: 'https://old', username: '' })
  assert.equal(gate.recentIdentity(lx).deviceId, 'device')
  for (const provider of ['lux', 'lx', 'local']) assert.equal(gate.gateInitialPage({ targetProvider: provider }), provider)
  assert.equal(gate.gateInitialPage({ reason: 'add', targetProvider: 'lux' }), 'main')
})
test('Gate uses one back callback for visible/system back, opaque resize layout, shared transition and focus actions', () => {
  const source = read('src/screens/SyncLogin/LoginGate.tsx')
  assert.match(source, /useBackHandler\(\(\) => \{ if \(!active\) return false; onBack\(\)/)
  assert.match(source, /BackButton onPress=\{onBack\}/)
  assert.match(source, /Keyboard\.isVisible\(\).*Keyboard\.dismiss\(\)/)
  assert.match(source, /useSettingsSubpage<GatePage>/)
  assert.match(source, /FocusVisibleAction/)
  assert.doesNotMatch(source, /Animated\.timing|keyboardHeight|dockHeight|commitSync/)
  assert.match(read('src/screens/Login/AuthFlow.tsx'), /Keyboard\.isVisible\(\)/)
})

// Every reviewed entry keeps its current non-identity capability; changing identity enters
// requestLogin (directly or via PR2's documented adapter), internal choices stay behind that gate.
const entries = [
  ['E01', 'src/screens/Login/index.tsx', /requestLogin\(\{ reason: 'boot'.*initialHost: null/],
  ['E02', 'src/screens/Login/index.tsx', /completeOnboarding\(false\)/],
  ['E03', 'src/navigation/navigation.ts', /requestLogin\(\{ reason: props\?\.onboarding \? 'boot'/],
  ['E04', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /setProfileDetailVisible\(true\)/],
  ['E05', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openSettingsProfileDetail/],
  ['E06', 'src/screens/Account/AccountPage.tsx', /requestLogin\(\{ reason: 'switch', source: 'E06-account'/],
  ['E07', 'src/utils/accountSpaceSwitch.ts', /requestLogin\(\{.*targetIdentity: session\?\.serverId/],
  ['E08', 'src/screens/Account/AccountSpaces.tsx', /requestLogin\(\{ reason: 'add'.*initialHost: null/],
  ['E09', 'src/utils/syncLogout.ts', /requestLogin/],
  ['E10', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /SyncConnectionInfo/],
  ['E11', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openGate\('E11-address-format'\)/],
  ['E12', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openGate\('E12-format', value === 'lux' \? 'lux' : 'lx', null\)/],
  ['E13', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openGate\('E13-address', syncMode, null\)/],
  ['E14', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openGate\('E14-history', syncMode, host\)/],
  ['E15', 'src/screens/SyncLogin/LoginGate.tsx', /removeSyncHostHistory\(index\)/],
  ['E16', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /Automatic LX failures stay in status/],
  ['E17', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openGate\('E17-check-address', syncMode, syncHost\)/],
  ['E18', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openGate\('E18-reauth', syncMode, syncHost, reloginUsername/],
  ['E19', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx', /openGate\('E19-local', 'local'\)/],
  ['E20', 'src/plugins/sync/client/sessionExpired.ts', /requestLogin\(\{ reason: 'reauth'.*targetProvider: 'lux'.*initialHost: account.host/],
  ['E21', 'src/screens/Home/Vertical/Tabs/PlaylistTab.tsx', /pushSyncLoginScreen/],
  ['E22', 'src/screens/SyncLogin/LoginGate.tsx', /GateTabs provider=\{provider\}/],
  ['E23', 'src/screens/SyncLogin/LoginGate.tsx', /await enterLocalAppSession/],
  ['E24', 'src/screens/SyncLogin/LoginGate.tsx', /else if \(page !== 'main'\) setPage/],
  ['E25', 'src/screens/SyncLogin/LoginGate.tsx', /initialPage=\{scene\}/],
  ['E26', 'src/screens/SyncLogin/LoginGate.tsx', /await clearSavedSyncLoginCredentialsForMode\(provider\)/],
]
for (const [id, path, contract] of entries) test(`${id} entry contract and preserved destination`, () => { assert.match(read(path), contract) })

test('IME dismissal precedes form navigation for both hardware and visible back', async() => {
  const h = harness({ intent: { reason: 'switch', targetProvider: 'lx', returnPolicy: 'none' } })
  h.render(); await settle(); h.render()
  const scene = h.find('GateScene')
  h.render(scene.type, scene.props)
  h.keyboard(true); assert.equal(h.back(), true)
  assert.deepEqual(h.events, [['dismiss']])
  h.render(); assert.ok(h.find('GateForm'))
  h.find('GateScene').props.onBack(); h.render()
  assert.equal(h.find('GateForm'), undefined)
})

for (const provider of ['lux', 'lx']) {
  test(`${provider} form submits through coordinator and keeps secrets out of remembered draft`, async() => {
    const h = harness({ intent: { targetProvider: provider }, recents: [lux] })
    h.render(); await settle(); h.render()
    const form = h.find('GateForm'); h.reset()
    const props = { ...form.props, selected: provider === 'lux' ? lux : lx, run: async fn => fn() }
    h.render(form.type, props); await settle()
    await new Promise(resolve => setTimeout(resolve, 550))
    const inputs = nodes(h.render(form.type, props)).filter(node => node.type === 'UnderlineInput')
    inputs.at(-1).props.onChangeText('secret-in-memory')
    h.render(form.type, props)
    h.find('PrimaryButton').props.onPress(); await settle()
    assert.equal(h.events.filter(([name]) => name === 'connect').length, 1)
    assert.equal(h.events.find(([name]) => name === 'connect')[1], provider)
    const remembered = h.events.find(([name]) => name === 'remember')[1]
    assert.doesNotMatch(JSON.stringify(remembered), /secret-in-memory/)
    assert.equal(h.events.some(([name]) => name === 'probe'), provider === 'lux', 'LX never probes the Lux protocol')
  })
}

test('malformed Lux server protocol prevents credential submission', async() => {
  const h = harness({ intent: { targetProvider: 'lux' }, serverInfo: { hello: 'LX' } })
  h.render(); await settle(); h.render()
  const form = h.find('GateForm'); h.reset()
  const failures = []
  const props = { ...form.props, selected: lux, run: async fn => { try { await fn() } catch (error) { failures.push(error.message) } } }
  h.render(form.type, props); await settle(); await new Promise(resolve => setTimeout(resolve, 550)); h.render(form.type, props)
  h.find('PrimaryButton').props.onPress(); await settle()
  assert.ok(failures.includes('Invalid server-info'))
  assert.equal(h.events.some(([name]) => name === 'connect'), false)
})
