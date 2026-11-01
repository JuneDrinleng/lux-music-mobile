import { settingsTransitionMock } from './settings-transition-mock.mjs'
/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
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
const api = load('src/utils/accountPage.ts')
const zh = JSON.parse(readFileSync(new URL('../src/lang/zh-cn.json', import.meta.url), 'utf8'))
const t = (key, args = {}) => zh[key].replace(/\{(\w+)\}/g, (_, name) => args[name])
const flush = () => new Promise(resolve => setImmediate(resolve))
const host = 'https://server/path'
const auth = { token: 'token', user: { id: 'alice', username: 'alice', role: 'user' } }
const devices = [
  { id: 'current', deviceId: 'phone', deviceName: 'Pixel', platform: 'Android', lastActiveAt: '2026-10-17T12:00:00Z', current: true },
  { id: 'other/id', deviceId: 'tablet', deviceName: '', platform: 'Browser', lastActiveAt: '2026-10-12T12:00:00Z', current: false },
]

test('session mapping, exact counts, current flag and relative activity boundaries', () => {
  assert.equal(api.mapSessions({ sessions: devices })[1].deviceName, 'tablet')
  assert.equal(api.mapSessions({ sessions: devices }).length, 2)
  assert.equal(api.mapSessions({ sessions: devices })[0].current, true)
  assert.equal(api.mapSessions({ sessions: [] }).length, 0)
  assert.throws(() => api.mapSessions({ sessions: [{}] }))
  const now = Date.parse('2026-10-17T12:00:00Z')
  for (const [offset, key, count] of [[-1, 'now'], [0, 'now'], [59_999, 'now'], [60_000, 'minutes', 1], [3_600_000, 'hours', 1], [7_200_000, 'hours', 2], [432_000_000, 'days', 5]]) {
    const result = api.relativeActivity(new Date(now - offset).toISOString(), now)
    assert.equal(result.key, `account_activity_${key}`)
    assert.equal(result.args?.count, count)
  }
  assert.equal(api.relativeActivity('invalid', now).key, 'account_activity_unknown')
})

test('remove and revoke-others use server sessions, refresh after success and propagate failure', async() => {
  const calls = []
  const service = api.createSessionService(async(...args) => { calls.push(args); return { sessions: [devices[0]] } }, `${host}/`, 'bearer')
  assert.equal((await service.remove('other/id')).length, 1)
  assert.deepEqual(calls, [[`${host}/api/me/sessions/other%2Fid`, undefined, 'bearer', 'DELETE'], [`${host}/api/me/sessions`, undefined, 'bearer']])
  calls.length = 0
  await service.revokeOthers()
  assert.deepEqual(calls, [[`${host}/api/me/sessions/revoke-others`, {}, 'bearer', 'POST'], [`${host}/api/me/sessions`, undefined, 'bearer']])
  let failedCalls = 0
  await assert.rejects(api.createSessionService(async() => { failedCalls++; throw new Error('offline') }, host, 'bearer').remove('other'))
  assert.equal(failedCalls, 1)
})

const profileHarness = send => {
  const writes = []; const calls = []; const events = []
  let space = 'lux:server:alice'
  const old = { displayName: 'Original', avatar: '', gender: 'unknown', signature: 'signature' }
  const local = { ...old }
  const data = {
    getSyncHost: async() => host,
    getLuxAuth: async() => ({ ...auth, serverUrl: host }),
    getSyncMode: async() => 'lux',
    saveUserAvatarDataUrl: async value => { writes.push('avatar'); local.avatar = value; return value },
    saveUserName: async value => { writes.push('name'); local.displayName = value },
    saveUserGender: async value => { writes.push('gender'); local.gender = value },
    saveUserSignature: async value => { writes.push('signature'); local.signature = value },
  }
  global.app_event = Object.fromEntries(['userNameUpdated', 'userAvatarUpdated', 'userGenderUpdated', 'userSignatureUpdated'].map(name => [name, value => { events.push([name, value]) }]))
  const mod = load('src/plugins/sync/client/profile.ts', {
    '@/utils/dataSpace': { getActiveSpace: () => space },
    '@/utils/data': data,
    './utils': { parseUrl: () => ({ href: host, httpProtocol: 'https:', hostPath: 'server/path' }) },
    './auth': { requestJson: async(...args) => { calls.push(args); return send(...args) } },
  })
  return { mod, writes, calls, events, local, old, switchSpace: () => { space = 'local' } }
}
test('profile PATCH is server-first; failure leaves local data and events unchanged, local save skips server', async context => {
  const previousEvents = global.app_event
  context.after(() => { global.app_event = previousEvents })
  const draft = { displayName: 'New name', avatar: 'data:image/png;base64,new', gender: 'female', signature: 'New signature' }
  let finish
  const env = profileHarness(async() => new Promise(resolve => { finish = resolve }))
  const saving = env.mod.saveEditedProfile(draft, true)
  await flush()
  assert.deepEqual(env.local, env.old); assert.deepEqual(env.writes, [])
  assert.deepEqual(env.calls, [[`${host}/api/me/profile`, draft, 'token', 'PATCH']])
  finish({ profile: draft }); await saving
  assert.deepEqual(env.local, draft); assert.equal(env.events.length, 4)
  const failed = profileHarness(async() => { throw new Error('offline') })
  await assert.rejects(failed.mod.saveEditedProfile(draft, true))
  assert.deepEqual(failed.local, failed.old); assert.deepEqual(failed.writes, []); assert.deepEqual(failed.events, [])
  await failed.mod.saveEditedProfile(draft, false)
  assert.equal(failed.calls.length, 1); assert.deepEqual(failed.local, draft)
  const raced = profileHarness(async() => { raced.switchSpace(); return { profile: draft } })
  await assert.rejects(raced.mod.saveEditedProfile(draft, true))
  assert.deepEqual(raced.writes, [])
})

