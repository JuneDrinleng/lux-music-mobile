/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { load, fakeSecure, secureModule } from './secure-credentials-test-support.mjs'

const model = load('src/utils/loginSession.ts', { './serverCheck': load('src/utils/serverCheck.ts') })
const recentModule = load('src/utils/loginRecents.ts', { './loginSession': model })
const credentialModule = load('src/utils/loginCredentialRepository.ts', { './secureCredentials': secureModule })
const lux = (serverId = 'nas', userId = 'alice', url = 'https://NAS/Music') => ({
  provider: 'lux',
  spaceId: `lux:${encodeURIComponent(serverId)}:${encodeURIComponent(userId)}`,
  server: { serverId, url },
  account: { userId, username: 'same-name', displayName: 'June' },
  credentialRef: credentialModule.luxCredentialRef(serverId, userId),
})
const recentsHarness = (legacy = { history: [], accounts: [] }) => {
  let value = null
  let fail = false
  const storage = {
    read: async() => structuredClone(value),
    write: async next => { if (fail) throw Error('interrupted'); value = structuredClone(next) },
    legacy: async() => structuredClone(legacy),
  }
  return { repo: recentModule.createLoginRecents(storage), storage, fail: v => { fail = v }, value: () => value }
}

test('recent identities isolate same-server accounts, same-name servers, reinstalled servers and deployment paths', async() => {
  const h = recentsHarness()
  await Promise.all([lux(), lux('nas', 'bob'), lux('other'), lux('reinstalled')].map((session, index) => h.repo.recordSuccess(session, 100 + index)))
  assert.equal((await h.repo.list()).recents.length, 4)
  const lx = url => ({ provider: 'lx', spaceId: 'local', server: { serverId: 'nas', url }, deviceId: 'device', credentialRef: credentialModule.syncCredentialRef(JSON.stringify(['nas', 'lx', ''])) })
  await h.repo.recordSuccess(lx('https://NAS/Music'), 200)
  await h.repo.recordSuccess(lx('https://nas/music'), 201)
  const rows = (await h.repo.list()).recents
  assert.equal(rows.length, 6)
  assert.equal(rows.filter(row => row.provider === 'lx').every(row => row.spaceId === 'local'), true)
  assert.equal(model.normalizeLoginServer(' HTTPS://NAS:443/Music/// '), 'https://nas/Music')
  assert.throws(() => model.normalizeLoginServer('https://u:password@nas/Music'))
  assert.throws(() => model.normalizeLoginServer('https://nas/Music?token=secret'))
})

test('recent writes allowlist metadata, successful times only; removal leaves credentials and spaces untouched', async() => {
  const h = recentsHarness()
  const input = { ...lux(), password: 'secret-password', token: 'secret-token', key: 'secret-key', authCode: 'secret-code' }
  input.account.password = 'account-secret'
  input.server.token = 'server-secret'
  input.credentialRef.token = 'ref-secret'
  await h.repo.recordSuccess(input, 10)
  await assert.rejects(h.repo.recordSuccess(lux(), NaN), /successful login time/)
  assert.equal((await h.repo.list()).recents[0].lastLoginAt, 10)
  assert.doesNotMatch(JSON.stringify(h.value()), /secret|password|authCode|"key"|"token"/)
  await h.repo.recordSuccess({ provider: 'local', spaceId: 'local' }, 11)
  assert.equal((await h.repo.list()).recents[0].authHint, 'none')
  await h.repo.remove(model.recentLoginId(lux()))
  assert.deepEqual((await h.repo.list()).recents.map(row => row.id), ['local'])
  await assert.rejects(h.repo.recordSuccess({ ...lux(), spaceId: 'lux:other:alice' }, 12), /mismatch/)
})

test('legacy addresses, sessions and spaces without success times are never promoted to recents', async() => {
  const h = recentsHarness({
    history: [{ url: 'https://NAS/Music/' }, { url: 'https://nas/Music' }, { provider: 'lx', url: 'https://nas/music' }, { url: 'https://nas?token=secret' }],
    accounts: [{ spaceId: 'lux:nas:alice', username: 'alice', token: 'secret', lastActiveAt: 123 }],
  })
  const value = await h.repo.list()
  assert.equal(value.recents.length, 0)
  assert.equal(value.history.length, 2)
  assert.equal(value.history[0].provider, undefined, 'untyped old history cannot prefill either protocol')
  assert.doesNotMatch(JSON.stringify(value), /secret|lastLoginAt|lastActiveAt/)
  const snapshot = JSON.stringify(value)
  await h.repo.list()
  assert.equal(JSON.stringify(h.value()), snapshot)
})

