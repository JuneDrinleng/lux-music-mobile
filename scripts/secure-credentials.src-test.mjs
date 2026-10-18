import assert from 'node:assert/strict'
import test from 'node:test'
import { fakeSecure, migration, load } from './secure-credentials-test-support.mjs'

const session = { serverId: 'nas', token: 'short-lived', refreshToken: 'secret-refresh', password: 'old-password', user: { id: 'alice', username: 'alice' } }
const harness = () => {
  const secure = fakeSecure()
  let active = structuredClone(session)
  let sessions = { nas: structuredClone(session) }
  let password = 'saved-password'
  let marked = false
  let crash = false
  const deps = {
    secure,
    read: async() => ({ active, sessions }),
    write: async(a, s) => { if (crash) throw Error('storage interrupted'); active = a; sessions = s },
    scrubPasswords: async() => { password = undefined },
    mark: async() => { marked = true },
  }
  return { secure, run: () => migration.migrateLuxCredentials(deps), get active() { return active }, get sessions() { return sessions }, get password() { return password }, get marked() { return marked }, crash: value => { crash = value } }
}

test('migration verifies secure storage, strips every plaintext secret, marks completion and reruns idempotently', async() => {
  const h = harness()
  await h.run()
  assert.equal(await h.secure.getRefreshToken(JSON.stringify(['nas', 'alice'])), 'secret-refresh')
  assert.equal(h.active.refreshToken, undefined)
  assert.equal(h.sessions.nas.refreshToken, undefined)
  assert.equal(h.active.password, undefined)
  assert.equal(h.password, undefined)
  assert.equal(h.marked, true)
  const before = JSON.stringify([h.active, h.sessions])
  await h.run()
  assert.equal(JSON.stringify([h.active, h.sessions]), before)
  assert.equal(await h.secure.getRefreshToken(JSON.stringify(['nas', 'alice'])), 'secret-refresh')
})

test('interrupted migration resumes without losing the token or trusting its marker', async() => {
  const h = harness()
  h.crash(true)
  await assert.rejects(h.run(), /interrupted/)
  assert.equal(h.marked, false)
  h.crash(false)
  await h.run()
  assert.equal(h.active.refreshToken, undefined)
  assert.equal(await h.secure.getRefreshToken(JSON.stringify(['nas', 'alice'])), 'secret-refresh')
})

test('unavailable keychain discards plaintext and the next 401 requires relogin without crashing', async() => {
  const h = harness()
  h.secure.fail(true)
  await h.run()
  assert.equal(h.active.refreshToken, undefined)
  assert.equal(h.password, undefined)
  assert.equal(h.marked, true)
  const errors = load('src/plugins/sync/client/userErrors.ts')
  const { createLuxAuthClient } = load('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': errors })
  let expired = 0
  let requests = 0
  const client = createLuxAuthClient({
    send: async() => { requests++; return { code: 401, text: '{}' } },
    find: async() => h.active,
    getRefreshToken: auth => h.secure.getRefreshToken(auth.serverId),
    rotate: async() => { assert.fail('must not rotate without refresh token') },
    clear: async() => true,
    expired: () => { expired++ },
  })
  await assert.rejects(client.request('https://nas/api/me', undefined, h.active.token), /Session expired/)
  assert.equal(expired, 1)
  assert.equal(requests, 1)
})

test('failed verification rejects a write and clears its entry; namespaced servers remain isolated', async() => {
  const h = fakeSecure()
  await h.setRefreshToken('a/b', 'first')
  await h.setRefreshToken('a', 'other')
  assert.ok(h.tokens.has('lux.refresh.a%2Fb'))
  await h.clear('a/b')
  assert.equal(await h.getRefreshToken('a/b'), null)
  assert.equal(await h.getRefreshToken('a'), 'other')
  h.backend.get = async() => 'wrong'
  assert.equal(await h.setRefreshToken('a', 'replacement'), false)
  assert.equal(h.tokens.size, 0)
})

test('native options use AES keystore encryption without authentication or biometrics', async() => {
  let options
  let stored
  const native = load('src/utils/secureCredentials.ts', {
    'react-native-keychain': {
      ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'after-first-unlock' },
      SECURITY_LEVEL: { SECURE_SOFTWARE: 'software' },
      STORAGE_TYPE: { AES_GCM_NO_AUTH: 'aes-gcm-no-auth' },
      setGenericPassword: async(_, token, value) => { stored = token; options = value; return true },
      getGenericPassword: async() => ({ password: stored }),
      resetGenericPassword: async() => { stored = null },
    },
  })
  assert.equal(await native.setRefreshToken('nas', 'secret'), true)
  assert.deepEqual(options, { service: 'lux.refresh.nas', accessible: 'after-first-unlock', securityLevel: 'software', storage: 'aes-gcm-no-auth' })
  assert.equal(options.accessControl, undefined)
})

test('Lux form persistence retains username and never saves or prefills passwords; LX code stays unchanged', async() => {
  let drafts = { lux: { host: 'https://nas', luxUsername: 'alice', luxPassword: 'legacy' }, lx: { host: 'https://lx', lxAuthCode: 'code' } }
  const prefill = load('src/utils/syncLoginPrefill.ts', {
    '@/plugins/sync/client/utils': { parseUrl: url => ({ href: url }) },
    '@/utils/syncLoginSavedSecretField': {},
    '@/utils/data': {
      getSyncLoginDrafts: async() => drafts,
      setSyncLoginDrafts: async value => { drafts = value },
      findLuxAuthForHost: async() => session,
      getLuxAuth: async() => session,
      listLuxAuthSessions: async() => [session],
    },
  })
  const snapshot = await prefill.loadSyncLoginFormSnapshot('lux')
  assert.equal(snapshot.luxPassword, undefined)
  await prefill.rememberSyncLoginForm({ host: 'https://nas', mode: 'lux', luxUsername: 'alice', luxPassword: 'just-entered' })
  assert.deepEqual(drafts.lux, { host: 'https://nas', luxUsername: 'alice' })
  assert.equal(drafts.lx.lxAuthCode, 'code')
})
