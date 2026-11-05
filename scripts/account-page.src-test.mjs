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
    if (name === '@/utils/sessionFence') return { sessionRemoteWritesFrozen: () => false, sessionWritesFrozen: () => false, sessionGeneration: () => 0, acceptsSessionGeneration: () => true }
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

const renderAccount = ({ server = true, syncHost = host, lux = server } = {}) => {
  const values = []; const effects = []; const calls = []; let cursor = 0; let confirm = false
  const listeners = new Map()
  const events = {
    on(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback) },
    off(name, callback) { listeners.get(name)?.delete(callback) },
  }
  let savedAuth = auth
  let currentDevices = devices.slice()
  let profile = { displayName: 'Alice', avatar: '', signature: 'signature', gender: 'unknown' }
  const hooks = {
    useState: initial => { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value }] },
    useRef: initial => { const i = cursor++; values[i] ??= { current: initial }; return values[i] },
    useCallback: (callback, deps) => {
      const i = cursor++; const old = values[i]
      if (!old || deps.some((value, j) => value !== old.deps[j])) values[i] = { deps, callback }
      return values[i].callback
    },
    useEffect: (effect, deps) => {
      const i = cursor++; const old = effects[i]
      if (!old || deps.some((value, j) => value !== old.deps[j])) effects[i] = { deps, effect, pending: true, cleanup: old?.cleanup }
    },
  }
  const jsx = (type, props) => type?.name === 'SettingsSubpage' ? type(props) : ({ type, props })
  const screen = load('src/screens/Account/AccountPage.tsx', {
    '@/core/appSession': { requestLogin: async intent => { calls.push(['login', intent]) } },
    '@/components/common/SettingsPage': settingsTransitionMock(hooks),
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/common/FocusVisibleScrollView': { FocusVisibleScrollView: 'ScrollView', FocusVisibleAction: 'View' },
    'react-native': { Animated: { View: 'AnimatedView' }, StyleSheet: { absoluteFillObject: {} }, ...Object.fromEntries(['ActivityIndicator', 'View', 'Modal', 'ScrollView', 'KeyboardAvoidingView', 'TouchableOpacity'].map(key => [key, key])), Platform: { OS: 'android' } },
    'react-native-image-crop-picker': { default: { openPicker: async() => ({ data: 'new', mime: 'image/png' }) } },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/Image': { default: 'Image' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/magazine': Object.fromEntries(['BackButton', 'Rule', 'PrimaryButton', 'IconButton', 'SecondaryButton', 'TextButton', 'UnderlineInput', 'OptionRow'].map(key => [key, key])),
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { surface: {} } }), sharedLuxStyles: builder => () => builder() },
    '@/theme/magazineRoles': { magazineRoles: () => ({ ink: 'ink', quiet: 'quiet' }) },
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
    '@/plugins/sync/client/profile': { captureProfileIdentity: () => ({ generation: 0, space: server ? 'lux:server:alice' : 'local' }) },
    '@/utils/data': { DEFAULT_USER_NAME: 'Default user', DEFAULT_USER_AVATAR: 123, findLuxAuthForHost: async() => savedAuth, getUserName: async() => profile.displayName, getUserAvatar: async() => profile.avatar, getUserAvatarDataUrl: async() => profile.avatar, getUserGender: async() => profile.gender, getUserSignature: async() => profile.signature },
    '@/utils/dataSpace': { getActiveSpace: () => server ? 'lux:server:alice' : 'local', listSpaces: async() => [{ id: 'local', kind: 'local' }, { id: 'lux:server:alice', kind: 'lux', label: 'alice' }, { id: 'lux:server:bob', kind: 'lux', label: 'bob' }] },
    '@/utils/accountPage': api,
    './AccountSpaces': { default: 'AccountSpaces' },
    './AccountProfileSheet': { default: 'AccountProfileSheet' },
    '@/navigation/navigation': { pushSyncLoginScreen: async args => { calls.push(['login', args]) } },
    '@/screens/Login/ChangePassword': { default: 'ChangePassword' },
  }).default
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
  let tree
  const withEvents = action => {
    const previousEvents = global.app_event
    global.app_event = events
    try { return action() } finally { global.app_event = previousEvents }
  }
  const render = () => withEvents(() => { cursor = 0; tree = screen({ host: syncHost, lux, nickname: 'Alice', avatar: null, onBack() {}, onLogout: async() => {}, onManageData: () => { calls.push(['manage-data']) } }); for (const effect of effects.filter(Boolean)) if (effect.pending) { effect.cleanup?.(); effect.cleanup = effect.effect(); effect.pending = false } })
  render()
  return { render, calls, emit: (name, value) => { for (const listener of listeners.get(name) ?? []) listener(value) }, listenerCount: name => listeners.get(name)?.size ?? 0, unmount: () => withEvents(() => { for (const effect of effects.filter(Boolean)) effect.cleanup?.() }), setProfile: value => { profile = { ...profile, ...value } }, setAuth: value => { savedAuth = value }, confirm: value => { confirm = value }, nodes: () => nodes(tree), find: (type, label) => nodes(tree).find(node => node.type === type && (!label || node.props.label === label || node.props.accessibilityLabel === label)), text: value => nodes(tree).find(node => node.props?.children === value), pressRow: value => nodes(tree).find(node => node.type === 'TouchableOpacity' && nodes(node).some(child => child.props?.children === value)).props.onPress() }
}

