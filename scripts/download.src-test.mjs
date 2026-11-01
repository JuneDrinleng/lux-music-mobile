/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const load = (path, deps = {}) => {
  const module = { exports: {} }
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    if (name === '@/utils/sessionFence') return { isSessionCoordinatorEnabled: () => true, sessionRemoteWritesFrozen: () => false, sessionWritesFrozen: () => false, sessionGeneration: () => 0, acceptsSessionGeneration: () => true }
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
const api = load('src/core/download/model.ts')
const song = { source: 'kw', id: 'kw_1', name: 'Song', meta: {} }
const request = { musicInfo: song, quality: '128k', wifiOnly: true, estimatedSize: 1234 }
const make = () => {
  let space = 'local'
  let disk = []
  const calls = []
  const paths = new Map()
  const bridge = {
    availableBytes: async() => 100 * 1024 * 1024,
    enqueue: async(owner, payload) => {
      const incoming = JSON.parse(payload)
      calls.push(['enqueue', owner, incoming])
      for (const item of incoming) {
        disk = disk.filter(row => row.key != item.key || row.space != owner)
        disk.push({ ...item, id: owner + item.key, space: owner, state: 'queued', bytes: 0, error: '' })
      }
      return JSON.stringify(disk.filter(item => item.space == owner))
    },
    snapshot: async owner => JSON.stringify(disk.filter(item => item.space == owner)),
    reconcile: async owner => { calls.push(['reconcile', owner]); return bridge.snapshot(owner) },
    command: async(owner, key, action) => {
      calls.push(['command', action, owner, key])
      disk.find(item => item.space == owner && item.key == key).state = action == 'pause' ? 'paused' : 'queued'
      return bridge.snapshot(owner)
    },
    offlinePath: async(owner, key) => { calls.push(['stat', owner, key]); return paths.get(key) ?? null },
  }
  const queue = api.createDownloadQueue({ bridge, space: () => space, resolveUrl: async(item, refresh) => { calls.push(['resolve', refresh]); return refresh ? 'https://fresh' : 'https://first' } })
  return { queue, calls, bridge, paths, setSpace: value => { space = value }, disk: () => disk, setDisk: value => { disk = value } }
}

test('download batch preserves Wi-Fi policy; native transitions, pause/resume/retry and done guards', async() => {
  const env = make()
  const key = api.downloadKey(song, '128k')
  await env.queue.enqueue([request, { ...request, quality: '320k', wifiOnly: false }])
  assert.deepEqual(env.queue.getSnapshot().map(item => item.wifiOnly), [true, false])
  assert.equal(env.queue.getSnapshot()[0].state, 'queued')
  env.disk()[0].state = 'running'
  await env.queue.sync()
  assert.equal(env.queue.getSnapshot()[0].state, 'running')
  await env.queue.command(key, 'pause')
  assert.equal(env.queue.getSnapshot()[0].state, 'paused')
  await env.queue.command(key, 'retry')
  assert.equal(env.queue.getSnapshot()[0].state, 'paused')
  await env.queue.command(key, 'resume')
  assert.equal(env.queue.getSnapshot()[0].state, 'queued')
  env.disk()[0].state = 'failed'
  await env.queue.sync()
  await env.queue.command(key, 'retry')
  assert.equal(env.queue.getSnapshot()[0].state, 'queued')
  env.disk()[0].state = 'done'
  await env.queue.sync()
  const before = env.calls.length
  for (const action of ['pause', 'resume', 'retry']) await env.queue.command(key, action)
  assert.equal(env.calls.length, before)
})

test('storage precheck includes reserve, rejects before URL requests, and validates size/flag', async() => {
  const env = make()
  const reserve = 8 * 1024 * 1024
  assert.equal(api.storagePrecheck(reserve + 100, 200, 100), true)
  assert.equal(api.storagePrecheck(reserve + 99, 200, 100), false)
  assert.equal(api.storagePrecheck(Infinity, 200), false)
  env.bridge.availableBytes = async() => reserve + request.estimatedSize - 1
  await assert.rejects(env.queue.enqueue([request]), /INSUFFICIENT_STORAGE/)
  assert.deepEqual(env.calls, [])
  for (const bad of [{ estimatedSize: -1 }, { estimatedSize: NaN }, { expectedSize: Infinity }, { wifiOnly: 'true' }]) {
    await assert.rejects(env.queue.enqueue([{ ...request, ...bad }]), /DOWNLOAD_INPUT/)
  }
})

test('expired URL events re-resolve once, survive reconcile after kill, and explicit retry refreshes again', async() => {
  const env = make()
  await env.queue.enqueue([request])
  const saved = { ...env.disk()[0], state: 'failed', error: 'URL_EXPIRED', bytes: 1024 }
  env.setDisk([saved])
  await env.queue.sync(true)
  assert.ok(env.calls.some(call => call[0] == 'reconcile'))
  assert.equal(env.calls.filter(call => call[0] == 'resolve' && call[1]).length, 1)
  assert.equal(env.disk()[0].url, 'https://fresh')
  // A fresh request that also expires cannot spin forever via running/failed events.
  env.disk()[0].state = 'running'
  await env.queue.sync()
  env.disk()[0].state = 'failed'; env.disk()[0].error = 'URL_EXPIRED'
  await env.queue.sync()
  await env.queue.sync()
  assert.equal(env.calls.filter(call => call[0] == 'resolve' && call[1]).length, 1)
  await env.queue.command(saved.key, 'retry')
  assert.equal(env.calls.filter(call => call[0] == 'resolve' && call[1]).length, 2)
})

test('reconciliation trusts persisted native byte offsets and offline lookup checks a real native hit', async() => {
  const env = make()
  assert.equal(await env.queue.offline(song), null)
  assert.equal(env.calls.length, 0)
  await env.queue.enqueue([request])
  const saved = { ...env.disk()[0], state: 'running', bytes: 321 }
  env.setDisk([saved])
  env.queue.clear()
  await env.queue.sync(true)
  assert.equal(env.queue.getSnapshot()[0].bytes, 321)
  assert.equal(await env.queue.offline(song), null)
  saved.state = 'done'
  await env.queue.sync()
  assert.equal(await env.queue.offline(song), null)
  env.paths.set(saved.key, 'file:///private/download.audio')
  assert.equal(await env.queue.offline(song), 'file:///private/download.audio')
  assert.equal(await env.queue.offline(song, 'flac'), null)
  env.paths.delete(saved.key)
  assert.equal(await env.queue.offline(song), null)
  env.setSpace('lux:s:a')
  assert.equal(await env.queue.offline(song), null)
})

test('slow native snapshots cannot republish a previous data space', async() => {
  const env = make()
  await env.queue.enqueue([request])
  let finish
  env.bridge.snapshot = async() => new Promise(resolve => { finish = resolve })
  const pending = env.queue.sync()
  env.setSpace('lux:s:b')
  env.queue.clear()
  finish(JSON.stringify(env.disk()))
  await pending
  assert.deepEqual(env.queue.getSnapshot(), [])
})

test('playback URL resolution prefers verified download and keeps online fallback unchanged', async() => {
  let path = null
  let onlineCalls = 0
  const online = { getMusicUrl: async() => { ++onlineCalls; return 'https://online' } }
  const music = load('src/core/music/index.ts', {
    '@/core/download': { getDownloadedMusicPath: async() => path },
    './online': online,
    './download': {},
    './local': {},
  })
  assert.equal(await music.getMusicUrl({ musicInfo: song }), 'https://online')
  assert.equal(onlineCalls, 1)
  path = 'file:///download.audio'
  assert.equal(await music.getMusicUrl({ musicInfo: song }), path)
  assert.equal(onlineCalls, 1)
  path = null
  assert.equal(await music.getMusicUrl({ musicInfo: song }), 'https://online')
})

test('native event bridge reconciles on startup and space change, refreshes expired URLs with existing resolver', async() => {
  const env = make()
  const events = new Map()
  const changes = []
  const before = []
  const resolves = []
  class Emitter {
    addListener(name, listener) { events.set(name, listener) }
  }
  const download = load('src/core/download/index.ts', {
    'react-native': { NativeModules: { DownloadModule: env.bridge }, NativeEventEmitter: Emitter, AppState: { addEventListener: (name, listener) => events.set('appState', listener) } },
    '@/utils/dataSpace': { getActiveSpace: () => 'local', onDataSpaceChanged: fn => changes.push(fn), onDataSpaceWillChange: fn => before.push(fn) },
    '@/core/music/online': { getMusicUrl: async params => { resolves.push(params); return 'https://resolved' } },
    './model': api,
  })
  await download.initDownloads()
  assert.equal(env.calls.filter(call => call[0] == 'reconcile').length, 1)
  await download.downloadQueue.enqueue([request])
  env.disk()[0].state = 'failed'
  env.disk()[0].error = 'URL_EXPIRED'
  events.get('luxDownloadChanged')()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(resolves.at(-1).isRefresh, true)
  assert.equal(resolves.at(-1).allowToggleSource, false)
  before[0]()
  assert.deepEqual(download.downloadQueue.getSnapshot(), [])
  await changes[0]()
  assert.equal(env.calls.filter(call => call[0] == 'reconcile').length, 2)
  events.get('appState')('active')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(env.calls.filter(call => call[0] == 'reconcile').length, 3)
  const unsupported = load('src/core/download/index.ts', {
    'react-native': { NativeModules: {} }, '@/utils/dataSpace': {}, '@/core/music/online': {}, './model': api,
  })
  assert.equal(unsupported.downloadQueue, null)
  assert.equal(await unsupported.getDownloadedMusicPath(song), null)
  assert.equal(await unsupported.isIgnoringDownloadBatteryOptimizations(), null)
  assert.equal(await unsupported.openDownloadBatterySettings(), false)
})

test('URL resolution finishing after an account switch cannot enqueue into the removed space', async() => {
  const env = make()
  let finish
  const queue = api.createDownloadQueue({ bridge: env.bridge, space: () => env.owner ?? 'local', resolveUrl: async() => new Promise(resolve => { finish = resolve }) })
  const pending = queue.enqueue([request])
  await new Promise(resolve => setImmediate(resolve))
  env.owner = 'lux:s:b'
  queue.clear()
  finish('https://fresh')
  await pending
  assert.deepEqual(env.disk(), [])
})