const renderAccount = ({ server = true, failSave = false } = {}) => {
  const values = []; const effects = []; const calls = []; let cursor = 0; let confirm = false
  let savedAuth = auth
  let currentDevices = devices.slice()
  const hooks = {
    useState: initial => { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value }] },
    useRef: initial => { const i = cursor++; values[i] ??= { current: initial }; return values[i] },
    useEffect: (effect, deps) => {
      const i = cursor++; const old = effects[i]
      if (!old || deps.some((value, j) => value !== old.deps[j])) effects[i] = { deps, effect, pending: true, cleanup: old?.cleanup }
    },
  }
  const jsx = (type, props) => ({ type, props })
  const screen = load('src/screens/Account/AccountPage.tsx', {
    '@/components/common/SettingsPage': settingsTransitionMock(hooks),
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/common/FocusVisibleScrollView': { FocusVisibleScrollView: 'ScrollView', FocusVisibleAction: 'View' },
    'react-native': { Animated: { View: 'AnimatedView' }, StyleSheet: { absoluteFillObject: {} }, ...Object.fromEntries(['View', 'Modal', 'ScrollView', 'KeyboardAvoidingView', 'TouchableOpacity'].map(key => [key, key])), Platform: { OS: 'android' } },
    'react-native-image-crop-picker': { default: { openPicker: async() => ({ data: 'new', mime: 'image/png' }) } },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/Image': { default: 'Image' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/magazine': Object.fromEntries(['BackButton', 'Rule', 'PrimaryButton', 'SecondaryButton', 'TextButton', 'UnderlineInput', 'OptionRow'].map(key => [key, key])),
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { surface: {} } }), sharedLuxStyles: builder => () => builder() },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': { createStyle: value => value, confirmDialog: async() => confirm },
    '@/store/common/hook': { useStatusbarHeight: () => 44 },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0 },
    '@/lang': { useI18n: () => t },
    '@/plugins/sync/client/auth': {
      requestJson: async(...args) => {
        calls.push(args)
        if (args[3] === 'DELETE' || args[3] === 'POST') currentDevices = currentDevices.filter(item => item.current)
        return { sessions: currentDevices }
      },
    },
    '@/plugins/sync/client/profile': { saveEditedProfile: async(...args) => { calls.push(['save', ...args]); if (failSave) throw new Error('offline') } },
    '@/utils/data': { findLuxAuthForHost: async() => savedAuth, getUserAvatarDataUrl: async() => '', getUserGender: async() => 'unknown', getUserSignature: async() => 'signature' },
    '@/utils/dataSpace': { getActiveSpace: () => server ? 'lux:server:alice' : 'local', listSpaces: async() => [{ id: 'local', kind: 'local' }, { id: 'lux:server:alice', kind: 'lux', label: 'alice' }, { id: 'lux:server:bob', kind: 'lux', label: 'bob' }] },
    '@/utils/accountPage': api,
    './AccountSpaces': { default: 'AccountSpaces' },
    '@/navigation/navigation': { pushSyncLoginScreen: async args => { calls.push(['login', args]) } },
    '@/screens/Login/ChangePassword': { default: 'ChangePassword' },
  }).default
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
  let tree
  const render = () => { cursor = 0; tree = screen({ host, lux: server, nickname: 'Alice', avatar: null, onBack() {}, onLogout: async() => {} }); for (const effect of effects.filter(Boolean)) if (effect.pending) { effect.cleanup?.(); effect.cleanup = effect.effect(); effect.pending = false } }
  render()
  return { render, calls, setAuth: value => { savedAuth = value }, confirm: value => { confirm = value }, nodes: () => nodes(tree), find: (type, label) => nodes(tree).find(node => node.type === type && (!label || node.props.label === label || node.props.accessibilityLabel === label)), text: value => nodes(tree).find(node => node.props?.children === value), pressRow: value => nodes(tree).find(node => node.type === 'TouchableOpacity' && nodes(node).some(child => child.props?.children === value)).props.onPress() }
}

