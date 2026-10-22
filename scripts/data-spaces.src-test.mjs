/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { fakeSecure, migration } from './secure-credentials-test-support.mjs'

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
    unlink: async path => {
      for (const file of files.keys()) if (file === path || file.startsWith(`${path}/`)) files.delete(file)
    },
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
  return { secure: fakeSecure(), disk, space, adapter, storage, load, fs, avatar, files, messages, failCopy: value => { failCopy = value }, fail: n => { writes = 0; failAt = n } }
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
  '@memories_milestones_v1': '{"version":1,"achieved":{},"ignored":["streak:30"]}',
  '@recommendations_v1': '{"version":1,"days":{}}',
  '@smart_playlist_rules_v1': '{"version":1,"playlists":[{"playlistId":"mine","name":"Recent","autoRefresh":true,"ruleSet":{"match":"all","rules":[{"field":"playCount","operator":"gte","value":5}],"sort":{"field":"playCount","direction":"desc"},"limit":50}}]}',
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
    './secureCredentials': env.secure,
    './secureCredentialMigration': migration,
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
    './secureCredentials': env.secure,
    './secureCredentialMigration': migration,
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
    '@/utils/dataSpace': env.space,
    '@/utils/dataSpace/operations': { deleteSpaceData: async() => {} },
  })
  await logout.applySyncAccountLogout()
  assert.equal(env.space.getActiveSpace(), 'local')
  assert.equal(await data.getUserName(), 'local')
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
  './secureCredentials': env.secure,
  './secureCredentialMigration': migration,
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
  assert.equal(JSON.parse(env.disk.get('@lux_auth')).refreshToken, undefined)
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['a', 'alice'])), 'ra1')
  assert.equal(JSON.parse(env.disk.get('@lux_auth_servers')).a.refreshToken, undefined)
  assert.equal(JSON.parse(env.disk.get('@lux_auth_servers')).b.refreshToken, undefined)
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['b', 'bob'])), 'rb1')
  assert.equal(env.space.getActiveSpace(), activeSpace)
  assert.equal(await data.clearLuxAuthForServer(b), false, 'stale refresh failure must not delete rotated tokens')
  assert.equal(await data.clearLuxAuthForServer(nextB), true)
  assert.equal((await data.getLuxAuth()).token, 'a1')
  assert.equal(JSON.parse(env.disk.get('@lux_auth_servers')).b, undefined)
  assert.equal(await data.clearLuxAuthForServer(nextA), true)
  assert.equal(await data.getLuxAuth(), null)
  assert.equal(env.space.getActiveSpace(), activeSpace, 'expiry does not delete account data')
})

test('login activates its data space; inactive refresh cannot overwrite a switched account', async() => {
  const env = make()
  await env.space.initializeDataSpaces()
  const data = loadData(env)
  const alice = { serverId: 's', serverUrl: 'https://s', token: 'alice', refreshToken: 'ra', user: { id: 'alice', username: 'alice' } }
  const bob = { ...alice, token: 'bob', refreshToken: 'rb', user: { id: 'bob', username: 'bob' } }
  await data.setLuxAuth(alice)
  assert.equal(env.space.getActiveSpace(), 'lux:s:alice')
  await data.setLuxAuth(bob)
  assert.equal(env.space.getActiveSpace(), 'lux:s:bob')
  assert.equal((await data.rotateLuxAuth(alice, { token: 'renewed-alice', refreshToken: 'renewed-ra' })).user.id, 'alice')
  assert.equal((await data.getLuxAuth()).user.id, 'bob', 'inactive refresh cannot replace the selected account')
  assert.equal(await data.clearLuxAuthForServer(alice), false)
  assert.equal((await data.getLuxAuth('s')).refreshToken, undefined)
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['s', 'bob'])), 'rb')
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
  await data.migrateStoredLuxCredentials()
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
  assert.equal(active.token, 'new'); assert.equal(active.refreshToken, undefined)
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['a', 'alice'])), 'new-refresh')
  assert.equal(active.sessionId, 'new-session'); assert.equal(active.user.displayName, 'Alice')
  assert.equal(active.serverUrl, 'https://a'); assert.deepEqual(servers.b, bob)
  for (const secret of ['old-secret', 'new-secret', 'response-secret']) assert.equal(JSON.stringify([...env.disk]).includes(secret), false)
})

