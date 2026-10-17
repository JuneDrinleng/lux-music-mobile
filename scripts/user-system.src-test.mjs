/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const load = (path, deps = {}, globals = {}) => {
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,global) {${source}\n})`).runInThisContext()(
    name => { assert.ok(Object.hasOwn(deps, name), `Unexpected dependency: ${name}`); return deps[name] },
    module, module.exports, globals,
  )
  return module.exports
}
const credentials = load('src/plugins/sync/client/credentials.ts')
const translations = JSON.parse(readFileSync(new URL('../src/lang/en-us.json', import.meta.url), 'utf8'))
const globals = { i18n: { t: key => translations[key] } }
const errors = load('src/plugins/sync/client/userErrors.ts', {}, globals)
const constants = load('src/plugins/sync/constants.ts').SYNC_CODE
const authHarness = (session, response = { code: 200, text: '{}' }, savedKey = null) => {
  const requests = []
  const auth = load('src/plugins/sync/client/auth.ts', {
    './utils': {
      request: async(url, options) => {
        requests.push([url, options])
        if (url.endsWith('/hello')) return { code: 200, text: constants.helloMsg }
        if (url.endsWith('/id')) return { code: 200, text: `${constants.idPrefix}server` }
        return response
      },
    },
    './userErrors': errors,
    '@/utils/luxAuthApi': load('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': errors }),
    '../data': { getSyncAuthKey: async() => savedKey, setSyncAuthKey: async() => {} },
    '@/utils/data': { getLuxAuth: async() => session, findLuxAuthForHost: async() => null, setLuxAuth: async() => {} },
    '../log': { default: { error() {} } },
    '../utils': {},
    '@/utils/nativeModules/utils': { getDeviceName: async() => 'phone' },
    '@/utils/tools': {},
    '../constants': { SYNC_CODE: constants },
    '../deviceId': { getSyncDeviceId: async() => 'device' },
    './credentials': credentials,
  }, globals)
  return { auth, requests }
}
const urlInfo = { href: 'https://server', httpProtocol: 'https:', hostPath: 'server' }
const session = { token: 'saved', user: { id: 'alice-id', username: 'alice' } }

test('username mismatch requires password in authLux and both login forms', async() => {
  assert.equal(credentials.canReuseLuxSession(session, 'alice'), true)
  for (const username of ['bob', 'Alice']) {
    const { auth, requests } = authHarness(session)
    await assert.rejects(auth.authLux(urlInfo, username), { message: translations.setting_sync_lux_login_missing_tip })
    assert.equal(requests.length, 2, 'no old token or key may be used')
  }
  for (const path of ['src/screens/SyncLogin/index.tsx', 'src/screens/Home/Vertical/Tabs/SettingsTab.tsx']) {
    assert.match(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), /canReuseLuxSession\(savedLux, username\)/)
  }
})

test('missing and revoked Lux sessions use the expired status, never LX connection codes', async() => {
  await assert.rejects(authHarness(null).auth.authLux(urlInfo), { message: constants.luxSessionExpired })
  for (const text of ['', JSON.stringify({ code: 'UNAUTHENTICATED', message: 'revoked' })]) {
    const { auth, requests } = authHarness(session, { code: 401, text }, { clientId: 'saved', key: 'valid-key', luxUserId: session.user.id })
    await assert.rejects(auth.authLux(urlInfo), { message: constants.luxSessionExpired })
    assert.equal(requests.at(-1)[0], 'https://server/api/auth/me', 'validate bearer session before reusing a saved socket key')
  }
})

test('remember checkbox controls persistence; overwrite is never remembered', async() => {
  for (const remember of [false, true]) {
    for (const mode of ['merge_local_remote', 'overwrite_local_remote', 'cancel']) {
      let listener
      const writes = []
      const sync = load('src/core/sync.ts', {
        '@/navigation': { dismissOverlay() {}, onModalDismissed: () => () => {}, showSyncModeModal() {} },
        '@/store/sync/state': { default: { syncModeComponentId: 'modal' } },
        '@/store/sync/action': { default: { setServerInfo() {}, setSyncModeComponentId() {} } },
        '@/utils/data': { getSyncConflictMode: async() => null, setSyncConflictMode: async value => { writes.push(value) } },
      }, { app_event: { on: (_, fn) => { listener = fn }, off() {} } })
      const pending = sync.selectSyncMode('server', 'list')
      await Promise.resolve()
      await listener({ type: 'list', mode, remember })
      assert.equal(await pending, mode)
      assert.deepEqual(writes, remember && mode.startsWith('merge_') ? [mode] : [])
    }
  }
})

test('401 rejects credentials, coded 403 preserves them, and 429 is transient', async() => {
  for (const coded of [false, true]) {
    for (const [status, code, expected] of [[401, 'UNAUTHENTICATED', true], [403, 'FORBIDDEN', !coded], [429, 'RATE_LIMITED', false]]) {
      const text = coded ? JSON.stringify({ code, message: 'server message' }) : ''
      assert.equal(credentials.isKeyRejection(status, text, 'Auth failed', 'Blocked IP'), expected)
      const { auth } = authHarness(session, { code: status, text })
      await assert.rejects(auth.requestJson('https://server/api'), error => error.status === status && error.code === (coded ? code : undefined))
    }
  }
  let saved = 0
  await assert.rejects(credentials.reuseOrRequestKey({ saved: { clientId: 'old' }, verify: async() => { throw new errors.LuxRequestError('permission', 403, 'FORBIDDEN') }, request: async() => assert.fail('must preserve credentials'), save: async() => { saved++ } }))
  assert.equal(saved, 0)
})

test('admin access distinguishes expired login from permission with old and new servers', async() => {
  for (const coded of [false, true]) {
    for (const [status, code, reason] of [[401, 'UNAUTHENTICATED', 'no_auth'], [403, 'FORBIDDEN', 'denied'], [429, 'RATE_LIMITED', null]]) {
      const api = load('src/core/admin/api.ts', {
        '@/plugins/sync/client/auth': { requestJson: async() => { throw new errors.LuxRequestError(coded ? 'server message' : `HTTP ${status}`, status, coded ? code : undefined) } },
        '@/plugins/sync/client/userErrors': errors,
        '@/plugins/sync/client/utils': { parseUrl: () => urlInfo, request: async() => ({ code: status, text: coded ? JSON.stringify({ code, message: 'server message' }) : '' }) },
        '@/utils/data': { getLuxAuth: async() => ({ ...session, user: { ...session.user, role: 'admin', status: 'active' } }), setLuxAuth: async() => {} },
      })
      await assert.rejects(api.luxAdminRequest('server', 'token', '/api'), error => error.status === status && error.code === (coded ? code : undefined))
      const result = await api.ensureAdminAccess('server')
      if (reason) assert.equal(result.reason, reason)
      else assert.equal(result.ok, true)
    }
  }
})

test('profile failures preserve server messages and localize oversized avatars', () => {
  assert.equal(errors.profileSyncErrorMessage(new errors.LuxRequestError('payload', 413, 'AVATAR_TOO_LARGE')), 'Avatar too large')
  assert.equal(errors.profileSyncErrorMessage(new errors.LuxRequestError('payload', 413)), 'Avatar too large')
  assert.equal(errors.profileSyncErrorMessage(new errors.LuxRequestError('server detail', 400, 'INVALID_PROFILE')), 'Profile sync failed: server detail')
  assert.equal(errors.profileSyncErrorMessage(new Error('offline')), 'Profile sync failed: offline')
})

test('together user messages exclude gate diagnostics while logs retain them', () => {
  const gate = load('src/core/together/togetherGate.ts', { '@/plugins/sync/client/session': {}, '@/utils/data': {} })
  assert.equal(gate.shouldAppendTogetherGateHint(), false)
  const source = readFileSync(new URL('../src/core/together/index.ts', import.meta.url), 'utf8')
  const handler = source.slice(source.indexOf('const appendGateHint'), source.indexOf('const ensureOnline'))
  assert.match(handler, /log.warn\('\[together\]'[^\n]*formatTogetherGateHint\(snap\)/)
  assert.match(handler, /return message\n/)
  assert.doesNotMatch(handler, /return `.*formatTogetherGateHint/)
})
