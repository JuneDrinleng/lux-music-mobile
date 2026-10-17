/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const evaluate = (file, deps) => {
  const js = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
// Read the production key catalog, without importing RN-backed constants.
const catalog = readFileSync(join(root, 'src/config/constant.ts'), 'utf8').split('export const storageDataPrefix = {')[1].split('} as const')[0]
const keys = Object.fromEntries([...catalog.matchAll(/(\w+): '([^']+)'/g)].map(match => [match[1], match[2]]))
const make = (seed = {}) => {
  const disk = new Map(Object.entries(seed))
  let writes = 0
  let failAt = Infinity
  const storage = {
    getItem: async key => disk.get(key) ?? null,
    setItem: async(key, value) => { if (++writes === failAt) throw Error('simulated crash'); disk.set(key, value) },
    getAllKeys: async() => [...disk.keys()],
    multiGet: async list => list.map(key => [key, disk.get(key) ?? null]),
    multiSet: async pairs => { for (const [key, value] of pairs) await storage.setItem(key, value) },
    removeItem: async key => { disk.delete(key) },
    multiRemove: async list => { for (const key of list) disk.delete(key) },
  }
  const messages = []
  const log = Object.fromEntries(['info', 'error', 'warn'].map(level => [level, (...args) => messages.push([level, ...args])]))
  const files = new Map()
  let failCopy = false
  const fs = {
    privateStorageDirectoryPath: '/private',
    extname: path => path.split('.').at(-1),
    existsFile: async path => files.has(path),
    mkdir: async path => { files.set(path, '') },
    readFile: async path => { assert.ok(files.has(path)); return files.get(path) },
    writeFile: async(path, data) => {
      files.set(path, failCopy ? data.slice(0, 2) : data)
      if (failCopy) throw Error('file copy crash')
    },
    stat: async path => ({ size: files.get(path).length }),
    unlink: async path => { files.delete(path) },
    rename: async(source, name) => {
      const target = source.slice(0, source.lastIndexOf('/') + 1) + name
      files.set(target, files.get(source))
      files.delete(source)
      return true
    },
  }
  const avatar = evaluate('src/utils/dataSpace/avatar.ts', { '@/utils/fs': fs })
  let current

  const load = () => (current = evaluate('src/utils/dataSpace/index.ts', {
    '@react-native-async-storage/async-storage': storage,
    '@/config/constant': { storageDataPrefix: keys },
    '@/utils/log': { log },
    './avatar': avatar,
  }))
  const space = load()
  const adapter = evaluate('src/plugins/storage.ts', {
    '@react-native-async-storage/async-storage': storage, '@/utils/log': { log }, '@/utils/dataSpace': new Proxy({}, { get: (_, key) => current[key] }),
  })
  return { disk, space, adapter, storage, load, fs, avatar, files, messages, failCopy: value => { failCopy = value }, fail: n => { writes = 0; failAt = n } }
}
const legacy = {
  '@user_avatar': '"https://example.com/avatar.png"',
  '@user_list': '[{"id":"mine"}]',
  '@list__default': '[1]',
  '@list__love': '[2]',
  '@list__mine': '[3]',
  '@play_history': '[{"id":"history"}]',
  '@play_history_cursor': '{"cursor":7}',
  '@user_name': '"Alice"',
  '@user_signature': '"hello"',
  '@user_gender': '"female"',
  '@sync_conflict_mode': '"merge_local_remote"',
  '@dislike_list': '"rule"',
  '@play_info': '{}',
  '@list_scroll_position': '{}',
  '@list_prev_select_id': '"mine"',
  '@list_update_info': '{}',
}
for (const loggedIn of [false, true]) {
  test(`startup migrates all affected keys, logged in=${loggedIn}, and preserves globals/legacy`, async() => {
    const globals = Object.fromEntries(Object.values(keys).filter(key => !(key in legacy) && key !== keys.list).map(key => [key, '"global"']))
    Object.assign(globals, {
      '@sync_login_completed': JSON.stringify(loggedIn),
      '@sync_mode': '"lux"',
      '@lux_auth': JSON.stringify({ serverId: 'server', user: { id: 'alice' } }),
    })
    const { disk, space } = make({ ...legacy, ...globals })
    await space.initializeDataSpaces()
    const target = loggedIn ? 'lux:server:alice' : 'local'
    assert.equal(space.getActiveSpace(), target)
    for (const [key, value] of Object.entries(legacy)) {
      assert.equal(disk.get(`${key}@${target}`), value, key)
      assert.equal(disk.get(key), value)
    }
    for (const [key, value] of Object.entries(globals)) {
      assert.equal(disk.get(key), value, key)
      assert.equal(disk.has(`${key}@${target}`), false, key)
    }
    const once = new Map(disk)
    await space.migrateDataSpaces('lux:other:user')
    assert.deepEqual(disk, once)
    assert.equal(disk.get(space.MIGRATION_KEY), `v1:${target}`)
    assert.ok(disk.has(space.BACKUP_KEY))
  })
}
test('every migration write boundary recovers, preserving existing destination values and original backup target', async() => {
  for (let failAt = 1; failAt < 30; failAt++) {
    const env = make({ ...legacy, '@user_name@lux:s:a': '"already edited"' })
    env.fail(failAt)
    try { await env.space.migrateDataSpaces('lux:s:a') } catch (error) { assert.match(error.message, /simulated crash/) }
    env.fail(Infinity)
    await env.load().migrateDataSpaces('lux:s:a')
    assert.ok(env.disk.has(env.space.BACKUP_KEY))
    for (const [key, value] of Object.entries(legacy)) {
      assert.equal(env.disk.get(key), value)
      assert.equal(env.disk.get(`${key}@lux:s:a`), key === '@user_name' ? '"already edited"' : value)
    }
  }
  const env = make(legacy)
  env.fail(5)
  await assert.rejects(env.space.migrateDataSpaces('lux:s:a'))
  env.fail(Infinity)
  await env.load().migrateDataSpaces('local')
  assert.equal(env.disk.get(env.space.MIGRATION_KEY), 'v1:local')
})
test('large current and old-format fragmented playlists get independent verified shards', async() => {
  for (const old of [false, true]) {
    const raw = JSON.stringify(['x'.repeat(600000)])
    const shardNames = old ? ['old1', 'old2'] : ['@___PART_A___@list__big0', '@___PART_A___@list__big1']
    const env = make({
      '@list__big': old ? '@___PART___' + shardNames.join(',') : '@___PART_A___' + JSON.stringify(shardNames),
      [shardNames[0]]: raw.slice(0, 400000),
      [shardNames[1]]: raw.slice(400000),
    })
    for (let n = 1; n < 16; n++) {
      const trial = make(Object.fromEntries(env.disk))
      trial.fail(n)
      try { await trial.space.migrateDataSpaces('local') } catch {}
      trial.fail(Infinity)
      await trial.load().migrateDataSpaces('local')
      assert.deepEqual(await trial.adapter.getData('@list__big'), JSON.parse(raw))
      await trial.adapter.removeData('@list__big')
      assert.equal(trial.disk.get(shardNames[0]), raw.slice(0, 400000))
    }
  }
})
test('single/batch reads, writes and deletes isolate spaces and retain global settings/device/credentials', async() => {
  const { space, adapter, disk } = make()
  await space.migrateDataSpaces('local')
  for (const id of ['local', 'lux:s:a', 'lux:s:b']) {
    await space.setActiveSpace(id)
    await adapter.saveData('@user_name', id)
    await adapter.saveDataMultiple([['@list__love', [id]], ['@play_history_cursor', { id }]])
  }
  for (const id of ['local', 'lux:s:a', 'lux:s:b']) {
    await space.setActiveSpace(id)
    assert.equal(await adapter.getData('@user_name'), id)
    assert.deepEqual(await adapter.getDataMultiple(['@list__love', '@play_history_cursor']), [
      ['@list__love', [id]], ['@play_history_cursor', { id }],
    ])
  }
  await adapter.removeDataMultiple(['@list__love', '@play_history_cursor'])
  await space.setActiveSpace('lux:s:a')
  assert.deepEqual(await adapter.getData('@list__love'), ['lux:s:a'])
  for (const key of ['@setting_v1', '@theme', '@play_history_device', '@sync_auth_key', '@lux_auth_servers', '@sync_host_history']) {
    await adapter.saveData(key, 'shared')
    assert.equal(disk.get(key), '"shared"')
    assert.equal(disk.has(`${key}@lux:s:a`), false)
  }
  assert.equal((await space.listSpaces()).length, 3)
  const visible = await adapter.getAllKeys()
  assert.equal(visible.filter(key => key === '@list__love').length, 1)
  assert.equal(visible.some(key => /@lux:/.test(key)), false)
})

test('logout restart retains last space, and saved credentials alone do not select an account', async() => {
  const env = make({
    ...legacy,
    '@sync_login_completed': 'false',
    '@sync_mode': '"lux"',
    '@lux_auth': JSON.stringify({ serverId: 's', user: { id: 'a' } }),
  })
  await env.space.initializeDataSpaces()
  assert.equal(env.space.getActiveSpace(), 'local')
  await env.space.setActiveSpace('lux:s:a')
  const restarted = env.load()
  await restarted.initializeDataSpaces()
  assert.equal(restarted.getActiveSpace(), 'lux:s:a')
})
test('backup verification failure prevents copying or setting marker', async() => {
  const env = make(legacy)
  const read = env.storage.getItem
  env.storage.getItem = async key => key.startsWith('dataSpaceBackup@v1:chunk:') ? 'corrupt' : read(key)
  await assert.rejects(env.space.migrateDataSpaces('local'), /verification failed/)
  assert.equal(env.disk.has(env.space.MIGRATION_KEY), false)
  for (const [key, value] of Object.entries(legacy)) {
    assert.equal(env.disk.get(key), value)
    assert.equal(env.disk.has(`${key}@local`), false)
  }
})
test('history caches and pending writes follow their original space; cursors reset on switch', async() => {
  const env = make({ '@play_history_device': '"device"' })
  await env.space.migrateDataSpaces('local')
  const history = evaluate('src/utils/playHistory/store.ts', {
    '@/utils/dataSpace': env.space,
    '@/config/constant': { storageDataPrefix: keys },
    '@/plugins/storage': env.adapter,
    './merge': evaluate('src/utils/playHistory/merge.ts', {}),
  })
  await history.loadPlayHistoryStore()
  const record = {
    id: 'one',
    deviceId: 'device',
    startedAt: 1,
    endedAt: 60001,
    listenedMs: 60000,
    song: { source: 'kw', songmid: '1', name: 'song', singer: 'singer' },
  }
  history.upsertPlayRecord(record)
  await history.savePlayHistoryCursor({ serverKey: 's', userId: 'a', cursor: 10, ackedIds: ['one'] })
  await env.space.setActiveSpace('lux:s:b')
  assert.deepEqual(history.getPlayRecords(), [])
  assert.equal(history.getPlayHistoryCursor(), null)
  assert.deepEqual(JSON.parse(env.disk.get('@play_history@local')), [record])
  await history.replacePlayRecords([{ ...record, id: 'two' }])
  await env.space.setActiveSpace('local')
  assert.deepEqual(history.getPlayRecords(), [record])
  assert.equal(history.getPlayHistoryCursor().cursor, 10)
  assert.equal(history.getPlayDeviceId(), 'device')
})

test('production data helpers isolate profile, default/love/custom lists and metadata; Lux login selects account', async() => {
  const env = make()
  await env.space.migrateDataSpaces('local')
  const constants = evaluate('src/config/constant.ts', {})
  const data = evaluate('src/utils/data.ts', {
    '@/plugins/storage': env.adapter,
    '@/config/constant': constants,
    './dataSpace': env.space,
    './common': { throttle: fn => fn },
    './fs': env.fs,
    './log': { log: { warn() {} } },
    './musicUrlCache': {},
    '../../assets/img/DefaultAvatar.png': 0,
    '@react-native-async-storage/async-storage': env.storage,
    '@/plugins/sync/client/credentials': evaluate('src/plugins/sync/client/credentials.ts', {}),
  })
  const lists = evaluate('src/utils/listManage.ts', {
    '@/utils/dataSpace': env.space, '@/utils/data': data, '@/utils/common': {}, '@/config/constant': constants,
  })
  for (const id of ['local', 'lux:s:a', 'lux:s:b']) {
    await env.space.setActiveSpace(id)
    await data.saveUserList([{ id: 'custom', name: id }])
    await data.saveListMusics(['default', 'love', 'custom'].map(listId => ({ id: listId, musics: [{ id }] })))
    await data.saveUserName(id)
    await data.saveUserSignature(id)
    await data.saveUserGender(id === 'local' ? 'unknown' : 'female')
    await Promise.all([data.saveListPosition('custom', 17), data.saveListPosition('love', 25)])
    await Promise.all([data.setListAutoUpdate('custom', true), data.setListUpdateTime('custom', 123)])
    assert.deepEqual(await lists.getListMusics('custom'), [{ id }])
  }
  for (const id of ['local', 'lux:s:a', 'lux:s:b']) {
    await env.space.setActiveSpace(id)
    assert.equal(await data.getUserName(), id)
    assert.equal(await data.getUserSignature(), id)
    assert.equal(await data.getUserGender(), id === 'local' ? 'unknown' : 'female')
    assert.equal(lists.userLists[0].name, id)
    for (const listId of ['default', 'love', 'custom']) assert.deepEqual(await lists.getListMusics(listId), [{ id }])
    assert.equal(await data.getListPosition('custom'), 17)
    assert.equal(await data.getListPosition('love'), 25)
    assert.deepEqual((await data.getListUpdateInfo()).custom, { isAutoUpdate: true, updateTime: 123 })
  }
  await data.setLuxAuth({ serverId: 's', user: { id: 'a', username: 'Alice' }, token: 'token' })
  assert.equal(env.space.getActiveSpace(), 'lux:s:a')
  assert.equal((await env.space.listSpaces()).find(space => space.id === 'lux:s:a').label, 'Alice')
  const logout = evaluate('src/utils/syncLogout.ts', {
    '@/core/common': { updateSetting() {} },
    '@/core/player/player': {},
    '@/plugins/sync': { disconnectServer: async() => {} },
    '@/store/player/state': { isPlay: false },
    '@/utils/data': data,
  })
  await logout.applySyncAccountLogout()
  assert.equal(env.space.getActiveSpace(), 'lux:s:a')
  assert.equal(await data.getUserName(), 'lux:s:a')
})

test('a write already in flight keeps its physical namespace when the active account changes', async() => {
  const env = make()
  await env.space.migrateDataSpaces('local')
  let resume
  const gate = new Promise(resolve => { resume = resolve })
  const originalRemove = env.storage.removeItem
  env.storage.removeItem = async key => { await gate; await originalRemove(key) }
  const pending = env.adapter.saveData('@list__love', ['old space'])
  await env.space.setActiveSpace('lux:s:b')
  resume()
  await pending
  assert.deepEqual(JSON.parse(env.disk.get('@list__love@local')), ['old space'])
  assert.equal(env.disk.has('@list__love@lux:s:b'), false)
})

for (const loggedIn of [false, true]) {
  test(`avatar file migrates to ${loggedIn ? 'logged-in account' : 'local'}; reruns keep existing key and legacy bytes`, async() => {
    const source = '/private/user/avatar.png'
    const env = make({
      '@user_avatar': JSON.stringify(`file://${source}`),
      '@sync_login_completed': JSON.stringify(loggedIn),
      '@sync_mode': '"lux"',
      '@lux_auth': JSON.stringify({ serverId: 's/:%', user: { id: 'a/b' } }),
    })
    const bytes = 'base64-avatar-content'
    env.files.set(source, bytes)
    await env.space.initializeDataSpaces()
    const target = loggedIn ? env.space.luxSpaceId('s/:%', 'a/b') : 'local'
    const destination = `/private/user/${encodeURIComponent(target)}/avatar.png`
    assert.equal(env.disk.get(`@user_avatar@${target}`), JSON.stringify(destination))
    assert.equal(env.files.get(destination), bytes)
    assert.equal(env.files.get(source), bytes)
    assert.equal(env.disk.get('@user_avatar'), JSON.stringify(`file://${source}`))
    const once = new Map(env.files)
    await env.load().initializeDataSpaces()
    assert.deepEqual(env.files, once)
    // A destination profile already present before migration must be retained.
    const existing = make({ '@user_avatar': JSON.stringify(source), '@user_avatar@local': '"https://existing/avatar"' })
    existing.files.set(source, bytes)
    await existing.space.initializeDataSpaces()
    assert.equal(existing.disk.get('@user_avatar@local'), '"https://existing/avatar"')
    assert.equal(existing.files.size, 1)
  })
}

test('interrupted avatar copy is rebuilt through temp + rename, with size checked before publishing', async() => {
  const source = '/private/user/avatar.jpg'
  const env = make({ '@user_avatar': JSON.stringify(source) })
  env.files.set(source, 'identical-original-avatar-bytes')
  env.failCopy(true)
  await assert.doesNotReject(env.space.initializeDataSpaces())
  assert.equal(env.disk.has('@user_avatar@local'), false)
  assert.equal(env.disk.has(env.space.MIGRATION_KEY), false)
  assert.equal(env.files.get('/private/user/local/avatar.jpg.migration-tmp'), 'id')
  // Model a process that died with both temp and unpublished destination bytes.
  env.files.set('/private/user/local/avatar.jpg', 'partial')
  env.failCopy(false)
  await env.load().initializeDataSpaces()
  assert.equal(env.files.get('/private/user/local/avatar.jpg'), env.files.get(source))
  assert.equal(env.files.has('/private/user/local/avatar.jpg.migration-tmp'), false)
  assert.equal(env.files.get(source), 'identical-original-avatar-bytes')
  const mismatch = make({ '@user_avatar': JSON.stringify(source) })
  mismatch.files.set(source, 'bytes')
  mismatch.fs.stat = async path => ({ size: path === source ? 10 : 2 })
  await mismatch.space.initializeDataSpaces()
  assert.equal(mismatch.disk.has('@user_avatar@local'), false)
  assert.equal(mismatch.disk.has(mismatch.space.MIGRATION_KEY), false)
})

const loadData = env => evaluate('src/utils/data.ts', {
  '@/plugins/storage': env.adapter,
  '@/config/constant': evaluate('src/config/constant.ts', {}),
  './dataSpace': env.space,
  './common': { throttle: fn => fn },
  './fs': env.fs,
  './log': { log: { warn() {} } },
  './musicUrlCache': {},
  '../../assets/img/DefaultAvatar.png': 0,
  '@react-native-async-storage/async-storage': env.storage,
  '@/plugins/sync/client/credentials': evaluate('src/plugins/sync/client/credentials.ts', {}),
})

test('avatar reads, local and sync writes, deletions and in-flight writes stay in their captured space', async() => {
  const env = make({ '@user_avatar': '"/private/user/avatar.png"' })
  env.files.set('/private/user/avatar.png', 'legacy')
  env.files.set('/selected.webp', 'selected')
  await env.space.initializeDataSpaces()
  const data = loadData(env)
  await env.space.setActiveSpace('lux:s:a')
  const a = await data.saveUserAvatar('/selected.webp')
  await env.space.setActiveSpace('lux:s:b')
  assert.equal(await data.getUserAvatar(), null)
  const b = await data.saveUserAvatarDataUrl('data:image/png;base64,space-b')
  await env.space.setActiveSpace('lux:s:a')
  assert.equal(await data.getUserAvatar(), a)
  assert.equal(env.files.get(a), 'selected')
  await data.saveUserAvatar(null)
  assert.equal(env.files.has(a), false)
  assert.equal(env.files.get(b), 'space-b')
  let resume
  const gate = new Promise(resolve => { resume = resolve })
  const write = env.fs.writeFile
  env.fs.writeFile = async(...args) => { await gate; return write(...args) }
  const pending = data.saveUserAvatarDataUrl('data:image/jpeg;base64,in-flight-a')
  await env.space.setActiveSpace('lux:s:b')
  resume()
  const pinned = await pending
  assert.equal(env.files.get(pinned), 'in-flight-a')
  assert.equal(JSON.parse(env.disk.get('@user_avatar@lux:s:a')), pinned)
  assert.equal(await data.getUserAvatar(), b)
  assert.equal(env.files.get(b), 'space-b')
  assert.equal(env.files.get('/private/user/avatar.png'), 'legacy')
})

for (const resolved of [false, true]) {
  test(`missing logged-in serverId ${resolved ? 'resolves matching session' : 'warns and falls back to local'} without breaking startup`, async() => {
    const env = make({
      ...legacy,
      '@sync_login_completed': 'true',
      '@sync_mode': '"lux"',
      '@lux_auth': JSON.stringify({ user: { id: 'a' } }),
      '@lux_auth_servers': JSON.stringify({
        other: { serverId: 'wrong', user: { id: 'b' } },
        ...(resolved ? { server: { serverId: 's', user: { id: 'a' } } } : {}),
      }),
    })
    await assert.doesNotReject(env.space.initializeDataSpaces())
    const target = resolved ? 'lux:s:a' : 'local'
    assert.equal(env.disk.get(env.space.MIGRATION_KEY), `v1:${target}`)
    assert.equal(env.space.getActiveSpace(), target)
    if (!resolved) assert.ok(env.messages.some(([level, text]) => level === 'warn' && text.includes('identity unknown')))
  })
}

test('failed migration keeps legacy reads and enumeration visible; switching is a logged no-op', async() => {
  const env = make({ ...legacy, '@user_name@lux:s:a': '"destination"' })
  env.fail(4)
  await assert.doesNotReject(env.space.initializeDataSpaces())
  assert.equal(env.disk.has(env.space.MIGRATION_KEY), false)
  await env.space.setActiveSpace('lux:s:a')
  assert.equal(env.space.getActiveSpace(), 'local')
  assert.equal(await env.adapter.getData('@user_name'), 'Alice')
  assert.deepEqual(await env.adapter.getDataMultiple(['@list__love', '@user_signature']), [['@list__love', [2]], ['@user_signature', 'hello']])
  const visible = await env.adapter.getAllKeys()
  for (const key of Object.keys(legacy)) assert.ok(visible.includes(key))
  assert.equal(visible.includes('@user_name@lux:s:a'), false)
  assert.ok(env.messages.some(([level, text]) => level === 'warn' && text.includes('switch ignored')))
  const data = loadData(env)
  await data.saveListPosition('mine', 77)
  assert.equal(JSON.parse(env.disk.get('@list_scroll_position')).mine, 77)
  assert.equal(env.disk.has('@list_scroll_position@local'), false)
})

for (const failureAt of [1, 2, 4, 6, 10]) {
  test(`quota error at write ${failureAt} rolls back only this run's keys; next start retries`, async() => {
    const seed = { ...legacy, '@list__large': JSON.stringify(['x'.repeat(600000)]), '@user_name@local': '"existing"' }
    const env = make(seed)
    let writes = 0
    const set = env.storage.setItem
    env.storage.setItem = async(key, value) => {
      await set(key, value)
      if (++writes === failureAt) throw Error('SQLITE_FULL: database or disk is full')
    }
    await assert.doesNotReject(env.space.initializeDataSpaces())
    assert.deepEqual(env.disk, new Map(Object.entries(seed)))
    assert.equal(env.space.storageKey('@user_name'), '@user_name')
    assert.equal(await env.adapter.getData('@user_name'), 'Alice')
    assert.ok(env.messages.some(args => args.some(arg => String(arg).includes('SQLITE_FULL'))))
    env.storage.setItem = set
    await env.load().initializeDataSpaces()
    assert.equal(env.disk.get(env.space.MIGRATION_KEY), 'v1:local')
    assert.equal(env.disk.get('@user_name@local'), '"existing"')
  })
}

test('storage read and malformed authentication errors never reject initialization', async() => {
  for (const failRead of [false, true]) {
    const env = make({ '@lux_auth': '{invalid' })
    if (failRead) env.storage.getItem = async() => { throw Error('storage unavailable') }
    await assert.doesNotReject(env.space.initializeDataSpaces())
    assert.equal(env.space.isDataSpaceReady(), false)
    assert.ok(env.messages.some(([level]) => level === 'error'))
  }
})

test('hard process interruption at storage write boundaries resumes the completed backup target', async() => {
  for (let boundary = 1; boundary <= 20; boundary++) {
    const env = make({ ...legacy, '@user_name@lux:s:a': '"existing profile"' })
    let snapshot
    let writes = 0
    const set = env.storage.setItem
    env.storage.setItem = async(key, value) => {
      await set(key, value)
      if (++writes === boundary) {
        // Capture the native store as if the process died, before catch cleanup.
        snapshot = Object.fromEntries(env.disk)
        throw Error('process terminated')
      }
    }
    try { await env.space.migrateDataSpaces('lux:s:a') } catch {}
    if (!snapshot) continue
    const restarted = make(snapshot)
    const hadBackup = env.space.BACKUP_KEY in snapshot
    await restarted.space.migrateDataSpaces('local')
    const target = hadBackup ? 'lux:s:a' : 'local'
    assert.equal(restarted.disk.get(env.space.MIGRATION_KEY), `v1:${target}`)
    assert.equal(restarted.disk.get('@user_name@lux:s:a'), '"existing profile"')
    for (const [key, value] of Object.entries(legacy)) {
      assert.equal(restarted.disk.get(key), value)
      assert.equal(restarted.disk.get(`${key}@${target}`), key === '@user_name' && hadBackup ? '"existing profile"' : value)
    }
  }
})

test('quota failure on a resumed backup preserves earlier artifacts and rolls back the new ones', async() => {
  const env = make(legacy)
  let snapshot
  const set = env.storage.setItem
  env.storage.setItem = async(key, value) => {
    await set(key, value)
    if (key === '@user_name@local') {
      snapshot = Object.fromEntries(env.disk)
      throw Error('terminated')
    }
  }
  await env.space.initializeDataSpaces()
  assert.ok(snapshot)
  const restarted = make(snapshot)
  const retrySet = restarted.storage.setItem
  restarted.storage.setItem = async(key, value) => {
    await retrySet(key, value)
    if (key === restarted.space.MIGRATION_KEY) throw Error('SQLITE_FULL')
  }
  await restarted.space.initializeDataSpaces()
  assert.deepEqual(restarted.disk, new Map(Object.entries(snapshot)))
  assert.equal(restarted.space.storageKey('@user_name'), '@user_name')
  restarted.storage.setItem = retrySet
  await restarted.load().initializeDataSpaces()
  assert.equal(restarted.disk.get(restarted.space.MIGRATION_KEY), 'v1:local')
})

test('completed routing survives malformed credentials or quota failure persisting the space registry', async() => {
  const brokenAuth = make({ dataSpaceMigration: 'v1:lux:s:a', '@lux_auth': '{invalid', '@user_name@lux:s:a': '"Alice"' })
  await brokenAuth.space.initializeDataSpaces()
  assert.equal(await brokenAuth.adapter.getData('@user_name'), 'Alice')
  const env = make({
    ...legacy,
    '@sync_login_completed': 'true',
    '@sync_mode': '"lux"',
    '@lux_auth': JSON.stringify({ serverId: 's', user: { id: 'a' } }),
  })
  const set = env.storage.setItem
  env.storage.setItem = async(key, value) => {
    if (key === 'dataSpaceSpaces') throw Error('SQLITE_FULL')
    await set(key, value)
  }
  await assert.doesNotReject(env.space.initializeDataSpaces())
  assert.equal(env.space.getActiveSpace(), 'lux:s:a')
  assert.equal(await env.adapter.getData('@user_name'), 'Alice')
})

test('refresh rotation persists both auth records, serializes servers, preserves active space, and expires only its server', async() => {
  const a = { serverId: 'a', serverUrl: 'https://a', token: 'a0', refreshToken: 'ra0', user: { id: 'alice', username: 'alice' } }
  const b = { serverId: 'b', serverUrl: 'https://b', token: 'b0', refreshToken: 'rb0', user: { id: 'bob', username: 'bob' } }
  const env = make({ '@lux_auth': JSON.stringify(a), '@lux_auth_servers': JSON.stringify({ a, b }) })
  await env.space.initializeDataSpaces()
  const data = loadData(env)
  const activeSpace = env.space.getActiveSpace()
  const [nextA, nextB] = await Promise.all([
    data.rotateLuxAuth(a, { token: 'a1', refreshToken: 'ra1' }),
    data.rotateLuxAuth(b, { token: 'b1', refreshToken: 'rb1' }),
  ])
  assert.equal(JSON.parse(env.disk.get('@lux_auth')).refreshToken, 'ra1')
  assert.equal(JSON.parse(env.disk.get('@lux_auth_servers')).a.refreshToken, 'ra1')
  assert.equal(JSON.parse(env.disk.get('@lux_auth_servers')).b.refreshToken, 'rb1')
  assert.equal(env.space.getActiveSpace(), activeSpace)
  assert.equal(await data.clearLuxAuthForServer(b), false, 'stale refresh failure must not delete rotated tokens')
  assert.equal(await data.clearLuxAuthForServer(nextB), true)
  assert.equal((await data.getLuxAuth()).token, 'a1')
  assert.equal(JSON.parse(env.disk.get('@lux_auth_servers')).b, undefined)
  assert.equal(await data.clearLuxAuthForServer(nextA), true)
  assert.equal(await data.getLuxAuth(), null)
  assert.equal(env.space.getActiveSpace(), activeSpace, 'expiry does not delete account data')
})

test('login activates its data space; stale rotation cannot overwrite a switched account', async() => {
  const env = make()
  await env.space.initializeDataSpaces()
  const data = loadData(env)
  const alice = { serverId: 's', serverUrl: 'https://s', token: 'alice', refreshToken: 'ra', user: { id: 'alice', username: 'alice' } }
  const bob = { ...alice, token: 'bob', refreshToken: 'rb', user: { id: 'bob', username: 'bob' } }
  await data.setLuxAuth(alice)
  assert.equal(env.space.getActiveSpace(), 'lux:s:alice')
  await data.setLuxAuth(bob)
  assert.equal(env.space.getActiveSpace(), 'lux:s:bob')
  assert.equal(await data.rotateLuxAuth(alice, { token: 'stale', refreshToken: 'stale' }), null)
  assert.equal(await data.clearLuxAuthForServer(alice), false)
  assert.equal((await data.getLuxAuth('s')).refreshToken, 'rb')
})


test('session expiry and Later preserve playlists, playback history, other server auth and active space', async() => {
  const a = { serverId: 'a', serverUrl: 'https://a', token: 'old', user: { id: 'alice', username: 'alice' } }
  const b = { serverId: 'b', token: 'other', user: { id: 'bob', username: 'bob' } }
  const env = make({ ...legacy, '@lux_auth': JSON.stringify(a), '@lux_auth_servers': JSON.stringify({ a, b }) })
  await env.space.initializeDataSpaces()
  const data = loadData(env)
  const before = new Map(env.disk)
  const active = env.space.getActiveSpace()
  assert.equal(await data.clearLuxAuthForServer(a), true)
  let later
  let connected = true
  const { createSessionExpiredDialog } = evaluate('src/utils/sessionExpiredDialog.ts', {})
  const report = createSessionExpiredDialog({
    isActive: () => true,
    disconnect: async() => { connected = false },
    show: async(_account, dismiss) => { later = dismiss },
    hide: async() => {},
    login: async() => { assert.fail('Later must not navigate') },
  })
  await report({ host: a.serverUrl, serverId: a.serverId, userId: a.user.id, username: a.user.username, token: a.token })
  await later()
  assert.equal(connected, false)
  assert.equal(env.space.getActiveSpace(), active)
  for (const [key, value] of before) {
    if (key === '@lux_auth' || key === '@lux_auth_servers') continue
    assert.equal(env.disk.get(key), value, key)
  }
  assert.deepEqual(JSON.parse(env.disk.get('@lux_auth_servers')), { b })
})

test('password replacement persists one new session for its server without password data', async() => {
  const alice = { serverId: 'a', serverUrl: 'https://a', token: 'old', refreshToken: 'old-refresh', user: { id: 'alice', username: 'alice' } }
  const bob = { serverId: 'b', serverUrl: 'https://b', token: 'bob', user: { id: 'bob' } }
  const env = make({ '@lux_auth': JSON.stringify(alice), '@lux_auth_servers': JSON.stringify({ a: alice, b: bob }) })
  await env.space.initializeDataSpaces()
  const data = loadData(env)
  const errorModule = evaluate('src/plugins/sync/client/userErrors.ts', {})
  const { createPasswordService } = evaluate('src/utils/changePassword.ts', { '@/plugins/sync/client/userErrors': errorModule })
  const batches = []
  const multiSet = env.storage.multiSet
  env.storage.multiSet = async pairs => { batches.push(pairs); await multiSet(pairs) }
  const service = createPasswordService({
    find: data.findLuxAuthForHost,
    rotate: data.rotateLuxAuth,
    request: async() => ({ ok: true, accessToken: 'new', token: 'legacy', refreshToken: 'new-refresh', sessionId: 'new-session', accessTokenExpiresAt: 'tomorrow', user: { ...alice.user, displayName: 'Alice' }, password: 'response-secret' }),
  })
  await service.change('https://a', alice, { oldPassword: 'old-secret', password: 'new-secret', confirm: 'new-secret' }, true)
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0].map(([key]) => key).sort(), ['@lux_auth', '@lux_auth_servers'])
  const active = JSON.parse(env.disk.get('@lux_auth'))
  const servers = JSON.parse(env.disk.get('@lux_auth_servers'))
  assert.deepEqual(active, servers.a)
  assert.equal(active.token, 'new'); assert.equal(active.refreshToken, 'new-refresh')
  assert.equal(active.sessionId, 'new-session'); assert.equal(active.user.displayName, 'Alice')
  assert.equal(active.serverUrl, 'https://a'); assert.deepEqual(servers.b, bob)
  for (const secret of ['old-secret', 'new-secret', 'response-secret']) assert.equal(JSON.stringify([...env.disk]).includes(secret), false)
})
