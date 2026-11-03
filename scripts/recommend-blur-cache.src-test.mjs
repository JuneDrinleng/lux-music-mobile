/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { moduleLoader, hookHost } from './recommend.src-test.mjs'

const batch = { spaceId: 'local', date: 'today', items: [{ key: 'one', song: { source: 'kw', songmid: '1', name: 'One', singer: 'Singer' } }], failures: [] }
const flush = () => new Promise(resolve => setImmediate(resolve))

test('fallback cache keys use the complete URL; disk hits are synchronous and trimming/clear revoke paths', async() => {
  const md5 = value => createHash('md5').update(value).digest('hex')
  const files = new Map()
  let downloads = 0
  const cache = moduleLoader({
    'react-native-quick-md5': { stringMd5: md5 },
    '@/utils/fs': {
      temporaryDirectoryPath: '/cache', mkdir: async() => {}, touchFile: async() => {},
      existsFile: async path => files.has(path),
      readDir: async() => [...files].map(([path, size]) => ({ path, size, mtime: 1 })),
      stat: async path => ({ size: files.get(path) }),
      unlink: async path => { files.delete(path) },
      moveFile: async(from, to) => { files.set(to, files.get(from)); files.delete(from) },
      downloadFile: (uri, path) => {
        downloads++
        files.set(path, 100)
        return { promise: Promise.resolve({ statusCode: 200 }) }
      },
    },
  })('../imageCache')
  const first = 'https://cover/image?v=1'
  const second = 'https://cover/image?v=2'
  const file = `/cache/image-cache/${md5(first)}`
  files.set(file, 80)
  await cache.primeImageCacheIndex()
  assert.equal(cache.peekCachedImageUri(first), `file://${file}`)
  assert.equal(cache.peekCachedImageUri(second), null)
  const uri = await cache.cacheImageUri(second)
  assert.equal(downloads, 1)
  assert.equal(cache.peekCachedImageUri(second), uri)
  assert.equal(await cache.cacheImageUri(second), uri)
  assert.equal(downloads, 1)
  cache.pinImageUrl(first)
  await cache.trimUnpinnedImageCache(0, 1)
  assert.equal(cache.peekCachedImageUri(second), null)
  assert.equal(cache.peekCachedImageUri(first), `file://${file}`)
  await cache.clearImageCacheFiles()
  assert.equal(cache.peekCachedImageUri(first), null)
  assert.equal(files.size, 0)
})

test('daily snapshot validates date, space, sources and dislikes and excludes radio/similar data', async() => {
  let space = 'local'
  let sources = [{ id: 'local:test', load: async() => batch.items.map(item => ({ song: item.song, origin: 'library' })) }]
  let disliked = false
  const engine = moduleLoader()('service').createRecommendationEngine({
    getSpaceId: () => space, getSources: () => sources, getHistory: () => [],
    isDisliked: () => disliked, readCache: async() => null, writeCache: async() => {},
  })
  assert.equal(engine.peekDailyRecommendations(), null)
  const result = await engine.getDailyRecommendations()
  assert.deepEqual(engine.peekDailyRecommendations(), result)
  engine.peekDailyRecommendations().items.length = 0
  assert.equal(engine.peekDailyRecommendations().items.length, 1)
  disliked = true
  assert.equal(engine.peekDailyRecommendations().items.length, 0)
  disliked = false
  space = 'other'
  assert.equal(engine.peekDailyRecommendations(), null)
  space = 'local'
  sources = []
  assert.equal(engine.peekDailyRecommendations(), null)
  await engine.getDailyRecommendations({ now: Date.now() - 86400000 })
  assert.equal(engine.peekDailyRecommendations(), null)
  engine.clearSessionCache()
  assert.equal(engine.peekDailyRecommendations(), null)
})

test('reload keeps a synchronous seed through pending work and failure; invalidation clears it', async() => {
  const states = []
  const loader = moduleLoader()('loadState').createRecommendationLoader(state => states.push(state))
  let reject
  const pending = loader.load(async() => new Promise((resolve, fail) => { reject = fail }), batch)
  assert.deepEqual(states[0], { batch, loading: false, failed: false })
  await flush()
  reject(Error('offline'))
  await pending
  assert.deepEqual(states.at(-1), { batch, loading: false, failed: true })
  loader.invalidate()
  assert.equal(states.at(-1).batch, null)
})

