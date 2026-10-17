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
  const log = { info() {}, error() {}, warn() {} }
  const load = () => evaluate('src/utils/dataSpace/index.ts', {
    '@react-native-async-storage/async-storage': storage,
    '@/config/constant': { storageDataPrefix: keys },
    '@/utils/log': { log },
  })
  const space = load()
  const adapter = evaluate('src/plugins/storage.ts', {
    '@react-native-async-storage/async-storage': storage, '@/utils/log': { log }, '@/utils/dataSpace': space,
  })
  return { disk, space, adapter, storage, load, fail: n => { writes = 0; failAt = n } }
}
const legacy = {
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
  assert.equal(env.disk.get(env.space.MIGRATION_KEY), 'v1:lux:s:a')
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
  const constants = evaluate('src/config/constant.ts', {})
  const data = evaluate('src/utils/data.ts', {
    '@/plugins/storage': env.adapter,
    '@/config/constant': constants,
    './dataSpace': env.space,
    './common': { throttle: fn => fn },
    './fs': { privateStorageDirectoryPath: '/private' },
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
