/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const load = (file, deps = {}) => {
  const js = ts.transpileModule(read(file), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const { createSessionExpiredDialog } = load('src/utils/sessionExpiredDialog.ts')
const account = { host: 'https://lux.june-nas.cn', username: 'june', serverId: 'nas', userId: 'june', token: 'expired' }
const harness = () => {
  const events = []
  let active = account.serverId
  let actions
  const report = createSessionExpiredDialog({
    isActive: value => value.serverId === active,
    disconnect: async() => { events.push('disconnect') },
    show: async(value, later, login) => { actions = { later, login }; events.push(['show', value]) },
    hide: async() => { events.push('hide') },
    login: async value => { events.push(['login', value.host, value.username]) },
  })
  return { report, events, get actions() { return actions }, switch: value => { active = value } }
}

test('expiry dedupes concurrent reports per server and presents at most one dialog', async() => {
  const h = harness()
  await Promise.all(Array.from({ length: 8 }, () => h.report(account)))
  assert.equal(h.events.filter(event => event[0] === 'show').length, 1)
  assert.equal(h.events.filter(event => event === 'disconnect').length, 1)
  await h.actions.later()
  await h.report(account)
  assert.equal(h.events.filter(event => event[0] === 'show').length, 1)
  await h.report({ ...account, token: 'new-login-expired' })
  assert.equal(h.events.filter(event => event[0] === 'show').length, 2)
})

test('inactive server expiry is silent and does not disconnect the active server', async() => {
  const h = harness()
  await h.report({ ...account, serverId: 'other' })
  assert.deepEqual(h.events, [])
})

test('Later dismisses without login; relogin is explicit, once, and retains host and username', async() => {
  const h = harness()
  await h.report(account)
  await h.actions.later()
  assert.deepEqual(h.events.map(event => Array.isArray(event) ? event[0] : event), ['disconnect', 'show', 'hide'])
  await h.report({ ...account, token: 'another' })
  await Promise.all([h.actions.login(), h.actions.login()])
  assert.deepEqual(h.events.at(-1), ['login', account.host, account.username])
  assert.equal(h.events.filter(event => event[0] === 'login').length, 1)
})

test('switching accounts while disconnecting cancels presentation', async() => {
  const h = harness()
  const result = h.report(account)
  h.switch('other')
  await result
  assert.deepEqual(h.events, ['disconnect'])
})

const cn = JSON.parse(read('src/lang/zh-cn.json'))
const jsx = (type, props) => ({ type, props: props ?? {} })
const renderDialog = () => {
  const styles = []
  const component = load('src/navigation/components/SessionExpiredDialog.tsx', {
    react: { useEffect() {} },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', BackHandler: {} },
    '@/components/common/Text': { default: 'Text' },
    '@/components/magazine': { PrimaryButton: 'PrimaryButton', TextButton: 'TextButton' },
    '@/lang': { useI18n: () => (key, args = {}) => Object.entries(args).reduce((value, [name, text]) => value.replace(`{${name}}`, text), cn[key]) },
    '@/theme/LuxTheme': { sharedLuxStyles: fn => () => { const value = fn({}); styles.push(value); return value }, useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({ ink: 'ink', paper: 'paper' }) },
    '@/theme/luxColorMath': { rgbaHex: (color, alpha) => [color, alpha] },
    '@/utils/tools': { createStyle: value => value },
  }).default
  return { tree: component({ account, later: async() => {}, login: async() => {} }), styles }
}
const textOf = node => node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : textOf(node.props.children)
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props.children)]

test('13E dialog renders exact message, separate second line, bold reassurance, compact actions and theme layout', () => {
  const { tree, styles: [styles] } = renderDialog()
  const elements = nodes(tree)
  assert.ok(textOf(tree).includes('账号 • june@lux.june-nas.cn'))
  assert.ok(textOf(tree).includes('登录已失效，请重新登录'))
  assert.ok(textOf(tree).includes('可能是密码已修改，或你在其他设备上退出了这台设备。\n本机歌单和播放记录不会丢失，重新登录后继续同步。'))
  assert.ok(elements.some(node => node.type === 'Text' && node.props.children === '不会丢失' && node.props.style.fontWeight === '700'))
  assert.equal(styles.card.borderTopWidth, 2)
  assert.equal(styles.root.justifyContent, 'center')
  assert.deepEqual(styles.root.backgroundColor, ['ink', 0.42])
  assert.deepEqual(elements.filter(node => /Button$/.test(node.type)).map(node => [node.props.label, node.props.compact]), [['稍后', true], ['重新登录', true]])
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const strings = JSON.parse(read(`src/lang/${locale}.json`))
    for (const key of Object.keys(cn).filter(key => key.startsWith('sync_expired_'))) assert.ok(strings[key], `${locale}: ${key}`)
  }
})

test('production expiry adapter clears only auth, ignores inactive server, and navigates with host on explicit relogin', async() => {
  const events = []
  let overlay
  const auth = { serverId: account.serverId, serverUrl: account.host, token: account.token, user: { id: account.userId, username: account.username } }
  const adapter = load('src/plugins/sync/client/sessionExpired.ts', {
    'react-native-navigation': {
      Navigation: {
        showOverlay: async value => { overlay = value.component; events.push('show') },
        dismissOverlay: async id => { assert.equal(id, overlay.id); events.push('hide') },
      },
    },
    '@/utils/sessionExpiredDialog': { createSessionExpiredDialog },
    '@/utils/dataSpace': { getActiveSpace: () => 'lux:nas:june', luxSpaceId: (server, user) => `lux:${server}:${user}` },
    '@/utils/data': { findLuxAuthForHost: async() => null, clearLuxAuthForServer: async value => { events.push(['clear', value.serverId]); return true } },
    '@/utils/syncLoginPrefill': { syncHostCompareKey: value => value.replace(/\/+$/, '').toLowerCase() },
    '@/core/common': { updateSetting: value => { events.push(['setting', value]) } },
    '@/plugins/sync': { disconnectServer: async() => { events.push('disconnect') } },
    '@/navigation': { navigations: { pushSyncLoginScreen: async props => { events.push(['navigate', props]) } } },
  })
  await adapter.showSessionExpiredDialog('https://other', { ...auth, serverId: 'other' })
  assert.deepEqual(events, [['clear', 'other']])
  events.length = 0
  await Promise.all([adapter.showSessionExpiredDialog(account.host, auth), adapter.showSessionExpiredDialog(account.host, auth)])
  assert.equal(events.filter(event => event === 'show').length, 1)
  assert.equal(events.filter(event => event === 'disconnect').length, 1)
  assert.ok(events.some(event => event[0] === 'setting' && event[1]['sync.enable'] === false))
  assert.equal(events.some(event => event[0] === 'navigate'), false)
  await overlay.passProps.login()
  assert.deepEqual(events.at(-1), ['navigate', { onboarding: false, initialHost: account.host, initialUsername: 'june' }])
  await adapter.showSessionExpiredDialog(account.host)
  assert.equal(events.filter(event => event === 'show').length, 1)
})
