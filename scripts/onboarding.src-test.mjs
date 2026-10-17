/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const load = (path, deps = {}) => {
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports) {${source}\n})`).runInThisContext()(
    name => { assert.ok(Object.hasOwn(deps, name), name); return deps[name] }, module, module.exports,
  )
  return module.exports
}
const check = load('src/utils/serverCheck.ts')
const info = { name: 'Lux', version: '2.2.0', minClientVersion: '0.5.0', registration: { enabled: true, inviteOnly: true } }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const harness = (request = async() => info, options = {}) => {
  let state
  const checker = check.createServerChecker({ request, clientVersion: '0.5.0', onChange: next => { state = next }, ...options })
  return { checker, get state() { return state } }
}

test('server URLs normalize domains, ports, paths, HTTPS and reject unsafe/invalid addresses', () => {
  for (const [input, expected] of [
    [' lux.example.com ', 'https://lux.example.com'],
    ['HTTPS://LUX.EXAMPLE.COM///', 'https://lux.example.com'],
    ['http://192.168.1.2:9527/lux/', 'http://192.168.1.2:9527/lux'],
    ['https://[::1]:9527/', 'https://[::1]:9527'],
    ['', ''], ['ftp://host', ''], ['https://user:pass@host', ''],
    ['host?secret=1', ''], ['bad host', ''], ['https://', ''], ['host:99999', ''],
  ]) assert.equal(check.normalizeServerUrl(input), expected, input)
})

test('server check goes idle -> checking -> ok with measured latency and contract fields', async() => {
  const times = [100, 220]
  let requested
  const h = harness(async(url, signal) => { requested = { url, signal }; return info }, { now: () => times.shift() })
  h.checker.input('lux.example.com')
  assert.equal(h.state.status, 'idle')
  const pending = h.checker.check('lux.example.com')
  assert.equal(h.state.status, 'checking')
  await pending
  assert.equal(requested.url, 'https://lux.example.com/api/server-info')
  assert.equal(requested.signal.aborted, false)
  assert.equal(h.state.status, 'ok')
  assert.equal(h.state.reachable, true)
  assert.equal(h.state.compatible, true)
  assert.equal(h.state.latency, 120)
  assert.equal(h.state.https, true)
  assert.deepEqual(h.state.registration, info.registration)
  h.checker.dispose()
})

test('unreachable and invalid server cannot enable login', async() => {
  let calls = 0
  const h = harness(async() => { calls++; throw new Error('offline') })
  await h.checker.check('host')
  assert.equal(h.state.status, 'failed')
  assert.equal(h.state.reachable, false)
  assert.equal(h.state.compatible, null)
  assert.equal(h.state.error, 'unreachable')
  await h.checker.check('ftp://host')
  assert.equal(h.state.error, 'invalid')
  assert.equal(calls, 1)
  h.checker.dispose()
})

test('minClientVersion compares the app version, not the server version; null imposes no minimum', async() => {
  const h = harness(async() => ({ ...info, minClientVersion: '0.6.0' }))
  await h.checker.check('host')
  assert.equal(h.state.status, 'failed')
  assert.equal(h.state.reachable, true)
  assert.equal(h.state.compatible, false)
  assert.equal(h.state.error, 'incompatible')
  const unlimited = harness(async() => ({ ...info, minClientVersion: null }))
  await unlimited.checker.check('host')
  assert.equal(unlimited.state.status, 'ok')
  for (const [a, b, expected] of [['0.5.0-dev.1', '0.5.0', false], ['0.5.0', '0.5', true], ['0.5.0-dev.10', '0.5.0-dev.2', true], ['0.5.1-dev.1', '0.5.0', true], ['invalid', '0.5.0', false]]) {
    assert.equal(check.versionAtLeast(a, b), expected)
  }
  h.checker.dispose()
  unlimited.checker.dispose()
})

test('HTTP warning and registration closed/open/invite-only are informational', async() => {
  for (const registration of [{ enabled: false, inviteOnly: true }, { enabled: true, inviteOnly: true }, { enabled: true, inviteOnly: false }]) {
    const h = harness(async() => ({ ...info, registration }))
    await h.checker.check('http://host')
    assert.equal(h.state.status, 'ok')
    assert.equal(h.state.https, false)
    assert.deepEqual(h.state.registration, registration)
    h.checker.dispose()
  }
})

test('editing immediately invalidates prior results; debounced requests use only the latest input', async() => {
  const urls = []
  const h = harness(async url => { urls.push(url); return info }, { debounceMs: 10 })
  await h.checker.check('first')
  h.checker.input('second')
  assert.equal(h.state.status, 'idle')
  assert.equal(h.state.reachable, null)
  h.checker.input('third')
  await delay(30)
  assert.deepEqual(urls, ['https://first/api/server-info', 'https://third/api/server-info'])
  assert.equal(h.state.status, 'ok')
  h.checker.input('')
  await delay(20)
  assert.equal(h.state.status, 'idle')
  assert.equal(urls.length, 2)
  h.checker.dispose()
})

test('superseded requests are aborted and stale successes/failures cannot replace newer results', async() => {
  for (const fail of [false, true]) {
    let finishOld
    let oldSignal
    const h = harness(async(url, signal) => {
      if (url.includes('old')) {
        oldSignal = signal
        return new Promise((resolve, reject) => { finishOld = () => fail ? reject(new Error('old')) : resolve(info) })
      }
      return { ...info, version: 'new' }
    })
    const old = h.checker.check('old')
    await h.checker.check('new')
    assert.equal(oldSignal.aborted, true)
    const current = h.state
    finishOld()
    await old
    assert.equal(h.state, current)
    assert.equal(h.state.info.version, 'new')
    h.checker.dispose()
  }
})

test('timeout aborts transport and ignores even a late successful result', async() => {
  let resolveRequest
  let signal
  const h = harness(async(_url, active) => { signal = active; return new Promise(resolve => { resolveRequest = resolve }) }, { timeoutMs: 10 })
  const pending = h.checker.check('host')
  await delay(30)
  assert.equal(signal.aborted, true)
  assert.equal(h.state.status, 'failed')
  assert.equal(h.state.error, 'timeout')
  resolveRequest(info)
  await pending
  assert.equal(h.state.error, 'timeout')
  h.checker.dispose()
})

test('disposing cancels pending debounce and invalidates in-flight responses', async() => {
  let calls = 0
  const h = harness(async() => { calls++; return info }, { debounceMs: 10 })
  h.checker.input('host')
  h.checker.dispose()
  await delay(25)
  assert.equal(calls, 0)
})

test('malformed server-info never claims compatibility or registration support', () => {
  assert.deepEqual(check.parseServerInfo(info), info)
  for (const invalid of [{}, { ...info, minClientVersion: undefined }, { ...info, registration: {} }, null]) assert.throws(() => check.parseServerInfo(invalid))
})

test('first-launch gate excludes existing accepted users and completion persists across launches', async() => {
  const disk = new Map()
  let accepted = false
  let loginCompleted = false
  const lifecycle = load('src/utils/onboarding.ts', {
    '@/plugins/storage': { getData: async key => disk.get(key), saveData: async(key, value) => { disk.set(key, value) } },
    '@/config/constant': { storageDataPrefix: { cheatTip: 'safety' } },
    '@/core/common': { updateSetting: setting => { accepted = setting['common.isAgreePact'] } },
    '@/utils/data': { setSyncLoginCompleted: async value => { loginCompleted = value } },
  })
  assert.equal(lifecycle.shouldShowOnboarding(false, false, false), true)
  assert.equal(lifecycle.shouldShowOnboarding(false, true, false), false)
  assert.equal(lifecycle.shouldShowOnboarding(false, false, true), false)
  assert.equal(await lifecycle.getOnboardingCompleted(), false)
  await lifecycle.completeOnboarding()
  assert.equal(await lifecycle.getOnboardingCompleted(), true)
  assert.equal(accepted, true)
  assert.equal(disk.get('safety'), true)
  assert.equal(loginCompleted, true)
  assert.equal(lifecycle.shouldShowOnboarding(await lifecycle.getOnboardingCompleted(), false, false), false)
})

test('local entry disconnects sync and activates local before writing its profile', async() => {
  const events = []
  let active = 'lux:server:alice'
  const names = new Map([[active, 'Alice']])
  const originalGlobalEvent = global.app_event
  global.app_event = { userNameUpdated: value => { events.push(['nameEvent', value]) } }
  try {
    const local = load('src/utils/enterLocalSpace.ts', {
      '@/core/common': { updateSetting: value => { events.push(['setting', value]) } },
      '@/plugins/sync': { disconnectServer: async() => { events.push(['disconnect']) } },
      '@/utils/dataSpace': { setActiveSpace: async value => { events.push(['space', value]); active = value } },
      '@/utils/data': {
        setSyncHost: async value => { events.push(['host', value]) },
        saveUserName: async value => { events.push(['name', active]); names.set(active, value) },
      },
    })
    await local.enterLocalSpace('Local user')
    assert.equal(active, 'local')
    assert.equal(names.get('local'), 'Local user')
    assert.equal(names.get('lux:server:alice'), 'Alice')
    assert.deepEqual(events, [
      ['setting', { 'sync.enable': false }], ['disconnect'], ['space', 'local'],
      ['host', ''], ['name', 'local'], ['nameEvent', 'Local user'],
    ])
  } finally { global.app_event = originalGlobalEvent }
})

// Render the production login with native view/hook adapters; drive actual field/button callbacks.
test('legacy login adapter prefills checked URL and completes only after successful Lux auth', async() => {
  const values = []
  let cursor = 0
  let mounted = false
  const effects = []
  const events = []
  const hooks = {
    memo: value => value,
    useState: initial => {
      const index = cursor++
      if (!(index in values)) values[index] = initial
      return [values[index], value => { values[index] = value }]
    },
    useCallback: fn => fn,
    useEffect: fn => { if (!mounted) effects.push(fn) },
  }
  const jsx = (type, props) => ({ type, props })
  const noOp = () => {}
  const snapshot = { host: 'https://previous-server', luxUsername: 'previous-user', luxPassword: 'previous-secret', lxAuthCode: '', hasSavedLuxSession: true, hasSavedLxKey: false }
  let authFails = true
  const screen = load('src/screens/SyncLogin/index.tsx', {
    '../Login/AuthFlow': { default: 'AuthFlow' },
    '../Login/ServerStep': { default: 'ServerStep' },
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', ScrollView: 'ScrollView', BackHandler: { addEventListener: () => ({ remove: noOp }) } },
    '@/components/common/LanguageSwitch': { default: 'LanguageSwitch' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/MdiIcon': { MdiIcon: 'Icon' },
    '@/components/magazine': Object.fromEntries(['PrimaryButton', 'TextButton', 'TextTabs', 'UnderlineInput'].map(name => [name, name])),
    '@/plugins/sync/constants': { SYNC_CODE: {} },
    '@/plugins/sync/client/credentials': { canReuseLuxSession: () => false },
    '@/plugins/sync/client/userErrors': { luxSessionExpiredMessage: noOp, profileSyncErrorMessage: noOp },
    '@/plugins/sync': {
      connectLuxServer: async(...args) => { events.push(['auth', ...args]); if (authFails) throw new Error('bad password') },
      connectServer: async() => { assert.fail('LX must never be used') },
      syncLuxProfileOnLogin: async() => {},
    },
    '@/core/common': { updateSetting: noOp },
    '@/utils/onboarding': { completeOnboarding: async() => { events.push(['complete']) } },
    '@/utils/enterLocalSpace': { enterLocalSpace: async() => { events.push(['local']) } },
    '@/navigation': { navigations: { pushHomeScreen: async() => { events.push(['home']) } } },
    '@/lang': { useI18n: () => key => key },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: builder => () => builder() },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/theme/magazineType': { PAGE_GUTTER: 22, magType: { eyebrow: { size: 11 }, h2: { size: 32 } } },
    '@/utils/tools': { createStyle: value => value, toast: noOp },
    '@/store/common/hook': { useStatusbarHeight: () => 44 },
    '@/utils/data': {
      getSyncMode: async() => 'lx',
      findLuxAuthForHost: async() => null,
      setSyncMode: async value => { events.push(['mode', value]) },
      setSyncHost: async value => { events.push(['host', value]) },
      addSyncHostHistory: async() => {},
      setSyncLoginCompleted: async() => {},
    },
    '@/utils/syncLoginCredentialPersistence': { clearSavedSyncLoginCredentialsForMode: async() => {} },
    '@/utils/syncLoginPrefill': {
      loadSyncLoginFormSnapshot: async() => snapshot,
      rememberSyncLoginForm: async() => {},
      syncLoginSavedSecretDisplayValue: value => value,
      syncLoginSavedSecretInputValue: value => value,
    },
  }).LegacySyncLogin
  const oldEvent = global.app_event
  const oldLx = global.lx
  global.app_event = { on: noOp, off: noOp }
  global.lx = {}
  const render = () => { cursor = 0; return screen({ onboarding: true, initialHost: 'https://checked-server' }) }
  const allNodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(allNodes) : [node, ...allNodes(node.props?.children)]
  const find = (tree, type, label) => allNodes(tree).find(node => node.type === type && (!label || node.props.label === label))
  try {
    render()
    mounted = true
    const cleanup = effects.map(effect => effect())
    await delay(0)
    let tree = render()
    assert.equal(find(tree, 'UnderlineInput', 'setting_sync_host_label').props.value, 'https://checked-server')
    assert.equal(find(tree, 'UnderlineInput', 'sync_login_lux_account_label').props.value, '')
    assert.equal(find(tree, 'UnderlineInput', 'setting_sync_lux_password').props.value, '')
    assert.equal(find(tree, 'TextTabs'), undefined)
    assert.equal(find(tree, 'UnderlineInput', 'setting_sync_code_label'), undefined)
    find(tree, 'UnderlineInput', 'sync_login_lux_account_label').props.onChangeText('alice')
    find(tree, 'UnderlineInput', 'setting_sync_lux_password').props.onChangeText('password')
    tree = render()
    find(tree, 'PrimaryButton').props.onPress()
    await delay(0)
    assert.equal(events.some(([type]) => type === 'complete'), false)
    assert.equal(events.some(([type]) => type === 'home'), false)
    authFails = false
    tree = render()
    find(tree, 'PrimaryButton').props.onPress()
    await delay(0)
    assert.deepEqual(events.filter(([type]) => type === 'auth'), [
      ['auth', 'https://checked-server', 'alice', 'password'],
      ['auth', 'https://checked-server', 'alice', 'password'],
    ])
    assert.deepEqual(events.slice(-2), [['complete'], ['home']])
    cleanup.forEach(fn => fn?.())
  } finally {
    global.app_event = oldEvent
    global.lx = oldLx
  }
})
