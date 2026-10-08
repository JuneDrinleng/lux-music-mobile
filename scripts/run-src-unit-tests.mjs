/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'lux-unit-'))
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const files = [
  'src/components/playlist/playlistDragMath.ts',
  'src/components/playlist/playlistDragState.ts',
  'src/components/playlist/songRowKey.ts',
  'src/utils/imagePresentation.ts',
  'src/theme/luxTokens.ts',
  'src/utils/imageCachePolicy.ts',
  'src/utils/playlistCoverQueue.ts',
  'src/utils/playlistCoverMap.ts',
]

const compiled = spawnSync(process.execPath, [
  tsc,
  '--pretty', 'false',
  '--module', 'commonjs',
  '--target', 'es2020',
  '--moduleResolution', 'node',
  '--rootDir', root,
  '--outDir', outDir,
  '--skipLibCheck',
  '--esModuleInterop',
  '--strict', 'false',
  ...files,
], { cwd: root, encoding: 'utf8' })

if (compiled.status != 0) {
  process.stderr.write(compiled.stdout || '')
  process.stderr.write(compiled.stderr || '')
  process.exit(compiled.status || 1)
}

const require = createRequire(import.meta.url)
const math = require(join(outDir, 'src/components/playlist/playlistDragMath.js'))
const dragState = require(join(outDir, 'src/components/playlist/playlistDragState.js'))
const rowKey = require(join(outDir, 'src/components/playlist/songRowKey.js'))
const presentation = require(join(outDir, 'src/utils/imagePresentation.js'))
const lux = require(join(outDir, 'src/theme/luxTokens.js'))

const LIME_COLOR_LITERALS = [
  '#000000', '#0f172a', '#111111', '#111827', '#16181f', '#17191f', '#171a22', '#19171c', '#1A1A1A', '#1a1c1e',
  '#1c1c1e', '#1d2434', '#1e2233', '#1f2613', '#20242d', '#22170e', '#232733', '#26355f', '#293548', '#2a311c',
  '#2b1f25', '#2d3242', '#2f3748', '#2f88ff', '#303340', '#31351b', '#31c27c', '#374151', '#383d2b', '#413052',
  '#435817', '#45301d', '#475569', '#4b5563', '#4f2340', '#526236', '#556b96', '#58651b', '#5b3b1c', '#5d6271',
  '#5f6572', '#5f6574', '#5f76d9', '#613060', '#61556d', '#64748b', '#652233', '#666d7b', '#687189', '#6a707c',
  '#6b4b2e', '#6b7280', '#6f7688', '#705640', '#707789', '#72798a', '#737373', '#747b8f', '#757b85', '#767d89',
  '#76809b', '#7b8193', '#7d8190', '#7f5da5', '#7f8898', '#81889a', '#838995', '#84789b', '#85b300', '#8a6745',
  '#8a8f9d', '#8a909c', '#8a92a1', '#8caf33', '#8e8e93', '#8f96a2', '#9aa1ae', '#9ca3af', '#FA5252', '#a7afbe',
  '#b5cc49', '#b8bfcc', '#bcc2cf', '#bfdbfe', '#c68444', '#c8e600', '#cdd2de', '#cf385b', '#cf4f8f', '#cf5f35',
  '#d1d5db', '#d1fae5', '#d4ddeb', '#d5d8e0', '#d7deec', '#d7e08b', '#d7ef59', '#d81e06', '#d9d9de', '#d9ef62',
  '#dbeb92', '#dce0e9', '#ddf27a', '#dfe6f3', '#dff0ad', '#e11d8d', '#e1e6ef', '#e2e6ef', '#e2e8f0', '#e3e8f3',
  '#e3e9f4', '#e4e8f1', '#e5e7eb', '#e7ecfa', '#e8e8ec', '#e8e9f0', '#e8eaef', '#e8f0d7', '#eadfe4', '#ebe4d7',
  '#ece6f2', '#ececf0', '#ecfdf3', '#ede9fe', '#edf0f7', '#edf2f7', '#eef0f3', '#eef0fb', '#eef1f6', '#eef1f7',
  '#eef1f8', '#eef2f8', '#ef4444', '#eff6ff', '#f0f1f6', '#f1f1f3', '#f1f4fb', '#f1f5f9', '#f2d6e6', '#f2f5fb',
  '#f2f5fd', '#f3d7ed', '#f3e6d5', '#f3eef2', '#f3f4f6', '#f4e6d8', '#f4f4f7', '#f59e0b', '#f5f8ea', '#f6e2e7',
  '#f6e6de', '#f6f9ea', '#f7f8fd', '#f8eee7', '#f8f9fc', '#f8f9fd', '#f8fafc', '#f9edf4', '#faf2ea', '#fbf6f2',
  '#fce7f3', '#fcfbfc', '#fdf2f8', '#fee2e2', '#fef2f2', '#fef9c3', '#ffedd5', '#fffbeb', '#ffffff',
  'rgba(0,0,0,0.45)', 'rgba(15,23,42,0.04)', 'rgba(15,23,42,0.08)', 'rgba(15,23,42,0.1)', 'rgba(15,23,42,0.22)',
  'rgba(15,23,42,0.35)', 'rgba(15,23,42,0.55)', 'rgba(17, 24, 39, 0.32)', 'rgba(17, 24, 39, 0.35)', 'rgba(17,24,39,0.04)',
  'rgba(217,239,98,0.5)', 'rgba(22,24,31,0.08)', 'rgba(22,24,31,0.28)', 'rgba(230,234,243,0.92)', 'rgba(231,236,245,0.96)',
  'rgba(244,247,252,0.56)', 'rgba(244,247,252,0.58)', 'rgba(244,247,252,0.72)', 'rgba(245,247,252,0.72)',
  'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.18)',
  'rgba(255,255,255,0.26)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.44)',
  'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0.62)', 'rgba(255,255,255,0.7)',
  'rgba(255,255,255,0.72)', 'rgba(255,255,255,0.78)', 'rgba(255,255,255,0.88)', 'rgba(255,255,255,0.9)',
  'rgba(255,255,255,0.92)', 'rgba(255,255,255,0.95)', 'rgba(34, 39, 51, 0.16)',
]
const cachePolicy = require(join(outDir, 'src/utils/imageCachePolicy.js'))
const coverQueue = require(join(outDir, 'src/utils/playlistCoverQueue.js'))
const coverMap = require(join(outDir, 'src/utils/playlistCoverMap.js'))

