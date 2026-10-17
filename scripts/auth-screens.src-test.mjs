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
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const errors = load('src/plugins/sync/client/userErrors.ts')
const api = load('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': errors })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const session = { serverId: 's', serverUrl: 'https://server', token: 'old', refreshToken: 'r0', user: { id: 'alice', username: 'alice' } }
const response = (code, data) => ({ code, text: JSON.stringify(data) })
const harness = (send, seed = session) => {
  let saved = structuredClone(seed)
  const writes = []
  const expired = []
  const client = api.createLuxAuthClient({
    send,
    getRefreshToken: async() => saved?.refreshToken ?? null,
    find: async() => saved,
    rotate: async(previous, tokens) => {
      if (previous.token !== saved?.token) return null
      saved = { ...saved, ...tokens }; writes.push(structuredClone(saved)); return saved
    },
    clear: async previous => {
      if (previous.token !== saved?.token) return false
      saved = null; return true
    },
    expired: host => { expired.push(host) },
  })
  return { client, writes, expired, get saved() { return saved }, replace: value => { saved = value } }
}

test('concurrent 401s share one refresh, retry with rotated token, and late 401 reuses rotation', async() => {
  let refreshes = 0
  let oldRequests = 0
  const env = harness(async(url, options) => {
    if (url.endsWith('/refresh')) {
      refreshes++; assert.deepEqual(JSON.parse(options.body), { refreshToken: 'r0' })
      await delay(10); return response(200, { accessToken: 'new', refreshToken: 'r1' })
    }
    if (options.headers.Authorization === 'Bearer old') {
      if (++oldRequests === 3) await delay(35)
      return response(401, { code: 'EXPIRED' })
    }
    assert.equal(options.headers.Authorization, 'Bearer new')
    return response(200, { ok: true })
  })
  const results = await Promise.all(Array.from({ length: 3 }, () => env.client.request('https://server/api/me/profile', { displayName: 'a' }, 'old', 'PATCH')))
  assert.deepEqual(results, [{ ok: true }, { ok: true }, { ok: true }])
  assert.equal(refreshes, 1)
  assert.equal(env.writes.length, 1)
  assert.equal(env.saved.refreshToken, 'r1')
  await env.client.request('https://server/api/me/profile', undefined, 'old')
  assert.equal(refreshes, 1)
})

test('refresh failure clears once and signals expiry; forbidden does not renew', async() => {
  for (const failure of [response(401, { code: 'REVOKED', message: 'Revoked' }), response(200, { accessToken: 'bad' }), new Error('offline')]) {
    let refreshes = 0
    const env = harness(async url => {
      if (url.endsWith('/refresh')) { refreshes++; await delay(5); if (failure instanceof Error) throw failure; return failure }
      return response(401, {})
    })
    const results = await Promise.allSettled([1, 2, 3].map(() => env.client.request('https://server/api/me', null, 'old')))
    assert.equal(results.every(result => result.status === 'rejected'), true)
    assert.equal(refreshes, 1)
    assert.equal(env.saved, null)
    assert.deepEqual(env.expired, ['https://server'])
  }
  const denied = harness(async() => response(403, { code: 'FORBIDDEN' }))
  await assert.rejects(denied.client.request('https://server/api/me', null, 'old'), { status: 403 })
  assert.equal(denied.saved.token, 'old')
})

test('retry once only, preserve verb and body; public login never refreshes', async() => {
  const calls = []
  const env = harness(async(url, options) => {
    calls.push({ url, ...options })
    return url.endsWith('/refresh') ? response(200, { accessToken: 'new', refreshToken: 'r1' }) : response(401, { message: 'Expired' })
  })
  await assert.rejects(env.client.request('https://server/api/me', { a: 1 }, 'old', 'PATCH'), { status: 401 })
  assert.equal(calls.length, 3)
  assert.equal(calls[0].method, calls[2].method)
  assert.equal(calls[0].body, calls[2].body)
  assert.equal(env.saved, null)
  await assert.rejects(env.client.request('https://server/api/auth/login', { username: 'a' }))
  assert.equal(calls.length, 4)
})

test('new account bearer is never replaced by the previous saved account', async() => {
  const env = harness(async(url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer new-account')
    return response(200, { ok: true })
  })
  await env.client.request('https://server/api/sync/key', {}, 'new-account')
})

test('in-flight refresh cannot erase or replace a newly logged-in session', async() => {
  const env = harness(async url => {
    if (url.endsWith('/refresh')) {
      env.replace({ ...session, token: 'other-account', user: { id: 'bob' } })
      return response(200, { accessToken: 'new', refreshToken: 'r1' })
    }
    return response(401, {})
  })
  await assert.rejects(env.client.request('https://server/api/me', null, 'old'))
  assert.equal(env.saved.user.id, 'bob')
  assert.deepEqual(env.expired, [])
})

