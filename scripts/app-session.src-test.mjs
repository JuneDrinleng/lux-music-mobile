/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { load } from './secure-credentials-test-support.mjs'
const { AppSessionCoordinator } = load('src/core/appSession/coordinator.ts')
const fence = load('src/utils/sessionFence.ts')
const intent = { reason: 'switch', source: 'test', returnPolicy: 'restorePrevious' }
const local = { provider: 'local', spaceId: 'local' }
const target = { provider: 'lux', spaceId: 'lux:nas:alice', server: { serverId: 'nas', url: 'https://nas' }, account: { userId: 'alice', username: 'Alice' }, credentialRef: { kind: 'luxRefresh', id: '["nas","alice"]' } }
const deferred = () => { let resolve; const promise = new Promise(_resolve => { resolve = _resolve }); return { promise, resolve } }
const harness = () => {
  const events = []
  let disk = null
  let fail = ''
  let identity = local
  const step = name => async() => { events.push(name); if (fail === name) throw Error(name) }
  const deps = {
    read: async() => structuredClone(disk),
    write: async journal => { disk = structuredClone(journal); await step(journal.phase)() },
    clear: async() => { await step('clear')(); disk = null },
    active: () => identity,
    freeze: () => { events.push('freeze'); return fence.freezeSession() },
    release: () => { events.push('release'); fence.releaseSession() },
    pause: step('pause'),
    flush: step('flush'),
    pauseDownloads: async() => { await step('downloads')(); return ['only-running'] },
    leave: step('leave'),
    disconnect: step('disconnect'),
    gate: step('gate'),
    publish: async next => { await step('publish')(); identity = next },
    main: step('main'),
  }
  const candidate = { identity: target, prepare: step('prepare'), activate: step('activate') }
  const coordinator = new AppSessionCoordinator(deps)
  return { coordinator, deps, candidate, events, disk: () => disk, fail: value => { fail = value }, identity: () => identity }
}

test('switch pauses before source flush, downloads, leave, Gate, candidate preparation and activation', async() => {
  const h = harness()
  await h.coordinator.begin(intent)
  assert.deepEqual(h.events, ['freeze', 'pause', 'flush', 'downloads', 'gatePending', 'leave', 'disconnect', 'gate'])
  assert.deepEqual(h.disk().pausedDownloads, ['only-running'])
  await h.coordinator.complete(async() => h.candidate)
  assert.deepEqual(h.events.slice(8), ['authenticating', 'preparing', 'prepare', 'committing', 'activate', 'publish', 'main', 'clear', 'release'])
  assert.equal(h.disk(), null)
  assert.equal(h.coordinator.canEnterMain, true)
})

for (const failure of ['pause', 'flush', 'downloads']) {
  test(`${failure} failure aborts before Gate and leaves original identity`, async() => {
    const h = harness(); h.fail(failure)
    await assert.rejects(h.coordinator.begin(intent), new RegExp(failure))
    assert.equal(h.disk(), null)
    assert.equal(h.identity(), local)
    assert.equal(h.events.includes('gate'), false)
    assert.equal(h.coordinator.canEnterMain, true)
  })
}

for (const phase of ['gatePending', 'authenticating', 'preparing', 'prepare', 'committing', 'activate', 'publish', 'main', 'clear']) {
  test(`interruption at ${phase} always recovers to safe Gate`, async() => {
    const h = harness(); h.fail(phase)
    try { await h.coordinator.begin(intent); await h.coordinator.complete(async() => h.candidate) } catch {}
    assert.ok(h.disk())
    h.fail('')
    const restarted = new AppSessionCoordinator(h.deps)
    assert.equal(await restarted.recover(), true)
    assert.equal(restarted.canEnterMain, false)
    assert.equal(h.events.at(-1), 'gate')
    assert.equal(fence.sessionWritesFrozen(), true)
  })
}

test('concurrent begin and submit reuse one operation, with no second candidate or source flush', async() => {
  const h = harness(); const block = deferred()
  h.deps.pause = async() => { h.events.push('pause'); await block.promise }
  const first = h.coordinator.begin(intent)
  assert.equal(first, h.coordinator.begin({ ...intent, source: 'second-tap' }))
  block.resolve(); await first
  const auth = deferred(); let calls = 0
  const run = h.coordinator.complete(async() => { calls++; await auth.promise; return h.candidate })
  assert.equal(run, h.coordinator.complete(async() => { throw Error('must not authenticate twice') }))
  auth.resolve(); await run
  assert.equal(calls, 1)
  assert.equal(h.events.filter(x => x === 'flush').length, 1)
})

