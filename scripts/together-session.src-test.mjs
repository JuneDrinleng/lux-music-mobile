/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (path, require = () => { throw new Error('unexpected import') }, globals = {}) => {
  const source = ts.transpileModule(readFileSync(join(root, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}) {${source}\n})`, { filename: path })
    .runInThisContext()(require, module, module.exports, ...Object.values(globals))
  return module.exports
}
const deferred = () => {
  let resolve
  const promise = new Promise(_resolve => { resolve = _resolve })
  return { promise, resolve }
}

const harness = () => {
  const session = load('src/plugins/sync/client/session.ts')
  const timers = new Map()
  const delays = new Map()
  let now = 1000
  let timerId = 0
  const sockets = []
  const calls = []
  let decrypt = async data => data
  class Socket {
    events = {}
    sent = []
    constructor() { sockets.push(this) }
    addEventListener(name, callback) { (this.events[name] ??= []).push(callback) }
    emit(name, value = {}) { for (const callback of this.events[name] ?? []) callback(value) }
    close() {} // Native close event arrives asynchronously.
    send(data) { this.sent.push(data) }
  }
  const client = load('src/plugins/sync/client/client.ts', specifier => {
    if (specifier == '@/utils/syncStatus') {
      return load('src/utils/syncStatus.ts', name => {
        if (name === '../plugins/sync/constants') return load('src/plugins/sync/constants.ts')
        throw new Error(name)
      })
    }
    if (specifier == './session') return session
    if (specifier == './utils') return { encryptMsg: async(_key, data) => data, decryptMsg: (_key, data) => decrypt(data) }
    if (specifier == './sync') return { callObj: {} }
    if (specifier == '../log') return { default: { info() {}, error() {}, r_error() {} } }
    if (specifier == '../utils') return { aesEncrypt: () => '' }
    if (specifier == '@/core/sync') return { setSyncStatus() {} }
    if (specifier == '@/utils/common') return { dateFormat() {} }
    if (specifier == '../constants') return { SYNC_CLOSE_CODE: { normal: 1000, failed: 4000 }, SYNC_CODE: { msgConnect: '' } }
    if (specifier == '../playHistoryFlag') return { isPlayHistoryFeatureEnabled: () => false, setPlayHistoryFeatureEnabled() {} }
    if (specifier == './moduleReadys') return { createInitialModuleReadys: () => ({}), setSyncModuleReady() {} }
    if (specifier == './syncReady') return { addSyncReadyListener() {}, removeSyncReadyListener() {}, notifySyncReady() {} }
    if (specifier == 'message2call') {
      return {
        createMsg2call: options => {
          const call = { ...options, remote: {}, createQueueRemote() {}, destroyCount: 0, destroy() { this.destroyCount++ }, message(data) { options.funcsObj[data]() } }
          calls.push(call)
          return call
        },
      }
    }
    throw new Error(specifier)
  }, {
    WebSocket: Socket,
    Date: class extends Date { static now() { return now } },
    setTimeout: (callback, delay) => { timers.set(++timerId, callback); delays.set(timerId, delay); return timerId },
    clearTimeout: id => { timers.delete(id); delays.delete(id) },
  })
  const connect = () => { client.connect({ wsProtocol: 'ws:', hostPath: 'test' }, { clientId: 'self', key: '' }); sockets.at(-1).emit('open'); return session.getSession().id }
  return { session, client, sockets, calls, timers, delays, advance: ms => { now += ms }, connect, setDecrypt: value => { decrypt = value } }
}

test('reconnect transitions and stale close preserve the new session; old-server finished enables together', () => {
  const h = harness()
  const first = h.connect()
  h.session.negotiateTogether(first, true)
  h.calls[0].funcsObj.finished()
  assert.equal(h.session.getSession().state, 'togetherReady')
  const second = h.connect()
  assert.notEqual(first, second)
  assert.equal(h.session.getSession().state, 'connecting')
  h.session.negotiateTogether(second, true)
  assert.equal(h.session.getSession().state, 'negotiated')
  h.sockets[0].emit('close', { code: 1006 })
  assert.equal(h.session.getSession().state, 'negotiated')
  assert.equal(h.calls[1].destroyCount, 0)
  h.calls[1].funcsObj.together_sync_finished()
  h.calls[1].funcsObj.finished()
  assert.equal(h.session.getSession().state, 'togetherReady')
})

test('explicit disconnect cleans callbacks, RPC and role timers before native close', async() => {
  const h = harness()
  const id = h.connect()
  let host = true
  let member = true
  h.sockets[0].onClose(() => { host = false; member = false })
  await h.client.disconnect()
  assert.equal(h.session.getSession().state, 'closed')
  assert.equal(host, false)
  assert.equal(member, false)
  assert.equal(h.calls[0].destroyCount, 1)
  assert.equal(h.timers.size, 0)
  h.sockets[0].emit('close', { code: 1000 })
  h.session.closeSession(id)
  assert.equal(h.calls[0].destroyCount, 1)
})

test('message decrypted after reconnect cannot finish the replacement session', async() => {
  const h = harness()
  h.connect()
  const pending = deferred()
  h.setDecrypt(() => pending.promise)
  h.sockets[0].emit('message', { data: 'encrypted' })
  const id = h.connect()
  h.session.negotiateTogether(id, true)
  pending.resolve('"finished"')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.session.getSession().state, 'negotiated')
  assert.equal(h.sockets[1].isReady, false)
})

test('negotiation never sends a transient feature disable during reconnect or repeated handshake', async() => {
  const h = harness()
  const handler = load('src/plugins/sync/client/sync/handler.ts', specifier => {
    if (specifier == '../session') return h.session
    if (specifier == '@/utils/data') return { getSyncMode: async() => 'lux' }
    if (specifier == '../../playHistoryFlag') return { setPlayHistoryFeatureEnabled() {} }
    if (specifier == '../syncReady') return { notifySyncReady() {} }
    if (specifier == '../modules') return { featureVersion: { together: 1 } }
    throw new Error(specifier)
  }).default
  for (let i = 0; i < 2; i++) {
    h.connect()
    const socket = h.sockets.at(-1)
    const result = await handler.getEnabledFeatures(socket, 'server', { together: 1 })
    assert.equal(result.together, true)
    h.calls.at(-1).funcsObj.finished()
    assert.equal((await handler.getEnabledFeatures(socket, 'server', { together: 1 })).together, true)
    assert.equal(h.session.getSession().state, 'togetherReady')
    assert.equal(socket.sent.length, 0)
  }
})

const coreHarness = () => {
  const h = harness()
  const state = { room: null, connection: 'offline', role: null, pending: false }
  const actions = {
    setRoom(room) { state.room = room; state.role = room ? 'member' : null },
    patchRoom(patch) { if (state.room) state.room = { ...state.room, ...patch } },
    setConnection(value) { state.connection = value },
    setPending(value) { state.pending = value },
  }
  let push
  let rpc = async() => ({ ok: true, data: null })
  const intervals = new Set()
  const backgroundTimer = {
    setInterval(callback) { intervals.add(callback); return callback },
    clearInterval(id) { intervals.delete(id) },
    setTimeout() { return 1 },
    clearTimeout() {},
  }
  const noop = () => {}
  const emitter = { on: noop, off: noop }
  const globals = { global: { i18n: { t: key => key }, app_event: emitter, state_event: emitter } }
  const playerState = { playMusicInfo: {}, playInfo: {}, progress: { nowPlayTime: 0 } }
  const math = load('src/core/together/math.ts')
  const api = { callTogether: (...args) => rpc(...args), getTogetherSelfId: () => 'self', setTogetherPushListener: fn => { push = fn }, TogetherUnavailableError: class extends Error {} }
  const shared = specifier => {
    if (specifier == 'react-native-background-timer') return { default: backgroundTimer }
    if (specifier == '@/plugins/sync/client/session') return h.session
    if (specifier == '@/store/together/state') return { default: state }
    if (specifier == '@/plugins/sync/client/modules/together/api') return api
    if (specifier == '@/store/player/state') return { default: playerState }
    if (specifier == '@/utils/log') return { log: { warn: noop } }
    if (specifier == './math') return math
    if (specifier == './clock') return { getServerNow: Date.now, startClockSync: noop, stopClockSync: noop }
    return null
  }
  const host = load('src/core/together/host.ts', specifier => shared(specifier) ?? {
    '@/core/player/playInfo': { getList: () => [] },
    '@/core/music/utils': {},
    '@/plugins/player': {},
    '@/store/setting/state': { default: {} },
  }[specifier], globals)
  let setTempList = async() => {}
  const played = []
  const member = load('src/core/together/member.ts', specifier => shared(specifier) ?? {
    '@/config/constant': { LIST_IDS: { TEMP: 'temp' } },
    '@/core/list': { setTempList: (...args) => setTempList(...args) },
    '@/core/player/player': { playList: (...args) => { played.push(args) } },
    '@/core/player/playStatus': {},
    '@/core/player/progress': {},
    '@/plugins/player': {},
    '@/store/list/state': { default: {} },
    './control': { setTogetherBlockedHandler: noop, runAsTogetherApply: fn => fn() },
  }[specifier], globals)
  const core = load('src/core/together/index.ts', specifier => shared(specifier) ?? {
    '@/plugins/sync/client/client': { ...h.client, onSyncSocketReady: noop },
    '@/plugins/sync/client/togetherReady': { isTogetherSyncReady: h.session.isSessionTogetherReady },
    '@/plugins/sync/togetherFlag': { isTogetherFeatureEnabled: h.session.isSessionTogetherNegotiated },
    '@/store/together/action': { default: actions },
    '@/utils/data': { getSyncMode: async() => 'lux', getLuxAuth: async() => ({ serverId: 'server-a' }) },
    '@/utils/tools': { toast: noop },
    '@/store/together/roomFeed': { togetherRoomFeed: load('src/core/together/roomFeed.ts').createRoomFeed(api.callTogether) },
    './roomFeed': load('src/core/together/roomFeed.ts'),
    './roomRevision': load('src/core/together/roomRevision.ts'),
    './clock': { startClockSync: noop, stopClockSync: noop },
    './debugPanelPreference': { loadTogetherDebugPanelPreference: async() => false, subscribeTogetherDebugPanel: noop },
    './togetherGate': { snapshotTogetherGate: async() => ({}), formatTogetherGateHint: () => 'gate test' },
    './debugTelemetry': { syncTogetherDebugTelemetry: noop, resetTogetherDebugPushSong: noop, recordTogetherRoomStatePush: noop },
    './host': host,
    './member': member,
  }[specifier], globals)
  core.initTogether()
  const id = h.connect()
  h.session.negotiateTogether(id, true)
  h.calls[0].funcsObj.finished()
  return { ...h, core, state, actions, host, member, intervals, played, setLoader: fn => { setTempList = fn }, emitPush: event => push({ sessionId: id, ...event }), setRpc: fn => { rpc = fn } }
}

const room = (version = 1) => ({ roomId: 'room', version, playbackVersion: 1, queueVersion: 1, hostId: 'host', members: [], playback: {}, queue: { items: [] } })

test('late getRoom cannot overwrite a newer push or resurrect a left room', async() => {
  const h = coreHarness()
  h.actions.setRoom(room(2))
  let pending = deferred()
  h.setRpc(() => pending.promise)
  const refresh = h.core.refreshRoom()
  h.emitPush({ type: 'memberChanged', push: { roomId: 'room', version: 4, members: [], change: { type: 'online', memberId: 'other' } } })
  pending.resolve({ ok: true, data: room(3) })
  await refresh
  assert.equal(h.state.room.version, 4)
  const afterLeave = deferred()
  h.setRpc(method => method == 'together:getRoom' ? afterLeave.promise : Promise.resolve({ ok: true }))
  const late = h.core.refreshRoom()
  await h.core.leaveTogetherRoom()
  afterLeave.resolve({ ok: true, data: room(9) })
  await late
  assert.equal(h.state.room, null)
})

test('explicit disconnect stops actual host/member intervals through session lifecycle', async() => {
  const h = coreHarness()
  h.actions.setRoom(room())
  h.member.startMemberSync()
  h.host.startHostReporting({ onAck() {}, onLostHost() {} })
  assert.equal(h.intervals.size, 2)
  await h.client.disconnect()
  assert.equal(h.member.isMemberApplying(), false)
  assert.equal(h.host.isHostReporting(), false)
  assert.equal(h.intervals.size, 0)
})

test('successful member load after stop cannot start playback', async() => {
  const h = coreHarness()
  const snapshot = room()
  snapshot.playback.musicInfo = { id: 'song', source: 'kw' }
  h.actions.setRoom(snapshot)
  h.member.startMemberSync()
  const loading = deferred()
  h.setLoader(() => loading.promise)
  const apply = h.member.applyPlayback(snapshot)
  h.member.stopMemberSync()
  h.member.startMemberSync()
  loading.resolve()
  await apply
  assert.deepEqual(h.played, [])
  await h.member.applyPlayback(snapshot)
  assert.deepEqual(h.played, [['temp', 0]])
})

test('late host ACK cannot reach callbacks after stop and restart', async() => {
  const h = coreHarness()
  h.actions.setRoom(room())
  const old = deferred()
  const newer = deferred()
  h.setRpc(() => old.promise)
  const acks = []
  h.host.startHostReporting({ onAck: ack => acks.push(ack), onLostHost() {} })
  h.host.stopHostReporting()
  h.setRpc(() => newer.promise)
  h.host.startHostReporting({ onAck: ack => acks.push(ack), onLostHost() {} })
  old.resolve({ ok: true, data: { version: 99, subVersion: 99 } })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(acks, [])
  newer.resolve({ ok: true, data: { version: 2, subVersion: 2 } })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(acks, [{ version: 2, subVersion: 2 }])
})

test('pending getRoom from old session is ignored after reconnect', async() => {
  const h = coreHarness()
  h.actions.setRoom(room(5))
  const pending = deferred()
  h.setRpc(() => pending.promise)
  const refresh = h.core.refreshRoom()
  h.connect()
  pending.resolve({ ok: true, data: room(90) })
  await refresh
  assert.equal(h.state.room.version, 5)
})

test('blocked together actions return clean messages without diagnostic suffixes', async() => {
  const h = coreHarness()
  await h.client.disconnect()
  for (const run of [() => h.core.createTogetherRoom(), () => h.core.joinTogetherRoom('123456')]) {
    const result = await run()
    assert.equal(result.ok, false)
    assert.equal(result.message, 'together_offline')
    assert.doesNotMatch(result.message, /gate|session=|mode=/)
  }
})


test('sync status exposes the actual socket retry deadline, immediate reconnect cancels it, and success resets attempts', () => {
  const h = harness()
  h.connect()
  h.calls[0].funcsObj.finished()
  h.sockets[0].emit('close', { code: 1006 })
  assert.equal(h.client.getStatus().attempts, 1)
  assert.equal(h.client.getStatus().retryAt, 3000)
  const [retryId, callback] = [...h.timers].find(([id]) => h.delays.get(id) === 2000)
  h.advance(500)
  assert.equal(h.client.reconnectNow(), true)
  assert.equal(h.timers.has(retryId), false)
  assert.equal(h.client.getStatus().retryAt, undefined)
  assert.equal(h.sockets.length, 2)
  callback() // Native callback already queued when the user tapped retry.
  assert.equal(h.sockets.length, 2)
  h.sockets[1].emit('open')
  h.sockets[1].emit('close', { code: 1006 })
  assert.equal(h.client.getStatus().attempts, 2)
  assert.equal(h.client.getStatus().retryAt, 6500)
  const next = [...h.timers].find(([id]) => h.delays.get(id) === 5000)[1]
  h.advance(5000)
  next()
  assert.equal(h.sockets.length, 3)
  h.sockets[2].emit('open')
  h.calls[2].funcsObj.finished()
  assert.equal(h.client.getStatus().status, true)
  assert.equal(h.client.getStatus().retryAt, undefined)
  assert.equal(h.client.getStatus().lastSyncedAt, 6500)
  h.sockets[2].emit('close', { code: 1006 })
  assert.equal(h.client.getStatus().attempts, 1)
})


test('asynchronous failed-close after connection timeout preserves the already scheduled retry deadline', () => {
  const h = harness()
  h.client.connect({ wsProtocol: 'ws:', hostPath: 'test' }, { clientId: 'self', key: '' })
  const timeout = [...h.timers].find(([id]) => h.delays.get(id) === 120000)[1]
  timeout()
  const scheduled = h.client.getStatus()
  assert.equal(scheduled.attempts, 2, 'retain the existing timeout/backoff failure count')
  assert.equal(scheduled.retryAt, 6000)
  h.sockets[0].emit('close', { code: 4000 })
  assert.equal(h.client.getStatus().retryAt, scheduled.retryAt)
  assert.equal([...h.delays.values()].includes(5000), true)
})


test('stale retry callback cannot erase the replacement retry timer reference', async() => {
  const h = harness()
  h.connect()
  h.sockets[0].emit('close', { code: 1006 })
  const stale = [...h.timers].find(([id]) => h.delays.get(id) === 2000)[1]
  h.client.reconnectNow()
  h.sockets[1].emit('open')
  h.sockets[1].emit('close', { code: 1006 })
  const nextId = [...h.timers].find(([id]) => h.delays.get(id) === 5000)[0]
  stale()
  await h.client.disconnect()
  assert.equal(h.timers.has(nextId), false)
  assert.equal(h.client.getStatus().retryAt, undefined)
})


test('clipboard joins check authenticated server and reject recycled room codes before applying playback', async() => {
  const h = coreHarness()
  const calls = []
  h.setRpc(async(method, payload) => {
    calls.push([method, payload])
    return { ok: true, data: method === 'together:joinRoom' ? room() : null }
  })
  assert.equal((await h.core.joinTogetherRoom('123456', 'other-server', 'room')).ok, false)
  assert.equal(calls.length, 0)
  assert.equal((await h.core.joinTogetherRoom('123456', 'server-a', 'old-room')).ok, false)
  assert.deepEqual(calls.map(([method]) => method), ['together:joinRoom', 'together:leaveRoom'])
  assert.equal(h.state.room, null)
  assert.equal(h.played.length, 0)
})