const zh = JSON.parse(readFileSync(new URL('../src/lang/zh-cn.json', import.meta.url), 'utf8'))
const translate = (key, values = {}) => zh[key].replace(/\{(\w+)\}/g, (_, name) => values[name])
const validForm = { invite: 'valid', username: 'xiaolin', displayName: '小林', password: 'password', confirm: 'password' }

test('required fields, password mismatch and localized help text', () => {
  assert.deepEqual(api.loginErrors(' ', ''), { username: 'auth_required', password: 'auth_required' })
  assert.equal(Object.values(api.loginErrors('a', 'p')).some(Boolean), false)
  assert.equal(api.registerErrors({ ...validForm, confirm: 'different' }).confirm, 'auth_password_mismatch')
  assert.equal(api.registerErrors({ ...validForm, password: 'short' }).password, 'auth_password_hint')
  assert.equal(api.helpMessage(' xiaolin ', 'lux.june-nas.cn', translate), '我是 xiaolin，忘记了 lux.june-nas.cn 的密码，麻烦帮我重置。')
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const messages = JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of Object.keys(zh).filter(key => key.startsWith('auth_'))) assert.equal(typeof messages[key], 'string')
  }
})

// Hook/view adapters exercise production screen callbacks, including async debounce cleanup.
const renderScreen = (client, host, connect) => {
  const values = []; const effects = []; let cursor = 0
  const hooks = {
    useState: initial => { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value }] },
    useRef: initial => { const index = cursor++; values[index] ??= { current: initial }; return values[index] },
    useEffect: (effect, deps) => {
      const index = cursor++; const previous = effects[index]
      if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) effects[index] = { deps, effect, cleanup: previous?.cleanup, pending: true }
    },
  }
  const jsx = (type, props) => ({ type, props })
  const events = []
  const screen = load('src/screens/Login/AuthFlow.tsx', {
    '@/components/common/LanguageSwitch': { default: 'LanguageSwitch' },
    '../SyncLogin/LocalAction': { default: 'LocalAction' },
    '@/utils/syncLoginPrefill': { loadSyncLoginFormSnapshot: async() => ({ host: '', luxUsername: '', luxPassword: '' }), syncHostCompareKey: value => value, rememberSyncLoginForm: async() => {} },
    '@/utils/syncLoginCredentialPersistence': { clearSavedSyncLoginCredentialsForMode: async() => {} },
    '@/plugins/sync/client/credentials': { canReuseLuxSession: () => false },
    '@/plugins/sync/constants': { SYNC_CODE: {} },
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...Object.fromEntries(['View', 'ScrollView', 'KeyboardAvoidingView'].map(key => [key, key])), Platform: { OS: 'android' }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/magazine': Object.fromEntries(['BackButton', 'OptionRow', 'PrimaryButton', 'TextButton', 'UnderlineInput'].map(key => [key, key])),
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: builder => () => builder() },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': { createStyle: value => value, clipboardWriteText: value => { events.push(['copy', value]) }, toast: value => { events.push(['toast', value]) } },
    '@/store/common/hook': { useStatusbarHeight: () => 44 },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0 },
    '@/lang': { useI18n: () => translate },
    '@/utils/luxAuthApi': api,
    '@/utils/serverCheck': load('src/utils/serverCheck.ts'),
    '@/plugins/sync/client/sessionExpired': { showSessionExpiredDialog: async() => {} },
    '@/plugins/sync/client/auth': { luxAuthApi: client, requestJson: client.request },
    '@/plugins/sync': { connectLuxServer: connect, syncLuxProfileOnLogin: async() => {} },
    '@/plugins/sync/client/userErrors': { profileSyncErrorMessage: () => '' },
    '@/core/common': { updateSetting() {} },
    '@/utils/data': { ...Object.fromEntries(['addSyncHostHistory', 'setSyncHost', 'setSyncMode', 'setSyncLoginCompleted'].map(key => [key, async() => {}])), findLuxAuthForHost: async() => null },
    '@/utils/onboarding': { completeOnboarding: async() => { events.push(['complete']) } },
    '@/navigation': { navigations: { pushHomeScreen: async() => { events.push(['home']) } } },
  }).default
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
  let tree
  const render = () => {
    cursor = 0; tree = screen({ host, onboarding: true, onBack: () => { events.push(['back']) } })
    for (const effect of effects.filter(Boolean)) if (effect.pending) { effect.cleanup?.(); effect.cleanup = effect.effect(); effect.pending = false }
    return tree
  }
  const find = (type, label) => nodes(tree).find(node => node.type === type && (!label || node.props.label === label || node.props.accessibilityLabel === label))
  render()
  return { render, find, events, nodes: () => nodes(tree), dispose: () => { effects.filter(Boolean).forEach(effect => effect.cleanup?.()) } }
}

