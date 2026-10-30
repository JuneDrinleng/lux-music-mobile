import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const module = { exports: {} }
new Script(`(function(module,exports){${ts.transpileModule(readFileSync(new URL('../src/core/together/inviteCode.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText}})`).runInThisContext()(module, module.exports)
const m = module.exports
const invite = { code: '482799', serverId: 'server-a', roomId: 'room-a', host: '小林', song: 'red', members: 3 }
test('whole invite round trips chat wrappers, full width, whitespace, optional metadata', () => {
  const text = m.formatInviteText(invite, '【Lux 一起听】小林邀你一起听「red」')
  assert.deepEqual(m.parseInviteText(`转发消息\n${text}\n来自聊天`), invite)
  const token = m.formatInviteToken(invite).replace(/LX482799/, 'ＬＸ４８２７９９').replace(/%/g, '％').split('').join(' \n')
  assert.deepEqual(m.parseInviteText(token), invite)
  const minimal = { code: '123456', serverId: 's', roomId: 'r' }
  assert.deepEqual(m.parseInviteText(m.formatInviteText(minimal)), minimal)
  for (const bad of ['482799', '₤LX482799-%broken₤', '₤LX123456-null₤', m.formatInviteToken(invite).replace('LX482799', 'LX123456')]) assert.equal(m.parseInviteText(bad), null)
})
test('validation and server expiry never trust malformed or expired text', () => {
  for (const patch of [{ code: '000001' }, { serverId: '' }, { roomId: '' }, { members: -1 }, { expiresAt: NaN }, { host: {} }]) assert.equal(m.validInvite({ ...invite, ...patch }), false)
  const expiring = { ...invite, expiresAt: Date.now() + 10000 }
  assert.equal(m.parseInviteText(m.formatInviteText(expiring), expiring.expiresAt), null)
  assert.deepEqual(m.parseInviteText(m.formatInviteText(expiring), expiring.expiresAt - 1), expiring)
})
test('pending survives cold start/login/connection and only joins correct server once ready', () => {
  const pending = JSON.parse(JSON.stringify({ invite, accepted: true }))
  const gate = { loggedIn: true, connected: true, serverId: invite.serverId }
  for (const patch of [{ loggedIn: false }, { connected: false }, { serverId: 'other' }, { busy: true }, { currentRoomId: 'other' }]) assert.equal(m.pendingInviteDecision(pending, { ...gate, ...patch }), 'hold')
  assert.equal(m.pendingInviteDecision({ ...pending, accepted: false }, gate), 'hold')
  assert.equal(m.pendingInviteDecision(pending, gate), 'join')
  assert.equal(m.pendingInviteDecision(pending, { ...gate, currentRoomId: invite.roomId }), 'joined')
  assert.equal(m.pendingInviteDecision(null, gate), 'empty')
  assert.equal(m.pendingInviteDecision({ invite: { ...invite, expiresAt: 1 }, accepted: true }, gate), 'expired')
  assert.equal(m.inviteIdentity(invite), m.inviteIdentity({ ...invite, host: 'changed' }))
  assert.notEqual(m.inviteIdentity(invite), m.inviteIdentity({ ...invite, serverId: 'other' }))
})
const controllerModule = { exports: {} }
new Script(`(function(require,module,exports){${ts.transpileModule(readFileSync(new URL('../src/core/together/inviteController.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText}})`).runInThisContext()(() => m, controllerModule, controllerModule.exports)
const harness = (disk = null) => {
  let stored = disk
  let gate = { loggedIn: false, connected: false }
  const events = []
  const joins = []
  let reads = 0
  const controller = controllerModule.exports.createInviteController({
    load: async() => stored,
    save: async value => { stored = structuredClone(value) },
    read: async() => { reads++; return m.formatInviteText(invite) },
    changed: value => events.push(value),
    gate: async() => gate,
    join: async value => { joins.push(value); return true },
  })
  return { controller, events, joins, reads: () => reads, disk: () => stored, gate: value => { gate = value } }
}
test('foreground detection persists acceptance across restart and deduplicates join', async() => {
  const h = harness()
  await h.controller.foreground(false)
  assert.equal(h.reads(), 0)
  await h.controller.foreground(true)
  assert.deepEqual(h.events.at(-1), invite)
  await h.controller.accept()
  assert.equal(h.joins.length, 0)
  assert.equal(h.disk().pending.accepted, true)
  const resumed = harness(h.disk())
  resumed.gate({ loggedIn: true, connected: true, serverId: invite.serverId })
  await resumed.controller.foreground(true)
  await Promise.all([resumed.controller.pump(), resumed.controller.pump()])
  assert.equal(resumed.joins.length, 1)
  assert.equal(resumed.disk().pending, null)
})
test('ignore and device-wide never prompt persist through restarts', async() => {
  for (const disable of [false, true]) {
    const h = harness()
    await h.controller.foreground(true)
    await h.controller.dismiss(disable)
    const resumed = harness(h.disk())
    await resumed.controller.foreground(true)
    assert.equal(resumed.events.some(Boolean), false)
    assert.equal(resumed.reads(), disable ? 0 : 1)
    assert.equal(resumed.disk().ignored.includes(m.inviteIdentity(invite)), true)
  }
})
test('unsupported servers suppress clipboard reads and prompts while retaining pending', async() => {
  const h = harness({ disabled: false, ignored: [], pending: { invite, accepted: true } })
  h.gate({ loggedIn: true, connected: true, supported: false, serverId: invite.serverId })
  await h.controller.foreground(true)
  assert.equal(h.reads(), 0)
  assert.equal(h.joins.length, 0)
  assert.equal(h.events.some(Boolean), false)
  h.gate({ loggedIn: true, connected: true, supported: true, serverId: invite.serverId })
  await h.controller.pump()
  assert.equal(h.joins.length, 1)
})
test('backgrounding during clipboard read discards its result', async() => {
  let resolve
  let reads = 0
  const events = []
  const controller = controllerModule.exports.createInviteController({
    load: async() => null,
    save: async() => {},
    read: async() => { reads++; return new Promise(_resolve => { resolve = _resolve }) },
    gate: async() => ({ loggedIn: false, connected: false }),
    join: async() => { throw new Error('must not join') },
    changed: value => events.push(value),
  })
  const active = controller.foreground(true)
  for (let i = 0; i < 1000; i++) {
    if (reads > 0) break
    await new Promise(_resolve => setImmediate(_resolve))
  }
  await controller.foreground(false)
  resolve(m.formatInviteText(invite))
  await active
  assert.equal(events.some(Boolean), false)
})
test('failed join retains invite without an automatic retry loop', async() => {
  const events = []
  let disk = { disabled: false, ignored: [], pending: { invite, accepted: true } }
  let calls = 0
  const controller = controllerModule.exports.createInviteController({
    load: async() => disk,
    save: async value => { disk = value },
    read: async() => { throw new Error('pending invite must block read') },
    gate: async() => ({ loggedIn: true, connected: true, serverId: invite.serverId }),
    join: async() => { calls++; throw new Error('connection dropped') },
    changed: value => events.push(value),
  })
  await controller.foreground(true)
  await controller.pump()
  assert.equal(calls, 1)
  assert.equal(disk.pending.accepted, false)
  assert.deepEqual(events.at(-1), invite)
})

