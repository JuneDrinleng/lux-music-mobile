import { settingsTransitionMock } from './settings-transition-mock.mjs'
/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const load = (file, deps = {}) => {
  const js = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    if (name === '@/utils/sessionFence') return { isSessionCoordinatorEnabled: () => true, sessionRemoteWritesFrozen: () => false, sessionWritesFrozen: () => false, sessionGeneration: () => 0, acceptsSessionGeneration: () => true }
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const routing = load('src/utils/syncLoginRouting.ts')
const credentials = load('src/plugins/sync/client/credentials.ts')
const userErrors = load('src/plugins/sync/client/userErrors.ts')
const api = load('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': userErrors })
const jsx = (type, props) => ({ type, props })
const children = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(children)]

// Run the actual screen functions with stateful hooks and inspect their rendered callbacks.
const harness = (file, { mode = 'lux', savedHost = '', snapshotHost = savedHost, session = null, connectError } = {}) => {
  const slots = []
  let cursor = 0
  let effects = []
  let hardware
  const events = []
  const react = {
    memo: value => value,
    useState: value => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef: value => { const index = cursor++; return slots[index] ??= { current: value } },
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useEffect: (fn, deps) => {
      const index = cursor++
      const previous = slots[index]
      if (!previous || !deps || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() } })
      }
    },
  }
  const magazine = Object.fromEntries(['BackButton', 'PrimaryButton', 'SecondaryButton', 'TextButton', 'TextTabs', 'UnderlineInput', 'OptionRow'].map(name => [name, name]))
  const data = {
    getSyncMode: async() => mode,
    getPreferredSyncHost: async() => savedHost,
    getSyncHostHistory: async() => ['https://previous'],
    findLuxAuthForHost: async() => session,
    setSyncMode: async value => { events.push(['mode', value]) },
    setSyncHost: async value => { events.push(['host', value]) },
    addSyncHostHistory: async value => { events.push(['history', value]) },
    setSyncLoginCompleted: async() => {},
  }
  const deps = {
    '@/core/appSession': { getLoginIntent: () => null, cancelAppSessionSwitch: async() => { events.push(['home']) } },
    '@/components/common/SettingsPage': settingsTransitionMock(react),
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/common/FocusVisibleScrollView': { FocusVisibleScrollView: 'ScrollView', FocusVisibleAction: 'View' },
    'react-native': { Animated: { View: 'AnimatedView' }, StyleSheet: { absoluteFillObject: {} }, View: 'View', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' }, BackHandler: { addEventListener: (_, fn) => { hardware = fn; return { remove() { if (hardware === fn) hardware = null } } } } },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/common/LanguageSwitch': { default: 'LanguageSwitch' },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/magazine': magazine,
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: fn => fn },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/theme/magazineType': { PAGE_GUTTER: 22, magType: { eyebrow: {}, h2: {} } },
    '@/utils/tools': { createStyle: value => value, toast: value => { events.push(['toast', value]) } },
    '@/store/common/hook': { useStatusbarHeight: () => 0 },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0 },
    '@/lang': { useI18n: () => key => key },
    '@/utils/data': data,
    '@/utils/syncLoginRouting': routing,
    '@/utils/syncLoginPrefill': {
      syncHostCompareKey: value => value.replace(/\/+$/, '').toLowerCase(),
      loadSyncLoginFormSnapshot: async() => ({ host: snapshotHost, luxUsername: 'alice', luxPassword: '', lxAuthCode: '', hasSavedLuxSession: !!session }),
      rememberSyncLoginForm: async value => { events.push(['remember', value]) },
      syncLoginSavedSecretDisplayValue: value => value,
      syncLoginSavedSecretInputValue: value => value,
    },
    '@/utils/syncLoginCredentialPersistence': { clearSavedSyncLoginCredentialsForMode: async value => { events.push(['clear', value]) } },
    '@/plugins/sync/client/credentials': credentials,
    '@/plugins/sync/client/userErrors': userErrors,
    '@/plugins/sync/constants': { SYNC_CODE: { luxSessionExpired: 'expired' } },
    '@/plugins/sync': { connectLuxServer: async(...args) => { events.push(['connect', ...args]); if (connectError) throw connectError }, syncLuxProfileOnLogin: async() => {} },
    '@/plugins/sync/client/sessionExpired': { showSessionExpiredDialog: async host => { events.push(['expired-dialog', host]) } },
    '@/plugins/sync/client/auth': { requestJson: async() => ({}), luxAuthApi: {} },
    '@/utils/serverCheck': { parseServerInfo: () => ({ registration: { enabled: true } }), initialServerCheck: {}, createServerChecker: () => ({ dispose() {}, input(value) { events.push(['input', value]) } }) },
    '@/utils/luxAuthApi': api,
    '@/core/common': { updateSetting() {} },
    '@/utils/onboarding': { completeOnboarding: async() => { events.push(['onboarded']) } },
    '@/utils/enterLocalSpace': { enterLocalSpace: async() => { events.push(['local']) } },
    '@/navigation': { navigations: { pushLoginScreen: async() => { events.push(['onboarding']) }, pushHomeScreen: async() => { events.push(['home']) } } },
    '../Login/AuthFlow': { default: 'AuthFlow' },
    '../Login/ServerStep': { default: 'ServerStep' },
    './LocalAction': { default: 'LocalAction' },
    '../SyncLogin/LocalAction': { default: 'LocalAction' },
  }
  const screen = load(file, deps)
  let tree
  return {
    events,
    render(props = {}, Component = screen.default) {
      cursor = 0
      tree = Component(props)
      const pending = effects; effects = []; pending.forEach(effect => effect())
      return tree
    },
    find(type, label) { return children(tree).find(node => node.type === type && (!label || node.props.label === label))?.props },
    back() { assert.equal(hardware(), true) },
    Legacy: screen.LegacySyncLogin,
  }
}
const settle = async() => { for (let i = 0; i < 12; i++) await Promise.resolve() }
global.app_event = { on() {}, off() {} }
global.lx = {}
global.i18n ??= { t: key => key }