test('Lux and local account rows, data-space labels, username read-only and explicit profile save failure', async() => {
  for (const server of [true, false]) {
    const view = renderAccount({ server, failSave: true }); await flush(); view.render()
    assert.ok(view.text('昵称')); assert.ok(view.text('头像')); assert.ok(view.text('切换账号'))
    assert.equal(Boolean(view.text('我的设备')), server); assert.equal(Boolean(view.text('修改密码')), server)
    assert.equal(Boolean(view.find('SecondaryButton', '退出登录')), server)
    assert.ok(view.text(server ? '本机还有：本地用户、bob' : '本机还有：alice、bob'))
    view.find('SecondaryButton', '编辑').props.onPress(); await flush(); view.render()
    assert.equal(view.find('UnderlineInput', '用户名').props.editable, false)
    assert.equal(view.find('UnderlineInput', '用户名').props.value, server ? 'alice' : '本地用户')
    assert.ok(view.text(server ? zh.account_save_note : zh.account_save_local_note))
    view.find('SecondaryButton', '更换头像').props.onPress(); await flush(); view.render()
    assert.equal(view.calls.filter(call => call[0] === 'save').length, 0)
    view.find('PrimaryButton', '保存').props.onPress(); await flush(); view.render()
    assert.ok(view.text(zh.account_save_failed)); assert.ok(view.text('编辑资料'))
    assert.equal(view.calls.find(call => call[0] === 'save')[2], server)
  }
})

test('normal-user devices screen marks current session and confirms destructive requests', async() => {
  const view = renderAccount(); await flush(); view.render()
  assert.ok(view.text('2 台已登录'))
  view.pressRow('我的设备'); await flush(); view.render()
  assert.ok(view.text('2 台')); assert.ok(view.text('当前'))
  assert.equal(view.nodes().filter(node => node.type === 'SecondaryButton' && node.props.label === '移除').length, 1)
  view.find('SecondaryButton', '移除').props.onPress(); await flush(); view.render()
  assert.equal(view.calls.some(call => call[3] === 'DELETE'), false)
  view.confirm(true)
  view.find('SecondaryButton', '移除').props.onPress(); await flush(); view.render()
  assert.ok(view.calls.some(call => call[3] === 'DELETE'))
  assert.ok(view.text('1 台'))
  assert.equal(view.find('SecondaryButton', '移除'), undefined)
  view.find('SecondaryButton', '退出其他所有设备').props.onPress(); await flush(); view.render()
  assert.ok(view.calls.some(call => call[3] === 'POST' && call[0].endsWith('/revoke-others')))
})

test('account text exists in all three languages', () => {
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const lang = JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of Object.keys(zh).filter(key => key.startsWith('account_'))) assert.equal(typeof lang[key], 'string', `${locale}: ${key}`)
  }
})


test('returning from password change refreshes session credentials and device count', async() => {
  const view = renderAccount(); await flush(); view.render()
  view.pressRow('修改密码'); view.render()
  assert.ok(view.find('ChangePassword'))
  view.setAuth({ ...auth, token: 'password-replacement' })
  view.find('ChangePassword').props.onBack(); await flush(); view.render()
  assert.ok(view.calls.some(call => call[0] === `${host}/api/me/sessions` && call[2] === 'password-replacement'))
  assert.ok(view.text('2 台已登录'))
})