test('mock server: invite valid/invalid/used, username taken, mismatch, success logs in; help options copy', async() => {
  const calls = []
  // In-process mock HTTP server: sandbox forbids binding localhost sockets.
  const server = async(url, options) => {
    const path = url.replace('https://mock-server', '')
    const body = options.body ? JSON.parse(options.body) : {}
    calls.push([path, body])
    let status = 200; let data = {}
    if (path === '/api/server-info') data = { name: 'Lux', version: '0.5.0', minClientVersion: null, registration: { enabled: true, inviteOnly: true } }
    if (path === api.AUTH_CONTRACT.invitePath) {
      if (body.inviteCode === 'valid') data = { valid: true, inviterName: 'June' }
      else { status = 400; data = { code: body.inviteCode === 'used' ? 'INVITE_USED' : 'INVITE_NOT_FOUND', message: body.inviteCode === 'used' ? 'Invite used' : 'Invalid invite' } }
    }
    if (path === '/api/auth/register') {
      if (body.username === 'taken') { status = 409; data = { code: 'USERNAME_TAKEN', message: 'Username taken' } } else data = { token: 'registered', refreshToken: 'registered-refresh', user: { id: 'new', username: body.username } }
    }
    return response(status, data)
  }
  const host = 'https://mock-server'
  const env = harness(server, null)
  const previousLx = global.lx; global.lx = {}
  let screen
  try {
    for (const [code, expected] of [['invalid', 'INVITE_NOT_FOUND'], ['used', 'INVITE_USED']]) await assert.rejects(env.client.invite(host, code), { code: expected })
    assert.equal(await env.client.invite(host, 'valid'), 'June')
    const count = calls.length
    await assert.rejects(env.client.register(host, { ...validForm, confirm: 'mismatch' }))
    assert.equal(calls.length, count)
    screen = renderScreen(env.client, host, async(...args) => { screen.events.push(['login', ...args]) })
    await delay(30); screen.render()
    assert.equal(screen.find('PrimaryButton').props.disabled, true)
    screen.find('UnderlineInput', '用户名').props.onBlur(); screen.render()
    assert.equal(screen.find('UnderlineInput', '用户名').props.error, '必填')
    screen.find('TextButton', '用邀请码注册').props.onPress(); screen.render()
    for (const [label, value] of [['邀请码', 'valid'], ['用户名', 'taken'], ['昵称', '小林'], ['密码', 'password'], ['再输一次', 'different']]) screen.find('UnderlineInput', label).props.onChangeText(value)
    screen.render(); await delay(550); screen.render()
    assert.equal(screen.find('PrimaryButton').props.disabled, true)
    screen.find('UnderlineInput', '再输一次').props.onBlur(); screen.render()
    assert.equal(screen.find('UnderlineInput', '再输一次').props.error, '两次输入的密码不一致')
    screen.find('UnderlineInput', '再输一次').props.onChangeText('password'); screen.render()
    screen.find('PrimaryButton').props.onPress(); await delay(30); screen.render()
    assert.ok(screen.nodes().some(node => node.props?.children === 'Username taken'))
    assert.equal(screen.events.some(([event]) => event === 'login'), false)
    screen.find('UnderlineInput', '用户名').props.onChangeText('xiaolin'); screen.render()
    screen.find('PrimaryButton').props.onPress(); await delay(30); screen.render()
    assert.deepEqual(screen.events.slice(-3), [['login', host, 'xiaolin', 'password'], ['complete'], ['home']])
    screen.find('BackButton').props.onPress(); screen.render()
    screen.find('TextButton', '忘记密码？').props.onPress(); screen.render()
    screen.find('PrimaryButton').props.onPress()
    assert.deepEqual(screen.events.at(-2), ['copy', `我是 xiaolin，忘记了 ${host.replace(/^https?:\/\//, '')} 的密码，麻烦帮我重置。`])
    screen.find('OptionRow', '用其他已登录设备修改').props.onPress(); screen.render()
    assert.equal(screen.find('PrimaryButton'), undefined)
    assert.ok(screen.find('OptionRow', '用其他已登录设备修改').props.description.includes('账号 · 修改密码'))
  } finally {
    screen?.dispose(); global.lx = previousLx
  }
})