test('recent migration and success writes resume after interruption without inventing a successful login', async() => {
  const h = recentsHarness({ history: [{ url: 'https://nas/path' }], accounts: [] })
  h.fail(true)
  await assert.rejects(h.repo.list(), /interrupted/)
  assert.equal(h.value(), null)
  h.fail(false)
  await h.repo.list()
  h.fail(true)
  await assert.rejects(h.repo.recordSuccess(lux(), 20), /interrupted/)
  h.fail(false)
  assert.equal((await h.repo.list()).recents.length, 0)
  await h.repo.recordSuccess(lux(), 21)
  assert.equal((await h.repo.list()).recents[0].lastLoginAt, 21)
})

const key = (owner = '') => ({ key: `secret-${owner}`, clientId: `device-${owner}`, serverName: 'NAS', ...(owner ? { luxUserId: owner } : {}) })
const credentialsHarness = (initial = { nas: key() }) => {
  const secure = fakeSecure()
  let value = structuredClone(initial)
  let interrupt = false
  let wrongRead = false
  const storage = {
    read: async() => structuredClone(value),
    write: async next => { if (interrupt) throw Error('interrupted'); value = structuredClone(next) },
    remove: async() => { value = null },
  }
  const backend = { ...secure.backend, get: async id => wrongRead ? 'wrong' : secure.backend.get(id) }
  return { repo: credentialModule.createLoginCredentialRepository(storage, backend), secure, value: () => value, interrupt: v => { interrupt = v }, wrongRead: v => { wrongRead = v } }
}

test('LX long-term keys migrate to secure storage and the old adapter returns exactly the same key', async() => {
  const h = credentialsHarness({ nas: key(), '["nas","lx",""]': key(), '["nas","lux","alice"]': key('alice') })
  assert.deepEqual(await h.repo.get('nas'), key())
  assert.doesNotMatch(JSON.stringify(h.value()), /secret-|"key"|clientId/)
  assert.equal(h.value()['["nas","lux","alice"]'].luxUserId, 'alice')
  assert.deepEqual(await h.repo.get('["nas","lux","alice"]'), key('alice'))
  await h.repo.set('other/path', key('bob'))
  assert.deepEqual(await h.repo.get('other/path'), key('bob'))
  assert.deepEqual(await h.repo.get('nas'), key())
})

test('secure-storage failures and readback mismatch never return or write a plaintext fallback', async() => {
  const h = credentialsHarness()
  h.secure.fail(true)
  await assert.rejects(h.repo.get('nas'), /locked/)
  await assert.rejects(h.repo.set('new', key()), /locked/)
  assert.equal(h.value().new, undefined)
  h.secure.fail(false)
  h.wrongRead(true)
  await assert.rejects(h.repo.get('nas'), /write failed/)
  h.wrongRead(false)
  assert.deepEqual(await h.repo.get('nas'), key())
  h.secure.fail(true)
  await assert.rejects(h.repo.get('nas'), /locked/)
})

test('interrupted secure migration keeps source and replays verified entries; batch clear remains retryable', async() => {
  const h = credentialsHarness()
  h.interrupt(true)
  await assert.rejects(h.repo.get('nas'), /interrupted/)
  assert.equal(h.value().nas.key, key().key)
  h.interrupt(false)
  assert.deepEqual(await h.repo.get('nas'), key())
  await Promise.all(['a', 'b', 'c'].map(id => h.repo.set(id, key(id))))
  assert.equal(Object.keys(h.value()).length, 4)
  await h.repo.clear()
  assert.equal(h.value(), null)
  assert.equal(h.secure.tokens.size, 0)
})