test('entry matrix: onboarding overrides LX, explicit hosts preserve saved LX mode', () => {
  for (const onboarding of [false, true]) {
    for (const mode of ['lx', 'lux']) {
      for (const initial of ['', 'https://explicit']) {
        assert.deepEqual(routing.resolveSyncLoginEntry(onboarding, mode, initial, 'https://saved'), {
          legacy: !onboarding && mode === 'lx', host: initial || (onboarding ? '' : 'https://saved'),
        })
        assert.equal(routing.syncLoginExitTarget(onboarding), onboarding ? 'onboarding' : 'home')
      }
    }
  }
})

test('Settings/Playlist: AuthFlow -> ServerStep -> Home; LX link opens LX and Lux tab returns', async() => {
  const h = harness('src/screens/SyncLogin/index.tsx', { savedHost: 'https://saved' })
  h.render(); await settle()
  assert.equal(h.render().type, 'AuthFlow')
  h.find('AuthFlow').onBack()
  h.render()
  assert.equal(h.find('ServerStep').showHistory, true)
  h.find('ServerStep').onBack()
  assert.deepEqual(h.events, [['home']])
  h.find('TextButton', 'sync_login_use_lx').onPress()
  const legacy = h.render()
  assert.equal(legacy.props.initialMode, 'lx')
  legacy.props.onLux()
  h.render()
  assert.ok(h.find('TextButton', 'sync_login_use_lx'))
})

test('onboarding has no LX/local/history entry and returns to onboarding only', () => {
  const h = harness('src/screens/SyncLogin/index.tsx')
  const props = { onboarding: true, initialHost: 'https://explicit' }
  h.render(props)
  h.find('AuthFlow').onBack()
  h.render(props)
  assert.equal(h.find('ServerStep').showHistory, false)
  assert.equal(h.find('TextButton', 'sync_login_use_lx'), undefined)
  assert.equal(h.find('LocalAction'), undefined)
  h.find('ServerStep').onBack()
  assert.deepEqual(h.events, [['onboarding']])
})

