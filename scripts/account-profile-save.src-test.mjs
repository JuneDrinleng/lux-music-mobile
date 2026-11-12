/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import ts from 'typescript'

const deferred = () => {
  let resolve; let reject
  const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject })
  return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const initial = () => ({ displayName: 'Alice', avatar: 'avatar-original', signature: 'Original signature', gender: 'unknown' })
const harness = ({ mode = 'lux', send, write, read, wrapRequest } = {}) => {
  let generation = 1; let space = mode === 'lux' ? 'lux:server:alice' : 'local'
  let auth = { token: 'bearer', serverUrl: 'https://server', serverId: 'server', user: { id: 'alice' } }
  let remote = initial()
  const disk = new Map([[space, initial()]])
  const calls = []; const writes = []; const events = []
  const local = () => disk.get(space)
  const readSaved = async field => {
    const captured = local()
    if (read) await read(field, captured)
    return captured[field]
  }
  const persist = async(field, value) => {
    const captured = space
    writes.push({ field, value, space: captured })
    if (write) await write(field, value, captured)
    disk.get(captured)[field] = value ?? ''
    return value
  }
  const deps = {
    '@/utils/sessionFence': { sessionGeneration: () => generation, acceptsSessionGeneration: ticket => ticket === generation },
    '@/utils/dataSpace': { getActiveSpace: () => space },
    '@/utils/data': {
      getSyncHost: async() => 'https://server',
      getLuxAuth: async() => auth,
      getSyncMode: async() => mode,
      getUserAvatarDataUrl: async() => readSaved('avatar'),
      getUserName: async() => await readSaved('displayName') || null,
      getUserSignature: async() => await readSaved('signature') || null,
      getUserGender: async() => readSaved('gender'),
      saveUserAvatarDataUrl: value => persist('avatar', value),
      saveUserName: value => persist('displayName', value),
      saveUserSignature: value => persist('signature', value),
      saveUserGender: value => persist('gender', value),
    },
    './utils': { parseUrl: host => ({ href: host.replace(/\/$/, ''), httpProtocol: 'https:', hostPath: host.replace(/^https:\/\//, '').replace(/\/$/, '') }) },
    './auth': {
      requestJson: async(url, body, token, method) => {
        const call = { url, body: body && { ...body }, token, method: method ?? (body == null ? 'GET' : 'POST') }
        calls.push(call)
        if (send) return send(call, { read: () => ({ ...remote }), update: value => { remote = { ...value } } })
        if (body != null) remote = { ...remote, ...body }
        return { profile: { ...remote } }
      },
    },
  }
  if (wrapRequest) deps['./auth'].requestJson = wrapRequest(deps['./auth'].requestJson)
  const source = ts.transpileModule(readFileSync(new URL('../src/plugins/sync/client/profile.ts', import.meta.url), 'utf8'), {
    fileName: 'profile.ts', compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText
  const module = { exports: {} }
  const appGlobal = { app_event: Object.fromEntries(['userNameUpdated', 'userSignatureUpdated', 'userGenderUpdated', 'userAvatarUpdated'].map(name => [name, value => { events.push([name, value]) }])) }
  new Script(`(function(require,module,exports,global){${source}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency ${name}`)
    return deps[name]
  }, module, module.exports, appGlobal)
  return {
    api: module.exports,
    calls,
    writes,
    events,
    disk,
    local,
    remote: () => ({ ...remote }),
    setRemote: value => { remote = { ...value } },
    setAuth: value => { auth = { ...auth, ...value } },
    invalidate: () => { generation++ },
    switchSpace: (next = 'lux:server:bob') => { space = next; disk.set(next, initial()); generation++ },
  }
}

test('local and LX single-field edits merge the latest saved fields without a server call', async() => {
  for (const mode of ['local', 'lx']) {
    const env = harness({ mode })
    const identity = env.api.captureProfileIdentity()
    env.local().displayName = 'Changed since panel opened'
    env.local().avatar = 'latest-avatar'
    await env.api.saveEditedProfileField('signature', 'Only signature', false, identity)
    assert.deepEqual(env.local(), { displayName: 'Changed since panel opened', avatar: 'latest-avatar', signature: 'Only signature', gender: 'unknown' })
    assert.equal(env.calls.length, 0)
    assert.equal(env.events.length, 4)
  }
})

test('Lux single-field edit GETs latest remote and PATCHes exactly its four fields', async() => {
  const env = harness()
  const identity = env.api.captureProfileIdentity()
  env.setRemote({ displayName: 'Newer remote name', avatar: 'remote-avatar', signature: 'remote signature', gender: 'female', extra: 'not a profile field' })
  const saved = await env.api.saveEditedProfileField('signature', 'Edited signature', true, identity)
  const expected = { displayName: 'Newer remote name', avatar: 'remote-avatar', signature: 'Edited signature', gender: 'female' }
  assert.deepEqual(env.calls.map(call => call.method), ['GET', 'PATCH'])
  assert.equal(env.calls[0].url, 'https://server/api/me/profile')
  assert.deepEqual(env.calls[1].body, expected)
  assert.deepEqual(env.local(), expected)
  assert.equal(saved.signature, 'Edited signature')
})

test('concurrent Lux edits are serialized and the second edit preserves the first', async() => {
  const firstPatch = deferred(); const release = deferred()
  let patches = 0
  const env = harness({
    send: async(call, remote) => {
      if (call.method === 'PATCH') {
        patches++
        if (patches === 1) { firstPatch.resolve(); await release.promise }
        remote.update(call.body)
      }
      return { profile: remote.read() }
    },
  })
  const first = env.api.saveEditedProfileField('displayName', 'New nickname', true)
  await firstPatch.promise
  const second = env.api.saveEditedProfileField('signature', 'New signature', true)
  await flush()
  assert.deepEqual(env.calls.map(call => call.method), ['GET', 'PATCH'])
  release.resolve(); await Promise.all([first, second])
  assert.deepEqual(env.calls.map(call => call.method), ['GET', 'PATCH', 'GET', 'PATCH'])
  assert.equal(env.calls[3].body.displayName, 'New nickname')
  assert.equal(env.local().signature, 'New signature')
})

test('pull and login cannot apply an older response over an explicit edit', async() => {
  for (const method of ['pullLuxProfileFromServer', 'syncLuxProfileOnLogin']) {
    const requested = deferred(); const release = deferred()
    let reads = 0
    const env = harness({
      send: async(call, remote) => {
        if (call.method === 'GET' && ++reads === 1) { requested.resolve(); await release.promise }
        if (call.method === 'PATCH') remote.update(call.body)
        return { profile: remote.read() }
      },
    })
    const pulling = env.api[method]()
    await requested.promise
    const saving = env.api.saveEditedProfileField('signature', 'Draft survives pull', true)
    await flush()
    assert.equal(env.calls.length, 1)
    release.resolve(); await Promise.all([pulling, saving])
    assert.equal(env.local().signature, 'Draft survives pull')
    assert.deepEqual(env.calls.map(call => call.method), ['GET', 'GET', 'PATCH'])
  }
})

test('explicit push waits for a save and uploads its newly saved local values', async() => {
  const patchStarted = deferred(); const release = deferred()
  const env = harness({
    send: async(call, remote) => {
      if (call.method === 'PATCH') { patchStarted.resolve(); await release.promise }
      if (call.body != null) remote.update(call.body)
      return { profile: remote.read() }
    },
  })
  const saving = env.api.saveEditedProfileField('displayName', 'Latest local name', true)
  await patchStarted.promise
  const pushing = env.api.pushLuxProfileToServer()
  await flush(); assert.equal(env.calls.length, 2)
  release.resolve(); await Promise.all([saving, pushing])
  assert.equal(env.calls.at(-1).method, 'POST')
  assert.equal(env.calls.at(-1).body.displayName, 'Latest local name')
})

test('failed remote read or PATCH leaves local data untouched and a retry remains usable', async() => {
  for (const failureAt of ['GET', 'PATCH']) {
    let failing = true
    const env = harness({
      send: async(call, remote) => {
        if (failing && call.method === failureAt) throw new Error('offline')
        if (call.method === 'PATCH') remote.update(call.body)
        return { profile: remote.read() }
      },
    })
    await assert.rejects(env.api.saveEditedProfileField('signature', 'Keep draft', true), /offline/)
    assert.deepEqual(env.local(), initial())
    assert.deepEqual(env.writes, [])
    assert.deepEqual(env.events, [])
    failing = false
    await env.api.saveEditedProfileField('signature', 'Keep draft', true)
    assert.equal(env.local().signature, 'Keep draft')
  }
})

test('retry after a timed out committed PATCH reads remote changes before resubmitting', async() => {
  let fail = true
  const env = harness({
    send: async(call, remote) => {
      if (call.method === 'PATCH') {
        remote.update(call.body)
        if (fail) { fail = false; throw new Error('timeout after server commit') }
      }
      return { profile: remote.read() }
    },
  })
  await assert.rejects(env.api.saveEditedProfileField('signature', 'Draft', true), /timeout/)
  assert.deepEqual(env.local(), initial())
  env.setRemote({ ...env.remote(), displayName: 'Changed on another device', gender: 'male' })
  await env.api.saveEditedProfileField('signature', 'Draft', true)
  assert.equal(env.calls.at(-1).body.displayName, 'Changed on another device')
  assert.equal(env.calls.at(-1).body.gender, 'male')
})

test('partial local persistence is settled before the queue advances and retry recovers from remote', async() => {
  const delayedWrite = deferred(); const writeStarted = deferred()
  let fail = true
  const env = harness({
    write: async field => {
      if (!fail) return
      if (field === 'signature') throw new Error('disk full')
      if (field === 'avatar') { writeStarted.resolve(); await delayedWrite.promise }
    },
  })
  const rejected = assert.rejects(env.api.saveEditedProfileField('signature', 'Saved remotely', true), /disk full/)
  await writeStarted.promise
  const retry = env.api.saveEditedProfileField('signature', 'Saved remotely', true)
  await flush()
  assert.equal(env.calls.length, 2, 'a failed parallel write must not release the queue while another write is pending')
  env.setRemote({ ...env.remote(), displayName: 'Remote name after partial local persistence', avatar: 'remote-new-avatar' })
  fail = false; delayedWrite.resolve()
  await rejected; await retry
  assert.equal(env.calls.at(-1).body.displayName, 'Remote name after partial local persistence')
  assert.equal(env.local().avatar, 'remote-new-avatar')
  assert.equal(env.local().signature, 'Saved remotely')
  assert.equal(env.events.length, 4, 'only the complete successful application publishes profile events')
})

test('captured identity rejects after account or session generation changes before submission', async() => {
  for (const change of ['switchSpace', 'invalidate']) {
    const env = harness()
    const identity = env.api.captureProfileIdentity()
    env[change]()
    await assert.rejects(env.api.saveEditedProfileField('signature', 'Old account draft', true, identity), /account changed/)
    assert.deepEqual(env.calls, [])
    assert.deepEqual(env.writes, [])
  }
})

test('account changed while waiting for GET cannot PATCH or apply into the new space', async() => {
  const requested = deferred(); const release = deferred()
  const env = harness({ send: async(call, remote) => { requested.resolve(); await release.promise; return { profile: remote.read() } } })
  const saved = env.api.saveEditedProfileField('signature', 'Old account draft', true)
  const rejected = assert.rejects(saved, /account changed/)
  await requested.promise
  env.switchSpace(); release.resolve(); await rejected
  assert.deepEqual(env.calls.map(call => call.method), ['GET'])
  assert.deepEqual(env.writes, [])
})

test('queued edits retain the caller identity and cannot run after switching away and back', async() => {
  const requested = deferred(); const release = deferred()
  const env = harness({ send: async(call, remote) => { requested.resolve(); await release.promise; return { profile: remote.read() } } })
  const pulling = env.api.pullLuxProfileFromServer()
  await requested.promise
  const saved = env.api.saveEditedProfileField('gender', 'female', true)
  const rejected = assert.rejects(saved, /account changed/)
  env.invalidate(); release.resolve()
  assert.equal(await pulling, null)
  await rejected
  assert.equal(env.calls.length, 1)
  assert.equal(env.writes.length, 0)
})

test('an auth identity replacement without a space change is fenced, while token rotation is allowed', async() => {
  for (const replaceAccount of [true, false]) {
    let env
    env = harness({
      send: async(call, remote) => {
        if (call.method === 'GET') env.setAuth(replaceAccount ? { user: { id: 'bob' } } : { token: 'rotated' })
        if (call.method === 'PATCH') remote.update(call.body)
        return { profile: remote.read() }
      },
    })
    const saving = env.api.saveEditedProfileField('signature', 'Draft', true)
    if (replaceAccount) {
      await assert.rejects(saving, /account changed/)
      assert.equal(env.calls.length, 1)
      assert.equal(env.writes.length, 0)
    } else {
      await saving
      assert.equal(env.local().signature, 'Draft')
      assert.equal(env.calls.at(-1).token, 'rotated')
    }
  }
})

test('a stale or mismatched bearer never sends a request or falls back to local persistence', async() => {
  for (const patch of [{ serverUrl: 'https://other-server' }, { serverId: 'other-server' }, { token: '' }]) {
    const env = harness()
    env.setAuth(patch)
    await assert.rejects(env.api.saveEditedProfileField('signature', 'Draft', true), /session unavailable/)
    assert.equal(env.calls.length, 0)
    assert.equal(env.writes.length, 0)
  }
})

test('session changes during PATCH prevent local writes and success events', async() => {
  let env
  env = harness({
    send: async(call, remote) => {
      if (call.method === 'PATCH') { remote.update(call.body); env.switchSpace() }
      return { profile: remote.read() }
    },
  })
  await assert.rejects(env.api.saveEditedProfileField('avatar', 'new-avatar', true), /account changed/)
  assert.equal(env.writes.length, 0)
  assert.equal(env.events.length, 0)
})

test('switching during local writes keeps every physical write in the captured space and suppresses stale events', async() => {
  const writing = deferred(); const release = deferred()
  const env = harness({ mode: 'local', write: async() => { writing.resolve(); await release.promise } })
  const saving = env.api.saveEditedProfileField('signature', 'Local draft', false)
  const rejected = assert.rejects(saving, /account changed/)
  await writing.promise
  env.switchSpace(); release.resolve(); await rejected
  assert.equal(env.writes.every(write => write.space === 'local'), true)
  assert.deepEqual(env.local(), initial())
  assert.equal(env.events.length, 0)
})

test('direct profile application holds the queue until every local field is available to the next edit', async() => {
  const writing = deferred(); const release = deferred()
  let block = true
  const env = harness({
    mode: 'lx',
    write: async field => {
      if (block && field === 'displayName') { writing.resolve(); await release.promise }
    },
  })
  const applying = env.api.applyLuxProfile({ ...initial(), displayName: 'Applied in background', avatar: 'applied-avatar' })
  await writing.promise
  const saving = env.api.saveEditedProfileField('signature', 'Explicit edit', false)
  await flush()
  assert.equal(env.writes.length, 4)
  block = false; release.resolve(); await Promise.all([applying, saving])
  assert.equal(env.local().displayName, 'Applied in background')
  assert.equal(env.local().avatar, 'applied-avatar')
  assert.equal(env.local().signature, 'Explicit edit')
})

test('a failed local read waits for in-flight avatar migration before another field can save', async() => {
  const migrating = deferred(); const release = deferred()
  let fail = true
  const env = harness({
    mode: 'local',
    read: async(field, profile) => {
      if (!fail) return
      if (field === 'displayName') throw new Error('storage read failed')
      if (field === 'avatar') {
        migrating.resolve(); await release.promise
        profile.avatar = 'migrated-avatar'
      }
    },
  })
  const first = assert.rejects(env.api.saveEditedProfileField('signature', 'Failed draft', false), /storage read failed/)
  await migrating.promise
  const second = env.api.saveEditedProfileField('gender', 'female', false)
  await flush()
  assert.equal(env.writes.length, 0, 'a failing read must not let a second save race an avatar migration')
  fail = false; release.resolve(); await first; await second
  assert.equal(env.local().avatar, 'migrated-avatar')
  assert.equal(env.local().gender, 'female')
  assert.equal(env.local().signature, 'Original signature')
})

test('real auth requestJson blocks offline Lux edits before network, while prepared login is allowed', async() => {
  const authSource = ts.createSourceFile('auth.ts', readFileSync(new URL('../src/plugins/sync/client/auth.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest)
  const declaration = authSource.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(item => item.name.getText(authSource) === 'requestJson'))
  assert.ok(declaration)
  const source = ts.transpileModule(declaration.getText(authSource), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  let frozen = false
  const env = harness({
    wrapRequest: request => {
      const module = { exports: {} }
      new Script(`(function(exports,isSessionOffline,sessionWritesFrozen,luxAuthApi,global){${source}\n})`).runInThisContext()(module.exports, () => true, () => frozen, { request }, { i18n: { t: key => key } })
      return module.exports.requestJson
    },
  })
  await assert.rejects(env.api.saveEditedProfileField('signature', 'Offline draft', true), /login_gate_offline_restricted/)
  assert.equal(env.calls.length, 0)
  assert.equal(env.writes.length, 0)
  assert.equal(env.events.length, 0)
  frozen = true
  await env.api.saveEditedProfileField('signature', 'Prepared login', true)
  assert.deepEqual(env.calls.map(call => call.method), ['GET', 'PATCH'])
  assert.equal(env.local().signature, 'Prepared login')
})