test('session operations retain automatic refresh and retry through the shared request client', async() => {
  const errors = load('src/plugins/sync/client/userErrors.ts')
  const { createLuxAuthClient } = load('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': errors })
  let saved = { ...auth, refreshToken: 'refresh' }; const calls = []
  const client = createLuxAuthClient({
    find: async() => saved,
    getRefreshToken: async() => saved.refreshToken,
    rotate: async(previous, next) => { saved = { ...saved, ...next }; return saved },
    clear: async() => false,
    expired() {},
    send: async(url, options) => {
      calls.push([url, options])
      if (url.endsWith('/refresh')) return { code: 200, text: JSON.stringify({ accessToken: 'renewed', refreshToken: 'next' }) }
      if (options.headers.Authorization === 'Bearer token') return { code: 401, text: '{}' }
      return { code: 200, text: JSON.stringify({ sessions: [devices[0]] }) }
    },
  })
  const service = api.createSessionService(client.request, host, auth.token)
  assert.equal((await service.remove('other')).length, 1)
  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    [`${host}/api/me/sessions/other`, 'DELETE'], [`${host}/api/auth/refresh`, 'POST'],
    [`${host}/api/me/sessions/other`, 'DELETE'], [`${host}/api/me/sessions`, 'GET'],
  ])
  assert.equal(calls[2][1].headers.Authorization, 'Bearer renewed')
  assert.equal(calls[3][1].headers.Authorization, 'Bearer renewed')
})

test('14D loads signature and gender into an isolated draft and saves them together for Lux and local users', async() => {
  for (const server of [true, false]) {
    const view = renderAccount({ server }); await flush(); view.render()
    view.find('SecondaryButton', '编辑').props.onPress(); await flush(); view.render()
    const signature = view.find('UnderlineInput', zh.setting_profile_signature)
    assert.equal(signature.props.value, 'signature')
    assert.equal(signature.props.maxLength, 140)
    assert.ok(view.text(zh.setting_profile_signature_placeholder))
    const options = view.nodes().filter(node => node.type === 'OptionRow')
    assert.deepEqual(options.map(node => node.props.label), [zh.setting_profile_gender_male, zh.setting_profile_gender_female, zh.setting_profile_gender_unknown])
    assert.equal(options[2].props.selected, true)
    assert.ok(options.every(node => node.props.leading && node.props.compact))
    signature.props.onChangeText('  New signature  ')
    options[1].props.onPress(); view.render()
    view.find('UnderlineInput', '昵称').props.onChangeText('New name'); view.render()
    assert.equal(view.calls.filter(call => call[0] === 'save').length, 0)
    view.find('PrimaryButton', '保存').props.onPress(); await flush(); view.render()
    assert.deepEqual(view.calls.find(call => call[0] === 'save'), ['save', { displayName: 'New name', avatar: '', signature: 'New signature', gender: 'female' }, server])
    assert.equal(view.text('编辑资料'), undefined)
  }
})

test('14D failure retains signature/gender draft; cancel discards it; signature keeps old validation', async() => {
  const view = renderAccount({ failSave: true }); await flush(); view.render()
  view.find('SecondaryButton', '编辑').props.onPress(); await flush(); view.render()
  view.find('UnderlineInput', zh.setting_profile_signature).props.onChangeText('x'.repeat(150))
  view.find('OptionRow', zh.setting_profile_gender_male).props.onPress(); view.render()
  view.find('PrimaryButton', '保存').props.onPress(); await flush(); view.render()
  assert.equal(view.calls.find(call => call[0] === 'save')[1].signature, 'x'.repeat(140))
  assert.equal(view.find('UnderlineInput', zh.setting_profile_signature).props.value, 'x'.repeat(150))
  assert.equal(view.find('OptionRow', zh.setting_profile_gender_male).props.selected, true)
  assert.ok(view.text(zh.account_save_failed))
  view.find('BackButton').props.onPress(); view.render()
  view.find('SecondaryButton', '编辑').props.onPress(); await flush(); view.render()
  assert.equal(view.find('UnderlineInput', zh.setting_profile_signature).props.value, 'signature')
  assert.equal(view.find('OptionRow', zh.setting_profile_gender_unknown).props.selected, true)
  for (const value of ['   ', zh.me_profile_status]) {
    view.find('UnderlineInput', zh.setting_profile_signature).props.onChangeText(value); view.render()
    view.find('PrimaryButton', '保存').props.onPress(); await flush(); view.render()
    assert.equal(view.calls.filter(call => call[0] === 'save').at(-1)[1].signature, '')
  }
})

test('5.7 login pulls an empty remote profile without automatically POSTing the local profile', async context => {
  const previous = global.app_event
  context.after(() => { global.app_event = previous })
  const profile = { displayName: '', avatar: '', signature: '', gender: 'unknown' }
  const env = profileHarness(async() => ({ profile }))
  assert.deepEqual(await env.mod.syncLuxProfileOnLogin(host), profile)
  assert.deepEqual(env.calls, [[`${host}/api/me/profile`, null, 'token']])
  assert.equal(env.calls.filter(call => call[1] != null).length, 0)
})

