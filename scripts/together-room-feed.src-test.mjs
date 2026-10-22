/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (path, imports = {}) => {
  const source = ts.transpileModule(readFileSync(join(root, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports) {${source}\n})`, { filename: path }).runInThisContext()(name => {
    assert.ok(name in imports, `unexpected import ${name}`)
    return imports[name]
  }, module, module.exports)
  return module.exports
}
const model = load('src/core/together/roomFeed.ts')
const features = { together: 1, 'together.chat': 1, 'together.reaction': 1, 'together.request': 1 }
const song = id => ({ id, source: 'wy', name: id })
const room = (patch = {}) => ({ roomId: 'room', hostId: 'self', version: 1, queueVersion: 7, members: [{ memberId: 'self', displayName: 'Me' }], queue: { items: [], currentId: null }, playback: { musicInfo: null }, ...patch })
const message = (id, patch = {}) => ({ id, roomId: 'room', senderId: 'self', displayName: 'Me', text: `message ${id}`, at: id * 10, clientMsgId: `msg-${id}`, ...patch })
const request = id => ({ id, at: 20, song: song(id), requestedBy: { memberId: 'self', displayName: 'Me' }, status: 'pending' })
const ok = data => ({ ok: true, data })
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject })
  return { promise, resolve, reject }
}
const feed = (call = async() => ok(null), options = {}) => {
  const result = model.createRoomFeed(call, { now: () => 1000, ...options })
  result.setContext(model.roomCapabilities(features, true), 'self')
  result.setRoom(room())
  return result
}

test('room timeline models chat, reactions, membership and song changes with authoritative IDs', () => {
  const f = feed()
  f.chat(message(2))
  f.chat(message(2, { text: 'canonical' }))
  f.chat(message(3, { roomId: 'other' }))
  f.reaction({ roomId: 'room', emoji: '👍', memberId: 'self', displayName: 'Me', at: 30 })
  f.system({ kind: 'system', id: 'join:1', event: 'join', memberId: 'self', at: 5, timeSource: 'server' })
  f.system({ kind: 'system', id: 'song:1', event: 'songChange', song: song('one'), at: 40, timeSource: 'server' })
  assert.deepEqual(model.selectRoomTimeline(f.getSnapshot()).map(item => item.kind), ['system', 'chat', 'reaction', 'system'])
  assert.equal(f.getSnapshot().entries[1].message.text, 'canonical')
  assert.equal(model.selectRoomTabs(f.getSnapshot()).members[0].displayName, 'Me')
  let notifications = 0
  const unsubscribe = f.subscribe(() => { notifications++ })
  f.chat(message(4))
  unsubscribe()
  f.chat(message(5))
  assert.equal(notifications, 1)
  f.setRoom(room({ roomId: 'next' }))
  assert.equal(f.getSnapshot().entries.length, 0)
})

test('history pages dedupe and sort by server time/id, advance cursor, and stop on exhaustion', async() => {
  const calls = []
  const pages = [ok({ messages: [message(4), message(2), message(3), message(2)], hasMore: true }), ok({ messages: [message(1), message(2)], hasMore: false })]
  const f = feed(async(method, args) => { calls.push([method, args]); return pages.shift() })
  f.chat(message(4))
  await f.loadOlder()
  await f.loadOlder()
  await f.loadOlder()
  assert.deepEqual(f.getSnapshot().entries.map(item => item.message.id), [1, 2, 3, 4])
  assert.deepEqual(calls.map(([, args]) => args.beforeId), [undefined, 2])
  assert.equal(f.getSnapshot().beforeId, 1)
  assert.equal(f.getSnapshot().hasMore, false)
  assert.equal(f.getSnapshot().loading, false)
  f.chat(message(6, { at: 40 }))
  assert.deepEqual(f.getSnapshot().entries.map(item => item.message.id), [1, 2, 3, 4, 6])
})

test('bounded backward history retains older window; errors retry; concurrent loads coalesce', async() => {
  const pending = deferred()
  let count = 0
  const f = feed(async() => { count++; return pending.promise }, { limit: 3 })
  for (const id of [4, 5, 6, 7]) f.chat(message(id))
  assert.deepEqual(f.getSnapshot().entries.map(item => item.message.id), [5, 6, 7])
  const loading = f.loadOlder()
  await f.loadOlder()
  assert.equal(count, 1)
  pending.resolve(ok({ messages: [message(3), message(1), message(2)], hasMore: true }))
  await loading
  assert.deepEqual(f.getSnapshot().entries.map(item => item.message.id), [1, 2, 3])
  let attempt = 0
  const errors = feed(async() => ++attempt == 1 ? { ok: false, code: 'FAIL', message: 'history failed' } : ok({ messages: [], hasMore: true }))
  await errors.loadOlder()
  assert.equal(errors.getSnapshot().historyError, 'history failed')
  await errors.loadOlder()
  assert.equal(errors.getSnapshot().historyError, undefined)
  assert.equal(errors.getSnapshot().hasMore, false)
})

test('optimistic send stays pending, fails, retries with same clientMsgId, and dedupes echo/ACK', async() => {
  const first = deferred()
  const second = deferred()
  const calls = []
  const f = feed(async(method, args) => { calls.push([method, args]); return calls.length == 1 ? first.promise : second.promise }, { clientId: () => 'local-id' })
  const send = f.sendChat('  hello  ')
  assert.equal(f.getSnapshot().entries[0].delivery, 'pending')
  assert.equal(f.getSnapshot().entries[0].message.text, 'hello')
  first.reject(new Error('transport failed'))
  const id = await send
  assert.equal(f.getSnapshot().entries[0].delivery, 'failed')
  const retry = f.retry(id)
  await f.retry(id)
  assert.equal(calls.length, 2)
  assert.equal(f.getSnapshot().entries[0].delivery, 'pending')
  const canonical = message(8, { clientMsgId: 'local-id', senderId: 'canonical-self' })
  f.chat(canonical)
  second.resolve(ok(canonical))
  await retry
  assert.deepEqual(calls.map(([, args]) => args.clientMsgId), ['local-id', 'local-id'])
  assert.equal(f.getSnapshot().entries.length, 1)
  assert.equal(f.getSnapshot().entries[0].delivery, 'sent')
  for (const text of ['', ' ', 'a'.repeat(501), 'hello\u0000']) assert.equal(await f.sendChat(text), null)
  assert.equal(calls.length, 2)
})

test('echo remains confirmed when send transport fails, and old-room results cannot resurrect data', async() => {
  const pending = deferred()
  const f = feed(async() => pending.promise, { clientId: () => 'echo' })
  const send = f.sendChat('hello')
  f.chat(message(1, { clientMsgId: 'echo' }))
  pending.reject(new Error('late failure'))
  await send
  assert.equal(f.getSnapshot().entries[0].delivery, 'sent')
  const history = deferred()
  const next = feed(async() => history.promise)
  const loading = next.loadOlder()
  next.setRoom(null)
  history.resolve(ok({ messages: [message(1)], hasMore: true }))
  await loading
  assert.equal(next.getSnapshot().entries.length, 0)
  assert.equal(next.getSnapshot().loading, false)
})

test('capability downgrade hides unsupported features and prevents outgoing/incoming optional work', async() => {
  let calls = 0
  const f = feed(async() => { calls++; return ok(null) })
  f.chat(message(1))
  f.reaction({ roomId: 'room', at: 20, emoji: '👍' })
  f.requests({ roomId: 'room', version: 1, requests: [request('a')] })
  f.system({ kind: 'system', id: 'join', at: 0, timeSource: 'local', event: 'join' })
  f.setContext(model.roomCapabilities({ together: 1 }, true))
  assert.deepEqual(model.selectRoomTimeline(f.getSnapshot()).map(item => item.kind), ['system'])
  assert.equal(model.selectRoomTabs(f.getSnapshot()).chat.length, 1)
  assert.deepEqual(model.selectRequestQueue(f.getSnapshot()), [])
  assert.equal(model.selectRequestQueueModel(f.getSnapshot(), 'self', 'self').canManage, false)
  assert.equal(await f.sendChat('hello'), null)
  assert.equal(await f.sendReaction('👍'), false)
  assert.equal(await f.addRequest(song('b')), false)
  assert.equal(await f.requestAction('approve', 'a'), false)
  assert.equal(await f.reorderRequests(['a']), false)
  await f.loadOlder()
  f.chat(message(2))
  f.requests({ roomId: 'room', version: 2, requests: [] })
  assert.equal(f.getSnapshot().requestsVersion, 1)
  assert.equal(calls, 0)
  assert.deepEqual(model.roomCapabilities(features, false), { chat: false, reactions: false, requests: false, remoteRequests: false })
  assert.equal(model.roomCapabilities({ 'together.chat': 2 }, true).chat, false)
})

test('disconnect fails local sends and ignores stale ACK after capability recovery', async() => {
  const pending = deferred()
  const f = feed(async() => pending.promise, { clientId: () => 'offline' })
  const sending = f.sendChat('hello')
  f.disconnect()
  assert.equal(f.getSnapshot().entries[0].delivery, 'failed')
  f.setContext(model.roomCapabilities(features, true))
  pending.resolve(ok(message(1, { clientMsgId: 'offline' })))
  await sending
  assert.equal(f.getSnapshot().entries[0].delivery, 'failed')
})

test('一起听房间布局 defaults to 6A and only explicit 6B opts in', () => {
  const defaults = load('src/config/defaultSetting.ts').default
  assert.equal(defaults['together.roomLayout'], '6A')
  for (const value of [undefined, null, '', '6A', '6C', 6]) assert.equal(model.resolveTogetherLayout(value), '6A')
  assert.equal(model.resolveTogetherLayout('6B'), '6B')
  for (const lang of ['zh-cn', 'zh-tw', 'en-us']) assert.ok(JSON.parse(readFileSync(join(root, `src/lang/${lang}.json`), 'utf8')).together_room_layout)
})

test('request queue tracks pending, accepted, played, rejected and unknown removal without stale regression', async() => {
  const calls = []
  const f = feed(async(method, args) => { calls.push([method, args]); return ok(null) })
  f.requests({ roomId: 'room', version: 1, requests: [request('a'), request('b'), request('c')] })
  assert.equal(model.selectRequestQueueModel(f.getSnapshot(), 'self', 'self').canRequest, false)
  assert.equal(await f.reorderRequests(['c', 'a', 'b']), true)
  assert.equal(await f.reorderRequests(['a', 'a', 'b']), false)
  assert.equal(await f.requestAction('approve', 'a'), true)
  assert.equal(calls.at(-1)[1].expectedQueueVersion, 7)
  assert.equal(f.getSnapshot().entries.find(item => item.id == 'request:a').status, 'accepted')
  f.setRoom(room({ playback: { musicInfo: song('a') } }))
  assert.equal(f.getSnapshot().entries.find(item => item.id == 'request:a').status, 'played')
  assert.equal(await f.requestAction('reject', 'b'), true)
  assert.equal(f.getSnapshot().entries.find(item => item.id == 'request:b').status, 'rejected')
  f.requests({ roomId: 'room', version: 2, requests: [] })
  assert.equal(f.getSnapshot().entries.find(item => item.id == 'request:c').status, null)
  f.requests({ roomId: 'room', version: 1, requests: [request('c')] })
  assert.deepEqual(model.selectRequestQueue(f.getSnapshot()), [])
  f.setRoom(room({ queue: { items: [song('c')], currentId: null } }))
  assert.equal(f.getSnapshot().entries.find(item => item.id == 'request:c').status, 'accepted')
  f.setRoom(room({ playback: { musicInfo: song('c') } }))
  assert.equal(f.getSnapshot().entries.find(item => item.id == 'request:c').status, 'played')
})

test('request and reaction commands validate permissions, payloads and stale results', async() => {
  const calls = []
  const f = feed(async(method, args) => { calls.push([method, args]); return ok(null) })
  assert.equal(await f.sendReaction('invalid'), false)
  assert.equal(await f.sendReaction('🔥'), true)
  assert.equal(await f.addRequest(song('a')), true)
  f.requests({ roomId: 'room', version: 1, requests: [request('a')] })
  f.setContext(model.roomCapabilities(features, true), 'member')
  assert.equal(await f.reorderRequests(['a']), false)
  assert.equal(calls.length, 2)
  const pending = deferred()
  const next = feed(async() => pending.promise)
  next.requests({ roomId: 'room', version: 1, requests: [request('a')] })
  const approving = next.requestAction('approve', 'a')
  next.setRoom(null)
  pending.resolve(ok(null))
  assert.equal(await approving, false)
  assert.deepEqual(next.getSnapshot().entries, [])
})

test('existing together push handlers work without optional capabilities and reject stale sockets', async() => {
  const session = load('src/plugins/sync/client/session.ts')
  const bus = load('src/plugins/sync/client/modules/together/pushBus.ts')
  const handler = load('src/plugins/sync/client/modules/together/handler.ts', { '../../session': session, './pushBus': bus }).default
  const events = []
  bus.setTogetherPushListener(event => events.push(event))
  const old = {}
  const current = session.createSession(old)
  session.negotiateTogether(current.id, true, { together: 1 })
  const existing = ['RoomState', 'MemberChanged', 'HostChanged', 'RoomClosed']
  for (const name of existing) await handler[`together:on${name}`](old, { roomId: 'room', version: 2 })
  assert.deepEqual(events.map(event => event.type), ['roomState', 'memberChanged', 'hostChanged', 'roomClosed'])
  for (const name of ['Chat', 'Reaction', 'Requests']) await handler[`together:on${name}`](old, { roomId: 'room' })
  assert.equal(events.length, 4)
  session.negotiateTogether(current.id, true, features)
  for (const name of ['Chat', 'Reaction', 'Requests']) await handler[`together:on${name}`](old, { roomId: 'room' })
  assert.deepEqual(events.slice(4).map(event => event.type), ['chat', 'reaction', 'requests'])
  const replacement = {}
  const next = session.createSession(replacement)
  session.negotiateTogether(next.id, true, features)
  for (const name of [...existing, 'Chat', 'Reaction', 'Requests']) await handler[`together:on${name}`](old, { roomId: 'room' })
  assert.equal(events.length, 7)
  session.negotiateTogether(next.id, false)
  await handler['together:onRoomState'](replacement, { roomId: 'room', version: 3 })
  assert.equal(events.length, 7)
})

test('sync handshake preserves list/dislike/history/together negotiation and only adds matching Lux features', async() => {
  const session = load('src/plugins/sync/client/session.ts')
  const versions = { list: 1, dislike: 1, playHistory: 1, ...features }
  let mode = 'lux'
  let history = false
  const handler = load('src/plugins/sync/client/sync/handler.ts', {
    '@/utils/data': { getSyncMode: async() => mode },
    '../../playHistoryFlag': { setPlayHistoryFeatureEnabled: value => { history = value } },
    '../session': session,
    '../syncReady': { notifySyncReady() {} },
    '../modules': { featureVersion: versions },
  }).default
  const socket = {}
  const id = session.createSession(socket).id
  const legacy = { list: 1, dislike: 1, playHistory: 1, together: 1 }
  const expected = { list: { skipSnapshot: false }, dislike: { skipSnapshot: false }, playHistory: true, together: true }
  for (const type of ['server', 'desktop-app']) assert.deepEqual(await handler.getEnabledFeatures(socket, type, legacy), expected)
  assert.equal(history, true)
  session.finishTogether(id)
  let notifications = 0
  session.subscribeSession(() => { notifications++ })
  await handler.getEnabledFeatures(socket, 'server', legacy)
  assert.equal(session.getSession().state, 'togetherReady')
  assert.equal(notifications, 0)
  const full = await handler.getEnabledFeatures(socket, 'server', versions)
  assert.deepEqual(full, { ...expected, 'together.chat': true, 'together.reaction': true, 'together.request': true })
  assert.equal(notifications, 1)
  const downgrade = await handler.getEnabledFeatures(socket, 'server', { ...versions, 'together.chat': 2, 'together.reaction': undefined })
  assert.equal(downgrade['together.chat'], undefined)
  assert.equal(downgrade['together.reaction'], undefined)
  assert.equal(downgrade['together.request'], true)
  assert.equal(session.getSession().state, 'togetherReady')
  mode = 'lx'
  assert.deepEqual(await handler.getEnabledFeatures(socket, 'server', versions), { list: { skipSnapshot: false }, dislike: { skipSnapshot: false } })
  assert.equal(history, false)
  assert.equal(session.getSession().togetherFeatures, undefined)
  mode = 'lux'
  assert.deepEqual(await handler.getEnabledFeatures(socket, 'server', { 'together.chat': 1 }), {})
})

test('RPC adapter leaves base calls unchanged and blocks unsupported optional calls before transport', async() => {
  const session = load('src/plugins/sync/client/session.ts')
  const calls = []
  const socket = { remote: new Proxy({}, { get: (_, method) => async args => { calls.push([method, args]); return ok(null) } }) }
  const id = session.createSession(socket).id
  session.negotiateTogether(id, true, { together: 1 })
  session.finishTogether(id)
  const api = load('src/plugins/sync/client/modules/together/api.ts', {
    '../../client': { getReadySyncSocket: () => socket },
    '../../togetherReady': { isTogetherSyncReady: session.isSessionTogetherReady },
    '../../session': session,
    './pushBus': {},
  })
  assert.deepEqual(await api.callTogether('together:getRoom'), ok(null))
  for (const method of ['together:chat:history', 'together:chat:send', 'together:reaction', 'together:request:add']) {
    await assert.rejects(api.callTogether(method, {}), api.TogetherUnavailableError)
  }
  assert.equal(calls.length, 1)
  session.negotiateTogether(id, true, features)
  await api.callTogether('together:chat:send', { text: 'hi', clientMsgId: 'id' })
  assert.equal(calls.at(-1)[0], 'together:chat:send')
})