test('secure refresh reads reject stale accounts; server switches preserve each refresh token; logout clears only its server', async() => {
  const env = make()
  const data = loadData(env)
  const a = { serverId: 'a', token: 'a', refreshToken: 'ra', user: { id: 'alice', username: 'alice' } }
  const b = { serverId: 'b', token: 'b', refreshToken: 'rb', user: { id: 'bob', username: 'bob' } }
  await data.setLuxAuth(a)
  await data.setLuxAuth(b)
  const savedA = await data.getLuxAuth('a')
  await data.setLuxAuth(savedA)
  assert.equal(await data.getLuxRefreshToken(savedA), 'ra')
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['b', 'bob'])), 'rb')
  const replacement = { ...a, token: 'new-account', refreshToken: 'new-refresh', user: b.user }
  await data.setLuxAuth(replacement)
  assert.equal(await data.getLuxRefreshToken(savedA), 'ra', 'another account on the same server keeps its own session')
  assert.equal(await data.getLuxRefreshToken(await data.getLuxAuth('a')), 'new-refresh')
  const logout = evaluate('src/utils/syncLogout.ts', {
    '@/core/common': { updateSetting() {} },
    '@/core/player/player': {},
    '@/plugins/sync': { disconnectServer: async() => {} },
    '@/store/player/state': { isPlay: false },
    '@/utils/data': data,
    '@/utils/dataSpace': env.space,
    '@/utils/dataSpace/operations': { deleteSpaceData: async() => {} },
  })
  await logout.applySyncAccountLogout()
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['a', 'bob'])), null)
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['a', 'alice'])), 'ra')
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['b', 'bob'])), 'rb')
  await data.clearLuxAuth()
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['b', 'bob'])), null)
})

test('legacy session binding transfers its verified refresh token into the server namespace', async() => {
  const legacy = { serverUrl: 'https://nas', token: 'a', refreshToken: 'ra', user: { id: 'alice', username: 'alice' } }
  const env = make({ '@lux_auth': JSON.stringify(legacy) })
  const data = loadData(env)
  const auth = await data.getLuxAuth('nas')
  assert.equal(auth.refreshToken, undefined)
  await data.setLuxAuth({ ...auth, serverId: 'nas' })
  assert.equal(await data.getLuxRefreshToken(await data.getLuxAuth('nas')), 'ra')
  assert.equal(await env.secure.getRefreshToken('https://nas'), null)
})

test('failed rotation discards the secure token and never persists its plaintext replacement', async() => {
  const env = make()
  const data = loadData(env)
  const auth = { serverId: 'a', token: 'old', refreshToken: 'old-refresh', user: { id: 'alice', username: 'alice' } }
  await data.setLuxAuth(auth)
  env.secure.fail(true)
  assert.equal(await data.rotateLuxAuth(await data.getLuxAuth('a'), { token: 'new', refreshToken: 'replacement' }), null)
  assert.equal(JSON.stringify([...env.disk]).includes('replacement'), false)
  env.secure.fail(false)
  assert.equal(await data.getLuxRefreshToken(await data.getLuxAuth('a')), null)
})

test('401 refresh reads the actual secure backend and persists rotation without a plaintext session token', async() => {
  const env = make()
  const data = loadData(env)
  await data.setLuxAuth({ serverId: 'nas', serverUrl: 'https://nas', token: 'old', refreshToken: 'keychain-refresh', user: { id: 'alice', username: 'alice' } })
  const saved = await data.getLuxAuth('nas')
  assert.equal(saved.refreshToken, undefined)
  const errors = evaluate('src/plugins/sync/client/userErrors.ts', {})
  const { createLuxAuthClient } = evaluate('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': errors })
  let refreshes = 0
  const client = createLuxAuthClient({
    send: async(url, options) => {
      if (url.endsWith('/refresh')) {
        refreshes++
        assert.deepEqual(JSON.parse(options.body), { refreshToken: 'keychain-refresh' })
        return { code: 200, text: JSON.stringify({ accessToken: 'new', refreshToken: 'rotated-refresh' }) }
      }
      return { code: options.headers.Authorization === 'Bearer new' ? 200 : 401, text: '{}' }
    },
    find: data.findLuxAuthForHost,
    getRefreshToken: data.getLuxRefreshToken,
    rotate: data.rotateLuxAuth,
    clear: data.clearLuxAuthForServer,
    expired() { assert.fail('valid secure refresh must not expire') },
  })
  await client.request('https://nas/api/me', undefined, saved.token)
  assert.equal(refreshes, 1)
  assert.equal(await env.secure.getRefreshToken(JSON.stringify(['nas', 'alice'])), 'rotated-refresh')
  assert.equal((await data.getLuxAuth('nas')).token, 'new')
  assert.equal(JSON.stringify([...env.disk]).includes('rotated-refresh'), false)
})

// 5.7: exercise the production storage adapter, import gate, auth and connection order.
const operationsFor = env => evaluate('src/utils/dataSpace/operations.ts', {
  'react-native': { NativeModules: { DownloadModule: { removeSpace: async space => { (env.deletedDownloadSpaces ??= []).push(space) } } } },
  '@react-native-async-storage/async-storage': env.storage,
  '@/config/constant': evaluate('src/config/constant.ts', {}),
  '@/plugins/storage': env.adapter,
  '@/utils/fs': env.fs,
  './avatar': env.avatar,
  './index': env.space,
})
const seedLocalImport = async env => {
  await env.space.initializeDataSpaces()
  await env.adapter.saveData(keys.userList, [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }])
  await env.adapter.saveData(keys.list + 'one', [{ id: 'song1' }])
  await env.adapter.saveData(keys.list + 'two', [{ id: 'song2' }, { id: 'song3' }])
  await env.adapter.saveData(keys.playHistory, [{ id: 'record1' }])
  await env.adapter.saveData(keys.userName, 'Local Name')
  await env.adapter.saveData(keys.userAvatar, '/private/user/local/avatar.png')
  env.files.set('/private/user/local/avatar.png', 'local-avatar-bytes')
}
const dialogsFor = (env, show) => evaluate('src/utils/accountDataDialogs.ts', {
  'react-native-navigation': { Navigation: { showOverlay: show, dismissOverlay: async() => {} } },
  '@/utils/dataSpace/operations': operationsFor(env),
  '@/utils/dataSpace': env.space,
})