const box = (x, y, width = 100, height = 80) => ({ x, y, width, height })
const flags = (overrides = {}) => ({
  active: false,
  settling: false,
  pressLive: false,
  moved: false,
  panOwned: false,
  fromIndex: -1,
  toIndex: -1,
  ...overrides,
})

test('playlist drag math shifts cards into the target slot', () => {
  const layouts = [box(0, 0), box(120, 0), box(0, 100), box(120, 100)]
  assert.deepEqual(math.shiftBetweenSlots(layouts, 1, 0, 3), { x: -120, y: 0 })
  assert.deepEqual(math.shiftBetweenSlots(layouts, 2, 0, 3), { x: 120, y: -100 })
  assert.deepEqual(math.shiftBetweenSlots(layouts, 0, 0, 0), { x: 0, y: 0 })
  assert.equal(math.getCardDisplayIndex(2, 0, 3), 1)
  assert.equal(math.findNearestSlotIndex(layouts, 130, 110, 0), 3)
  assert.equal(math.findNearestSlotIndex(layouts, 20, 10, 0, 18), 0)
  assert.equal(math.clampNumber(8, 0, 3), 3)
  assert.equal(math.clampNumber(-2, 0, 3), 0)
  const fallback = math.fallbackPlaylistLayout(1, false, 200)
  assert.ok(fallback.width > 0 && fallback.height > 0)
  assert.ok(fallback.x > 0)
})

test('lift scale stays inside the two-column grid', () => {
  assert.equal(dragState.liftScaleFitsGrid(dragState.PLAYLIST_LIFT_SCALE), true)
  assert.equal(dragState.PLAYLIST_LIFT_SCALE <= 1.03, true)
  assert.equal(dragState.liftScaleFitsGrid(1.2), false)
})