test('cancel prepares original identity and rebuilds Main without resuming playback or downloads', async() => {
  const h = harness(); await h.coordinator.begin(intent)
  await h.coordinator.cancel(async previous => ({ identity: previous, prepare: h.candidate.prepare, activate: async() => {} }))
  assert.equal(h.identity(), local)
  assert.equal(h.disk(), null)
  assert.equal(h.events.includes('play'), false)
  assert.equal(h.events.includes('resumeDownloads'), false)
})

test('target mismatch cannot activate; clearing credentials revokes restoration', async() => {
  const h = harness(); await h.coordinator.begin({ ...intent, targetIdentity: local })
  await assert.rejects(h.coordinator.complete(async() => h.candidate), /mismatch/)
  assert.equal(h.events.includes('activate'), false)
  await h.coordinator.revokeReturn()
  await assert.rejects(h.coordinator.cancel(async() => h.candidate), /unavailable/)
})

test('generation rejects old HTTP callbacks after same-space LX switch and A to B to A', () => {
  const first = fence.sessionGeneration()
  fence.freezeSession(); fence.releaseSession()
  fence.freezeSession(); fence.releaseSession()
  assert.equal(fence.acceptsSessionGeneration(first), false)
  assert.equal(fence.acceptsSessionGeneration(fence.sessionGeneration()), true)
})

test('leave refusal aborts the switch before disconnecting or replacing Main', async() => {
  const h = harness(); h.fail('leave')
  await assert.rejects(h.coordinator.begin(intent), /leave/)
  assert.equal(h.coordinator.canEnterMain, true)
  assert.equal(h.disk(), null)
  assert.equal(h.events.includes('disconnect'), false)
  assert.equal(h.events.includes('gate'), false)
})

test('recovery with failed download pause stays Gate and retries the barrier before authenticating', async() => {
  const h = harness(); await h.coordinator.begin(intent)
  h.fail('downloads')
  const restarted = new AppSessionCoordinator(h.deps)
  await restarted.recover()
  let authenticated = false
  await assert.rejects(restarted.complete(async() => { authenticated = true; return h.candidate }), /downloads/)
  assert.equal(authenticated, false)
  assert.equal(restarted.canEnterMain, false)
  h.fail('')
  await restarted.complete(async() => h.candidate)
  assert.equal(restarted.canEnterMain, true)
})

test('old 401 responses cannot rotate, clear credentials or open Gate after a new generation', async() => {
  const errors = load('src/plugins/sync/client/userErrors.ts')
  const { createLuxAuthClient } = load('src/utils/luxAuthApi.ts', { '@/plugins/sync/client/userErrors': errors })
  let generation = 0
  const reply = deferred()
  let clears = 0
  const client = createLuxAuthClient({
    generation: () => generation,
    send: async() => reply.promise,
    find: async() => ({ token: 'old', user: { id: 'alice' } }),
    getRefreshToken: async() => { throw Error('must not refresh') },
    rotate: async() => { throw Error('must not rotate') },
    clear: async() => { clears++; return true },
    expired: () => { throw Error('must not present expired Gate') },
  })
  const request = client.request('https://nas/api/me/profile', null, 'old')
  generation++
  reply.resolve({ code: 401, text: '{}' })
  await assert.rejects(request, /HTTP 401/)
  assert.equal(clears, 0)
})

test('native download barrier verifies stopped tasks and records only newly paused IDs', async() => {
  const fence = load('src/utils/sessionFence.ts')
  const { createDownloadQueue } = load('src/core/download/model.ts', { '@/utils/sessionFence': fence })
  let stopped = false
  const queue = createDownloadQueue({
    space: () => 'lux:nas:alice',
    resolveUrl: async() => 'https://media/song',
    bridge: {
      pauseSpace: async() => JSON.stringify([{ id: 'was-running', state: 'running' }]),
      snapshot: async() => JSON.stringify([{ id: 'was-running', state: stopped ? 'paused' : 'running' }, { id: 'user-paused', state: 'paused' }]),
    },
  })
  await assert.rejects(queue.pauseForSwitch(), /DOWNLOAD_PAUSE_FAILED/)
  stopped = true
  assert.deepEqual(await queue.pauseForSwitch(), ['was-running'])
})