test('5.7 regression: logging into an empty server account does NOT auto-upload local playlists, history or profile', async context => {
  const previousEvents = { app: global.app_event, list: global.list_event }
  global.app_event = Object.fromEntries(['userNameUpdated', 'userAvatarUpdated', 'userGenderUpdated', 'userSignatureUpdated'].map(name => [name, () => {}]))
  global.list_event = new EventEmitter()
  let cleanup = () => {}
  context.after(() => { cleanup(); global.app_event = previousEvents.app; global.list_event = previousEvents.list })
  const env = make()
  await seedLocalImport(env)
  const data = loadData(env)
  const requests = []
  let overlay
  let connected = 0
  const dialogs = dialogsFor(env, async args => { overlay = args.component.passProps })
  const request = async(url, body) => {
    requests.push([url, body])
    if (url.endsWith('/api/auth/login')) return { token: 'token', user: { id: 'alice', username: 'alice' } }
    if (url.endsWith('/api/sync/key')) return { clientId: 'client', key: 'key' }
    if (url.endsWith('/api/me/profile')) return { profile: { displayName: '', avatar: '', signature: '', gender: 'unknown' } }
    if (url.endsWith('/api/me/playlists')) return { playlists: { defaultList: { musicCount: 0 }, loveList: { musicCount: 0 }, userList: [] } }
    throw Error(`Unexpected request ${url}`)
  }
  const constants = evaluate('src/plugins/sync/constants.ts', {}).SYNC_CODE
  const auth = evaluate('src/plugins/sync/client/auth.ts', {
    '@/utils/serverCheck': evaluate('src/utils/serverCheck.ts', {}),
    './utils': { request: async url => ({ text: url.endsWith('/hello') ? constants.helloMsg : constants.idPrefix + 'server' }) },
    './userErrors': evaluate('src/plugins/sync/client/userErrors.ts', {}),
    '@/utils/luxAuthApi': { createLuxAuthClient: () => ({ request }) },
    '../data': { getSyncAuthKey: async() => null, setSyncAuthKey: async() => {} },
    '@/utils/data': data,
    '../log': { error() {} },
    '../utils': {},
    '@/utils/nativeModules/utils': { getDeviceName: async() => 'phone' },
    '@/utils/tools': {},
    '../constants': { SYNC_CODE: constants },
    '../deviceId': { getSyncDeviceId: async() => 'device' },
    './credentials': evaluate('src/plugins/sync/client/credentials.ts', {}),
    '@/utils/accountDataDialogs': dialogs,
  })
  const socketPushes = []
  const listManage = { userLists: [] }
  const listEvent = evaluate('src/plugins/sync/listEvent.ts', {
    '@/utils/dataSpace': env.space,
    '@/config/constant': evaluate('src/config/constant.ts', {}),
    '@/core/list': { getListMusics: async id => await env.adapter.getData(keys.list + id) ?? [] },
    '@/utils/listManage': listManage,
  })
  const localEvent = evaluate('src/plugins/sync/client/modules/list/localEvent.ts', {
    '@/plugins/sync/constants': { SYNC_CLOSE_CODE: {} },
    '../../../listEvent': listEvent,
    '@/core/sync': { setSyncStatus() {} },
    '@/utils/tools': { toast() {} },
  })
  cleanup = () => { localEvent.unregisterEvent() }
  const listHandler = evaluate('src/plugins/sync/client/modules/list/handler.ts', {
    '../../../listEvent': listEvent,
    '../../../log': { info() {} },
    '@/core/sync': {},
    '@/utils/tools': {},
    './localEvent': localEvent,
  }).default
  const socket = {
    moduleReadys: { list: false },
    onClose: () => () => {},
    remoteQueueList: { onListSyncAction: async action => { socketPushes.push(action) } },
  }
  let socketReady
  const connect = () => {
    connected++
    socketReady = (async() => {
      listManage.userLists = await env.adapter.getData(keys.userList) ?? []
      // Empty-server handshake asks the real list handler for its current-space snapshot.
      const snapshot = await listHandler.list_sync_get_list_data(socket)
      if (snapshot.defaultList.length || snapshot.loveList.length || snapshot.userList.length) socketPushes.push(snapshot)
      await listHandler.list_sync_finished(socket)
    })()
  }
  const profile = evaluate('src/plugins/sync/client/profile.ts', {
    '@/utils/dataSpace': env.space,
    '@/utils/data': data,
    './utils': { parseUrl: () => ({ href: 'https://server', httpProtocol: 'https:', hostPath: 'server' }) },
    './auth': auth,
  })
  const client = evaluate('src/plugins/sync/client/index.ts', {
    './auth': auth,
    './client': { connect, disconnect: async() => {}, sendSyncStatus() {}, sendSyncMessage() {} },
    '../log': { info() {}, r_warn() {} },
    './utils': { parseUrl: () => ({ href: 'https://server', httpProtocol: 'https:', hostPath: 'server' }) },
    '../constants': { SYNC_CODE: constants },
  })
  const login = client.connectLuxServer('https://server', 'alice', 'password')
  for (let i = 0; i < 20; i++) {
    if (overlay) break
    await new Promise(resolve => setImmediate(resolve))
  }
  assert.ok(overlay)
  assert.equal(connected, 0, 'socket must not start list/history sync before a decision')
  assert.equal(overlay.contents.lists.length, 2)
  assert.equal(overlay.contents.songs, 3)
  assert.equal(overlay.contents.history, 1)
  const before = new Map([...env.disk].filter(([key]) => key.endsWith('@local')))
  await overlay.finish(null)
  await login
  await socketReady
  assert.equal(socket.moduleReadys.list, true)
  assert.equal(connected, 1)
  assert.equal(await env.adapter.getData(keys.userList), null)
  assert.equal(await env.adapter.getData(keys.playHistory), null)
  assert.equal(await env.adapter.getData(keys.userName), null)
  for (const [key, value] of before) assert.equal(env.disk.get(key), value)
  // SyncLogin calls this after connectLuxServer; execute the real profile path too.
  await profile.syncLuxProfileOnLogin('https://server')
  assert.deepEqual(requests.filter(([url, body]) => !/\/(login|key)$/.test(url) && body != null), [], 'no data-upload HTTP requests')
  assert.deepEqual(socketPushes, [], 'no socket list snapshot or action push')
  assert.equal(requests.filter(([url]) => url.endsWith('/api/me/profile')).length, 1)
  let recheck = 0
  assert.equal(await dialogs.offerLocalImport(await data.getLuxAuth(), async() => { recheck++; throw Error('must not prompt twice') }), false)
  assert.equal(recheck, 0)
  const restarted = env.load()
  await restarted.initializeDataSpaces()
  assert.ok(await env.storage.getItem(operationsFor(env).decisionKey('lux:server:alice')))
})

