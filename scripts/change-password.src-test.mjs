/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const load = (file, deps = {}) => {
  const js = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const errors = load('src/plugins/sync/client/userErrors.ts')
const api = load('src/utils/changePassword.ts', { '@/plugins/sync/client/userErrors': errors })
const authApi = load('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': errors })
const host = 'https://server/deployment'
const session = { serverId: 'server', serverUrl: host, token: 'old', refreshToken: 'refresh-old', sessionId: 'current', user: { id: 'alice', username: 'alice' } }
const valid = { oldPassword: 'old password', password: 'new password', confirm: 'new password' }
const response = { ok: true, token: 'legacy', accessToken: 'new', refreshToken: 'refresh-new', sessionId: 'new-session', accessTokenExpiresAt: '2026-12-01', user: session.user, password: 'must not be stored' }
const zh = JSON.parse(readFileSync(new URL('../src/lang/zh-cn.json', import.meta.url), 'utf8'))
const translate = (key, args = {}) => zh[key].replace(/\{(\w+)\}/g, (_, name) => args[name])
const flush = () => new Promise(resolve => setImmediate(resolve))

const harness = (send = async() => response) => {
  let saved = structuredClone(session)
  const writes = []; const calls = []
  const data = {
    findLuxAuthForHost: async target => { assert.equal(target, host); return saved },
    rotateLuxAuth: async(previous, next) => {
      if (saved?.token !== previous.token) return null
      saved = { ...saved, ...next }; writes.push(structuredClone(saved)); return saved
    },
  }
  const client = authApi.createLuxAuthClient({
    send: async(url, options) => {
      calls.push({ url, ...options })
      const result = await send(url, options)
      return { code: result.status ?? 200, text: JSON.stringify(result.body ?? result) }
    },
    find: data.findLuxAuthForHost,
    rotate: data.rotateLuxAuth,
    clear: async() => false,
    expired() {},
  })
  return { data, calls, writes, request: client.request, get saved() { return saved }, replace: value => { saved = value } }
}
const renderScreen = env => {
  const values = []; const effects = []; let cursor = 0
  const hooks = {
    useState: initial => {
      const i = cursor++; if (!(i in values)) values[i] = initial
      return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value }]
    },
    useRef: initial => { const i = cursor++; values[i] ??= { current: initial }; return values[i] },
    useEffect: (effect, deps) => {
      const i = cursor++; const old = effects[i]
      if (!old || !deps || deps.some((value, j) => value !== old.deps?.[j])) effects[i] = { deps, effect, pending: true, cleanup: old?.cleanup }
    },
  }
  const jsx = (type, props) => ({ type, props })
  const events = []
  const screen = load('src/screens/Login/ChangePassword.tsx', {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...Object.fromEntries(['View', 'Modal', 'ScrollView', 'KeyboardAvoidingView'].map(key => [key, key])), Platform: { OS: 'android' } },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/magazine': Object.fromEntries(['BackButton', 'PrimaryButton', 'Toggle', 'UnderlineInput'].map(key => [key, key])),
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: builder => () => builder() },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': { createStyle: value => value, toast: value => { events.push(['toast', value]) } },
    '@/store/common/hook': { useStatusbarHeight: () => 44 },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0 },
    '@/lang': { useI18n: () => translate },
    '@/plugins/sync/client/auth': { requestJson: env.request },
    '@/utils/data': env.data,
    '@/utils/changePassword': api,
  }).default
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
  let tree
  const render = () => {
    cursor = 0; tree = screen({ host, session, onBack: () => { events.push(['back']) } })
    for (const effect of effects.filter(Boolean)) if (effect.pending) { effect.cleanup?.(); effect.cleanup = effect.effect(); effect.pending = false }
  }
  const find = (type, label) => nodes(tree).find(node => node.type === type && (!label || node.props.accessibilityLabel === label))
  render()
  return {
    render,
    find,
    events,
    nodes: () => nodes(tree),
    fill: (form = valid) => {
      for (const [label, key] of [['当前密码', 'oldPassword'], ['新密码', 'password'], ['再输一次', 'confirm']]) find('UnderlineInput', label).props.onChangeText(form[key])
      render()
    },
  }
}

test('password screen validates required, minimum length, and mismatch before sending', async() => {
  const env = harness(); const view = renderScreen(env)
  assert.equal(view.find('PrimaryButton').props.disabled, true)
  view.find('UnderlineInput', '当前密码').props.onBlur(); view.render()
  assert.equal(view.find('UnderlineInput', '当前密码').props.error, '必填')
  view.fill({ ...valid, password: 'short', confirm: 'different' })
  for (const label of ['新密码', '再输一次']) view.find('UnderlineInput', label).props.onBlur()
  view.render()
  assert.equal(view.find('UnderlineInput', '新密码').props.error, '至少 8 位')
  assert.equal(view.find('UnderlineInput', '再输一次').props.error, '两次输入的密码不一致')
  view.find('PrimaryButton').props.onPress(); await flush()
  assert.equal(env.calls.some(call => call.url.endsWith('/password')), false)
  await assert.rejects(api.createPasswordService({ request: env.request, find: env.data.findLuxAuthForHost, rotate: env.data.rotateLuxAuth }).change(host, session, { ...valid, oldPassword: '' }, true))
})