test('hook paints its cached initial value before effects and pauses hidden refresh timers', async() => {
  const previous = global.state_event
  const previousSet = global.setInterval
  const previousClear = global.clearInterval
  const host = hookHost()
  let snapshot = batch
  let requests = 0
  const timers = new Set()
  let willChange
  global.state_event = new EventEmitter()
  global.setInterval = callback => { timers.add(callback); return callback }
  global.clearInterval = callback => { timers.delete(callback) }
  try {
    const { useRecommendations } = moduleLoader({
      react: host.react,
      'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
      '@/utils/recommend': { peekDailyRecommendations: () => snapshot, getDailyRecommendations: async() => { requests++; return snapshot } },
      '@/utils/dataSpace': { onDataSpaceWillChange: cb => { willChange = cb; return () => {} }, onDataSpaceChanged: () => () => {} },
    })('../../components/recommend/useRecommendations')
    const renders = []
    const render = active => host.render(() => { const state = useRecommendations(undefined, active); renders.push(state); return state })
    render(true)
    assert.equal(renders[0].batch, batch)
    assert.equal(renders[0].loading, false)
    await flush()
    assert.equal(requests, 1)
    assert.equal(timers.size, 1)
    render(false)
    assert.equal(timers.size, 0)
    global.state_event.emit('syncStatusUpdated')
    await flush()
    assert.equal(requests, 1)
    assert.equal(render(false).batch, batch)
    render(true)
    await flush()
    assert.equal(requests, 2)
    assert.equal(timers.size, 1)
    snapshot = null
    willChange()
    assert.equal(render(true).batch, null)
    host.dispose()
    assert.equal(timers.size, 0)
    assert.equal(global.state_event.listenerCount('syncStatusUpdated'), 0)
  } finally {
    global.state_event = previous
    global.setInterval = previousSet
    global.clearInterval = previousClear
  }
})

test('boot gate waits for both actual blur loads, supports event ordering and releases on the existing deadline', async() => {
  const load = () => moduleLoader()('../recommendationCoverBoot')
  const gate = load()
  let ready = false
  void gate.recommendationBootCoversReady.then(() => { ready = true })
  gate.noteRecommendationBootCoverLoaded('daily')
  gate.setRecommendationBootCovers(['daily', 'weekly'])
  await flush()
  assert.equal(ready, false)
  gate.noteRecommendationBootCoverLoaded('old-weekly')
  await flush()
  assert.equal(ready, false)
  gate.noteRecommendationBootCoverLoaded('weekly')
  await flush()
  assert.equal(ready, true)
  const slow = load()
  slow.setRecommendationBootCovers(['never-loaded'])
  slow.finishRecommendationCoverBoot()
  await slow.recommendationBootCoversReady
  const empty = load()
  empty.setRecommendationBootCovers([undefined, undefined])
  await empty.recommendationBootCoversReady
  const boot = readFileSync(new URL('../src/utils/homeFirstScreenBoot.ts', import.meta.url), 'utf8')
  assert.match(boot, /Promise.all\(\[warmCovers\(next\), recommendationBootCoversReady\]\)/)
  assert.match(boot, /revealed = true\s+finishRecommendationCoverBoot\(\)/)
})

test('only all-content stays mounted; hiding preserves layout width and restarts the existing reveal', () => {
  const home = readFileSync(new URL('../src/screens/Home/Vertical/Tabs/HomeTab.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(home, /activeFilter === 'all' && \(/)
  assert.match(home, /position: 'absolute', left: 0, right: 0, opacity: 0/)
  assert.match(home, /pointerEvents=\{activeFilter === 'all' \? 'auto' : 'none'\}/)
  assert.match(home, /accessibilityElementsHidden=\{activeFilter !== 'all'\}/)
  assert.match(home, /importantForAccessibility=\{activeFilter === 'all' \? 'auto' : 'no-hide-descendants'\}/)
  assert.match(home, /<ContentReveal active=\{activeFilter === 'all'\}>/)
  assert.match(home, /anim.setValue\(0\)[\s\S]*?if \(!active\) return[\s\S]*?duration: 260[\s\S]*?animation.stop\(\)/)
  assert.match(home, /scrollTo\(\{ x: 0, y: 0, animated: false \}\)/)
  assert.match(home, /\{isLbFilter && \(/)
  assert.match(home, /\{activeFilter === 'other' && \(/)
  const section = readFileSync(new URL('../src/components/recommend/RecommendationSection.tsx', import.meta.url), 'utf8')
  assert.match(section, /removeClippedSubviews=\{false\}/)
  assert.match(section, /if \(nativeEvent.layout.width > 0\)/)
  assert.doesNotMatch(section, /scrollTo\(/)
})

test('weekly metadata reuses the latest background refresh synchronously and rejects another data space', () => {
  let space = 'local'
  const boot = moduleLoader({
    'react-native': { Image: {} },
    '@/utils/dataSpace': { getActiveSpace: () => space },
    '@/config/constant': { LIST_IDS: {} },
    '@/core/list': {},
    '@/store/player/state': { default: {}, __esModule: true },
    '@/store/list/state': { default: {}, __esModule: true },
    '@/theme/LuxTheme': {},
    '@/utils/imageCache': {},
    '@/utils/playlistCoverStore': {},
  })('../homeFirstScreenBoot')
  const first = { love: { count: 2, cover: 'first' } }
  const next = { love: { count: 3, cover: 'refreshed' } }
  boot.publishHomePlaylistMeta(first)
  assert.deepEqual(boot.getHomePlaylistMetaSnapshot(), first)
  boot.publishHomePlaylistMeta(next)
  assert.deepEqual(boot.getHomePlaylistMetaSnapshot(), next)
  space = 'other'
  assert.deepEqual(boot.getHomePlaylistMetaSnapshot(), {})
  boot.publishHomePlaylistMeta(first, 'local')
  assert.deepEqual(boot.getHomePlaylistMetaSnapshot(), {})
  boot.publishHomePlaylistMeta(first, 'other')
  assert.deepEqual(boot.getHomePlaylistMetaSnapshot(), first)
})