test('touch points come from changedTouches when pageX is absent', () => {
  assert.deepEqual(dragState.readTouchPagePoint({
    changedTouches: [{ pageX: 12, pageY: 40 }],
    touches: [],
  }), { pageX: 12, pageY: 40 })
  assert.deepEqual(dragState.readTouchPagePoint({ pageX: 4, pageY: 9 }), { pageX: 4, pageY: 9 })
  assert.equal(dragState.readTouchPagePoint({ pageX: Number.NaN, pageY: 1 }), null)
  assert.equal(dragState.readTouchPagePoint(null), null)
})

test('lifted card resets on release, cancel, terminate, safety, and a new press', () => {
  const lifted = flags({ active: true, pressLive: true, moved: true, fromIndex: 0, toIndex: 0 })
  for (const kind of ['release', 'cancel', 'terminate', 'safety']) {
    const decision = dragState.decidePlaylistGestureEnd(lifted, kind)
    assert.equal(decision.resetVisual, true, kind)
    assert.equal(decision.openList, false, kind)
  }
  assert.equal(dragState.decidePlaylistGestureEnd(lifted, 'release').commitOrder, false)
  const moved = flags({ active: true, moved: true, panOwned: true, fromIndex: 1, toIndex: 3 })
  assert.equal(dragState.decidePlaylistGestureEnd(moved, 'release').commitOrder, true)
  assert.equal(dragState.decidePlaylistGestureEnd(moved, 'release').resetVisual, true)
  assert.equal(dragState.decidePlaylistGestureEnd(moved, 'cancel').commitOrder, true)
  assert.equal(dragState.decidePlaylistGestureEnd(moved, 'terminate').resetVisual, true)
  const safety = dragState.decidePlaylistGestureEnd(moved, 'safety')
  assert.equal(safety.resetVisual, true)
  assert.equal(safety.commitOrder, false)
  const again = dragState.decidePlaylistGestureEnd(lifted, 'newPress')
  assert.equal(again.recoverStuck, true)
  assert.equal(again.resetVisual, true)
  assert.equal(again.commitOrder, false)
  const settling = flags({ settling: true, active: false, fromIndex: 0, toIndex: 2 })
  const duringSettle = dragState.decidePlaylistGestureEnd(settling, 'newPress')
  assert.equal(duringSettle.recoverStuck, false)
  assert.equal(duringSettle.resetVisual, false)
})

test('a tap opens the list and a sloppy press does not', () => {
  const pressing = flags({ pressLive: true, moved: false })
  assert.equal(dragState.decidePlaylistGestureEnd(pressing, 'release').openList, true)
  assert.equal(dragState.decidePlaylistGestureEnd(pressing, 'release').resetVisual, false)
  const sloppy = flags({ pressLive: true, moved: true })
  assert.equal(dragState.decidePlaylistGestureEnd(sloppy, 'release').openList, false)
  assert.equal(dragState.decidePlaylistGestureEnd(flags(), 'release').resetVisual, false)
})

test('duplicate songs keep stable keys across reorder', () => {
  const first = { source: 'wy', id: '1' }
  const second = { source: 'wy', id: '1' }
  const other = { source: 'kg', id: '9' }
  const store = rowKey.createSongRowKeyStore()
  const before = [first, other, second]
  const beforeKeys = before.map((song, index) => rowKey.stableSongRowKey(song, index, before, store))
  assert.deepEqual(beforeKeys, ['wy_1', 'kg_9', 'wy_1#1'])
  const after = [second, first, other]
  const afterKeys = after.map((song, index) => rowKey.stableSongRowKey(song, index, after, store))
  assert.deepEqual(afterKeys, ['wy_1#1', 'wy_1', 'kg_9'])
  assert.equal(afterKeys.includes('wy_1_0'), false)
})

test('the same song reference inserted twice still has unique keys', () => {
  const song = { source: 'tx', id: '7' }
  const store = rowKey.createSongRowKeyStore()
  const list = [song, song]
  const keys = list.map((item, index) => rowKey.stableSongRowKey(item, index, list, store))
  assert.equal(keys[0], 'tx_7')
  assert.equal(keys[1], 'tx_7@1')
  assert.notEqual(keys[0], keys[1])
})