test('success posts either revoke flag, atomically rotates both tokens, never stores passwords, toasts and goes back', async() => {
  for (const revoke of [true, false]) {
    const env = harness(async url => url.endsWith('/sessions') ? { sessions: [{ id: 'current' }, { id: 'other' }] } : response)
    const view = renderScreen(env); await flush(); view.render(); view.fill()
    assert.equal(view.find('Toggle').props.value, true)
    view.find('Toggle').props.onChange(revoke); view.render()
    const submit = view.find('PrimaryButton').props.onPress
    submit(); submit(); await flush(); view.render()
    const calls = env.calls.filter(call => call.url.endsWith('/password'))
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.deepEqual(JSON.parse(calls[0].body), { oldPassword: valid.oldPassword, password: valid.password, revokeOtherDevices: revoke })
    assert.equal(env.writes.length, 1)
    assert.equal(env.saved.token, 'new'); assert.equal(env.saved.refreshToken, 'refresh-new')
    assert.equal(env.saved.sessionId, 'new-session'); assert.equal(env.saved.accessTokenExpiresAt, response.accessTokenExpiresAt)
    for (const secret of [valid.oldPassword, valid.password, response.password]) assert.equal(JSON.stringify(env.writes).includes(secret), false)
    assert.deepEqual(view.events, [['toast', '密码已修改'], ['back']])
    assert.equal(view.find('UnderlineInput', '当前密码').props.value, '')
  }
})

test('wrong current password stays under the field and clears on edit; friendly errors never show server details', async() => {
  for (const [status, code, key] of [[403, 'INVALID_CURRENT_PASSWORD', 'password_current_invalid'], [429, 'RATE_LIMITED', 'password_rate_limited'], [400, 'MISSING_FIELDS', 'password_invalid_request'], [400, 'INVALID_REQUEST', 'password_invalid_request'], [500, 'INTERNAL', 'password_failed']]) {
    const env = harness(async url => url.endsWith('/sessions') ? {} : { status, body: { code, message: 'private server details' } })
    const view = renderScreen(env); view.fill(); view.find('PrimaryButton').props.onPress(); await flush(); view.render()
    assert.equal(env.writes.length, 0); assert.deepEqual(view.events, [])
    if (status === 403) {
      assert.equal(view.find('UnderlineInput', '当前密码').props.error, zh[key])
      view.find('UnderlineInput', '当前密码').props.onChangeText('fixed'); view.render()
      assert.equal(view.find('UnderlineInput', '当前密码').props.error, undefined)
    } else assert.ok(view.nodes().some(node => node.props?.children === zh[key]))
    assert.equal(view.nodes().some(node => node.props?.children === 'private server details'), false)
  }
})

test('sessions subtitle excludes current session and falls back without a number when unavailable', async() => {
  for (const [payload, expected] of [
    [{ sessions: [{ id: 'a' }, { id: 'current' }, { id: 'b' }] }, '其他 2 台设备需要重新登录'],
    [{ sessions: [{ id: 'current' }] }, '其他 0 台设备需要重新登录'],
    [{ sessions: [{ id: 'a', current: true }, { id: 'b' }] }, '其他 1 台设备需要重新登录'],
    [{ sessions: [{ id: 'a' }] }, '其他设备需要重新登录'],
    [{}, '其他设备需要重新登录'],
    [{ status: 503, body: {} }, '其他设备需要重新登录'],
  ]) {
    const view = renderScreen(harness(async() => payload)); await flush(); view.render()
    assert.ok(view.nodes().some(node => node.props?.children === expected), expected)
  }
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const messages = JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of Object.keys(zh).filter(key => key.startsWith('password_'))) assert.equal(typeof messages[key], 'string', `${locale}:${key}`)
    assert.equal(messages.password_other_devices_unknown.includes('{count}'), false)
  }
})

test('refresh before password change preserves replacement tokens and account changes cannot be overwritten', async() => {
  let attempts = 0
  const env = harness(async url => {
    if (url.endsWith('/refresh')) return { accessToken: 'renewed', refreshToken: 'renewed-refresh' }
    if (++attempts === 1) return { status: 401, body: {} }
    return { ...response, accessToken: undefined }
  })
  const service = api.createPasswordService({ request: env.request, find: env.data.findLuxAuthForHost, rotate: env.data.rotateLuxAuth })
  await service.change(host, session, valid, true)
  assert.equal(env.saved.token, 'legacy'); assert.equal(env.saved.refreshToken, 'refresh-new')
  const raced = harness(async() => { raced.replace({ ...session, token: 'bob', user: { id: 'bob' } }); return response })
  await assert.rejects(api.createPasswordService({ request: raced.request, find: raced.data.findLuxAuthForHost, rotate: raced.data.rotateLuxAuth }).change(host, session, valid, true), { status: 401 })
  assert.equal(raced.saved.user.id, 'bob'); assert.equal(raced.writes.length, 0)
})

test('pending submit blocks modal back and duplicate actions', async() => {
  let finish
  const env = harness(async url => url.endsWith('/sessions') ? {} : await new Promise(resolve => { finish = resolve }))
  const view = renderScreen(env); view.fill(); view.find('PrimaryButton').props.onPress(); await flush(); view.render()
  assert.equal(view.find('PrimaryButton').props.disabled, true)
  assert.equal(view.find('Toggle').props.disabled, true)
  view.find('BackButton').props.onPress(); view.find('Modal').props.onRequestClose()
  assert.deepEqual(view.events, [])
  finish(response); await flush()
  assert.deepEqual(view.events, [['toast', '密码已修改'], ['back']])
})