test('an old resolved download URL cannot enqueue after a same-space switch or during Gate', async() => {
  const fence = load('src/utils/sessionFence.ts')
  const { createDownloadQueue } = load('src/core/download/model.ts', { '@/utils/sessionFence': fence })
  const url = deferred()
  let enqueued = 0
  const queue = createDownloadQueue({
    space: () => 'local',
    resolveUrl: async() => url.promise,
    bridge: { availableBytes: async() => 100_000_000, enqueue: async() => { enqueued++; return '[]' } },
  })
  const request = { musicInfo: { source: 'kw', id: '1' }, quality: '128k', wifiOnly: true, estimatedSize: 100 }
  const pending = queue.enqueue([request])
  await Promise.resolve()
  fence.freezeSession(); fence.releaseSession()
  url.resolve('https://media/source-account')
  await pending
  assert.equal(enqueued, 0)
  fence.freezeSession()
  await assert.rejects(queue.enqueue([request]), /SESSION_FROZEN/)
})

test('runtime activation restores only the target queue and position, replaces Main once and keeps playback paused', async context => {
  const previousLx = global.lx
  global.lx = { restorePlayInfo: null }
  context.after(() => { global.lx = previousLx })
  const fence = load('src/utils/sessionFence.ts')
  const events = []
  const targetSong = { id: 'target', source: 'kw' }
  let space = 'local'
  const player = { progress: { nowPlayTime: 15, maxPlayTime: 100 }, playMusicInfo: { listId: 'source-list' }, playInfo: { playIndex: 0 }, tempPlayList: [{ musicInfo: { id: 'source-queued' }, listId: 'source-list' }] }
  const disk = new Map([['appSessionActive:v1', JSON.stringify(local)]])
  const savedTarget = { listId: 'target-list', index: 0, time: 42, maxTime: 200, tempListMetaId: 'target-meta', tempQueue: [{ musicInfo: { id: 'target-queued' }, listId: 'target-list' }] }
  const storage = { getItem: async key => disk.get(key) ?? null, setItem: async(key, value) => { disk.set(key, value) }, removeItem: async key => { disk.delete(key) } }
  const runtime = load('src/core/appSession/index.ts', {
    '@react-native-async-storage/async-storage': storage,
    'react-native-navigation': { Navigation: { dismissAllModals: async() => {} } },
    'react-native': { NativeModules: {} },
    '@/plugins/player': { getPosition: async() => 15 },
    '@/plugins/player/utils': { pauseForSessionSwitch: async() => { events.push('pause') }, resetForSessionSwitch: async() => { events.push('reset') } },
    './coordinator': { AppSessionCoordinator },
    '@/utils/sessionFence': fence,
    '@/utils/dataSpace': { getActiveSpace: () => space, isDataSpaceReady: () => true, namespacedKey: (key, id) => `${key}@${id}`, setActiveSpace: async id => { space = id }, reloadActiveSpace: async() => {} },
    '@/config/constant': { storageDataPrefix: { playInfo: '@play_info' } },
    '@/utils/data': {
      getPlayInfo: async() => savedTarget,
      getSyncLoginCompleted: async() => true,
      setSyncLoginCompleted: async() => {},
      recordSuccessfulLogin: async() => { events.push('recent') },
      commitSyncMode: async() => {},
      commitSyncHost: async() => {},
      addSyncHostHistory: async() => {},
    },
    '@/core/together/member': { restorePersonalQueueForSwitch: async() => false },
    '@/utils/playHistory/store': { flushPlayHistory: async() => { events.push('flush') } },
    '@/plugins/storage': { saveData: async(key, value) => { disk.set(key, JSON.stringify(value)) } },
    '@/store/player/state': { __esModule: true, default: player },
    '@/utils/playHistory/tracker': { finishPlayHistorySession() {} },
    '@/core/download': { downloadQueue: { pauseForSwitch: async() => ['source-download'], releaseAfterSwitch: async() => {} } },
    '@/core/together': { quiesceTogetherForSwitch: async() => { events.push('leave') } },
    '@/plugins/sync': { disconnectServer: async() => { events.push('disconnect') } },
    '@/core/common': { updateSetting() {} },
    '@/navigation/navigation': { replaceWithLoginGate: async() => { events.push('gate') }, pushHomeScreen: async() => { events.push('main') } },
    '@/utils/tools': { toast() {} },
    '@/store/list/state': { __esModule: true, default: { tempListMeta: { id: 'source-meta' } } },
    '@/core/player/playInfo': { setPlayListId: id => { player.playInfo.playerListId = id }, setPlayMusicInfo: (_id, song) => { player.playMusicInfo.musicInfo = song } },
    '@/core/player/progress': { setNowPlayTime: value => { player.progress.nowPlayTime = value }, setMaxplayTime: value => { player.progress.maxPlayTime = value } },
    '@/store/player/action': { __esModule: true, default: { clearTempPlayeList: () => { player.tempPlayList = [] }, clearPlayedList() {}, addTempPlayList: list => { player.tempPlayList = list }, setIsPlay: value => { player.isPlay = value } } },
    '@/store/list/action': { __esModule: true, default: { setTempListMeta: value => { events.push(['meta', value.id]) } } },
    '@/core/list': { getListMusics: async() => [targetSong] },
    '@/plugins/sync/client/auth': { authenticateLuxCandidate: async() => ({ identity: target, keyInfo: {}, prepare: async() => { space = target.spaceId } }) },
    '@/plugins/sync/client/utils': { parseUrl: () => ({ href: 'https://nas' }) },
    '@/plugins/sync/client/client': { connect: () => { events.push('socket') } },
  })
  const previousI18n = global.i18n
  global.i18n = { t: value => value }
  context.after(() => { global.i18n = previousI18n })
  await runtime.initializeAppSession()
  await runtime.requestLogin(intent)
  assert.equal(fence.sessionWritesFrozen(), true)
  await runtime.connectAppSession('lux', 'https://nas', 'Alice', 'secret')
  assert.equal(space, target.spaceId)
  assert.equal(player.playMusicInfo.musicInfo.id, 'target')
  assert.equal(player.playInfo.playerListId, 'target-list')
  assert.equal(player.progress.nowPlayTime, 42)
  assert.equal(player.isPlay, false)
  assert.equal(player.tempPlayList[0].musicInfo.id, 'target-queued')
  assert.equal(JSON.parse(disk.get('@play_info@local')).tempQueue[0].musicInfo.id, 'source-queued')
  assert.equal(events.filter(value => value === 'main').length, 1)
  assert.equal(events.indexOf('pause') < events.indexOf('flush'), true)
  assert.equal(events.indexOf('leave') < events.indexOf('gate'), true)
  assert.equal(disk.has('appSessionJournal:v1'), false)
  assert.equal(fence.sessionWritesFrozen(), false)
})