test('5.7 all and selected import copy exact choices, avatar bytes and history without modifying local data; repeat is idempotent', async() => {
  for (const all of [false, true]) {
    const env = make()
    await seedLocalImport(env)
    const before = new Map([...env.disk].filter(([key]) => key.endsWith('@local')))
    await env.space.setActiveSpace('lux:s:alice')
    const operations = operationsFor(env)
    const choice = { ids: all ? ['one', 'two'] : ['two'], history: all, all }
    await operations.copyLocalData('lux:s:alice', choice)
    await operations.copyLocalData('lux:s:alice', choice)
    assert.deepEqual((await env.adapter.getData(keys.userList)).map(item => item.id), choice.ids)
    assert.equal((await env.adapter.getData(keys.list + 'two')).length, 2)
    assert.equal((await env.adapter.getData(keys.playHistory))?.length ?? 0, all ? 1 : 0)
    assert.equal(await env.adapter.getData(keys.userName), all ? 'Local Name' : null)
    if (all) {
      assert.equal(await env.adapter.getData(keys.userAvatar), '/private/user/lux%3As%3Aalice/avatar.png')
      assert.equal(env.files.get('/private/user/lux%3As%3Aalice/avatar.png'), 'local-avatar-bytes')
    }
    for (const [key, value] of before) assert.equal(env.disk.get(key), value)
    assert.equal(env.files.get('/private/user/local/avatar.png'), 'local-avatar-bytes')
    await operations.persistImportDecision('lux:s:alice')
    assert.equal(await operations.prepareLocalImport('lux:s:alice', async() => { assert.fail('decision persisted') }), null)
  }
})

test('5.7 nonempty server and no local data do not prompt; malformed/failed server reads cannot imply empty', async() => {
  const env = make()
  await seedLocalImport(env)
  await env.space.setActiveSpace('lux:s:a')
  const ops = operationsFor(env)
  assert.equal(await ops.prepareLocalImport('lux:s:a', async() => false), null)
  await assert.rejects(ops.prepareLocalImport('lux:s:a', async() => { throw Error('offline') }), /offline/)
  const dialogs = dialogsFor(env, async() => { assert.fail('must not show') })
  assert.equal(dialogs.remoteAccountEmpty({ defaultList: { musicCount: 1 }, loveList: { musicCount: 0 }, userList: [] }), false)
  assert.equal(dialogs.remoteAccountEmpty({ defaultList: { musicCount: 0 }, loveList: { musicCount: 0 }, userList: [{ musicCount: 0 }] }), false)
  assert.throws(() => dialogs.remoteAccountEmpty({}))
  const empty = make()
  await empty.space.initializeDataSpaces()
  await empty.space.setActiveSpace('lux:s:a')
  assert.equal(await operationsFor(empty).prepareLocalImport('lux:s:a', async() => { assert.fail('no local data') }), null)
})