test('account source omits the local-data row and retains account-space data management', () => {
  const source = readFileSync(new URL('../src/screens/Account/AccountPage.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\brow\s*\(\s*t\s*\(\s*['"]spaces_manage['"]/)
  assert.doesNotMatch(source, /管理本机数据/)
  const switchGroup = source.match(/\{section\(t\('account_switch_section'\), undefined, true\)\}([\s\S]*?)\{rows\.includes\('logout'\)/)?.[1]
  assert.ok(switchGroup, 'the account switch group remains present')
  assert.deepEqual([...switchGroup.matchAll(/\brow\(t\('([^']+)'/g)].map(match => match[1]), ['spaces_title', 'account_switch'])
  assert.match(source, /page === 'spaces' \? <AccountSpaces onManageData=\{onManageData\}/)
  const spaces = readFileSync(new URL('../src/screens/Account/AccountSpaces.tsx', import.meta.url), 'utf8')
  assert.match(spaces, /<SecondaryButton\s+compact\s+label=\{t\('spaces_manage'\)\}[^>]+onPress=\{onManageData\}/)
})

test('local, LX and Lux accounts show two switch rows with one divider and preserve data-management access', async() => {
  for (const [provider, options] of [
    ['local', { server: false, syncHost: '', lux: false }],
    ['lx', { server: false, syncHost: host, lux: false }],
    ['lux', { server: true, syncHost: host, lux: true }],
  ]) {
    const view = renderAccount(options); await flush(); view.render()
    assert.equal(view.text(zh.spaces_manage), undefined, `${provider}: no direct data-management row`)
    const flatten = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)]
    const rows = view.nodes().filter(node => node.type === 'TouchableOpacity')
    const titles = rows.map(row => flatten(row).find(node => node.type === 'Text').props.children)
    assert.deepEqual(titles, [zh.account_avatar, zh.account_nickname, zh.setting_profile_signature, zh.setting_profile_gender, ...(options.server ? [zh.account_devices, zh.password_title] : []), zh.spaces_title, zh.account_switch], provider)
    const switchRows = rows.slice(-2)
    const styles = switchRows.map(row => Object.assign({}, ...row.props.style.flat(Infinity).filter(Boolean)))
    assert.deepEqual(styles.map(style => style.borderTopWidth ?? 0), [0, 0], `${provider}: no leading divider`)
    assert.deepEqual(styles.map(style => style.borderBottomWidth), [1, 0], `${provider}: only the divider between rows remains`)
    assert.deepEqual(styles.map(style => style.minHeight), [62, 62], `${provider}: both switch rows match B geometry`)
    assert.deepEqual(switchRows.map(row => flatten(row).find(node => node.type === 'Text').props.size), [16, 16])
    assert.ok(switchRows.every(row => flatten(row).find(node => node.type === 'MdiIcon').props.color === 'quiet'))
    const profileRows = rows.slice(0, 4)
    assert.ok(profileRows.every(row => Object.assign({}, ...row.props.style.flat(Infinity).filter(Boolean)).minHeight === 62))
    assert.ok(profileRows.every(row => row.props.accessibilityLabel && row.props.accessibilityHint && row.props.activeOpacity === 0.7))
    if (options.server) {
      const securityRows = rows.slice(4, 6)
      assert.deepEqual(securityRows.map(row => Object.assign({}, ...row.props.style.flat(Infinity).filter(Boolean)).minHeight), [56, 56], 'security retains original row height')
      assert.deepEqual(securityRows.map(row => flatten(row).find(node => node.type === 'Text').props.size), [15, 15], 'security retains original typography')
      assert.ok(securityRows.every(row => flatten(row).find(node => node.type === 'MdiIcon').props.color === 'ink'), 'security retains original chevron tone')
    }
    view.pressRow(zh.spaces_title); view.render()
    const spaces = view.find('AccountSpaces')
    assert.ok(spaces, `${provider}: account spaces remain reachable`)
    spaces.props.onManageData()
    assert.deepEqual(view.calls.filter(call => call[0] === 'manage-data'), [['manage-data']], `${provider}: the nested management action retains its callback`)
  }
})

test('account B has an H2 and read-only identity, four direct field rows, and unchanged security/switch destinations', async() => {
  for (const [provider, options] of [
    ['local', { server: false, syncHost: '', lux: false }],
    ['lx', { server: false, syncHost: host, lux: false }],
    ['lux', { server: true, syncHost: host, lux: true }],
  ]) {
    const view = renderAccount(options); await flush(); view.render()
    assert.ok(view.text(zh.account_title), `${provider}: account H2`)
    assert.equal(view.find('SecondaryButton', zh.account_edit), undefined, `${provider}: no generic edit button`)
    assert.equal(view.find('UnderlineInput', zh.auth_username), undefined, `${provider}: identity is not an editable field`)
    assert.equal(Boolean(view.text(zh.account_devices)), options.server, provider)
    assert.equal(Boolean(view.text(zh.password_title)), options.server, provider)
    assert.equal(Boolean(view.find('SecondaryButton', zh.account_logout)), options.server, provider)
    assert.ok(view.text(options.server ? '本机还有：本地用户、bob' : '本机还有：alice、bob'), provider)
    assert.ok(view.text(options.server ? 'alice · server/path · 成员' : zh[provider === 'lx' ? 'account_lx_identity' : 'account_local_identity']), `${provider}: mode identity`)
    view.pressRow(zh.account_switch); await flush()
    assert.deepEqual(view.calls.filter(call => call[0] === 'login'), [['login', { reason: 'switch', source: 'E06-account', returnPolicy: 'restorePrevious' }]], `${provider}: original LoginGate destination`)
    for (const [label, field, initialValue] of [
      [zh.account_avatar, 'avatar', ''],
      [zh.account_nickname, 'displayName', 'Alice'],
      [zh.setting_profile_signature, 'signature', 'signature'],
      [zh.setting_profile_gender, 'gender', 'unknown'],
    ]) {
      view.pressRow(label); await flush(); view.render()
      const sheet = view.find('AccountProfileSheet')
      assert.ok(sheet?.props.visible, `${provider}: ${field} opens its sheet directly`)
      assert.equal(sheet.props.field, field)
      assert.equal(sheet.props.initialValue, initialValue)
      assert.equal(sheet.props.server, options.server)
      assert.deepEqual(sheet.props.identity, { generation: 0, space: options.server ? 'lux:server:alice' : 'local' })
      assert.equal(view.text(zh.account_edit_title), undefined, `${provider}: no third-level profile editor`)
      sheet.props.onClose(); view.render()
      assert.equal(view.find('AccountProfileSheet')?.props.visible ?? false, false)
    }
  }
})

test('saved profile values refresh the account rows and each reopened field reads current storage', async() => {
  const view = renderAccount(); await flush(); view.render()
  view.pressRow(zh.setting_profile_signature); await flush(); view.render()
  view.setProfile({ signature: 'Updated signature', gender: 'female' })
  await view.find('AccountProfileSheet').props.onSaved(); view.render()
  assert.ok(view.text('Updated signature'))
  assert.ok(view.text(zh.setting_profile_gender_female))
  view.find('AccountProfileSheet').props.onClose(); view.render()
  view.pressRow(zh.setting_profile_signature); await flush(); view.render()
  assert.equal(view.find('AccountProfileSheet').props.initialValue, 'Updated signature')
})

test('clearing nickname refreshes to the default display name instead of the stale parent nickname', async() => {
  const view = renderAccount(); await flush(); view.render()
  view.pressRow(zh.account_nickname); await flush(); view.render()
  view.setProfile({ displayName: null })
  await view.find('AccountProfileSheet').props.onSaved(); view.render()
  assert.ok(view.text(t('account_nickname_value', { name: 'Default user' })))
  assert.equal(view.text(t('account_nickname_value', { name: 'Alice' })), undefined)
})

test('background profile events refresh the account without replacing an open field draft, and unsubscribe on unmount', async() => {
  const view = renderAccount(); await flush(); view.render()
  view.pressRow(zh.setting_profile_signature); await flush(); view.render()
  view.emit('userSignatureUpdated', 'Background signature')
  view.emit('userGenderUpdated', 'male')
  view.emit('userNameUpdated', '')
  view.emit('userAvatarUpdated', 'data:image/png;base64,background')
  view.render()
  assert.ok(view.text('Background signature'))
  assert.ok(view.text(zh.setting_profile_gender_male))
  assert.ok(view.text(t('account_nickname_value', { name: 'Default user' })))
  assert.equal(view.find('Image').props.url, 'data:image/png;base64,background')
  assert.equal(view.find('AccountProfileSheet').props.initialValue, 'signature', 'background pulls do not overwrite an active sheet snapshot')
  for (const name of ['userNameUpdated', 'userAvatarUpdated', 'userSignatureUpdated', 'userGenderUpdated']) assert.equal(view.listenerCount(name), 1)
  view.unmount()
  for (const name of ['userNameUpdated', 'userAvatarUpdated', 'userSignatureUpdated', 'userGenderUpdated']) assert.equal(view.listenerCount(name), 0)
})

test('account B source guards the four-row order and direct signature editing without a profile hero or edit route', () => {
  const source = readFileSync(new URL('../src/screens/Account/AccountPage.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /styles\.hero|hero:\s*\{|t\('account_edit'\)|setPage\('edit'\)|page === 'edit'|\| 'edit'/)
  assert.match(source, /<Text size=\{32\}[^>]+>\{t\('account_title'\)\}/)
  const fields = [...source.matchAll(/profileRow\('([^']+)'/g)].map(match => match[1])
  assert.deepEqual(fields, ['avatar', 'displayName', 'signature', 'gender'])
  assert.match(source, /<AccountProfileSheet/)
  assert.doesNotMatch(source, /<UnderlineInput/)
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
    for (const key of Object.keys(zh).filter(key => key.startsWith('account_'))) {
      assert.equal(typeof lang[key], 'string', `${locale}: ${key}`)
      const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
      assert.deepEqual(params(lang[key]), params(zh[key]), `${locale}: ${key} interpolation`)
    }
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
  const jsx = (type, props) => type?.name === 'SettingsSubpage' ? type(props) : ({ type, props })
  const component = load('src/navigation/components/AccountDataDialog.tsx', {
    '@/components/common/SettingsPage': settingsTransitionMock(hooks),
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/common/FocusVisibleScrollView': { FocusVisibleScrollView: 'ScrollView', FocusVisibleAction: 'View' },
    'react-native': { Animated: { View: 'AnimatedView' }, StyleSheet: { absoluteFillObject: {} }, BackHandler: {}, View: 'View', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/magazine': Object.fromEntries(['Checkbox', 'MagazineSheet', 'OptionRow', 'PrimaryButton', 'IconButton', 'SecondaryButton', 'TextButton', 'Toggle'].map(name => [name, name])),
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


const renderProfileSheet = ({ field = 'signature', initialValue = 'signature', server = true, failSave = false, saveWait, pickerError } = {}) => {
  const values = []; const effects = []; const calls = []; let cursor = 0; let confirmed = false; let keyboardVisible = false
  const identity = { generation: 7, space: server ? 'lux:server:alice' : 'local' }
  const hooks = {
    useState: initial => { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value }] },
    useRef: initial => { const i = cursor++; values[i] ??= { current: initial }; return values[i] },
    useEffect: (effect, deps = []) => { const i = cursor++; const old = effects[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) effects[i] = { deps, effect, pending: true, cleanup: old?.cleanup } },
    useMemo: (create, deps) => { const i = cursor++; const old = values[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) values[i] = { deps, value: create() }; return values[i].value },
    useCallback: callback => { cursor++; return callback },
  }
  const jsx = (type, props) => ({ type, props })
  const screen = load('src/screens/Account/AccountProfileSheet.tsx', {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      ...Object.fromEntries(['ActivityIndicator', 'View', 'TouchableOpacity', 'KeyboardAvoidingView'].map(key => [key, key])),
      Platform: { OS: 'android' },
      useWindowDimensions: () => ({ width: 375, height: 812 }),
      Keyboard: { isVisible: () => keyboardVisible, dismiss: () => { keyboardVisible = false; calls.push(['dismiss-keyboard']) }, addListener: () => ({ remove() {} }) },
    },
    'react-native-image-crop-picker': { default: { openPicker: async options => { calls.push(['pick', options]); if (pickerError) throw pickerError; return { data: 'new', mime: 'image/png' } } } },
    '@/components/common/FocusVisibleScrollView': { FocusVisibleScrollView: 'ScrollView', FocusVisibleAction: 'FocusVisibleAction' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/Image': { default: 'Image' },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/magazine': Object.fromEntries(['MagazineSheet', 'Rule', 'PrimaryButton', 'IconButton', 'SecondaryButton', 'TextButton', 'UnderlineInput', 'OptionRow'].map(key => [key, key])),
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { surface: {} } }), sharedLuxStyles: builder => () => builder({ surface: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': { createStyle: value => value, confirmDialog: async options => { calls.push(['confirm', options]); return confirmed } },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0 },
    '@/lang': { useI18n: () => t },
    '@/plugins/sync/client/profile': { saveEditedProfileField: async(...args) => { calls.push(['save', ...args]); if (failSave) throw new Error('offline'); await saveWait; return { displayName: 'Alice', avatar: '', signature: 'signature', gender: 'unknown', [args[0]]: args[1] } } },
  }).default
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children), ...nodes(node.props?.footerContent), ...nodes(node.props?.subject), ...nodes(node.props?.toolExtra)]
  let tree
  const render = () => {
    cursor = 0
    tree = screen({ visible: true, field, initialValue, identity, server, nickname: 'Alice', onClose: () => { calls.push(['closed']) }, onSaved: async() => { calls.push(['refreshed']) } })
    for (const effect of effects.filter(Boolean)) if (effect.pending) { effect.cleanup?.(); effect.cleanup = effect.effect(); effect.pending = false }
  }
  render(); render()
  return { render, calls, identity, confirm: value => { confirmed = value }, keyboard: value => { keyboardVisible = value }, nodes: () => nodes(tree), find: (type, label) => nodes(tree).find(node => node.type === type && (!label || node.props.label === label || node.props.accessibilityLabel === label)), text: value => nodes(tree).find(node => node.props?.children === value) }
}

test('each account B sheet edits only its own field and exposes the current save scope', () => {
  for (const server of [true, false]) {
    for (const [field, initialValue, inputLabel] of [
      ['avatar', '', null],
      ['displayName', 'Alice', zh.account_nickname],
      ['signature', 'signature', zh.setting_profile_signature],
      ['gender', 'unknown', null],
    ]) {
      const view = renderProfileSheet({ field, initialValue, server })
      const sheet = view.find('MagazineSheet')
      assert.equal(sheet.props.visible, true)
      assert.equal(sheet.props.profileLayout, true)
      assert.equal(sheet.props.inlineBottomInset, undefined, 'a native temporary task covers Dock')
      const inputs = view.nodes().filter(node => node.type === 'UnderlineInput')
      assert.equal(inputs.length, inputLabel ? 1 : 0, field)
      if (inputLabel) {
        assert.equal(inputs[0].props.accessibilityLabel, inputLabel)
        assert.equal(inputs[0].props.value, initialValue)
      }
      assert.equal(view.nodes().filter(node => node.type === 'OptionRow').length, field === 'gender' ? 3 : 0)
      assert.equal(Boolean(view.find('SecondaryButton', zh.account_change_avatar)), field === 'avatar')
      assert.ok(view.text(server ? zh.account_save_note : zh.account_save_local_note))
      assert.equal(view.find('TouchableOpacity', zh.account_save).props.disabled, true)
      assert.ok(view.find('FocusVisibleAction'), 'save/cancel participate in focus visibility scrolling')
      assert.equal(view.find('ScrollView').props.keyboardShouldPersistTaps, 'handled')
    }
  }
})

test('signature sheet keeps 140-character input, count, normalization, and explicit per-field saves', async() => {
  for (const server of [true, false]) {
    for (const [draft, expected] of [['  New signature  ', 'New signature'], ['x'.repeat(150), 'x'.repeat(140)], ['   ', ''], [zh.me_profile_status, '']]) {
      const view = renderProfileSheet({ server })
      const signature = view.find('UnderlineInput', zh.setting_profile_signature)
      assert.equal(signature.props.maxLength, 140)
      assert.equal(signature.props.multiline, true)
      assert.equal(signature.props.placeholder, zh.setting_profile_signature_placeholder)
      signature.props.onChangeText(draft); view.render()
      assert.ok(view.text(t('account_signature_count', { count: draft.length })))
      assert.equal(view.find('TouchableOpacity', zh.account_save).props.disabled, false)
      assert.equal(view.calls.some(call => call[0] === 'save'), false, 'typing does not save')
      view.find('TouchableOpacity', zh.account_save).props.onPress(); await flush(); view.render()
      assert.deepEqual(view.calls.find(call => call[0] === 'save'), ['save', 'signature', expected, server, view.identity])
      assert.deepEqual(view.calls.filter(call => ['refreshed', 'closed'].includes(call[0])), [['refreshed'], ['closed']])
    }
  }
})

test('nickname trims without a new required/length restriction, and gender remains three exclusive choices', async() => {
  for (const draft of ['  Renamed  ', '', 'n'.repeat(200)]) {
    const view = renderProfileSheet({ field: 'displayName', initialValue: 'Alice' })
    const input = view.find('UnderlineInput', zh.account_nickname)
    assert.equal(input.props.maxLength, undefined)
    assert.ok(view.text(zh.account_nickname_hint))
    input.props.onChangeText(draft); view.render()
    view.find('TouchableOpacity', zh.account_save).props.onPress(); await flush()
    assert.equal(view.calls.find(call => call[0] === 'save')[2], draft.trim())
  }
  const view = renderProfileSheet({ field: 'gender', initialValue: 'unknown' })
  let options = view.nodes().filter(node => node.type === 'OptionRow')
  assert.deepEqual(options.map(node => node.props.label), [zh.setting_profile_gender_male, zh.setting_profile_gender_female, zh.setting_profile_gender_unknown])
  assert.ok(options.every(node => node.props.leading && node.props.compact))
  assert.deepEqual(options.map(node => node.props.selected), [false, false, true])
  options[1].props.onPress(); view.render()
  options = view.nodes().filter(node => node.type === 'OptionRow')
  assert.deepEqual(options.map(node => node.props.selected), [false, true, false])
  assert.equal(view.calls.some(call => call[0] === 'save'), false)
  view.find('TouchableOpacity', zh.account_save).props.onPress(); await flush()
  assert.deepEqual(view.calls.find(call => call[0] === 'save'), ['save', 'gender', 'female', true, view.identity])
})

test('avatar picking preserves the 400px circular crop and waits for explicit save; picker cancellation is harmless', async() => {
  const view = renderProfileSheet({ field: 'avatar', initialValue: '' })
  view.find('SecondaryButton', zh.account_change_avatar).props.onPress(); await flush(); view.render()
  assert.deepEqual(view.calls.find(call => call[0] === 'pick')[1], { width: 400, height: 400, cropping: true, cropperCircleOverlay: true, mediaType: 'photo', includeBase64: true })
  assert.equal(view.find('Image').props.url, 'data:image/png;base64,new')
  assert.equal(view.calls.some(call => call[0] === 'save'), false)
  assert.equal(view.find('TouchableOpacity', zh.account_save).props.disabled, false)
  view.find('TouchableOpacity', zh.account_save).props.onPress(); await flush()
  assert.deepEqual(view.calls.find(call => call[0] === 'save'), ['save', 'avatar', 'data:image/png;base64,new', true, view.identity])
  const cancel = renderProfileSheet({ field: 'avatar', initialValue: '', pickerError: { code: 'E_PICKER_CANCELLED' } })
  cancel.find('SecondaryButton', zh.account_change_avatar).props.onPress(); await flush(); cancel.render()
  assert.equal(cancel.find('TouchableOpacity', zh.account_save).props.disabled, true)
  assert.equal(cancel.text(zh.account_avatar_failed), undefined)
  assert.equal(cancel.calls.some(call => call[0] === 'save'), false)
})

test('unchanged/reverted sheets disable save; submission prevents duplicate saves and every close path', async() => {
  let finish
  const view = renderProfileSheet({ saveWait: new Promise(resolve => { finish = resolve }) })
  const save = () => view.find('TouchableOpacity', zh.account_save)
  assert.equal(save().props.disabled, true)
  save().props.onPress(); await flush()
  assert.equal(view.calls.some(call => call[0] === 'save'), false)
  view.find('UnderlineInput').props.onChangeText('Changed'); view.render()
  assert.equal(save().props.disabled, false)
  view.find('UnderlineInput').props.onChangeText('signature'); view.render()
  assert.equal(save().props.disabled, true)
  view.find('UnderlineInput').props.onChangeText('Changed'); view.render()
  save().props.onPress(); view.render()
  assert.equal(save().props.disabled, true)
  assert.equal(view.find('MagazineSheet').props.closeDisabled, true)
  assert.equal(view.find('UnderlineInput').props.editable, false)
  assert.equal(view.find('TouchableOpacity', zh.cancel).props.disabled, true)
  assert.ok(view.find('ActivityIndicator'))
  save().props.onPress()
  view.find('MagazineSheet').props.onClose()
  view.find('TouchableOpacity', zh.cancel).props.onPress()
  assert.equal(view.calls.filter(call => call[0] === 'save').length, 1)
  assert.equal(view.calls.some(call => ['closed', 'confirm'].includes(call[0])), false)
  finish(); await flush(); view.render()
  assert.equal(view.calls.filter(call => call[0] === 'closed').length, 1)
})

test('close/cancel first dismiss IME, then confirm dirty draft discard; failed saves retain the value and sheet', async() => {
  const unchanged = renderProfileSheet()
  unchanged.find('MagazineSheet').props.onClose(); await flush()
  assert.deepEqual(unchanged.calls, [['closed']])
  const view = renderProfileSheet({ failSave: true })
  view.find('UnderlineInput').props.onChangeText('Failed draft'); view.render()
  view.keyboard(true)
  view.find('MagazineSheet').props.onClose(); await flush()
  assert.deepEqual(view.calls, [['dismiss-keyboard']])
  view.find('TouchableOpacity', zh.cancel).props.onPress(); await flush()
  assert.equal(view.calls.filter(call => call[0] === 'confirm').length, 1)
  assert.equal(view.calls.some(call => call[0] === 'closed'), false)
  assert.equal(view.find('UnderlineInput').props.value, 'Failed draft')
  view.find('TouchableOpacity', zh.account_save).props.onPress(); await flush(); view.render()
  assert.equal(view.find('UnderlineInput').props.value, 'Failed draft')
  assert.ok(view.text(zh.account_save_failed))
  assert.equal(view.calls.some(call => ['refreshed', 'closed'].includes(call[0])), false)
  assert.equal(view.find('TouchableOpacity', zh.account_save).props.disabled, false, 'draft can retry')
  view.confirm(true)
  view.find('MagazineSheet').props.onClose(); await flush()
  assert.equal(view.calls.filter(call => call[0] === 'closed').length, 1)
  assert.equal(view.calls.filter(call => call[0] === 'save').length, 1, 'discard does not save locally')
})