const renderDataDialog = kind => {
  const slots = []; let cursor = 0; const finished = []
  const hooks = {
    useState: initial => {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial } },
    useEffect() {},
  }
  const jsx = (type, props) => ({ type, props })
  const component = load('src/navigation/components/AccountDataDialog.tsx', {
    '@/components/common/SettingsPage': settingsTransitionMock(hooks),
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/common/FocusVisibleScrollView': { FocusVisibleScrollView: 'ScrollView', FocusVisibleAction: 'View' },
    'react-native': { Animated: { View: 'AnimatedView' }, StyleSheet: { absoluteFillObject: {} }, BackHandler: {}, View: 'View', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/magazine': Object.fromEntries(['Checkbox', 'MagazineSheet', 'OptionRow', 'PrimaryButton', 'SecondaryButton', 'TextButton', 'Toggle'].map(name => [name, name])),
    '@/lang': { useI18n: () => t },
    '@/store/common/hook': { useStatusbarHeight: () => 44 },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { surface: {} } }), sharedLuxStyles: builder => () => builder({ surface: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/theme/luxColorMath': { rgbaHex: () => 'scrim' },
    '@/utils/tools': { createStyle: value => value },
  }).default
  const contents = { lists: [{ id: 'love', name: '', count: 4 }, { id: 'one', name: 'One', count: 2 }, { id: 'temp', name: '', count: 1 }], songs: 7, history: 11, bytes: 100 }
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children), ...nodes(node.props?.footerContent)]
  let tree
  const render = () => { cursor = 0; tree = component({ kind, username: 'Alice', host: 'https://server', contents: kind === 'import' ? contents : undefined, finish: async choice => { finished.push(choice) } }) }
  render()
  return { render, finished, nodes: () => nodes(tree), find: (type, label) => nodes(tree).find(node => node.type === type && (!label || node.props.label === label)) }
}

test('5.7 logout dialog defaults to keep, delete changes choice, cancel makes no logout choice', async() => {
  const keep = renderDataDialog('logout')
  assert.equal(keep.find('OptionRow', zh.spaces_keep).props.selected, true)
  assert.equal(keep.find('OptionRow', zh.spaces_delete).props.selected, false)
  keep.find('PrimaryButton').props.onPress(); await flush()
  assert.deepEqual(keep.finished, [false])
  const remove = renderDataDialog('logout')
  remove.find('OptionRow', zh.spaces_delete).props.onPress(); remove.render()
  assert.equal(remove.find('OptionRow', zh.spaces_delete).props.selected, true)
  remove.find('PrimaryButton').props.onPress(); await flush()
  assert.deepEqual(remove.finished, [true])
  const cancel = renderDataDialog('logout')
  cancel.find('TextButton', zh.cancel).props.onPress(); await flush()
  assert.deepEqual(cancel.finished, [null])
})

test('5.7 choose-playlists opens the preview sheet, defaults history off, toggles choices and submits exact selection', async() => {
  const view = renderDataDialog('import')
  assert.equal(view.find('MagazineSheet').props.visible, false)
  view.find('SecondaryButton', zh.spaces_choose).props.onPress(); view.render()
  assert.equal(view.find('MagazineSheet').props.visible, true)
  assert.equal(view.find('MagazineSheet').props.figure.value, '2')
  assert.equal(view.find('Toggle').props.value, false)
  view.find('MagazineSheet').props.headerAction.onPress(); view.render()
  assert.equal(view.find('MagazineSheet').props.figure.value, '3')
  view.find('Toggle').props.onChange(true); view.render()
  view.find('PrimaryButton', zh.spaces_import).props.onPress(); await flush()
  assert.deepEqual(view.finished, [{ ids: ['love', 'one', 'temp'], history: true }])
  const skip = renderDataDialog('import')
  skip.find('TextButton', zh.spaces_no_import).props.onPress(); await flush()
  assert.deepEqual(skip.finished, [null])
  const all = renderDataDialog('import')
  all.find('PrimaryButton', zh.spaces_import_all).props.onPress(); await flush()
  assert.deepEqual(all.finished, [{ ids: ['love', 'one', 'temp'], history: true, all: true }])
})

test('5.7 every new space/dialog string has matching interpolation fields in all three languages', () => {
  const locales = ['zh-cn', 'zh-tw', 'en-us'].map(locale => JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8')))
  for (const key of Object.keys(locales[0]).filter(key => key.startsWith('spaces_'))) {
    const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
    for (const locale of locales) {
      assert.ok(locale[key], key)
      assert.deepEqual(parameters(locale[key]), parameters(locales[0][key]), key)
    }
  }
})