test('5.7 logout keep/delete touches only the captured account, including shards/avatar/Keychain; local and another account survive', async() => {
  for (const remove of [false, true]) {
    const env = make()
    await seedLocalImport(env)
    const data = loadData(env)
    const a = { serverId: 's', serverUrl: 'https://server', token: 'a', refreshToken: 'ra', user: { id: 'alice', username: 'alice' } }
    const b = { ...a, token: 'b', refreshToken: 'rb', user: { id: 'bob', username: 'bob' } }
    await data.setLuxAuth(b)
    await env.adapter.saveData(keys.userName, 'Bob')
    await data.setLuxAuth(a)
    await env.adapter.saveData(keys.userName, 'Alice')
    await env.adapter.saveData(keys.list + 'big', Array(120000).fill('large-song'))
    const directory = env.avatar.avatarDirectory('lux:s:alice')
    env.files.set(directory, '')
    const before = new Map([...env.disk].filter(([key]) => key.endsWith('@local') || key.endsWith('@lux:s:bob')))
    const logout = evaluate('src/utils/syncLogout.ts', {
      '@/core/common': { updateSetting() {} },
      '@/core/player/player': {},
      '@/plugins/sync': { disconnectServer: async() => {} },
      '@/store/player/state': { isPlay: false },
      '@/utils/data': data,
      '@/utils/dataSpace': env.space,
      '@/utils/dataSpace/operations': operationsFor(env),
    })
    await logout.applySyncAccountLogout(remove)
    assert.equal(env.space.getActiveSpace(), 'local')
    assert.equal(await env.secure.getRefreshToken(env.secure.refreshTokenServerKey(a)), null)
    assert.equal(await env.secure.getRefreshToken(env.secure.refreshTokenServerKey(b)), 'rb')
    assert.equal((await data.listLuxAuthSessions()).length, 1)
    for (const [key, value] of before) assert.equal(env.disk.get(key), value)
    const remaining = [...env.disk.keys()].filter(key => operationsFor(env).ownsSpaceKey(key, 'lux:s:alice'))
    assert.equal(remaining.length > 0, !remove)
    assert.equal(env.files.has(directory), !remove)
    assert.equal((await env.space.listSpaces()).some(space => space.id === 'lux:s:alice'), !remove)
  }
})

// Expected ownership comes from fixture writes, independently of ownsSpaceKey.
const deletionFixture = async(ids = ['lux:s:alice', 'lux:s:alice2', 'lux:s:alice20', 'lux:s:2', 'lux:s:20']) => {
  const env = make(legacy)
  await env.space.initializeDataSpaces()
  const owned = new Map()
  for (const id of ['local', ...ids]) {
    await env.space.setActiveSpace(id)
    const before = new Set(env.disk.keys())
    for (const key of env.space.perSpaceKeys) await env.adapter.saveData(key, `value for ${id} / ${key}`)
    await env.adapter.saveData(keys.userList, [{ id: 'big', name: id }])
    await env.adapter.saveData(keys.list + 'big', [{ id, bytes: 'x'.repeat(1100000) }])
    const root = env.space.namespacedKey(keys.list + 'big', id)
    assert.ok(env.disk.get(root).startsWith('@___PART_A___'), 'fixture must use real sharded storage')
    owned.set(id, new Set([...env.disk.keys()].filter(key => !before.has(key))))
    const directory = env.avatar.avatarDirectory(id)
    env.files.set(directory, '')
    env.files.set(`${directory}/avatar.png`, `avatar bytes for ${id}`)
    env.files.set(`${directory}/avatar.png.migration-tmp`, `unfinished bytes for ${id}`)
    await operationsFor(env).persistImportDecision(id)
  }
  // Unpublished shards, legacy shards, backup chunks and shared files are not owned roots.
  env.disk.set('@___PART_A___@list__big@lux:s:alice299', 'unpublished shard bytes')
  env.disk.set('@___PART_A___@list__legacy0', 'legacy shard bytes')
  env.disk.set('dataSpaceBackup@v1:chunk:99', 'retained backup bytes')
  env.disk.set('@lux_auth', '{"token":"untouched auth"}')
  env.disk.set('@lux_auth_servers', '{"other":"untouched server index"}')
  env.files.set('/private/user/avatar.png', 'legacy avatar bytes')
  env.files.set('/private/cache/shared', 'shared cache bytes')
  await env.space.setActiveSpace('local')
  return { ...env, owned }
}
const unchangedExcept = (before, after, exceptions = new Set()) => {
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    if (!exceptions.has(key)) {
      assert.equal(after.has(key), before.has(key), key)
      assert.equal(after.get(key), before.get(key), key)
    }
  }
}