test('saved LX mode reaches legacy even with an explicit host', async() => {
  const h = harness('src/screens/SyncLogin/index.tsx', { mode: 'lx' })
  const props = { initialHost: 'https://explicit' }
  h.render(props); await settle()
  assert.equal(h.render(props).props.initialMode, 'lx')
})

test('ServerStep Android and visible back call the same exit callback; history selects address', async() => {
  const h = harness('src/screens/Login/ServerStep.tsx')
  let exits = 0
  const props = { onBack: () => { exits++ }, showHistory: true }
  h.render(props); await settle(); h.render(props)
  h.back()
  h.find('BackButton').onPress()
  assert.equal(exits, 2)
  h.find('TextButton', 'sync_login_host_history').onPress()
  h.render(props)
  h.find('OptionRow', 'https://previous').onPress()
  h.render(props)
  assert.equal(h.find('UnderlineInput').value, 'https://previous')
  assert.deepEqual(h.events, [['input', 'https://previous']])
})

test('AuthFlow Android back: register/forgot -> login -> server, matching visible back', async() => {
  const h = harness('src/screens/Login/AuthFlow.tsx')
  let exits = 0
  const props = { host: 'https://server', onboarding: false, onBack: () => { exits++ } }
  h.render(props); await settle(); h.render(props)
  h.find('TextButton', 'auth_register_link').onPress(); h.render(props)
  h.back(); h.render(props)
  assert.equal(exits, 0)
  assert.ok(h.find('TextButton', 'auth_forgot_link'))
  h.find('TextButton', 'auth_forgot_link').onPress(); h.render(props)
  h.find('BackButton').onPress(); h.render(props)
  assert.equal(exits, 0)
  h.back()
  assert.equal(exits, 1)
  h.find('BackButton').onPress()
  assert.equal(exits, 2)
})

test('legacy LX entry stays LX despite saved Lux mode; Lux tab hands back to new flow; Android exits', async() => {
  const h = harness('src/screens/SyncLogin/index.tsx')
  let lux = 0; let exits = 0
  const props = { initialMode: 'lx', onLux: () => { lux++ }, onBack: () => { exits++ } }
  h.render(props, h.Legacy); await settle(); h.render(props, h.Legacy)
  assert.equal(h.find('TextTabs').value, 'lx')
  h.find('TextTabs').onChange('lux')
  assert.equal(lux, 1)
  h.back()
  assert.equal(exits, 1)
})

test('Lux session prefill allows passwordless same-account reconnect, remembers form, and clears credentials', async() => {
  const session = { token: 'saved', user: { username: 'alice' } }
  const options = { savedHost: 'https://server', session }
  const props = { host: 'https://server', onboarding: false, onBack() {} }
  const h = harness('src/screens/Login/AuthFlow.tsx', options)
  h.render(props); await settle(); h.render(props)
  assert.equal(h.find('UnderlineInput').value, 'alice')
  assert.equal(h.find('PrimaryButton', 'auth_login').disabled, false)
  h.find('UnderlineInput').onChangeText('bob'); h.render(props)
  assert.equal(h.find('PrimaryButton', 'auth_login').disabled, true)
  h.find('UnderlineInput').onChangeText('alice'); h.render(props)
  h.find('PrimaryButton', 'auth_login').onPress(); await settle()
  assert.ok(h.events.some(event => event[0] === 'connect' && event[2] === 'alice' && event[3] === undefined))
  assert.ok(h.events.some(event => event[0] === 'remember'))
  assert.equal(h.events.some(event => event[0] === 'home'), false, 'coordinator owns Main replacement')
  h.render(props)
  h.find('TextButton', 'sync_login_clear_saved').onPress(); await settle(); h.render(props)
  assert.ok(h.events.some(event => event[0] === 'clear' && event[1] === 'lux'))
  assert.equal(h.find('UnderlineInput').value, '')
  assert.equal(h.find('TextButton', 'sync_login_clear_saved'), undefined)
})

test('credentials never prefill a different host; onboarding has no local-use button', async() => {
  const h = harness('src/screens/Login/AuthFlow.tsx', { savedHost: 'https://other' })
  const props = { host: 'https://server', onboarding: true, onBack() {} }
  h.render(props); await settle(); h.render(props)
  assert.equal(h.find('UnderlineInput').value, '')
  assert.equal(h.find('LocalAction'), undefined)
  assert.ok(h.find('LanguageSwitch'))
})