test('playback pause barrier drains old native queue work and blocks external play before native pause verification', async context => {
  const previousLx = global.lx
  const previousI18n = global.i18n
  global.lx = { playerStatus: { isInitialized: true } }
  global.i18n = { t: value => value }
  context.after(() => { global.lx = previousLx; global.i18n = previousI18n })
  const fence = load('src/utils/sessionFence.ts')
  const draining = deferred()
  const events = []
  const utils = load('src/plugins/player/utils.ts', {
    '@/utils/sessionFence': fence,
    'react-native-track-player': { __esModule: true, State: { Playing: 'playing' }, Capability: {}, default: { play: async() => { events.push('play') }, pause: async() => { events.push('pause') }, getState: async() => 'paused' } },
    'react-native-background-timer': {},
    'react-native': { NativeModules: {} },
    './volumeFade': { createVolumeFade: () => ({}) },
    './gapless': { invalidateGapless: () => { events.push('invalidate') } },
    './playList': { quiesceSessionPlayer: async() => draining.promise },
    './hook': {},
    './cache': {},
    '@/utils/fs': {},
    '@/utils/tools': {},
    '@/config': {},
  })
  fence.freezeSession()
  const paused = utils.pauseForSessionSwitch()
  await utils.setPlay()
  assert.deepEqual(events, ['invalidate'])
  draining.resolve()
  await paused
  assert.deepEqual(events, ['invalidate', 'pause'])
})