test('recommendation cache migrates with milestones/history and logout keep/delete preserves other spaces', async() => {
  for (const loggedIn of [false, true]) {
    const cache = { version: 1, date: '2026-10-18', daily: [], dailyFailures: [], exposures: [] }
    const raw = JSON.stringify(cache)
    const env = make({
      [keys.recommendations]: raw,
      [keys.syncLoginCompleted]: JSON.stringify(loggedIn),
      [keys.syncMode]: '"lux"',
      [keys.luxAuth]: JSON.stringify({ serverId: 's', user: { id: 'alice' } }),
    })
    await env.space.initializeDataSpaces()
    const target = loggedIn ? 'lux:s:alice' : 'local'
    assert.ok(env.space.perSpaceKeys.includes(keys.recommendations))
    assert.equal(env.disk.get(`${keys.recommendations}@${target}`), raw)
    assert.equal(env.disk.get(keys.recommendations), raw)
    assert.deepEqual(await env.adapter.getData(keys.recommendations), cache)
    await env.load().initializeDataSpaces()
    assert.deepEqual(await env.adapter.getData(keys.recommendations), cache)
  }
  for (const remove of [false, true]) {
    const env = make()
    await env.space.initializeDataSpaces()
    const data = loadData(env)
    for (const id of ['local', 'lux:s:bob', 'lux:s:alice']) {
      await env.space.setActiveSpace(id)
      // Include a real sharded cache, since playback metadata can grow beyond a root value.
      await env.adapter.saveData(keys.recommendations, { id, payload: 'x'.repeat(1100000) })
    }
    await data.setLuxAuth({ serverId: 's', token: 'a', user: { id: 'alice', username: 'Alice' } })
    const before = new Map(env.disk)
    const root = `${keys.recommendations}@lux:s:alice`
    const shards = JSON.parse(before.get(root).slice('@___PART_A___'.length))
    const logout = evaluate('src/utils/syncLogout.ts', {
      '@/core/common': { updateSetting() {} },
      '@/core/player/player': {},
      '@/plugins/sync': { disconnectServer: async() => {} },
      '@/store/player/state': { isPlay: false },
      '@/utils/data': data,
      '@/utils/dataSpace': env.space,
      '@/utils/dataSpace/operations': operationsFor(env),
    })
    await logout.applySyncAccountLogout(remove)
    assert.equal(env.space.getActiveSpace(), 'local')
    for (const key of [root, ...shards]) assert.equal(env.disk.has(key), !remove, key)
    for (const id of ['local', 'lux:s:bob']) {
      await env.space.setActiveSpace(id)
      assert.deepEqual(await env.adapter.getData(keys.recommendations), { id, payload: 'x'.repeat(1100000) })
    }
  }
})

test('5.7 real deleteSpaceData removes only published roots/shards and avatar directory for similar and numeric account IDs', async() => {
  for (const target of ['lux:s:alice', 'lux:s:alice2', 'lux:s:2']) {
    const env = await deletionFixture()
    const before = new Map(env.disk)
    const files = new Map(env.files)
    const removed = env.owned.get(target)
    const spaces = JSON.parse(before.get('dataSpaceSpaces'))
    await operationsFor(env).deleteSpaceData(target)
    for (const key of removed) assert.equal(env.disk.has(key), false, key)
    unchangedExcept(before, env.disk, new Set([...removed, 'dataSpaceSpaces']))
    assert.equal(env.disk.get('dataSpaceSpaces'), JSON.stringify(spaces.filter(space => space.id !== target)))
    const directory = env.avatar.avatarDirectory(target)
    assert.deepEqual(env.files, new Map([...files].filter(([path]) => path !== directory && !path.startsWith(`${directory}/`))))
  }
})

test('5.7 real deleteSpaceData refuses active and local spaces without changing any storage or file bytes', async() => {
  const env = await deletionFixture()
  await env.space.setActiveSpace('lux:s:alice')
  for (const target of ['local', 'lux:s:alice']) {
    const disk = new Map(env.disk)
    const files = new Map(env.files)
    await assert.rejects(operationsFor(env).deleteSpaceData(target), /Cannot delete active or local space/)
    assert.deepEqual(env.disk, disk)
    assert.deepEqual(env.files, files)
  }
})