test('Lux reference uses existing compound secure index without lending same-server account tokens', async() => {
  const h = credentialsHarness({})
  await h.secure.setRefreshToken(JSON.stringify(['nas', 'alice']), 'alice-refresh')
  await h.secure.setRefreshToken(JSON.stringify(['nas', 'bob']), 'bob-refresh')
  assert.equal(await h.repo.readRefresh(credentialModule.luxCredentialRef('nas', 'alice')), 'alice-refresh')
  assert.equal(await h.repo.readRefresh(credentialModule.luxCredentialRef('nas', 'bob')), 'bob-refresh')
  await assert.rejects(h.repo.readRefresh(credentialModule.syncCredentialRef('nas')), /Wrong/)
  await assert.rejects(h.repo.readRefresh({ kind: 'luxRefresh', id: '"nas"' }), /Invalid/)
})

test('legacy login integrations publish only after auth, import and socket creation succeed', async() => {
  const auth = readFileSync(new URL('../src/plugins/sync/client/auth.ts', import.meta.url), 'utf8')
  assert.ok(auth.indexOf("provider: 'lux'") > auth.indexOf('await offerLocalImport'))
  const data = readFileSync(new URL('../src/utils/data.ts', import.meta.url), 'utf8')
  assert.match(data, /!isDataSpaceReady\(\) \|\| getActiveSpace\(\) !== session.spaceId/)
  const keyInfo = key()
  for (const provider of ['lx', 'lux']) {
    const events = []
    let failed = true
    const client = load('src/plugins/sync/client/index.ts', {
      './auth': { __esModule: true, default: async() => keyInfo, authLux: async() => keyInfo, recordAuthenticatedLogin: async() => { events.push('recent') } },
      './client': { connect: () => { events.push('socket'); if (failed) throw Error('socket failed') }, disconnect: async() => {}, sendSyncStatus() {}, sendSyncMessage() {} },
      '../log': { __esModule: true, default: { info() {}, r_warn() {} } },
      './utils': { parseUrl: () => ({ href: 'https://nas' }) },
      '../constants': { SYNC_CODE: {} },
    })
    const connect = provider === 'lx' ? client.connectServer : client.connectLuxServer
    await assert.rejects(connect('https://nas'), /socket failed/)
    assert.deepEqual(events, ['socket'])
    failed = false
    await connect('https://nas')
    assert.deepEqual(events, ['socket', 'socket', 'recent'])
  }
})

test('new key publication always leaves a discoverable reference even if the process stops after native write', async() => {
  const secure = fakeSecure()
  let index = {}
  let writes = 0
  const storage = {
    read: async() => structuredClone(index),
    write: async next => { if (++writes === 2) throw Error('interrupted publication'); index = structuredClone(next) },
    remove: async() => { index = {} },
  }
  const repo = credentialModule.createLoginCredentialRepository(storage, secure.backend)
  await assert.rejects(repo.set('new', key()), /publication/)
  assert.equal(index.new.credentialRef.id, 'new')
  assert.deepEqual(await repo.get('new'), key())
  await repo.clear()
  assert.equal(secure.tokens.size, 0)
})

test('secure clear failure keeps the index for retry, without deleting other refresh accounts', async() => {
  const h = credentialsHarness()
  await h.repo.get('nas')
  const clear = h.secure.backend.clear
  // The harness copies backend methods; use a second repository over the same storage.
  let removed = false
  const storage = { read: async() => h.value(), write: async() => {}, remove: async() => { removed = true } }
  let fail = true
  const repo = credentialModule.createLoginCredentialRepository(storage, { ...h.secure.backend, clear: async id => { if (fail) throw Error('locked'); return clear(id) } })
  await h.secure.setRefreshToken(JSON.stringify(['nas', 'alice']), 'refresh')
  await assert.rejects(repo.clear(), /locked/)
  assert.equal(removed, false)
  fail = false
  await repo.clear()
  assert.equal(removed, true)
  assert.equal(await h.secure.getRefreshToken(JSON.stringify(['nas', 'alice'])), 'refresh')
})


test('untrusted server indexes cannot alias object prototypes or leave undiscoverable secure entries', async() => {
  const h = credentialsHarness({})
  await h.repo.set('__proto__', key('alice'))
  await h.repo.set('constructor', key('bob'))
  assert.equal(Object.hasOwn(h.value(), '__proto__'), true)
  assert.deepEqual(await h.repo.get('__proto__'), key('alice'))
  assert.deepEqual(await h.repo.get('constructor'), key('bob'))
  await h.repo.clear()
  assert.equal(h.secure.tokens.size, 0)
})