// Render the production components with the same hook/JSX adapters as auth-screens.
const renderInviteView = (file, overrides = {}) => {
  const values = []; let cursor = 0; let jsxCalls = 0; let controllerDeps
  const events = []
  const jsx = (type, props) => { jsxCalls++; return { type, props } }
  const deps = {
    react: {
      useState: initial => { const index = cursor++; if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial; return [values[index], value => { values[index] = value }] },
      useEffect: () => {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', ScrollView: 'ScrollView', AppState: {}, Share: { share: async value => { events.push(['share', value.message]) } } },
    '@react-native-clipboard/clipboard': { default: {} },
    '@/components/common/Text': { default: 'Text' },
    '@/components/magazine': Object.fromEntries(['MagDialog', 'MagazineSheet', 'PrimaryButton', 'SecondaryButton', 'TextButton'].map(key => [key, key])),
    '@/core/together/inviteController': { createInviteController: value => { controllerDeps = value; return { dismiss: async disable => { events.push(['dismiss', disable]); value.changed(null) }, accept: async() => { events.push(['accept']); value.changed(null) } } } },
    '@/core/together/inviteCode': m,
    '@/core/together': { refreshRoom: async() => {}, joinTogetherRoom: async() => ({ ok: true }) },
    '@/plugins/storage': {},
    '@/utils/data': {},
    '@/plugins/sync/client/session': {},
    '@/store/together/action': {},
    '@/store/together/state': { default: {} },
    '@/store/together/hook': { useTogether: () => ({ room: { ...invite, members: [], playback: {} }, connection: 'online' }) },
    '@/lang': { useI18n: () => key => key },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: builder => () => builder() },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': { createStyle: value => value, toast: () => {}, clipboardWriteText: value => { events.push(['copy', value]) } },
    ...overrides,
  }
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync(new URL(`../src/screens/Home/Vertical/ListenTogether/${file}.tsx`, import.meta.url), 'utf8'), { fileName: `${file}.tsx`, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Script(`(function(require,module,exports){${js}})`).runInThisContext()(name => { assert.ok(name in deps, name); return deps[name] }, module, module.exports)
  return {
    render: () => { cursor = 0; jsxCalls = 0; return module.exports.default({ visible: true, onClose: () => {} }) },
    show: value => controllerDeps.changed(value),
    events,
    jsxCalls: () => jsxCalls,
    setServer: value => { values[0] = value },
  }
}
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
test('hidden clipboard prompt mounts nothing, leaving no dialog or layer over the Dock', () => {
  const h = renderInviteView('ClipboardInvitePrompt')
  assert.equal(h.render(), null)
  assert.equal(h.jsxCalls(), 0)
  for (const [label, event] of [['invite_ignore', ['dismiss', undefined]], ['invite_never', ['dismiss', true]], ['invite_join', ['accept']]]) {
    h.show(invite)
    const tree = h.render()
    assert.equal(tree.type, 'MagDialog')
    nodes(tree).find(node => node.props?.label === label).props.onPress()
    assert.deepEqual(h.events.at(-1), event)
    assert.equal(h.render(), null)
    assert.equal(h.jsxCalls(), 0)
  }
})
test('6D copies the entire machine-readable token and shares the complete displayed invite', async() => {
  const h = renderInviteView('InviteSheet')
  h.setServer(invite.serverId)
  const sheet = h.render()
  const buttons = nodes(sheet.props.footerContent)
  buttons.find(node => node.type === 'SecondaryButton').props.onPress()
  const token = h.events.at(-1)[1]
  assert.ok(token.startsWith('₤LX482799-') && token.endsWith('₤'))
  assert.equal(m.parseInviteText(token).roomId, invite.roomId)
  buttons.find(node => node.type === 'PrimaryButton').props.onPress()
  assert.deepEqual(h.events.at(-1), ['share', h.events.at(-2)[1]])
  const displayed = nodes(sheet).find(node => node.type === 'Text' && node.props.selectable).props.children
  assert.equal(h.events.at(-1)[1], displayed)
  assert.equal(m.parseInviteText(displayed).code, invite.code)
})
test('all invite copy is available in each supported locale', () => {
  const locales = ['zh-cn', 'zh-tw', 'en-us'].map(locale => JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8')))
  for (const key of Object.keys(locales[0]).filter(key => key.startsWith('invite_'))) for (const locale of locales) assert.equal(typeof locale[key], 'string', key)
})
test('empty controller exposes null and background work never joins or reads', async() => {
  const h = harness()
  await h.controller.pump()
  assert.equal(h.reads(), 0)
  await h.controller.foreground(false)
  assert.equal(h.events.at(-1), null)
  assert.equal(h.joins.length, 0)
})
test('accepted invite waits for login and connection notifications without another clipboard read', async() => {
  const h = harness()
  await h.controller.foreground(true)
  await h.controller.accept()
  h.gate({ loggedIn: true, connected: false, serverId: invite.serverId })
  await h.controller.pump()
  assert.equal(h.joins.length, 0)
  h.gate({ loggedIn: true, connected: true, serverId: invite.serverId })
  await h.controller.pump()
  await h.controller.pump()
  assert.equal(h.joins.length, 1)
  assert.equal(h.reads(), 1)
  assert.equal(h.disk().pending, null)
})
test('a previous foreground read cannot surface after background and reactivation', async() => {
  let resolveRead
  let signalRead
  const started = new Promise(resolve => { signalRead = resolve })
  const events = []
  const controller = controllerModule.exports.createInviteController({
    load: async() => null,
    save: async() => {},
    read: async() => new Promise(resolve => { resolveRead = resolve; signalRead() }),
    gate: async() => ({ loggedIn: false, connected: false }),
    join: async() => { throw new Error('must not join') },
    changed: value => events.push(value),
  })
  const first = controller.foreground(true)
  await started
  await controller.foreground(false)
  await controller.foreground(true)
  resolveRead(m.formatInviteText(invite))
  await first
  assert.equal(events.some(Boolean), false)
  assert.equal(events.at(-1), null)
})