test('local-use preserves credentials, selects local mode, completes login and exits Home', async() => {
  const h = harness('src/screens/SyncLogin/LocalAction.tsx')
  h.render()
  h.find('TextButton', 'sync_login_skip').onPress(); await settle()
  assert.deepEqual(h.events, [['local']])
})


test('local transition blocks auth/back and LX switching until it finishes', async() => {
  const h = harness('src/screens/SyncLogin/index.tsx')
  h.render(); await settle(); h.render()
  h.find('LocalAction').onBusyChange(true); h.render()
  assert.equal(h.find('ServerStep').disabled, true)
  assert.equal(h.find('TextButton', 'sync_login_use_lx').disabled, true)
  h.find('ServerStep').onBack()
  assert.deepEqual(h.events, [])
  h.find('LocalAction').onBusyChange(false); h.render()
  h.find('ServerStep').onBack()
  assert.deepEqual(h.events, [['home']])
})

test('expired saved session opens the dialog and does not exit Home', async() => {
  const h = harness('src/screens/Login/AuthFlow.tsx', { savedHost: 'https://server', session: { token: 'old', user: { username: 'alice' } }, connectError: new Error('expired') })
  const props = { host: 'https://server', onboarding: false, onBack() {} }
  h.render(props); await settle(); h.render(props)
  h.find('PrimaryButton', 'auth_login').onPress(); await settle()
  h.render(props)
  assert.ok(h.events.some(event => event[0] === 'expired-dialog' && event[1] === 'https://server'))
  assert.equal(h.events.some(event => event[0] === 'home'), false)
})


test('expired Lux account reopens its host and username even if saved entry mode is LX', async() => {
  const h = harness('src/screens/SyncLogin/index.tsx', { mode: 'lx' })
  const props = { onboarding: false, initialHost: 'https://expired-server', initialUsername: 'june', initialProvider: 'lux' }
  h.render(props); await settle()
  const tree = h.render(props)
  assert.equal(tree.type, 'AuthFlow')
  assert.equal(tree.props.host, props.initialHost)
  assert.equal(tree.props.initialUsername, 'june')
})

test('relogin username takes precedence over an old login draft', async() => {
  const h = harness('src/screens/Login/AuthFlow.tsx', { savedHost: 'https://server' })
  const props = { host: 'https://server', onboarding: false, initialUsername: 'june', onBack() {} }
  h.render(props); await settle(); h.render(props)
  assert.equal(h.find('UnderlineInput').value, 'june')
})


test('embedded Settings login backs through server and LX without replacing the native Home root', async() => {
  const h = harness('src/screens/SyncLogin/index.tsx', { savedHost: 'https://saved' })
  let closed = 0
  const props = { initialHost: 'https://saved', onBack: () => { closed++ } }
  h.render(props); await settle(); h.render(props)
  assert.equal(h.find('AuthFlow').settings, true)
  h.find('AuthFlow').onBack(); h.render(props)
  assert.ok(h.find('ServerStep'))
  h.find('TextButton', 'sync_login_use_lx').onPress(); h.render(props)
  // Legacy is a real component reference in this harness, so use its props from the tree.
  const findLegacy = node => {
    if (!node || typeof node !== 'object') return null
    if (node.type === h.Legacy) return node.props
    return [node.props?.children].flat(Infinity).map(findLegacy).find(Boolean)
  }
  findLegacy(h.render(props)).onBack()
  assert.equal(closed, 1)
  assert.deepEqual(h.events, [])
})

test('deleting the current server routes through the transaction before any disconnect', () => {
  const source = readFileSync(new URL('../src/screens/Home/Vertical/Tabs/SettingsTab.tsx', import.meta.url), 'utf8')
  const deletion = source.slice(source.indexOf('const handleDeleteSyncHost'), source.indexOf('const handleToggleSyncManage'))
  assert.match(deletion, /saveSyncHost\(''\)/)
  assert.doesNotMatch(deletion, /disconnectServer|updateSetting/)
})