test('5.7 real logout switches to local before deletion and clears only the logged-out account auth/Keychain; keep preserves all data', async() => {
  for (const remove of [true, false]) {
    const env = await deletionFixture()
    // Replace sentinel credentials with real persisted sessions on two servers and one sibling account.
    env.disk.delete('@lux_auth')
    env.disk.delete('@lux_auth_servers')
    const data = loadData(env)
    const auths = [
      { serverId: 'other', token: 'other-token', refreshToken: 'other-refresh', user: { id: 'alice', username: 'alice' } },
      { serverId: 's', token: 'sibling-token', refreshToken: 'sibling-refresh', user: { id: 'alice2', username: 'alice2' } },
      { serverId: 's', token: 'target-token', refreshToken: 'target-refresh', user: { id: 'alice', username: 'alice' } },
    ]
    for (const auth of auths) await data.setLuxAuth(auth)
    await data.setSyncLoginCompleted(true)
    const before = new Map(env.disk)
    const files = new Map(env.files)
    const tokens = new Map(env.secure.tokens)
    const sessions = JSON.parse(before.get(keys.luxAuthServers))
    const removals = []
    const originalRemove = env.storage.multiRemove
    env.storage.multiRemove = async keys => {
      // Observe the physical I/O of the real operation; do not replace deleteSpaceData.
      assert.equal(env.space.getActiveSpace(), 'local', 'must switch before removing account roots/shards')
      assert.equal(env.disk.get('dataSpaceActive'), 'local')
      removals.push(...keys)
      await originalRemove(keys)
    }
    const logout = evaluate('src/utils/syncLogout.ts', {
      '@/core/common': { updateSetting() {} },
      '@/core/player/player': {},
      '@/plugins/sync': { disconnectServer: async() => {} },
      '@/store/player/state': { isPlay: false },
      '@/utils/data': data,
      '@/utils/dataSpace': env.space,
      '@/utils/dataSpace/operations': operationsFor(env),
    })
    await logout.applySyncAccountLogout(remove)
    const target = 'lux:s:alice'
    assert.equal(env.space.getActiveSpace(), 'local')
    assert.deepEqual(new Set(removals), remove ? env.owned.get(target) : new Set())
    const expectedTokens = new Map(tokens)
    expectedTokens.delete(`lux.refresh.${encodeURIComponent(JSON.stringify(['s', 'alice']))}`)
    assert.equal(await env.secure.getRefreshToken(env.secure.refreshTokenServerKey(auths[2])), null)
    for (const auth of auths.slice(0, 2)) assert.equal(await env.secure.getRefreshToken(env.secure.refreshTokenServerKey(auth)), auth.refreshToken)
    assert.equal(tokens.size - expectedTokens.size, 1)
    assert.deepEqual(env.secure.tokens, expectedTokens)
    delete sessions.s
    delete sessions[env.secure.refreshTokenServerKey(auths[2])]
    assert.equal(env.disk.get(keys.luxAuthServers), JSON.stringify(sessions))
    assert.equal(env.disk.get(keys.luxAuth), 'null')
    assert.equal(env.disk.get(keys.syncLoginCompleted), 'false')
    unchangedExcept(before, env.disk, new Set([
      ...(remove ? env.owned.get(target) : []),
      keys.luxAuth, keys.luxAuthServers, keys.syncLoginCompleted, 'dataSpaceActive', 'dataSpaceSpaces',
    ]))
    const directory = env.avatar.avatarDirectory(target)
    assert.deepEqual(env.files, remove ? new Map([...files].filter(([path]) => path !== directory && !path.startsWith(`${directory}/`))) : files)
    assert.equal((await env.space.listSpaces()).some(space => space.id === target), !remove)
  }
})

test('5.7 same-server accounts retain separate sessions and Keychain tokens, switching restores the matching session', async() => {
  const env = make()
  await env.space.initializeDataSpaces()
  const data = loadData(env)
  const a = { serverId: 's', serverUrl: 'https://server', token: 'a', refreshToken: 'ra', user: { id: 'alice', username: 'alice' } }
  const b = { ...a, token: 'b', refreshToken: 'rb', user: { id: 'bob', username: 'bob' } }
  await data.setLuxAuth(a)
  await data.setLuxAuth(b)
  assert.equal((await data.listLuxAuthSessions()).length, 2)
  const savedA = (await data.listLuxAuthSessions()).find(auth => auth.user.id === 'alice')
  await data.setLuxAuth(savedA)
  assert.equal(env.space.getActiveSpace(), 'lux:s:alice')
  assert.equal((await data.findLuxAuthForHost('https://server')).user.id, 'alice')
  assert.equal(await data.getLuxRefreshToken(savedA), 'ra')
  assert.equal(await env.secure.getRefreshToken(env.secure.refreshTokenServerKey(b)), 'rb')
})

test('5.7 space list metadata and switching route local/session/signed-out entries correctly', async context => {
  const previous = global.app_event
  global.app_event = { syncModeUpdated() {} }
  context.after(() => { global.app_event = previous })
  const env = make()
  await seedLocalImport(env)
  const data = loadData(env)
  const a = { serverId: 's', serverUrl: 'https://server', token: 'a', user: { id: 'alice', username: 'alice' } }
  await data.setLuxAuth(a)
  const calls = []
  const navigation = { pushSyncLoginScreen: async props => { calls.push(['login', props]) }, pushHomeScreen: async() => { calls.push(['home']) } }
  const service = evaluate('src/utils/accountSpaceSwitch.ts', {
    '@/core/common': { updateSetting: value => calls.push(['setting', value]) },
    '@/core/player/player': {},
    '@/store/player/state': { isPlay: false },
    '@/plugins/sync': { connectLuxServer: async(...args) => { calls.push(['connect', ...args]) }, disconnectServer: async() => { calls.push(['disconnect']) } },
    '@/navigation': { navigations: navigation },
    '@/utils/data': data,
    '@/config/constant': { storageDataPrefix: keys },
    '@/plugins/storage': env.adapter,
    '@/utils/dataSpace': env.space,
    '@/utils/dataSpace/operations': operationsFor(env),
  })
  const rows = await service.loadAccountSpaces()
  assert.equal(rows.length, 2)
  const local = rows.find(item => item.space.id === 'local')
  const account = rows.find(item => item.space.id !== 'local')
  const messages = JSON.parse(readFileSync(join(root, 'src/lang/zh-cn.json'), 'utf8'))
  const t = (key, args = {}) => messages[key].replace(/\{(\w+)\}/g, (_, name) => args[name])
  const ops = operationsFor(env)
  assert.match(ops.spaceMeta(local.space, false, false, local.contents, t), /^不同步 • 2 个歌单 • [\d.]+ MB$/)
  assert.equal(ops.spaceMeta(account.space, true, true, account.contents, t), 'server • 已登录 • 正在使用')
  assert.equal(ops.spaceMeta(account.space, false, false, account.contents, t), 'server • 已退出（数据保留）')
  await service.switchAccountSpace(local.space)
  assert.equal(env.space.getActiveSpace(), 'local')
  await service.switchAccountSpace(account.space, account.session)
  assert.equal(env.space.getActiveSpace(), 'lux:s:alice')
  assert.ok(calls.some(call => call[0] === 'connect' && call[1] === 'https://server' && call[2] === 'alice'))
  await service.switchAccountSpace({ id: 'lux:s:bob', kind: 'lux', host: 'https://server', username: 'bob' })
  assert.deepEqual(calls.at(-1), ['login', { onboarding: false, initialHost: 'https://server', initialUsername: 'bob' }])
  assert.equal(env.space.getActiveSpace(), 'lux:s:alice', 'signed-out navigation keeps the current space until login succeeds')
})