test('cached covers paint immediately and a visible remote URL is not swapped', () => {
  const hit = presentation.coverPresentation({
    rawUri: 'https://img.example/a.jpg',
    cacheEnabled: true,
    peekedFileUri: 'file:///cache/a',
  })
  assert.equal(hit.uri, 'file:///cache/a')
  assert.equal(hit.loaded, true)
  assert.equal(hit.fadeIn, false)
  assert.equal(hit.waitForDownload, false)

  const miss = presentation.coverPresentation({
    rawUri: 'https://img.example/b.jpg',
    cacheEnabled: true,
    peekedFileUri: null,
  })
  assert.equal(miss.uri, null)
  assert.equal(miss.loaded, false)
  assert.equal(miss.fadeIn, true)
  assert.equal(miss.waitForDownload, true)

  const localFile = presentation.coverPresentation({
    rawUri: 'file:///cover.jpg',
    cacheEnabled: true,
    peekedFileUri: null,
  })
  assert.equal(localFile.loaded, true)
  assert.equal(localFile.fadeIn, false)

  assert.equal(presentation.nextCoverUri('https://img.example/b.jpg', 'file:///cache/b', 'https://img.example/b.jpg'), 'https://img.example/b.jpg')
  assert.equal(presentation.nextCoverUri(null, 'file:///cache/b', 'https://img.example/b.jpg'), 'file:///cache/b')
  assert.equal(presentation.COVER_FADE_MS, 150)
  assert.match(presentation.COVER_PLACEHOLDER_COLOR, /^#[0-9a-fA-F]{6}$/)
})

test('default lime theme keeps the current screen literals', () => {
  assert.equal(lux.limeTheme.id, 'lime')
  assert.equal(lux.limeTheme.name, '黄绿')
  assert.equal(lux.limeTheme.mode, 'light')
  assert.equal(lux.DEFAULT_LUX_THEME_ID, 'lime')
  assert.deepEqual(Object.keys(lux.luxThemeRegistry), ['lime'])
  assert.deepEqual([...lux.LUX_THEME_IDS], ['lime', 'mist_blue', 'sakura', 'lavender', 'oat_milk', 'ink_night'])
  assert.equal(lux.luxThemeRegistry.lime, lux.limeTheme)

  const colors = lux.limeTheme.colors
  assert.equal(colors.bg.app, '#eef0fb')
  assert.equal(colors.accent.primary, '#c8e600')
  assert.equal(colors.ink.secondary, '#767d89')
  assert.equal(colors.surface.placeholder, '#e8eaef')
  assert.equal(colors.accent.nav, '#d7ef59')
  assert.equal(colors.accent.chip, '#d9ef62')
  assert.equal(colors.accent.soft, '#dbeb92')
  assert.equal(colors.ink.pageTitle, '#16181f')
  assert.equal(colors.ink.subpageTitle, '#1a1c1e')
  assert.equal(colors.ink.list, '#20242d')
  assert.equal(colors.ink.strong, '#111827')
  assert.equal(colors.ink.input, '#232733')
  assert.equal(colors.ink.onAccent, '#111827')
  assert.equal(colors.control.play, '#111827')
  assert.equal(colors.danger, '#ef4444')
  assert.equal(colors.like, '#FA5252')
  assert.equal(colors.line.divider, '#e1e6ef')
  assert.equal(colors.surface.search, '#dce0e9')
  assert.equal(colors.searchField.border, '#cdd2de')
  assert.equal(colors.surface.cancel, '#f1f4fb')
  assert.equal(colors.ink.cancel, '#4b5563')
  assert.equal(colors.ink.navIdle, '#5f6574')
  assert.equal(colors.ink.navActive, '#2a311c')
  assert.equal(colors.source.localPlayer, '#64748b')
  assert.equal(colors.source.localDetail, '#475569')
  assert.equal(colors.source.unknown.background, '#e5e7eb')
  assert.equal(colors.source.queueUnknown.background, '#f3f4f6')
  assert.equal(colors.glass.rim72, 'rgba(244,247,252,0.72)')
  assert.equal(colors.glass.rim72Warm, 'rgba(245,247,252,0.72)')
  assert.equal(colors.scrim.settings, 'rgba(34, 39, 51, 0.16)')

  const splitAccents = [colors.accent.primary, colors.accent.nav, colors.accent.chip, colors.accent.soft]
  assert.equal(new Set(splitAccents).size, splitAccents.length)
  assert.notEqual(colors.ink.strong, colors.ink.secondary)
  assert.notEqual(colors.source.localPlayer, colors.source.localDetail)
  assert.notEqual(colors.source.unknown.background, colors.source.queueUnknown.background)

  const leaves = lux.listLuxColorValues()
  assert.equal(leaves.length, 227)
  const unique = [...new Set(leaves)].sort()
  assert.deepEqual(unique, LIME_COLOR_LITERALS)
  assert.equal(unique.includes('#eef3f9'), false)
  assert.equal(unique.includes('#12141c'), false)
})

test('prefetch queue dedupes, keeps priority, and does not downgrade', () => {
  const queue = new coverQueue.PlaylistCoverQueue()
  assert.equal(queue.enqueue('a', 'background'), 'added')
  assert.equal(queue.enqueue('a', 'background'), 'duplicate')
  assert.equal(queue.enqueue('a', 'visible'), 'upgraded')
  assert.equal(queue.enqueue('a', 'background'), 'duplicate')
  assert.equal(queue.size(), 1)
  for (let index = 0; index < 20; index++) queue.enqueue(`bg-${index}`, 'background')
  queue.enqueue('open', 'playlist')
  const first = queue.take(0)
  assert.equal(first?.key, 'a')
  assert.equal(first?.priority, 'visible')
  assert.equal(queue.take(0, ['visible']), null)
  assert.equal(queue.take(0)?.key, 'open')
  assert.equal(queue.take(0, ['background'])?.key, 'bg-0')
  const later = new coverQueue.PlaylistCoverQueue()
  later.enqueue('old', 'visible')
  later.enqueue('new', 'visible')
  assert.equal(later.take(0)?.key, 'new')
  assert.equal(later.take(0)?.key, 'old')
  assert.equal(coverQueue.VISIBLE_COVER_CONCURRENCY, 3)
  assert.equal(coverQueue.PLAYLIST_COVER_CONCURRENCY, 2)
  assert.equal(coverQueue.BACKGROUND_COVER_CONCURRENCY, 2)
})

test('prefetch retries back off and then stop', () => {
  const queue = new coverQueue.PlaylistCoverQueue()
  queue.enqueue('kg_1', 'background', 0)
  const first = queue.take(0)
  assert.equal(queue.fail(first, 1_000), 'retry')
  assert.equal(queue.take(1_000), null)
  assert.equal(coverQueue.playlistCoverRetryDelay(1), 2_000)
  const second = queue.take(3_000)
  assert.equal(second.attempts, 1)
  assert.equal(queue.fail(second, 3_000), 'retry')
  assert.equal(coverQueue.playlistCoverRetryDelay(2), 4_000)
  const third = queue.take(7_000)
  assert.equal(third.attempts, 2)
  assert.equal(queue.fail(third, 7_000), 'drop')
  assert.equal(queue.size(), 0)
  assert.equal(queue.isBlocked('kg_1', 7_000 + 1_000), true)
  assert.equal(queue.enqueue('kg_1', 'background', 8_000), 'duplicate')
  assert.equal(queue.enqueue('kg_1', 'visible', 8_000), 'added')
  assert.equal(queue.take(8_000)?.priority, 'visible')
})

test('cover url map persists, rejects fallbacks, and prunes removed songs', () => {
  const now = 1_700_000_000_000
  let map = {}
  map = coverMap.rememberPlaylistCover(map, {
    source: 'wy',
    id: 'wy_8',
    url: 'https://p2.music.126.net/abc/cover.jpg',
    now,
  })
  assert.equal(map.wy_wy_8.url, 'https://p2.music.126.net/abc/cover.jpg')
  assert.match(map.wy_wy_8.thumbUrl, /param=300y300/)
  const same = coverMap.rememberPlaylistCover(map, {
    source: 'wy',
    id: 'wy_8',
    url: 'https://p2.music.126.net/abc/cover.jpg',
    now: now + 10,
  })
  assert.equal(same, map)

  const rejected = coverMap.rememberPlaylistCover(map, {
    source: 'kg',
    id: 'kg_1',
    url: 'https://img.example/playlist.jpg',
    now,
    rejectUrls: new Set(['https://img.example/playlist.jpg']),
  })
  assert.equal(rejected, map)
  assert.equal(coverMap.rememberPlaylistCover(map, {
    source: 'tx',
    id: 'tx_0',
    url: 'https://y.gtimg.cn/music/photo_new/T002R500x500M000.jpg',
    now,
  }), map)
  assert.equal(coverMap.rememberPlaylistCover(map, {
    source: 'kg',
    id: 'kg_2',
    url: 'not-a-url',
    now,
  }), map)

  map = coverMap.rememberPlaylistCover(map, {
    source: 'kg',
    id: 'kg_9',
    url: 'http://imge.kugou.com/stdmusic/480/20200101/a.jpg',
    now,
  })
  const raw = coverMap.serializePlaylistCoverMap(map)
  const restored = coverMap.parsePlaylistCoverMap(raw)
  assert.equal(restored.kg_kg_9.thumbUrl, 'http://imge.kugou.com/stdmusic/240/20200101/a.jpg')
  assert.deepEqual(coverMap.parsePlaylistCoverMap('not json'), {})
  assert.deepEqual(coverMap.parsePlaylistCoverMap(null), {})

  const pruned = coverMap.prunePlaylistCoverMap(restored, new Set(['wy_wy_8']))
  assert.deepEqual(Object.keys(pruned.map), ['wy_wy_8'])
  assert.equal(pruned.removed.length, 1)
  assert.equal(pruned.removed[0].id, 'kg_9')
  assert.equal(coverMap.prunePlaylistCoverMap(pruned.map, new Set(['wy_wy_8'])).removed.length, 0)
})

test('fallback covers are shared across albums, real album art is not', () => {
  const fallback = coverMap.collectFallbackPicUrls([
    { picUrl: 'https://img.example/list.jpg', albumId: '1' },
    { picUrl: 'https://img.example/list.jpg', albumId: '2' },
    { picUrl: 'https://img.example/album.jpg', albumId: '9' },
    { picUrl: 'https://img.example/album.jpg', albumId: '9' },
    { picUrl: 'https://img.example/empty.jpg', albumId: '' },
    { picUrl: 'https://img.example/empty.jpg', albumId: null },
  ])
  assert.equal(fallback.has('https://img.example/list.jpg'), true)
  assert.equal(fallback.has('https://img.example/album.jpg'), false)
  assert.equal(fallback.has('https://img.example/empty.jpg'), true)
})

test('thumb urls shrink list art and leave playback-sized originals alone when already small', () => {
  assert.equal(
    coverMap.toPlaylistThumbUrl('https://y.gtimg.cn/music/photo_new/T002R500x500M000abc.jpg', 'tx'),
    'https://y.gtimg.cn/music/photo_new/T002R300x300M000abc.jpg',
  )
  assert.equal(
    coverMap.toPlaylistThumbUrl('https://y.gtimg.cn/music/photo_new/T002R300x300M000abc.jpg', 'tx'),
    'https://y.gtimg.cn/music/photo_new/T002R300x300M000abc.jpg',
  )
  assert.equal(
    coverMap.toPlaylistThumbUrl('https://p1.music.126.net/a/b.jpg', 'wy'),
    'https://p1.music.126.net/a/b.jpg?param=300y300',
  )
  assert.equal(
    coverMap.toPlaylistThumbUrl('https://p1.music.126.net/a/b.jpg?param=640y640', 'wy'),
    'https://p1.music.126.net/a/b.jpg?param=300y300',
  )
  assert.equal(
    coverMap.toPlaylistThumbUrl('https://img2.kuwo.cn/star/albumcover/500/s/a.jpg', 'kw'),
    'https://img2.kuwo.cn/star/albumcover/240/s/a.jpg',
  )
  assert.equal(
    coverMap.syntheticCoverUrl('tx', '003abc'),
    'https://y.gtimg.cn/music/photo_new/T002R500x500M000003abc.jpg',
  )
  assert.equal(coverMap.syntheticCoverUrl('tx', ''), null)
  assert.equal(coverMap.syntheticCoverUrl('kg', '1'), null)
  const kgPlan = coverMap.planSongCover({
    source: 'kg',
    id: 'kg_1',
    picUrl: null,
    trustPicUrl: false,
  })
  assert.equal(kgPlan.canonicalUrl, null)
  const txPlan = coverMap.planSongCover({
    source: 'tx',
    id: 'tx_1',
    picUrl: null,
    albumId: '003abc',
    trustPicUrl: false,
  })
  assert.match(txPlan.thumbUrl, /R300x300/)
})

test('background cover prefetch runs only on an unmetered network', () => {
  const ready = {
    visibleRunning: 0,
    playlistRunning: 0,
    backgroundRunning: 0,
    backgroundLimit: 2,
    visibleReady: false,
    playlistReady: false,
    backgroundReady: true,
  }
  assert.equal(coverMap.decideBackgroundCoverLane({ ...ready, unmetered: false }), 'defer-metered')
  assert.equal(coverMap.decideBackgroundCoverLane({ ...ready, unmetered: true }), 'start')
  assert.equal(coverMap.decideBackgroundCoverLane({
    ...ready,
    unmetered: true,
    visibleRunning: 1,
  }), 'defer-foreground')
  assert.equal(coverMap.decideBackgroundCoverLane({
    ...ready,
    unmetered: true,
    playlistReady: true,
  }), 'defer-foreground')
  assert.equal(coverMap.decideBackgroundCoverLane({
    ...ready,
    unmetered: true,
    backgroundRunning: 2,
  }), 'idle')
  assert.equal(coverMap.decideBackgroundCoverLane({
    ...ready,
    unmetered: true,
    backgroundReady: false,
  }), 'idle')
  assert.equal(coverMap.becameUnmetered(false, true), true)
  assert.equal(coverMap.becameUnmetered(true, true), false)
  assert.equal(coverMap.becameUnmetered(true, false), false)
  assert.equal(coverMap.becameUnmetered(false, false), false)
})

test('a cached cover stays on screen until the replacement file is ready', () => {
  const cached = new Set(['https://img.example/hero.jpg'])
  const next = coverMap.resolvePlaylistRowCover({
    source: 'kg',
    picUrl: null,
    fallbackUrl: 'https://img.example/hero.jpg',
    mapped: null,
    isCached: (url) => cached.has(url),
  })
  assert.equal(next, 'https://img.example/hero.jpg')
  const thumb = 'https://imge.kugou.com/stdmusic/240/a.jpg'
  assert.equal(coverMap.preferStableCover('https://img.example/hero.jpg', thumb, (url) => cached.has(url)), 'https://img.example/hero.jpg')
  cached.add(thumb)
  assert.equal(coverMap.preferStableCover('https://img.example/hero.jpg', thumb, (url) => cached.has(url)), thumb)
})

test('playlist pins are not evicted with ordinary image cache files', () => {
  const pinned = new Set(['thumb-a', 'thumb-b'])
  const names = ['loose-1', 'thumb-a', 'loose-2.tmp', 'loose-2', 'thumb-b', 'loose-3']
  assert.deepEqual(cachePolicy.selectUnpinnedEvictions(names, pinned, 2), ['loose-1'])
  assert.deepEqual(cachePolicy.selectUnpinnedEvictions(names, pinned, 10), [])
  assert.equal(cachePolicy.UNPINNED_IMAGE_CACHE_LIMIT >= 100, true)
})

test.after(() => {
  rmSync(outDir, { recursive: true, force: true })
})