test('5.7 accepting all/selected choices in the real import dialog service copies once and persists the decision', async() => {
  for (const all of [false, true]) {
    const env = make()
    await seedLocalImport(env)
    await env.space.setActiveSpace('lux:s:alice')
    let shown = 0
    const dialogs = dialogsFor(env, async args => {
      shown++
      await args.component.passProps.finish({ ids: all ? ['one', 'two'] : ['one'], history: true, all })
    })
    const auth = { serverUrl: 'https://server', token: 'a', user: { id: 'alice', username: 'alice' } }
    const remote = async() => ({ playlists: { defaultList: { musicCount: 0 }, loveList: { musicCount: 0 }, userList: [] } })
    assert.equal(await dialogs.offerLocalImport(auth, remote), all)
    assert.equal(await dialogs.offerLocalImport(auth, remote), false)
    assert.equal(shown, 1)
    assert.equal((await env.adapter.getData(keys.userList)).length, all ? 2 : 1)
    assert.equal((await env.adapter.getData(keys.playHistory)).length, 1)
    assert.equal((await env.adapter.getData(env.space.namespacedKey(keys.userList, 'local'))).length, 2)
  }
})

test('5.7 installed server-only Keychain entries upgrade to their known account owner without touching other account tokens', async() => {
  const a = { serverId: 's', serverUrl: 'https://server', token: 'a', user: { id: 'alice', username: 'alice' } }
  const env = make({ '@lux_auth': JSON.stringify(a), '@lux_auth_servers': JSON.stringify({ s: a }) })
  await env.secure.setRefreshToken('s', 'installed-v1-token')
  const data = loadData(env)
  await data.migrateStoredLuxCredentials()
  assert.equal(await data.getLuxRefreshToken(a), 'installed-v1-token')
  assert.equal(await env.secure.getRefreshToken('s'), null)
  await data.migrateStoredLuxCredentials()
  assert.equal(await data.getLuxRefreshToken(a), 'installed-v1-token')
})

test('smart playlist rules migrate intact and real delete scope removes only the selected account rules', async() => {
  const env = make(legacy)
  await env.space.initializeDataSpaces()
  assert.ok(env.space.perSpaceKeys.includes(keys.smartPlaylistRules))
  assert.equal(env.disk.get(`${keys.smartPlaylistRules}@local`), legacy[keys.smartPlaylistRules])
  assert.equal(env.disk.get(keys.smartPlaylistRules), legacy[keys.smartPlaylistRules])
  const fixture = JSON.parse(legacy[keys.smartPlaylistRules])
  for (const id of ['lux:s:alice', 'lux:s:bob']) {
    await env.space.setActiveSpace(id)
    assert.equal(await env.adapter.getData(keys.smartPlaylistRules), null)
    await env.adapter.saveData(keys.smartPlaylistRules, { ...fixture, owner: id })
  }
  await env.space.setActiveSpace('local')
  const before = new Map(env.disk)
  await operationsFor(env).deleteSpaceData('lux:s:alice')
  assert.equal(env.disk.has(`${keys.smartPlaylistRules}@lux:s:alice`), false)
  assert.equal(env.disk.get(`${keys.smartPlaylistRules}@lux:s:bob`), before.get(`${keys.smartPlaylistRules}@lux:s:bob`))
  assert.equal(env.disk.get(`${keys.smartPlaylistRules}@local`), before.get(`${keys.smartPlaylistRules}@local`))
  assert.equal(env.disk.get(keys.smartPlaylistRules), before.get(keys.smartPlaylistRules))
  assert.deepEqual(await env.adapter.getData(keys.smartPlaylistRules), fixture)
})


test('delete-local scope also removes the selected native downloads, preserving active and local spaces', async() => {
  const env = make()
  await env.space.initializeDataSpaces()
  await env.space.setActiveSpace('lux:s:a')
  await env.space.setActiveSpace('lux:s:b')
  const operations = operationsFor(env)
  await operations.deleteSpaceData('lux:s:a')
  assert.deepEqual(env.deletedDownloadSpaces, ['lux:s:a'])
  await assert.rejects(operations.deleteSpaceData('lux:s:b'), /Cannot delete/)
  await assert.rejects(operations.deleteSpaceData('local'), /Cannot delete/)
  assert.deepEqual(env.deletedDownloadSpaces, ['lux:s:a'])
})
