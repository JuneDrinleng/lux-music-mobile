/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
  'src/theme/luxColorMath.ts',
  'src/theme/luxStyleCache.ts',
  'src/theme/buildLuxColors.ts',
  'src/theme/luxTokens.ts',
  'src/utils/imageCachePolicy.ts',
  'src/utils/playlistCoverQueue.ts',
  'src/utils/musicUrlCache.ts',
  'src/utils/listenListLimit.ts',
  'src/utils/playlistCoverMap.ts',
  'src/utils/localSongRows.ts',
  'src/utils/cachedSongMetadata.ts',
  'src/utils/kwMusicInfoParse.ts',
  'src/utils/localSongCoverMatch.ts',
  'src/utils/homeBootGate.ts',
  'src/utils/cacheLimitSteps.ts',
  'src/utils/playHistory/types.ts',
  'src/utils/playHistory/threshold.ts',
  'src/utils/playHistory/session.ts',
  'src/utils/playHistory/merge.ts',
  'src/utils/playHistory/range.ts',
  'src/utils/playHistory/chartMode.ts',
  'src/utils/playHistory/statsPageStyle.ts',
  'src/utils/playHistory/chartLayout.ts',
  'src/utils/playHistory/backup.ts',
  'src/utils/playHistory/wire.ts',
  'src/plugins/sync/deviceIdentity.ts',
  'src/plugins/sync/client/credentials.ts',
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
const colorMath = require(join(outDir, 'src/theme/luxColorMath.js'))
const styleCache = require(join(outDir, 'src/theme/luxStyleCache.js'))

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
const musicUrlCache = require(join(outDir, 'src/utils/musicUrlCache.js'))
const listenListLimit = require(join(outDir, 'src/utils/listenListLimit.js'))
const coverMap = require(join(outDir, 'src/utils/playlistCoverMap.js'))
const localSongRows = require(join(outDir, 'src/utils/localSongRows.js'))
const cachedMetadata = require(join(outDir, 'src/utils/cachedSongMetadata.js'))
const kwMusicInfoParse = require(join(outDir, 'src/utils/kwMusicInfoParse.js'))
const localCover = require(join(outDir, 'src/utils/localSongCoverMatch.js'))
const homeBoot = require(join(outDir, 'src/utils/homeBootGate.js'))
const cacheSteps = require(join(outDir, 'src/utils/cacheLimitSteps.js'))
const playThreshold = require(join(outDir, 'src/utils/playHistory/threshold.js'))
const playSession = require(join(outDir, 'src/utils/playHistory/session.js'))
const playMerge = require(join(outDir, 'src/utils/playHistory/merge.js'))
const playRange = require(join(outDir, 'src/utils/playHistory/range.js'))
const playChartMode = require(join(outDir, 'src/utils/playHistory/chartMode.js'))
const playStatsPageStyle = require(join(outDir, 'src/utils/playHistory/statsPageStyle.js'))
const playChartLayout = require(join(outDir, 'src/utils/playHistory/chartLayout.js'))
const playBackup = require(join(outDir, 'src/utils/playHistory/backup.js'))
const playWire = require(join(outDir, 'src/utils/playHistory/wire.js'))
const deviceIdentity = require(join(outDir, 'src/plugins/sync/deviceIdentity.js'))
const syncCredentials = require(join(outDir, 'src/plugins/sync/client/credentials.js'))

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
  assert.deepEqual(Object.keys(lux.luxThemeRegistry), ['lime', 'mist_blue', 'sakura', 'lavender', 'oat_milk', 'ink_night'])
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

test('shared style cache refreshes on theme change and keeps one slot', () => {
  const read = styleCache.memoLuxColors(colors => ({ bg: colors.bg.app, sheet: {} }))
  const limeStyles = read(lux.limeColors)
  const mistStyles = read(lux.mistBlueTheme.colors)
  assert.notEqual(limeStyles, mistStyles)
  assert.equal(mistStyles.bg, '#eef3f9')
  assert.equal(read(lux.mistBlueTheme.colors), mistStyles)
  const limeAgain = read(lux.limeColors)
  assert.notEqual(limeAgain, limeStyles)
  assert.equal(limeAgain.bg, '#eef0fb')
  assert.equal(read(lux.limeColors), limeAgain)
})

test('the other five themes fill every slot and stay readable', () => {
  const seeds = {
    mist_blue: { bg: '#eef3f9', accent: '#2563eb', on: '#ffffff', secondary: '#556274', strong: '#0f172a', mode: 'light' },
    sakura: { bg: '#faf0f3', accent: '#db2777', on: '#ffffff', secondary: '#7a646e', strong: '#1c1216', mode: 'light' },
    lavender: { bg: '#f3f0fb', accent: '#7c5cbf', on: '#ffffff', secondary: '#716a82', strong: '#16131f', mode: 'light' },
    oat_milk: { bg: '#f6f1ea', accent: '#a65d28', on: '#ffffff', secondary: '#6f6458', strong: '#1c1712', mode: 'light' },
    ink_night: { bg: '#12141c', accent: '#c8e600', on: '#111827', secondary: '#a0a6b8', strong: '#f3f4f8', mode: 'dark' },
  }
  const backgroundPaths = [
    ['bg', 'app'], ['bg', 'plain'],
    ['surface', 'card'], ['surface', 'muted'], ['surface', 'placeholder'], ['surface', 'search'], ['surface', 'cancel'], ['surface', 'neutral'],
    ['line', 'divider'],
    ['iconWrap', 'orange'], ['iconWrap', 'green'], ['iconWrap', 'purple'], ['iconWrap', 'amber'], ['iconWrap', 'red'],
    ['queue', 'current'], ['queue', 'close'],
    ['coverFallback', 'top'], ['coverFallback', 'middle'], ['coverFallback', 'glow'], ['coverFallback', 'bottom'],
  ]
  for (const id of lux.LUX_THEME_IDS) {
    const theme = lux.luxThemeRegistry[id]
    assert.equal(theme.id, id)
    assert.equal(lux.listLuxColorValues(theme.colors).length, 227)
    if (id === 'lime') continue
    const seed = seeds[id]
    const colors = theme.colors
    assert.equal(theme.mode, seed.mode)
    assert.equal(colors.bg.app, seed.bg)
    assert.equal(colors.accent.primary, seed.accent)
    assert.equal(colors.ink.onAccent, seed.on)
    assert.equal(colors.ink.secondary, seed.secondary)
    assert.equal(colors.ink.strong, seed.strong)
    assert.equal(colors.surface.card === '#ffffff', seed.mode === 'light')
    assert.ok(colorMath.contrastRatio(colors.ink.strong, colors.bg.app) >= 4.5, id + ' body on page')
    assert.ok(colorMath.contrastRatio(colors.ink.list, colors.bg.app) >= 4.5, id + ' list on page')
    assert.ok(colorMath.contrastRatio(colors.ink.list, colors.surface.card) >= 4.5, id + ' list on card')
    assert.ok(colorMath.contrastRatio(colors.ink.secondary, colors.bg.app) >= 3, id + ' secondary on page')
    assert.ok(colorMath.contrastRatio(colors.ink.secondary, colors.surface.card) >= 3, id + ' secondary on card')
    assert.ok(colorMath.contrastRatio(colors.ink.onAccent, colors.accent.primary) >= 4.5, id + ' on accent')
    if (seed.mode === 'dark') {
      for (const path of backgroundPaths) {
        let value = colors
        for (const key of path) value = value[key]
        assert.equal(value.toLowerCase() === '#ffffff', false, path.join('.'))
        assert.ok(colorMath.relativeLuminance(value) < 0.35, path.join('.') + ' ' + value)
      }
      assert.equal(colors.glass.fill95.includes('255,255,255'), false)
      assert.equal(colors.ink.icon.toLowerCase() === '#000000', false)
    }
  }
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
  assert.equal(cachePolicy.DEFAULT_UNPINNED_IMAGE_CACHE_BYTES, 256 * 1024 * 1024)
})

test('unpinned images evict oldest until both the count and the byte cap fit', () => {
  const pinned = new Set(['keep'])
  const files = [
    { name: 'old', size: 100, accessedAt: 1 },
    { name: 'keep', size: 10000, accessedAt: 0 },
    { name: 'mid', size: 50, accessedAt: 2 },
    { name: 'new', size: 80, accessedAt: 3 },
    { name: 'skip.tmp', size: 999, accessedAt: 0 },
  ]
  assert.deepEqual(cachePolicy.selectUnpinnedEvictions(files, pinned, 10, 100), ['old', 'mid'])
  assert.deepEqual(cachePolicy.selectUnpinnedEvictions(files, pinned, 1), ['old', 'mid'])
})

test('saved playback urls expire by source unless the file is local or the audio is cached', () => {
  const legacy = musicUrlCache.parseMusicUrlRecord(' https://music.example/a.mp3 ')
  assert.equal(legacy.savedAt, 0)
  assert.equal(legacy.url, 'https://music.example/a.mp3')
  assert.equal(musicUrlCache.isMusicUrlFresh(legacy, 'wy', 1000), false)
  assert.equal(musicUrlCache.isMusicUrlFresh({ url: 'file:///song.mp3', savedAt: 0 }, 'local', 1), true)
  assert.equal(musicUrlCache.isMusicUrlFresh({ url: 'content://media/1', savedAt: 0 }, 'local', 1), true)
  assert.equal(musicUrlCache.musicUrlTtlMs('wy'), 20 * 60 * 1000)
  assert.equal(musicUrlCache.musicUrlTtlMs('tx'), 2 * 60 * 60 * 1000)
  assert.equal(musicUrlCache.musicUrlTtlMs('kg'), 2 * 60 * 60 * 1000)
  assert.equal(musicUrlCache.musicUrlTtlMs('kw'), 60 * 60 * 1000)
  assert.equal(musicUrlCache.musicUrlTtlMs('mg'), 60 * 60 * 1000)
  assert.equal(musicUrlCache.musicUrlTtlMs('local'), 30 * 60 * 1000)
  assert.equal(musicUrlCache.musicUrlTtlMs('other'), musicUrlCache.DEFAULT_MUSIC_URL_TTL_MS)
  const stale = { url: 'https://music.example/a.mp3', savedAt: 0 }
  assert.equal(musicUrlCache.decideMusicUrlReuse({
    record: stale, source: 'wy', now: 10, isRefresh: false, audioCached: true,
  }), 'use')
  assert.equal(musicUrlCache.decideMusicUrlReuse({
    record: stale, source: 'wy', now: 10, isRefresh: true, audioCached: true,
  }), 'refresh')
  assert.equal(musicUrlCache.decideMusicUrlReuse({
    record: { url: 'file:///song.mp3', savedAt: 0 }, source: 'local', now: 10, isRefresh: true, audioCached: false,
  }), 'use')
  assert.equal(musicUrlCache.decideMusicUrlReuse({
    record: null, source: 'wy', now: 10, isRefresh: false, audioCached: true,
  }), 'refresh')
  const savedAt = 1_000
  assert.equal(musicUrlCache.decideMusicUrlReuse({
    record: { url: 'https://music.example/a.mp3', savedAt },
    source: 'wy',
    now: savedAt + (19 * 60 * 1000),
    isRefresh: false,
    audioCached: false,
  }), 'use')
  assert.equal(musicUrlCache.decideMusicUrlReuse({
    record: { url: 'https://music.example/a.mp3', savedAt },
    source: 'wy',
    now: savedAt + (21 * 60 * 1000),
    isRefresh: false,
    audioCached: false,
  }), 'refresh')
})

test('listen list drops the earliest songs and leaves a short list alone', () => {
  const songs = Array.from({ length: 53 }, (_, index) => ({ id: String(index) }))
  assert.equal(listenListLimit.LISTEN_LIST_LIMIT, 50)
  assert.deepEqual(listenListLimit.selectOldestListenIds(songs, 'top'), ['50', '51', '52'])
  assert.deepEqual(listenListLimit.selectOldestListenIds(songs, 'bottom'), ['0', '1', '2'])
  assert.deepEqual(listenListLimit.selectOldestListenIds(songs.slice(0, 50), 'top'), [])
  assert.deepEqual(listenListLimit.selectOldestListenIds([{ id: 'a' }, { id: 'a' }, { id: '' }], 'bottom', 1), ['a'])
})

test('prefetch queue stays fast for a few thousand songs', () => {
  const queue = new coverQueue.PlaylistCoverQueue()
  const started = Date.now()
  for (let index = 0; index < 4000; index++) {
    const lane = index % 5 == 0 ? 'visible' : index % 3 == 0 ? 'playlist' : 'background'
    queue.enqueue(`song-${index}`, lane)
  }
  queue.enqueue('song-1', 'background')
  assert.equal(queue.size(), 4000)
  let taken = 0
  while (queue.take(Date.now())) taken += 1
  const elapsed = Date.now() - started
  assert.equal(taken, 4000)
  assert.equal(queue.size(), 0)
  assert.ok(elapsed < 1000, `elapsed ${elapsed}`)
  queue.enqueue('later', 'background', 0)
  const job = queue.take(0)
  queue.fail(job, 0)
  queue.forget('later')
  assert.equal(queue.size(), 0)
  assert.equal(queue.take(10_000), null)
})

test('lime token paths still match the inventory table', () => {
  const doc = readFileSync(join(root, 'docs/theme-tokens.md'), 'utf8')
  const rows = [...doc.matchAll(/^\| `([^`]+)` \| `([^`]+)` \|/gm)]
  assert.ok(rows.length >= 200)
  const resolvePath = tokenPath => {
    const parts = tokenPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
    let current = lux.limeColors
    for (const part of parts) current = current[part]
    return current
  }
  for (const row of rows) {
    assert.equal(resolvePath(row[1]), row[2], row[1])
  }
})

test('local songs page keeps device files and only complete cached audio', () => {
  const rows = localSongRows.mergeLocalSongRows([
    { id: '/music/a.mp3', source: 'local', size: 1200 },
    { id: '/music/a.mp3', source: 'local', size: 1200 },
  ], [
    { cacheKey: 'local_/music/a.mp3_local', cachedBytes: 1200, fullyCached: true, source: 'local', id: '/music/a.mp3' },
    { cacheKey: 'wy_wy_88_128k', cachedBytes: 1000, fullyCached: true, source: null, id: null },
    { cacheKey: 'wy_wy_88_320k', cachedBytes: 4000, fullyCached: true, source: null, id: null },
    { cacheKey: 'wy_wy_88_flac', cachedBytes: 9000, fullyCached: false, source: null, id: null },
    { cacheKey: 'kw_kw_569249599_128k', cachedBytes: 1800, fullyCached: false, source: null, id: null },
    { cacheKey: 'orphan', cachedBytes: 10, fullyCached: false, source: null, id: null },
  ])
  assert.deepEqual(rows.map(row => row.rowKey), [
    'device:local_/music/a.mp3',
    'cache:wy_wy_88',
  ])
  assert.equal(rows[0].origin, 'device')
  assert.equal(rows[0].cacheKeys.length, 0)
  assert.equal(rows[1].playable, true)
  assert.equal(rows[1].fullyCached, true)
  assert.equal(rows[1].source, 'wy')
  assert.equal(rows[1].id, 'wy_88')
  assert.equal(rows[1].quality, '320k')
  assert.equal(rows[1].cacheKey, 'wy_wy_88_320k')
  assert.deepEqual(rows[1].cacheKeys, ['wy_wy_88_128k', 'wy_wy_88_320k', 'wy_wy_88_flac'])
  assert.equal(rows.some(row => row.fullyCached == false), false)
  assert.equal(rows.some(row => String(row.cacheKey).includes('569249599')), false)
  assert.deepEqual(localSongRows.cacheKeysForSong('wy', '88', ['128k']), ['wy_88_128k'])
  const usage = localSongRows.summarizeLocalSongUsage(rows)
  assert.equal(usage.count, 2)
  assert.equal(usage.deviceBytes, 1200)
  assert.equal(usage.cacheBytes, 4000)
  assert.equal(usage.totalBytes, 5200)
  assert.equal(localSongRows.summarizeLocalSongUsage([]).totalBytes, 0)
  assert.equal(localSongRows.summarizeLocalSongUsage([
    { origin: 'device', size: null },
    { origin: 'cache', size: 0 },
  ]).count, 2)
})

test('audio cache keys parse source, song id and quality', () => {
  const wy = localSongRows.parseAudioCacheKey('wy_wy_3339519499_128k')
  assert.equal(wy.source, 'wy')
  assert.equal(wy.id, 'wy_3339519499')
  assert.equal(wy.songmid, '3339519499')
  assert.equal(wy.quality, '128k')
  assert.equal(wy.hash, null)
  const kw = localSongRows.parseAudioCacheKey('kw_kw_569249599_128k')
  assert.equal(kw.source, 'kw')
  assert.equal(kw.id, 'kw_569249599')
  assert.equal(kw.songmid, '569249599')
  assert.equal(kw.quality, '128k')
  const tx = localSongRows.parseAudioCacheKey('tx_tx_003nOs2y3Duyij_flac24bit')
  assert.equal(tx.source, 'tx')
  assert.equal(tx.songmid, '003nOs2y3Duyij')
  assert.equal(tx.quality, 'flac24bit')
  const kg = localSongRows.parseAudioCacheKey('kg_321_abcdef_320k')
  assert.equal(kg.source, 'kg')
  assert.equal(kg.id, '321_abcdef')
  assert.equal(kg.songmid, '321')
  assert.equal(kg.hash, 'abcdef')
  assert.equal(kg.quality, '320k')
  const local = localSongRows.parseAudioCacheKey('local_/sdcard/Music/a_b.mp3_local')
  assert.equal(local.source, 'local')
  assert.equal(local.id, '/sdcard/Music/a_b.mp3')
  assert.equal(local.quality, 'local')
  assert.equal(localSongRows.parseAudioCacheKey('orphan'), null)
  assert.equal(localSongRows.parseAudioCacheKey('wy_wy_1'), null)
  assert.equal(localSongRows.fallbackCacheSongName('wy_wy_3339519499_128k'), '3339519499')
  assert.equal(localSongRows.fallbackCacheSongName('wy_wy_3339519499_128k').includes('wy_wy_'), false)
  assert.equal(localSongRows.fallbackCacheSongName('local_/sdcard/Music/a_b.mp3_local'), 'a_b')
})

test('cached song metadata follows list, history, store, fetch, then a readable fallback', () => {
  assert.deepEqual([...localSongRows.CACHED_META_LOOKUP_ORDER], [
    'userList', 'listenList', 'playHistory', 'metaStore', 'fetched', 'fallback',
  ])
  const key = 'wy_wy_3339519499_128k'
  const song = (name, source = 'wy', id = 'wy_3339519499', songmid = '3339519499') => ({
    id,
    source,
    name,
    singer: `${name} singer`,
    interval: '03:21',
    meta: { songId: songmid, albumName: 'album', picUrl: `https://img.example/${name}.jpg` },
  })
  const catalogs = {
    userLists: [song('from-user')],
    listenList: [song('from-listen')],
    playHistory: [song('from-history')],
    metaStore: [song('from-store')],
    keyedMeta: song('from-key'),
    fetched: song('from-fetch'),
  }
  assert.equal(localSongRows.resolveCachedSongMetadata({ cacheKey: key, ...catalogs }).via, 'userList')
  assert.equal(localSongRows.resolveCachedSongMetadata({ cacheKey: key, ...catalogs }).musicInfo.name, 'from-user')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    listenList: catalogs.listenList,
    playHistory: catalogs.playHistory,
    metaStore: catalogs.metaStore,
    keyedMeta: catalogs.keyedMeta,
    fetched: catalogs.fetched,
  }).via, 'listenList')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    userLists: [song('other-user', 'kw', 'kw_1', '1')],
    listenList: catalogs.listenList,
  }).musicInfo.name, 'from-listen')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    playHistory: catalogs.playHistory,
    keyedMeta: catalogs.keyedMeta,
    fetched: catalogs.fetched,
  }).via, 'playHistory')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    metaStore: catalogs.metaStore,
    fetched: catalogs.fetched,
  }).via, 'metaStore')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    keyedMeta: catalogs.keyedMeta,
    fetched: catalogs.fetched,
  }).musicInfo.name, 'from-key')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    fetched: catalogs.fetched,
  }).via, 'fetched')
  const bySongmid = song('by-mid', 'wy', 'different-id', '3339519499')
  const exact = song('exact-id')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    userLists: [bySongmid, exact],
  }).musicInfo.name, 'exact-id')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    userLists: [bySongmid],
  }).musicInfo.name, 'by-mid')
  const aligned = localSongRows.alignCachedSong(bySongmid, localSongRows.parseAudioCacheKey(key))
  assert.equal(aligned.name, 'by-mid')
  assert.equal(aligned.id, 'wy_3339519499')
  assert.equal(aligned.source, 'wy')
  assert.equal(localSongRows.alignCachedSong(exact, localSongRows.parseAudioCacheKey(key)), exact)
  const rawKey = song(key)
  const fallback = localSongRows.resolveCachedSongMetadata({
    cacheKey: key,
    userLists: [rawKey],
    keyedMeta: rawKey,
    fetched: rawKey,
    unknownName: '未知歌曲',
  })
  assert.equal(fallback.via, 'fallback')
  assert.equal(fallback.musicInfo.source, 'wy')
  assert.equal(fallback.musicInfo.name, '3339519499')
  assert.equal(fallback.musicInfo.name == key, false)
  assert.equal(fallback.musicInfo.interval, null)
  const unknown = localSongRows.resolveCachedSongMetadata({ cacheKey: 'not-a-key', unknownName: '未知歌曲' })
  assert.equal(unknown.via, 'fallback')
  assert.equal(unknown.musicInfo.name, '未知歌曲')
  assert.equal(unknown.musicInfo.name == 'not-a-key', false)
})

test('complete cache filter keeps one best full copy and drops partial songs', () => {
  const groups = localSongRows.groupCompleteCaches([
    { cacheKey: 'wy_wy_1_flac', cachedBytes: 9000, fullyCached: false, source: null, id: null },
    { cacheKey: 'wy_wy_1_128k', cachedBytes: 100, fullyCached: true, source: null, id: null },
    { cacheKey: 'wy_wy_1_320k', cachedBytes: 400, fullyCached: true, source: null, id: null },
    { cacheKey: 'tx_tx_003nOs2y3Duyij_128k', cachedBytes: 50, fullyCached: false, source: null, id: null },
    { cacheKey: 'kw_kw_9_flac24bit', cachedBytes: 10, fullyCached: true, source: null, id: null },
    { cacheKey: 'kw_kw_9_128k', cachedBytes: 9999, fullyCached: true, source: null, id: null },
    { cacheKey: 'mg_mg_7_128k', cachedBytes: 20, fullyCached: true, source: null, id: null },
    { cacheKey: 'mg_mg_7_128k', cachedBytes: 20, fullyCached: true, source: null, id: null },
  ])
  assert.deepEqual(groups.map(group => group.cacheKey), [
    'wy_wy_1_320k',
    'kw_kw_9_flac24bit',
    'mg_mg_7_128k',
  ])
  assert.equal(groups.every(group => group.fullyCached == true), true)
  assert.deepEqual(groups[0].cacheKeys, ['wy_wy_1_flac', 'wy_wy_1_128k', 'wy_wy_1_320k'])
  assert.deepEqual(groups[2].cacheKeys, ['mg_mg_7_128k'])
  const tied = localSongRows.groupCompleteCaches([
    { cacheKey: 'wy_wy_2_128k', cachedBytes: 10, fullyCached: true, source: null, id: null },
    { cacheKey: 'wy_wy_2_128k', cachedBytes: 80, fullyCached: true, source: 'wy', id: 'wy_2' },
  ])
  assert.equal(tied.length, 1)
  assert.equal(tied[0].cachedBytes, 80)
})

test('home boot is ready only when counts and covers are both ready', () => {
  assert.equal(homeBoot.homeBootIsReady({ countsReady: false, coversReady: false }), false)
  assert.equal(homeBoot.homeBootIsReady({ countsReady: true, coversReady: false }), false)
  assert.equal(homeBoot.homeBootIsReady({ countsReady: false, coversReady: true }), false)
  assert.equal(homeBoot.homeBootIsReady({ countsReady: true, coversReady: true }), true)
})

test('home boot does not wait past the splash hold when everything is already cached', () => {
  const input = { launchStartedAt: 0, preloadStartedAt: 0, readyAt: 80 }
  assert.equal(homeBoot.homeBootRevealAt(input), homeBoot.HOME_LAUNCH_HOLD_MS)
  assert.equal(homeBoot.homeBootExtraWaitMs(input), 0)
  assert.equal(homeBoot.homeCoverSettleAt(80, false), 80)
  assert.equal(homeBoot.HOME_BOOT_COVER_FADE_MS, presentation.COVER_FADE_MS)
})

test('home boot caps the extra wait after the splash hold', () => {
  const missed = { launchStartedAt: 0, preloadStartedAt: 3000, readyAt: null }
  assert.equal(homeBoot.homeBootRevealAt(missed), homeBoot.HOME_LAUNCH_HOLD_MS + homeBoot.HOME_BOOT_EXTRA_WAIT_MS)
  assert.equal(homeBoot.homeBootExtraWaitMs(missed), homeBoot.HOME_BOOT_EXTRA_WAIT_MS)
  const earlyBudget = { launchStartedAt: 0, preloadStartedAt: 0, readyAt: null }
  assert.equal(homeBoot.homeBootExtraWaitMs(earlyBudget), 0)
  const partial = { launchStartedAt: 0, preloadStartedAt: 2000, readyAt: null }
  assert.equal(homeBoot.homeBootExtraWaitMs(partial), 1000)
  const readyDuringExtra = { launchStartedAt: 0, preloadStartedAt: 3000, readyAt: 3700 }
  assert.equal(homeBoot.homeBootRevealAt(readyDuringExtra), 3700)
  assert.equal(homeBoot.homeBootExtraWaitMs(readyDuringExtra), 200)
  for (let preloadStartedAt = 0; preloadStartedAt <= 8000; preloadStartedAt += 250) {
    const extra = homeBoot.homeBootExtraWaitMs({ launchStartedAt: 0, preloadStartedAt, readyAt: null })
    assert.ok(extra >= 0 && extra <= homeBoot.HOME_BOOT_EXTRA_WAIT_MS)
    assert.ok(homeBoot.homeBootRevealAt({ launchStartedAt: 0, preloadStartedAt, readyAt: null }) >= homeBoot.HOME_LAUNCH_HOLD_MS)
  }
  assert.equal(homeBoot.homeCoverSettleAt(1000, true), 1000 + homeBoot.HOME_BOOT_COVER_FADE_MS)
})

test('home first-screen lists and unknown counts', () => {
  assert.deepEqual(homeBoot.selectHomeFirstListIds([
    { id: 'default' },
    { id: 'love' },
    { id: 'custom-a' },
    { id: 'custom-b' },
  ]), ['love', 'default', 'custom-a'])
  assert.equal(homeBoot.formatHomeDailyMeta('我的收藏', null, '0 首'), '我的收藏')
  assert.equal(homeBoot.formatHomeDailyMeta('我的收藏', 0, '0 首'), '我的收藏 · 0 首')
  assert.equal(homeBoot.formatHomeDailyMeta('我的收藏', 12, '12 首'), '我的收藏 · 12 首')
  const thumb = 'https://imge.kugou.com/stdmusic/240/a.jpg'
  const resolved = homeBoot.resolveHomeListCover([
    { source: 'kg', id: '1', picUrl: null, albumId: '9' },
  ], {
    mapped: () => ({ url: 'https://imge.kugou.com/stdmusic/400/a.jpg', thumbUrl: thumb }),
    isCached: () => false,
  })
  assert.equal(resolved, thumb)
  const cachedFull = 'https://p.example/full.jpg'
  assert.equal(homeBoot.resolveHomeListCover([
    { source: 'wy', id: '2', picUrl: cachedFull },
  ], {
    mapped: () => null,
    isCached: (url) => url == cachedFull,
  }), cachedFull)
  assert.deepEqual(homeBoot.collectHomeWarmUrls([null, cachedFull, '  ', cachedFull, thumb]), [cachedFull, thumb])
})

test('cache limit sliders snap to the existing steps and never label zero as 0 MB', () => {
  assert.deepEqual([...cacheSteps.AUDIO_CACHE_STEPS_MB], [0, 256, 512, 1024, 2048, 4096, 8192])
  assert.deepEqual([...cacheSteps.IMAGE_CACHE_STEPS], [200, 400, 800, 1200, 2000])
  assert.deepEqual(
    cacheSteps.AUDIO_CACHE_STEPS_MB.map(mb => cacheSteps.formatAudioCacheLimit(mb, '关闭')),
    ['关闭', '256MB', '512MB', '1GB', '2GB', '4GB', '8GB'],
  )
  assert.deepEqual(
    cacheSteps.AUDIO_CACHE_STEPS_MB.map(mb => cacheSteps.formatAudioCacheLimit(mb, 'Off')),
    ['Off', '256MB', '512MB', '1GB', '2GB', '4GB', '8GB'],
  )
  assert.equal(cacheSteps.formatAudioCacheLimit(0, '关闭'), '关闭')
  assert.equal(cacheSteps.formatAudioCacheLimit(-4, '关闭'), '关闭')
  assert.equal(cacheSteps.formatAudioCacheLimit(Number.NaN, '关闭'), '关闭')
  assert.equal(cacheSteps.formatAudioCacheLimit(0, '关闭').includes('MB'), false)
  assert.notEqual(cacheSteps.formatAudioCacheLimit(0, '关闭'), '0 MB')
  assert.notEqual(cacheSteps.formatAudioCacheLimit(0, '关闭'), '0MB')
  assert.deepEqual(cacheSteps.IMAGE_CACHE_STEPS.map(cacheSteps.formatImageCacheTick), ['200', '400', '800', '1200', '2000'])
  for (const tick of cacheSteps.IMAGE_CACHE_STEPS.map(cacheSteps.formatImageCacheTick)) {
    assert.equal(tick.includes('张'), false)
    assert.equal(tick.includes('張'), false)
  }

  assert.equal(cacheSteps.cacheStepRatio(3, 7), 0.5)
  assert.equal(cacheSteps.cacheStepRatio(1, 5), 0.25)
  assert.equal(cacheSteps.cacheStepRatio(0, 7), 0)
  assert.equal(cacheSteps.cacheStepRatio(6, 7), 1)
  assert.equal(cacheSteps.cacheStepRatio(4, 5), 1)

  // §10.2: tick center x === thumb x (same cacheStepRatio × trackWidth).
  // Mid steps must not use evenly spaced flex cells (1GB was left of its label).
  const trackW = 300
  assert.equal(cacheSteps.cacheTickCenterX(0, 7, trackW), 0)
  assert.equal(cacheSteps.cacheTickCenterX(3, 7, trackW), 150)
  assert.equal(cacheSteps.cacheTickCenterX(6, 7, trackW), 300)
  assert.equal(cacheSteps.cacheTickCenterX(3, 7, trackW), cacheSteps.cacheStepRatio(3, 7) * trackW)
  // Centered label when it fits; clamped at edges only.
  assert.equal(cacheSteps.cacheTickLabelLeft(3, 7, trackW, 40), 130)
  assert.equal(cacheSteps.cacheTickLabelLeft(0, 7, trackW, 40), 0)
  assert.equal(cacheSteps.cacheTickLabelLeft(6, 7, trackW, 40), 260)
  assert.equal(cacheSteps.cacheTickLabelLeft(3, 7, trackW, 0), 150)
  assert.equal(cacheSteps.cacheTickLabelLeft(1, 5, 200, 30), cacheSteps.cacheTickCenterX(1, 5, 200) - 15)
  // Unclamped mid-step: label center equals thumb center (±0.5px).
  for (let i = 1; i < 6; i++) {
    const labelW = 36
    const left = cacheSteps.cacheTickLabelLeft(i, 7, trackW, labelW)
    const thumbX = cacheSteps.cacheTickCenterX(i, 7, trackW)
    const labelCenter = left + labelW / 2
    assert.ok(Math.abs(labelCenter - thumbX) <= 0.5, `tick ${i} label center ${labelCenter} vs thumb ${thumbX}`)
  }
  assert.equal(cacheSteps.nearestCacheStepIndex(0, 7), 0)
  assert.equal(cacheSteps.nearestCacheStepIndex(1, 7), 6)
  assert.equal(cacheSteps.nearestCacheStepIndex(0.5, 7), 3)
  assert.equal(cacheSteps.nearestCacheStepIndex(Number.NaN, 7), 0)
  assert.equal(cacheSteps.cacheStepFromRatio(cacheSteps.AUDIO_CACHE_STEPS_MB, 0.5), 1024)
  assert.equal(cacheSteps.cacheStepFromRatio(cacheSteps.AUDIO_CACHE_STEPS_MB, 0), 0)
  assert.equal(cacheSteps.cacheStepFromRatio(cacheSteps.AUDIO_CACHE_STEPS_MB, 1), 8192)
  assert.equal(cacheSteps.indexForCacheStep(cacheSteps.AUDIO_CACHE_STEPS_MB, 1024), 3)
  assert.equal(cacheSteps.indexForCacheStep(cacheSteps.AUDIO_CACHE_STEPS_MB, 0), 0)
  assert.equal(cacheSteps.indexForCacheStep(cacheSteps.AUDIO_CACHE_STEPS_MB, 3000), 4)
  assert.equal(cacheSteps.indexForCacheStep(cacheSteps.AUDIO_CACHE_STEPS_MB, 100), 0)
  assert.equal(cacheSteps.indexForCacheStep(cacheSteps.IMAGE_CACHE_STEPS, 1000), 2)
  assert.equal(cacheSteps.resolveCacheStepCommit(cacheSteps.AUDIO_CACHE_STEPS_MB, 0.5, 1024), null)
  assert.equal(cacheSteps.resolveCacheStepCommit(cacheSteps.AUDIO_CACHE_STEPS_MB, 1, 1024), 8192)
  assert.equal(cacheSteps.resolveCacheStepCommit(cacheSteps.AUDIO_CACHE_STEPS_MB, 0, 1024), 0)
  assert.equal(cacheSteps.resolveCacheStepCommit(cacheSteps.AUDIO_CACHE_STEPS_MB, cacheSteps.cacheStepRatio(4, 7), 3000), 2048)
  assert.equal(cacheSteps.resolveCacheStepCommit(cacheSteps.IMAGE_CACHE_STEPS, cacheSteps.cacheStepRatio(1, 5), 400), null)
  assert.equal(cacheSteps.shouldCommitCacheStep(400, 400), false)
  assert.equal(cacheSteps.shouldCommitCacheStep(400, 800), true)
  for (let ratio = 0; ratio <= 1; ratio += 0.01) {
    const audio = cacheSteps.cacheStepFromRatio(cacheSteps.AUDIO_CACHE_STEPS_MB, ratio)
    const image = cacheSteps.cacheStepFromRatio(cacheSteps.IMAGE_CACHE_STEPS, ratio)
    assert.equal(cacheSteps.AUDIO_CACHE_STEPS_MB.includes(audio), true)
    assert.equal(cacheSteps.IMAGE_CACHE_STEPS.includes(image), true)
  }

  const readLang = (file) => JSON.parse(readFileSync(join(root, file), 'utf8').replace(/^\uFEFF/, ''))
  const zh = readLang('src/lang/zh-cn.json')
  const tw = readLang('src/lang/zh-tw.json')
  const en = readLang('src/lang/en-us.json')
  assert.equal(zh.setting_cache_audio_off, '关闭')
  assert.equal(zh.setting_cache_image_count, '{count} 张')
  assert.equal(tw.setting_cache_image_count, '{count} 張')
  assert.match(en.setting_cache_image_count, /\{count\}/)
  for (const id of lux.LUX_THEME_IDS) {
    const colors = lux.luxThemeRegistry[id].colors
    assert.ok(colorMath.contrastRatio(colors.ink.chipActive, colors.accent.soft) >= 4.5, id + ' chip')
    assert.notEqual(colors.accent.primary.toLowerCase(), colors.line.divider.toLowerCase(), id + ' track')
    assert.notEqual(colors.line.white.toLowerCase(), colors.accent.primary.toLowerCase(), id + ' thumb')
    if (id === 'ink_night') {
      assert.notEqual(colors.line.white.toLowerCase(), colors.surface.card.toLowerCase(), id + ' thumb on card')
    }
  }
})

test('play history counting, rolling range, merge, and backup', () => {
  assert.equal(playThreshold.playCountThresholdMs(null), 30_000)
  assert.equal(playThreshold.playCountThresholdMs(0), 30_000)
  assert.equal(playThreshold.playCountThresholdMs(40_000), 20_000)
  assert.equal(playThreshold.playCountThresholdMs(120_000), 30_000)
  assert.equal(playThreshold.qualifiesAsPlay(20_000, 40_000), true)
  assert.equal(playThreshold.qualifiesAsPlay(19_999, 40_000), false)
  assert.equal(playThreshold.qualifiesAsPlay(30_000, null), true)
  assert.equal(playThreshold.qualifiesAsPlay(0, 180_000), false)
  assert.equal(playThreshold.intervalToMs('1:30'), 90_000)
  assert.equal(playThreshold.intervalToMs('--/--'), null)

  let session = playSession.createListenSession(0)
  session = playSession.sampleListenSession(session, 1_000, 0, true)
  session = playSession.sampleListenSession(session, 2_000, 1_000, true)
  assert.equal(session.listenedMs, 1_000)
  const pausedAt = session.lastAt
  const pausedPos = session.lastPositionMs
  session = playSession.sampleListenSession(session, pausedAt + 5_000, pausedPos, false)
  assert.equal(session.listenedMs, 1_000)
  session = playSession.sampleListenSession(session, pausedAt + 6_000, pausedPos, true)
  session = playSession.sampleListenSession(session, pausedAt + 7_000, pausedPos + 30_000, true)
  assert.equal(session.listenedMs, 1_000)
  session = playSession.sampleListenSession(session, session.lastAt + 1_000, session.lastPositionMs + 2_000, true)
  assert.equal(session.listenedMs, 3_000)

  const song = { source: 'tx', songmid: 'm1', name: '晚风邮局', singer: '林小屿', img: 'https://example.test/a.jpg' }
  const record = (deviceId, startedAt, listenedMs, singer = song.singer) => ({
    id: `${deviceId}:${startedAt}`,
    deviceId,
    startedAt,
    endedAt: startedAt + listenedMs,
    listenedMs,
    song: { ...song, singer },
  })
  const now = new Date(2026, 9, 9, 20, 16, 0).getTime()
  const oct2 = new Date(2026, 9, 2, 12, 0, 0).getTime()
  const oct3 = new Date(2026, 9, 3, 12, 0, 0).getTime()
  const days7 = playRange.rangeBounds('days7', now)
  assert.equal(playRange.recordInBounds(record('dev', oct3, 60_000), days7), true)
  assert.equal(playRange.recordInBounds(record('dev', oct2, 60_000), days7), false)
  const starts = playRange.last7DayStarts(now)
  assert.equal(starts.length, 7)
  assert.equal(new Date(starts[0]).getDate(), 3)
  assert.equal(new Date(starts[6]).getDate(), 9)
  const monday = new Date(2026, 9, 5, 8, 0, 0).getTime()
  assert.ok(monday > starts[0])
  const stats = playRange.buildRangeStats([
    record('dev', oct3, 60_000),
    record('dev', oct2, 120_000),
    record('other', oct3 + 1000, 60_000, '林小屿、苏禾'),
  ], 'days7', now)
  assert.equal(stats.listenedMs, 120_000)
  assert.equal(stats.songs.reduce((n, song) => n + song.playCount, 0), 2)
  assert.equal(stats.chart[0].minutes, 2)
  assert.equal(stats.chart[6].isCurrent, true)
  assert.equal(stats.chart.filter(day => day.isCurrent).length, 1)
  assert.equal(stats.artists.some(artist => artist.name == '苏禾'), true)

  const todayMorning = new Date(2026, 9, 9, 8, 30, 0).getTime()
  const todayEvening = new Date(2026, 9, 9, 19, 10, 0).getTime()
  const todayStats = playRange.buildRangeStats([
    record('dev', todayMorning, 120_000),
    record('dev', todayEvening, 60_000),
    record('dev', oct3, 90_000),
  ], 'today', now)
  assert.equal(todayStats.chart.length, 12)
  assert.equal(todayStats.chart[0].kind, 'hour2')
  assert.equal(todayStats.chart[0].hour, 0)
  assert.equal(todayStats.chart[4].hour, 8)
  assert.equal(todayStats.chart[4].minutes, 2)
  assert.equal(todayStats.chart[9].hour, 18)
  assert.equal(todayStats.chart[9].minutes, 1)
  assert.equal(todayStats.chart.filter(bucket => bucket.isCurrent).length, 1)
  assert.equal(todayStats.chart.find(bucket => bucket.isCurrent).hour, 20)
  assert.equal(todayStats.listenedMs, 180_000)
  assert.equal(todayStats.songs.reduce((n, song) => n + song.playCount, 0), 2)

  const hourly = playRange.buildTodayHourlyBuckets([
    record('dev', todayMorning, 180_000),
  ], now)
  assert.equal(hourly.length, 12)
  assert.equal(hourly[4].minutes, 3)
  assert.equal(hourly.every(bucket => bucket.kind == 'hour2'), true)

  assert.equal(playChartMode.normalizeStatsChartMode('bar'), 'bar')
  assert.equal(playChartMode.normalizeStatsChartMode('line'), 'line')
  assert.equal(playChartMode.normalizeStatsChartMode('nope'), 'bar')
  assert.equal(playChartMode.normalizeStatsChartMode(null), 'bar')
  assert.equal(playChartMode.normalizeStatsChartMode(undefined), 'bar')
  assert.equal(playChartMode.DEFAULT_STATS_CHART_MODE, 'bar')
  // Persistence is normalize → storage string → normalize again.
  const savedMode = playChartMode.normalizeStatsChartMode('line')
  assert.equal(playChartMode.normalizeStatsChartMode(JSON.parse(JSON.stringify(savedMode))), 'line')
  const savedBar = playChartMode.normalizeStatsChartMode('unexpected')
  assert.equal(playChartMode.normalizeStatsChartMode(JSON.parse(JSON.stringify(savedBar))), 'bar')

  assert.equal(playStatsPageStyle.DEFAULT_STATS_PAGE_STYLE, 'magazine')
  assert.equal(playStatsPageStyle.normalizeStatsPageStyle('magazine'), 'magazine')
  assert.equal(playStatsPageStyle.normalizeStatsPageStyle('replay'), 'replay')
  assert.equal(playStatsPageStyle.normalizeStatsPageStyle('nope'), 'magazine')
  assert.equal(playStatsPageStyle.normalizeStatsPageStyle(null), 'magazine')
  assert.deepEqual(playStatsPageStyle.STATS_PAGE_STYLES, ['magazine', 'replay'])
  const savedReplay = playStatsPageStyle.normalizeStatsPageStyle('replay')
  assert.equal(playStatsPageStyle.normalizeStatsPageStyle(JSON.parse(JSON.stringify(savedReplay))), 'replay')

  const shorter = record('dev', 10, 30_000)
  const longer = record('dev', 10, 80_000)
  const other = record('phone', 20, 40_000)
  const merged = playMerge.mergePlayRecords([shorter, other], [longer, { id: '' }])
  assert.equal(merged.length, 2)
  assert.equal(merged.find(item => item.id == 'dev:10').listenedMs, 80_000)
  assert.deepEqual(merged.map(item => item.id), ['dev:10', 'phone:20'])

  const document = playBackup.buildLuxBackup({
    records: [shorter, longer, other],
    playlists: { defaultList: [{ id: 'default' }], loveList: [], userList: [{ id: 'mine' }] },
    settings: { 'common.langId': 'zh-cn' },
    exportedAt: 99,
  })
  const parsed = playBackup.parseLuxBackup(JSON.parse(JSON.stringify(document)))
  assert.equal(parsed.version, 1)
  assert.equal(parsed.playHistory.length, 2)
  assert.equal(parsed.playHistory.find(item => item.id == 'dev:10').listenedMs, 80_000)
  assert.equal(parsed.settings['common.langId'], 'zh-cn')
  const imported = playBackup.importPlayHistory([record('tablet', 30, 50_000)], parsed)
  assert.deepEqual(imported.map(item => item.id), ['dev:10', 'phone:20', 'tablet:30'])
  assert.equal(playBackup.parseLuxBackup({ type: 'luxDataBackup', version: 2 }), null)
  assert.equal(playBackup.parseLuxBackup({ ...document, playHistory: [{ id: 'bad' }] }), null)

  assert.equal(playWire.PLAY_HISTORY_PUSH, 'playHistory:push')
  assert.equal(playWire.PLAY_HISTORY_PULL, 'playHistory:pull')
  assert.equal(playWire.toWireRecord(longer).id, 'dev:10')
  assert.equal(playWire.toWireRecord({ ...longer, id: 'not-the-contract' }), null)
  const batches = playWire.chunkWireRecords([
    ...Array.from({ length: 500 }, (_, index) => record('dev', index + 1, 30_000)),
    { ...longer, id: 'bad' },
  ])
  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 500)
  const overflow = playWire.chunkWireRecords(Array.from({ length: 501 }, (_, index) => record('dev', index + 1, 30_000)))
  assert.equal(overflow.length, 2)
  assert.equal(overflow[0].length, 500)
  assert.equal(overflow[1].length, 1)
})

test('local song covers parse tags first and filenames as 歌手 - 歌名', () => {
  assert.deepEqual(localCover.parseLocalSongIdentity({
    title: '晴天',
    artist: '周杰伦',
    fileName: '/sdcard/Music/别的 - 歌.mp3',
  }), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    title: '周杰伦 - 晴天',
    artist: '周杰伦',
    fileName: '周杰伦 - 晴天.mp3',
  }), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    title: '',
    artist: '<unknown>',
    fileName: '/sdcard/Music/周杰伦 - 晴天.flac',
  }), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    title: '周杰伦 - 晴天',
    artist: '',
    fileName: '周杰伦 - 晴天.mp3',
  }), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    title: '晴天',
    artist: '未知歌手',
    fileName: '周杰伦 - 晴天.mp3',
  }), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    fileName: '周杰伦－晴天.mp3',
  }), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    fileName: '林小屿 – 晚风邮局.wav',
  }), { name: '晚风邮局', singer: '林小屿' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    fileName: '苏禾—海边来信.ogg',
  }), { name: '海边来信', singer: '苏禾' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    fileName: '01 - 周杰伦 - 晴天.mp3',
  }), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    fileName: '01.晴天.mp3',
  }), { name: '晴天', singer: '' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    fileName: '晴天.mp3',
  }), { name: '晴天', singer: '' })
  assert.deepEqual(localCover.parseLocalSongIdentity({
    title: '晴天',
    artist: '',
    fileName: '没有分隔.mp3',
  }), { name: '晴天', singer: '' })
  assert.equal(localCover.isUnknownArtist('<unknown>'), true)
  assert.equal(localCover.isUnknownArtist('周杰伦'), false)
})

test('local song cover matches require both name and singer', () => {
  const query = { name: '晴天', singer: '周杰伦' }
  assert.equal(localCover.isLocalCoverMatch(query, { name: '晴天', singer: '周杰伦' }), true)
  assert.equal(localCover.isLocalCoverMatch(query, { name: '晴天!', singer: '周杰伦' }), true)
  assert.equal(localCover.isLocalCoverMatch(
    { name: 'Love Story', singer: 'Taylor Swift' },
    { name: 'love story', singer: 'taylor swift' },
  ), true)
  assert.equal(localCover.isLocalCoverMatch(
    { name: '晴天', singer: '周杰伦、方文山' },
    { name: '晴天', singer: '周杰伦' },
  ), true)
  assert.equal(localCover.isLocalCoverMatch(query, { name: '雨天', singer: '周杰伦' }), false)
  assert.equal(localCover.isLocalCoverMatch(query, { name: '晴天', singer: '林俊杰' }), false)
  assert.equal(localCover.isLocalCoverMatch(query, { name: '晴天 (Live)', singer: '周杰伦' }), false)
  assert.equal(localCover.isLocalCoverMatch({ name: '晴天', singer: '' }, { name: '晴天', singer: '周杰伦' }), false)
  assert.equal(localCover.isLocalCoverMatch(query, { name: '', singer: '周杰伦' }), false)
  assert.equal(localCover.isLocalCoverMatch(query, { name: '晴天', singer: '' }), false)
  const ranked = localCover.coverMatchScore(query, { name: '晴天', singer: '周杰伦' })
  assert.ok(ranked > localCover.coverMatchScore(query, { name: '雨天', singer: '周杰伦' }))
  assert.equal(localCover.coverMatchScore(query, { name: '七里香', singer: '周杰伦' }), 0)
})

test('local song cover cache keeps hits and expires misses', () => {
  const now = 1_700_000_000_000
  assert.equal(localCover.decideLocalCoverCache(null, now), 'lookup')
  assert.equal(localCover.decideLocalCoverCache({ url: 'https://img.example/a.jpg', savedAt: now - 86_400_000 }, now), 'use')
  assert.equal(localCover.decideLocalCoverCache({ url: null, savedAt: now - 1000 }, now), 'skip')
  assert.equal(localCover.decideLocalCoverCache({
    url: null,
    savedAt: now - localCover.LOCAL_COVER_NEGATIVE_TTL_MS,
  }, now), 'lookup')
  assert.equal(localCover.decideLocalCoverCache({ url: null, savedAt: now + 1000 }, now), 'lookup')
  assert.equal(localCover.LOCAL_COVER_NEGATIVE_TTL_MS, 6 * 60 * 60 * 1000)
  const raw = localCover.serializeLocalCoverCache({
    '/sdcard/Music/a.mp3': { url: 'https://img.example/a.jpg', savedAt: now },
    '/sdcard/Music/b.mp3': { url: null, savedAt: now },
    '/sdcard/Music/old.mp3': { url: null, savedAt: now - localCover.LOCAL_COVER_NEGATIVE_TTL_MS - 1 },
  })
  const restored = localCover.parseLocalCoverCache(raw)
  assert.equal(restored['/sdcard/Music/a.mp3'].url, 'https://img.example/a.jpg')
  assert.equal(restored['/sdcard/Music/b.mp3'].url, null)
  const pruned = localCover.pruneLocalCoverCache(restored, now)
  assert.deepEqual(Object.keys(pruned), ['/sdcard/Music/a.mp3', '/sdcard/Music/b.mp3'])
  assert.deepEqual(localCover.parseLocalCoverCache('not json'), {})
  assert.deepEqual(localCover.parseLocalCoverCache(null), {})
  assert.deepEqual(localCover.parseLocalCoverCache(JSON.stringify({
    version: 1,
    entries: { '  ': { url: 'https://img.example/a.jpg', savedAt: now }, bad: { url: '', savedAt: now } },
  })), {})
})

test('sync device UUID sets the version and variant without altering its random bytes', () => {
  const bytes = Uint8Array.from({ length: 16 }, (_, index) => index)
  const original = [...bytes]
  assert.equal(deviceIdentity.uuidV4FromBytes(bytes), '00010203-0405-4607-8809-0a0b0c0d0e0f')
  assert.deepEqual([...bytes], original)
  assert.equal(deviceIdentity.uuidV4FromBytes(Array(16).fill(255)), 'ffffffff-ffff-4fff-bfff-ffffffffffff')
  for (const invalid of [[], Array(15).fill(0), Array(17).fill(0), [...Array(15).fill(0), -1], [...Array(15).fill(0), 256], [...Array(15).fill(0), 1.5]]) {
    assert.throws(() => deviceIdentity.uuidV4FromBytes(invalid))
  }
})

test('simultaneous sync logins receive one device UUID only after it is persisted', async() => {
  const deviceId = '00010203-0405-4607-8809-0a0b0c0d0e0f'
  let stored = null
  let readCount = 0
  let createCount = 0
  let writeCount = 0
  let releasedCount = 0
  let beginWrite
  let finishWrite
  const writeStarted = new Promise(resolve => { beginWrite = resolve })
  const writeAllowed = new Promise(resolve => { finishWrite = resolve })
  const storage = {
    read: async() => { readCount++; return stored },
    create: async() => { createCount++; return deviceId },
    write: async(value) => {
      writeCount++
      beginWrite()
      await writeAllowed
      stored = value
    },
  }
  const getDeviceId = deviceIdentity.createPersistedDeviceIdGetter(storage)
  const requests = Array.from({ length: 3 }, async() => {
    const result = await getDeviceId()
    releasedCount++
    return result
  })
  await writeStarted
  assert.equal(stored, null)
  assert.equal(releasedCount, 0)
  assert.equal(readCount, 1)
  assert.equal(createCount, 1)
  assert.equal(writeCount, 1)
  finishWrite()
  assert.deepEqual(await Promise.all(requests), [deviceId, deviceId, deviceId])
  assert.equal(stored, deviceId)
  assert.equal(await getDeviceId(), deviceId)
  const afterRestart = deviceIdentity.createPersistedDeviceIdGetter(storage)
  assert.equal(await afterRestart(), deviceId)
  assert.equal(createCount, 1)
  assert.equal(writeCount, 1)
})

test('sync identity read failures never create a replacement UUID', async() => {
  const deviceId = '00010203-0405-4607-8809-0a0b0c0d0e0f'
  const readError = new Error('storage unavailable')
  let reads = 0
  const getDeviceId = deviceIdentity.createPersistedDeviceIdGetter({
    read: async() => {
      if (++reads == 1) throw readError
      return deviceId
    },
    create: async() => assert.fail('a failed read must not create a new identity'),
    write: async() => assert.fail('a failed read must not overwrite the existing identity'),
  })
  await assert.rejects(getDeviceId(), error => error === readError)
  assert.equal(await getDeviceId(), deviceId)
  assert.equal(reads, 2)
})

test('sync identity write failures do not expose an unpersisted UUID and retry the same value', async() => {
  const deviceId = '00010203-0405-4607-8809-0a0b0c0d0e0f'
  const writeError = new Error('disk full')
  let stored = null
  let creates = 0
  const attemptedWrites = []
  const getDeviceId = deviceIdentity.createPersistedDeviceIdGetter({
    read: async() => stored,
    create: async() => { creates++; return deviceId },
    write: async(value) => {
      attemptedWrites.push(value)
      if (attemptedWrites.length == 1) throw writeError
      stored = value
    },
  })
  await assert.rejects(getDeviceId(), error => error === writeError)
  assert.equal(stored, null)
  assert.equal(await getDeviceId(), deviceId)
  assert.equal(stored, deviceId)
  assert.equal(creates, 1)
  assert.deepEqual(attemptedWrites, [deviceId, deviceId])
})

test('invalid persisted or generated sync identities fail without overwriting storage', async() => {
  for (const saved of ['', 'corrupt-value', '00010203-0405-1607-8809-0a0b0c0d0e0f']) {
    const getDeviceId = deviceIdentity.createPersistedDeviceIdGetter({
      read: async() => saved,
      create: async() => assert.fail('do not rotate a corrupt persisted identity'),
      write: async() => assert.fail('do not overwrite a corrupt persisted identity'),
    })
    await assert.rejects(getDeviceId(), /Invalid saved sync device ID/)
  }
  const getInvalidDeviceId = deviceIdentity.createPersistedDeviceIdGetter({
    read: async() => null,
    create: async() => 'not-a-uuid',
    write: async() => assert.fail('do not persist an invalid generated identity'),
  })
  await assert.rejects(getInvalidDeviceId(), /Invalid generated sync device ID/)
})

test('both sync credential requests include the stable installation identity', () => {
  const deviceId = '00010203-0405-4607-8809-0a0b0c0d0e0f'
  assert.deepEqual(syncCredentials.buildLuxKeyRequest(deviceId, 'My phone'), {
    deviceId,
    deviceName: 'My phone',
    platform: 'lux_music_mobile',
  })
  assert.deepEqual(syncCredentials.buildLuxKeyRequest(deviceId, 'My phone', 'saved-client'), {
    deviceId,
    deviceName: 'My phone',
    platform: 'lux_music_mobile',
    clientId: 'saved-client',
  })
  const message = syncCredentials.buildLxAuthMessage('lx-music auth::', 'public-key', 'My phone', deviceId)
  const lines = message.split('\n')
  assert.deepEqual(lines, ['lx-music auth::', 'public-key', 'My phone', 'lx_music_mobile', deviceId])
  // Existing LX servers read the first four lines by position.
  assert.equal(lines.slice(0, 4).join('\n'), 'lx-music auth::\npublic-key\nMy phone\nlx_music_mobile')
  const multilineName = syncCredentials.buildLxAuthMessage('lx-music auth::', 'public-key', 'My\r\nphone', deviceId).split('\n')
  assert.equal(multilineName.length, 5)
  assert.equal(multilineName[2], 'My  phone')
  assert.equal(multilineName[4], deviceId)
})

test('sync credential fallback distinguishes rejection from network and server failures', () => {
  const rejected = (code, text) => syncCredentials.isKeyRejection(code, text, 'Auth failed', 'Blocked IP')
  assert.equal(rejected(401, ''), true)
  assert.equal(rejected(403, 'Forbidden'), true)
  assert.equal(rejected(400, 'Auth failed'), true)
  assert.equal(rejected(200, 'Auth failed'), true)
  for (const code of [200, 400, 401, 403, 429, 500, 502, 503]) {
    assert.equal(rejected(code, 'Blocked IP'), false, `blocked IP response ${code}`)
  }
  for (const code of [429, 500, 502, 503]) {
    assert.equal(rejected(code, 'Auth failed'), false, `transient response ${code}`)
  }
  assert.equal(rejected(200, 'encrypted hello'), false)
  assert.equal(rejected(404, 'Not found'), false)
})

test('new sync credentials are not released before the local save succeeds', async() => {
  const fresh = { clientId: 'new-client', key: 'new-key', serverName: 'Server' }
  let startSave
  let finishSave
  let released = false
  const saving = new Promise(resolve => { startSave = resolve })
  const saveAllowed = new Promise(resolve => { finishSave = resolve })
  const result = syncCredentials.reuseOrRequestKey({
    saved: null,
    verify: async() => assert.fail('there is no saved key to verify'),
    request: async(previousClientId) => {
      assert.equal(previousClientId, undefined)
      return fresh
    },
    save: async(key) => {
      assert.deepEqual(key, fresh)
      startSave()
      await saveAllowed
    },
  }).then(key => { released = true; return key })
  await saving
  assert.equal(released, false)
  finishSave()
  assert.deepEqual(await result, fresh)

  const storageError = new Error('cannot save credentials')
  await assert.rejects(syncCredentials.reuseOrRequestKey({
    saved: null,
    verify: async() => assert.fail('there is no saved key to verify'),
    request: async() => fresh,
    save: async() => { throw storageError },
  }), error => error === storageError)
})

test('sync reconnect, re-login, restart and server switching reuse each saved key', async() => {
  let stored = null
  let requests = 0
  let verifications = 0
  const storage = {
    read: async() => stored == null ? null : JSON.parse(stored),
    write: async(keys) => { stored = JSON.stringify(keys) },
    remove: async() => { stored = null },
  }
  let store = syncCredentials.createCredentialStore(storage)
  const connect = async(serverId, mode = 'lux', accountId = 'alice') => {
    const id = syncCredentials.credentialStorageKey(serverId, mode, accountId)
    return syncCredentials.reuseOrRequestKey({
      saved: await store.get(id),
      verify: async(key) => {
        verifications++
        assert.equal(key.serverName, serverId)
      },
      request: async(previousClientId) => {
        assert.equal(previousClientId, undefined)
        requests++
        return { clientId: `client-${requests}`, key: `key-${requests}`, serverName: serverId }
      },
      save: async(key) => store.set(id, key),
    })
  }
  const firstServer = await connect('server-a')
  assert.deepEqual(await connect('server-a'), firstServer)
  assert.deepEqual(await connect('server-a'), firstServer)
  const secondServer = await connect('server-b')
  assert.notEqual(secondServer.clientId, firstServer.clientId)
  assert.deepEqual(await connect('server-a'), firstServer)
  // A recreated store has no in-memory keys, as after an app restart.
  store = syncCredentials.createCredentialStore(storage)
  assert.deepEqual(await connect('server-b'), secondServer)
  assert.deepEqual(await connect('server-a'), firstServer)
  assert.equal(requests, 2)
  assert.equal(verifications, 5)
  const otherAccount = await connect('server-a', 'lux', 'bob')
  const lxAccount = await connect('server-a', 'lx', 'alice')
  assert.notEqual(otherAccount.clientId, firstServer.clientId)
  assert.notEqual(lxAccount.clientId, firstServer.clientId)
  assert.deepEqual(await connect('server-a'), firstServer)
  assert.equal(requests, 4)
})

test('rejected sync credentials request a replacement once using the old client ID', async() => {
  const old = { clientId: 'saved-client', key: 'revoked-key', serverName: 'Server' }
  const fresh = { ...old, key: 'replacement-key' }
  const events = []
  const result = await syncCredentials.reuseOrRequestKey({
    saved: old,
    verify: async(key) => {
      assert.deepEqual(key, old)
      events.push('verify')
      throw new syncCredentials.CredentialRejectedError('Auth failed')
    },
    request: async(previousClientId) => {
      assert.equal(previousClientId, old.clientId)
      events.push('request')
      return fresh
    },
    save: async(key) => {
      assert.deepEqual(key, fresh)
      events.push('save')
    },
  })
  assert.deepEqual(result, fresh)
  assert.deepEqual(events, ['verify', 'request', 'save'])
})

test('saved sync keys survive transient verification errors without requesting credentials', async() => {
  const saved = { clientId: 'saved-client', key: 'saved-key', serverName: 'Server' }
  for (const message of ['Network request failed', 'Timed out', 'HTTP 500', 'HTTP 429', 'Blocked IP', 'Auth failed']) {
    const verificationError = new Error(message)
    await assert.rejects(syncCredentials.reuseOrRequestKey({
      saved,
      verify: async() => { throw verificationError },
      request: async() => assert.fail(`must not replace a saved key after ${message}`),
      save: async() => assert.fail(`must not overwrite a saved key after ${message}`),
    }), error => error === verificationError)
  }
})

test('credential request failures propagate once without saving or repeated retries', async() => {
  const requestError = new Error('server unavailable')
  let requests = 0
  await assert.rejects(syncCredentials.reuseOrRequestKey({
    saved: { clientId: 'old-client' },
    verify: async() => { throw new syncCredentials.CredentialRejectedError('Auth failed') },
    request: async(previousClientId) => {
      assert.equal(previousClientId, 'old-client')
      requests++
      throw requestError
    },
    save: async() => assert.fail('no credentials were received'),
  }), error => error === requestError)
  assert.equal(requests, 1)
})

test('credential storage scopes cannot collide between servers, modes or accounts', () => {
  const identities = [
    ['server-a', 'lux', 'alice'],
    ['server-b', 'lux', 'alice'],
    ['server-a', 'lx', 'alice'],
    ['server-a', 'lux', 'bob'],
    ['server-a:lux', 'lux', 'bob'],
    ['server-a', 'lux', 'lux:bob'],
    ['["server-a","lux","alice"]', 'lux', 'alice'],
  ]
  const keys = identities.map(args => syncCredentials.credentialStorageKey(...args))
  assert.equal(new Set(keys).size, identities.length)
})

test('Lux credential migration reuses only the selected account and reconciles unowned legacy IDs', () => {
  const scoped = { clientId: 'scoped-alice', key: 'scoped-key', luxUserId: 'alice' }
  const sameOwner = { clientId: 'legacy-alice', key: 'legacy-key', luxUserId: 'alice' }
  const otherOwner = { clientId: 'legacy-bob', key: 'other-key', luxUserId: 'bob' }
  const unowned = { clientId: 'legacy-unowned', key: 'unowned-key' }
  const lxCredential = { clientId: 'legacy-lx', key: 'lx-key', lxAuthCodeHash: 'code-hash' }
  assert.deepEqual(syncCredentials.selectLuxCredential(scoped, otherOwner, 'alice'), {
    saved: scoped,
    previousClientId: undefined,
  })
  assert.deepEqual(syncCredentials.selectLuxCredential(null, sameOwner, 'alice'), {
    saved: sameOwner,
    previousClientId: undefined,
  })
  assert.deepEqual(syncCredentials.selectLuxCredential(null, unowned, 'alice'), {
    saved: null,
    previousClientId: unowned.clientId,
  })
  for (const legacy of [null, otherOwner, lxCredential]) {
    assert.deepEqual(syncCredentials.selectLuxCredential(null, legacy, 'alice'), {
      saved: null,
      previousClientId: undefined,
    })
  }
})

test('LX credential migration distinguishes automatic reconnects from explicit account selection', () => {
  const scoped = { clientId: 'scoped-lx', key: 'scoped-key', lxAuthCodeHash: 'alice-code' }
  const knownLegacy = { clientId: 'legacy-lx', key: 'legacy-key', lxAuthCodeHash: 'alice-code' }
  const unowned = { clientId: 'legacy-unowned', key: 'unowned-key' }
  const luxCredential = { clientId: 'legacy-lux', key: 'lux-key', luxUserId: 'alice' }
  assert.deepEqual(syncCredentials.selectLxCredential(scoped, null, 'alice-code'), scoped)
  assert.deepEqual(syncCredentials.selectLxCredential(scoped, null, ''), scoped)
  assert.deepEqual(syncCredentials.selectLxCredential(null, knownLegacy, 'alice-code'), knownLegacy)
  assert.deepEqual(syncCredentials.selectLxCredential(null, knownLegacy, ''), knownLegacy)
  assert.deepEqual(syncCredentials.selectLxCredential(null, unowned, ''), unowned)
  assert.equal(syncCredentials.selectLxCredential(null, unowned, 'alice-code'), null)
  assert.equal(syncCredentials.selectLxCredential(null, knownLegacy, 'bob-code'), null)
  assert.equal(syncCredentials.selectLxCredential(null, luxCredential, ''), null)
  assert.equal(syncCredentials.selectLxCredential(null, luxCredential, 'alice-code'), null)
  assert.equal(syncCredentials.selectLxCredential(null, null, 'alice-code'), null)
})

test('concurrent credential writes preserve every server and pending reads await persistence', async() => {
  let stored = null
  let startWrite
  let finishWrite
  let returned = false
  const writing = new Promise(resolve => { startWrite = resolve })
  const writeAllowed = new Promise(resolve => { finishWrite = resolve })
  const store = syncCredentials.createCredentialStore({
    read: async() => stored == null ? null : JSON.parse(stored),
    write: async(keys) => {
      startWrite()
      await writeAllowed
      stored = JSON.stringify(keys)
    },
    remove: async() => { stored = null },
  })
  const first = { clientId: 'first', key: 'key-a' }
  const second = { clientId: 'second', key: 'key-b' }
  const writes = [store.set('server-a', first), store.set('server-b', second)]
  const read = store.get('server-b').then(key => { returned = true; return key })
  await writing
  assert.equal(returned, false)
  finishWrite()
  await Promise.all(writes)
  assert.deepEqual(await read, second)
  assert.deepEqual(await store.get('server-a'), first)
  assert.deepEqual(await store.get('server-b'), second)
  assert.equal(await store.get('toString'), null)
})

test('credential storage recovers its write queue after failure and orders explicit clearing', async() => {
  const storageError = new Error('disk full')
  let stored = null
  let writes = 0
  const store = syncCredentials.createCredentialStore({
    read: async() => stored == null ? null : JSON.parse(stored),
    write: async(keys) => {
      if (++writes == 1) throw storageError
      stored = JSON.stringify(keys)
    },
    remove: async() => { stored = null },
  })
  await assert.rejects(store.set('failed-server', { clientId: 'not-saved' }), error => error === storageError)
  assert.equal(await store.get('failed-server'), null)
  const operations = [
    store.set('before-clear', { clientId: 'removed' }),
    store.clear(),
    store.set('after-clear', { clientId: 'retained' }),
  ]
  await Promise.all(operations)
  assert.equal(await store.get('before-clear'), null)
  assert.deepEqual(await store.get('after-clear'), { clientId: 'retained' })
})

test('Kuwo cache lookup normalizes catalog IDs without changing playback cache keys', () => {
  for (const cacheId of ['638844272', 'kw_638844272', 'MUSIC_638844272', 'kw_MUSIC_638844272']) {
    const cacheKey = `kw_${cacheId}_128k`
    const parsed = localSongRows.parseAudioCacheKey(cacheKey)
    assert.equal(parsed.songmid, '638844272')
    assert.equal(parsed.id, cacheId)
    for (const id of ['638844272', 'kw_638844272', 'MUSIC_638844272', 'kw_MUSIC_638844272']) {
      const song = { id, source: 'kw', name: '本地保存的歌名', singer: '歌手', interval: '03:32' }
      const resolved = localSongRows.resolveCachedSongMetadata({ cacheKey, userLists: [song] })
      assert.equal(resolved.via, 'userList')
      assert.equal(resolved.musicInfo.singer, '歌手')
      assert.equal(localSongRows.alignCachedSong(resolved.musicInfo, parsed).id, cacheId)
    }
    assert.equal(localSongRows.songMatchesCacheKey({
      id: 'legacy-id', source: 'kw', meta: { songId: 'MUSIC_638844272' },
    }, parsed), true)
    assert.equal(localSongRows.songMatchesCacheKey({ id: '638844272', source: 'wy' }, parsed), false)
    assert.equal(localSongRows.songMatchesCacheKey({ id: 'kw_638844273', source: 'kw' }, parsed), false)
  }
})

test('persisted listening records restore Kuwo titles, artists and duration over poisoned ID placeholders', () => {
  const cacheKey = 'kw_kw_2689279_320k'
  const placeholder = localSongRows.resolveCachedSongMetadata({ cacheKey }).musicInfo
  const history = cachedMetadata.cachedSongsFromPlayRecords([{
    id: 'device:1',
    deviceId: 'device',
    startedAt: 1,
    endedAt: 181001,
    listenedMs: 180000,
    song: { source: 'kw', songmid: 'MUSIC_2689279', name: '旧记录歌名', singer: '旧记录歌手', interval: '03:00', img: 'file:///cover.jpg' },
  }])
  assert.equal(history[0].meta.songId, '2689279')
  const resolved = localSongRows.resolveCachedSongMetadata({
    cacheKey, userLists: [placeholder], listenList: [placeholder], playHistory: history, keyedMeta: placeholder,
  })
  assert.equal(resolved.via, 'playHistory')
  assert.equal(resolved.musicInfo.name, '旧记录歌名')
  assert.equal(resolved.musicInfo.singer, '旧记录歌手')
  assert.equal(resolved.musicInfo.interval, '03:00')
  assert.equal(resolved.musicInfo.meta.picUrl, 'file:///cover.jpg')
  assert.equal(localSongRows.resolveCachedSongMetadata({ cacheKey, keyedMeta: placeholder }).via, 'fallback')
  assert.equal(localSongRows.hasCachedSongMetadata(placeholder, cacheKey), false)
  assert.equal(localSongRows.hasCachedSongMetadata({ ...placeholder, singer: '真实歌手' }, cacheKey), true)
  const user = { ...history[0], name: '用户歌单中的歌名' }
  assert.equal(localSongRows.resolveCachedSongMetadata({ cacheKey, userLists: [user], playHistory: history }).musicInfo.name, user.name)
})

test('cache metadata index preserves concurrent writes and rejects replayed placeholders', async() => {
  let reads = 0
  let disk = []
  let release
  const initialRead = new Promise(resolve => { release = resolve })
  const index = cachedMetadata.createCachedSongIndex(async() => { reads += 1; return initialRead }, entries => { disk = entries })
  const song = id => ({ id: `kw_${id}`, source: 'kw', name: `歌曲 ${id}`, singer: '歌手', meta: { songId: id } })
  const keys = ['638844272', '2689279', '193290598'].map(id => `kw_kw_${id}_128k`)
  const writes = keys.map((key, i) => index.remember(key, song(['638844272', '2689279', '193290598'][i])))
  release([])
  await Promise.all(writes)
  assert.equal(reads, 1)
  assert.deepEqual((await index.load()).map(entry => entry.key), keys)
  assert.deepEqual(disk.map(entry => entry.key), keys)
  await index.remember(keys[0], localSongRows.resolveCachedSongMetadata({ cacheKey: keys[0] }).musicInfo)
  assert.equal((await index.load())[0].musicInfo.name, '歌曲 638844272')
  await Promise.all([
    index.forget([keys[0]]),
    index.remember('kw_kw_4_128k', song('4')),
    index.forget([keys[1]]),
  ])
  assert.deepEqual(disk.map(entry => entry.key), [keys[2], 'kw_kw_4_128k'])
  const reloaded = cachedMetadata.createCachedSongIndex(async() => disk, () => {})
  assert.equal((await reloaded.load()).length, 2)
})

test('failed cache index reads are retryable and never overwrite existing disk metadata', async() => {
  let attempts = 0
  let writes = 0
  const disk = [{ key: 'kw_kw_1_128k', musicInfo: { id: 'kw_1', source: 'kw', name: '已保存', singer: '歌手' } }]
  const index = cachedMetadata.createCachedSongIndex(async() => {
    if (++attempts == 1) throw new Error('storage temporarily unavailable')
    return disk
  }, () => { writes += 1 })
  await assert.rejects(index.remember('kw_kw_2_128k', { id: 'kw_2', source: 'kw', name: '第二首', singer: '歌手' }))
  assert.equal(writes, 0)
  await index.remember('kw_kw_2_128k', { id: 'kw_2', source: 'kw', name: '第二首', singer: '歌手' })
  assert.equal((await index.load()).length, 2)
  assert.equal(attempts, 2)
})

test('missing Kuwo metadata fetches once across aliases and persists through a fresh resolver', async() => {
  let disk = []
  const index = cachedMetadata.createCachedSongIndex(async() => disk, entries => { disk = entries })
  let fetches = 0
  let release
  const remote = new Promise(resolve => { release = resolve })
  const dependencies = {
    loadStored: async() => (await index.load()).map(entry => entry.musicInfo),
    fetch: async parsed => { fetches += 1; assert.equal(parsed.songmid, '193290598'); return remote },
    prepare: song => song,
    persist: index.remember,
  }
  const fetchInfo = cachedMetadata.createCachedSongMetadataFetcher(dependencies)
  const firstKey = localSongRows.parseAudioCacheKey('kw_kw_193290598_128k')
  const otherKey = localSongRows.parseAudioCacheKey('kw_MUSIC_193290598_320k')
  const first = fetchInfo(firstKey)
  const other = fetchInfo(otherKey)
  release({ id: 'kw_193290598', source: 'kw', name: '网络补全', singer: '网络歌手', interval: '04:08', meta: { songId: '193290598' } })
  const [one, two] = await Promise.all([first, other])
  assert.equal(fetches, 1)
  assert.equal(one.name, '网络补全')
  assert.equal(one.interval, '04:08')
  assert.equal(two.id, 'MUSIC_193290598')
  assert.equal(disk.length, 2)
  const reopened = cachedMetadata.createCachedSongIndex(async() => disk, () => {})
  const afterRestart = cachedMetadata.createCachedSongMetadataFetcher({
    ...dependencies,
    loadStored: async() => (await reopened.load()).map(entry => entry.musicInfo),
    fetch: async() => { throw new Error('must not refetch saved metadata') },
    persist: reopened.remember,
  })
  assert.equal((await afterRestart(firstKey)).singer, '网络歌手')
  assert.equal(fetches, 1)
})

test('metadata hydration keeps the ID offline and can recover on a later retry', async() => {
  const parsed = localSongRows.parseAudioCacheKey('kw_kw_638844272_128k')
  let online = false
  const index = cachedMetadata.createCachedSongIndex(async() => [], () => {})
  const fetchInfo = cachedMetadata.createCachedSongMetadataFetcher({
    loadStored: async() => (await index.load()).map(entry => entry.musicInfo),
    fetch: async() => {
      if (!online) throw new Error('offline')
      return { id: 'kw_638844272', source: 'kw', name: '恢复歌名', singer: '恢复歌手' }
    },
    prepare: song => song,
    persist: index.remember,
  })
  assert.equal(await fetchInfo(parsed), null)
  assert.equal((await index.load()).length, 0)
  const fallback = localSongRows.resolveCachedSongMetadata({ cacheKey: parsed.cacheKey })
  assert.equal(fallback.musicInfo.name, '638844272')
  online = true
  assert.equal((await fetchInfo(parsed)).name, '恢复歌名')
  assert.equal((await index.load()).length, 1)
})

test('metadata hydration does not coalesce distinct Kugou hashes', async() => {
  const hashes = []
  const fetchInfo = cachedMetadata.createCachedSongMetadataFetcher({
    loadStored: async() => [],
    fetch: async parsed => {
      hashes.push(parsed.hash)
      return { id: parsed.id, source: 'kg', name: `歌曲 ${parsed.hash}`, singer: '歌手', meta: { songId: parsed.songmid, hash: parsed.hash } }
    },
    prepare: song => song,
    persist: async() => {},
  })
  const [first, second] = await Promise.all([
    fetchInfo(localSongRows.parseAudioCacheKey('kg_1_hashA_128k')),
    fetchInfo(localSongRows.parseAudioCacheKey('kg_1_hashB_128k')),
  ])
  assert.deepEqual(hashes, ['hashA', 'hashB'])
  assert.equal(first.meta.hash, 'hashA')
  assert.equal(second.meta.hash, 'hashB')
})

test('Kuwo rid search body yields name, singer, album, duration and cover; www illegal body is rejected', () => {
  const url = kwMusicInfoParse.kwRidMusicInfoUrl('2689279')
  assert.match(url, /search\.kuwo\.cn\/r\.s\?/)
  assert.match(url, /rid=MUSIC_2689279/)
  assert.match(url, /mobi=1/)
  assert.equal(kwMusicInfoParse.isIllegalKwMusicInfoBody({
    success: false, message: 'The request is illegal!',
  }), true)
  assert.equal(kwMusicInfoParse.parseKwSearchMusicInfo({
    success: false, message: 'The request is illegal!',
  }, '2689279'), null)

  const parsed = kwMusicInfoParse.parseKwSearchMusicInfo({
    abslist: [{
      SONGNAME: '东南苦山行',
      ARTIST: '殷正洋',
      ALBUM: '雨中的歉意/&nbsp;请你回眸',
      ALBUMID: '2155852',
      DURATION: '239',
      MUSICRID: 'MUSIC_2689279',
      web_albumpic_short: '120/90/62/700599983.jpg',
    }],
  }, '2689279')
  assert.equal(parsed.name, '东南苦山行')
  assert.equal(parsed.artist, '殷正洋')
  assert.equal(parsed.album, '雨中的歉意/ 请你回眸')
  assert.equal(parsed.albumid, '2155852')
  assert.equal(parsed.duration, 239)
  assert.equal(parsed.songmid, '2689279')
  assert.equal(parsed.pic, 'https://img1.kuwo.cn/star/albumcover/120/90/62/700599983.jpg')
  assert.equal(kwMusicInfoParse.parseKwSearchMusicInfo({
    abslist: [{ SONGNAME: '错歌', MUSICRID: 'MUSIC_1' }],
  }, '2689279'), null)

  const screenshotIds = [
    { mid: '638844272', name: '小河淌水', artist: 'DJ铁柱&Grimmmz' },
    { mid: '193290598', name: '如愿', artist: '王菲' },
  ]
  for (const song of screenshotIds) {
    const info = kwMusicInfoParse.parseKwSearchMusicInfo({
      abslist: [{
        SONGNAME: song.name,
        ARTIST: song.artist,
        DURATION: '100',
        MUSICRID: `MUSIC_${song.mid}`,
        web_albumpic_short: 'a/b.jpg',
      }],
    }, song.mid)
    assert.equal(info.name, song.name)
    assert.equal(info.artist, song.artist)
  }
})

test('dev.31 numeric-name cache index entries are treated as missing and backfilled with real Kuwo names', async() => {
  // Reproduce v0.4.0-dev.31: ExoPlayer has complete KW blobs, but the index only has
  // songmid placeholders (no singer). Opening 本地歌曲 must fetch and persist real names.
  const poisoned = [
    { key: 'kw_kw_638844272_128k', musicInfo: { id: 'kw_638844272', source: 'kw', name: '638844272', singer: '', interval: null, meta: { songId: '638844272', albumName: '', picUrl: '', qualitys: [], _qualitys: {} } } },
    { key: 'kw_kw_2689279_128k', musicInfo: { id: 'kw_2689279', source: 'kw', name: '2689279', singer: '', interval: null, meta: { songId: '2689279', albumName: '', picUrl: '', qualitys: [], _qualitys: {} } } },
    { key: 'kw_kw_193290598_128k', musicInfo: { id: 'kw_193290598', source: 'kw', name: '193290598', singer: '', interval: null, meta: { songId: '193290598', albumName: '', picUrl: '', qualitys: [], _qualitys: {} } } },
  ]
  let disk = poisoned.slice()
  const index = cachedMetadata.createCachedSongIndex(async() => disk, entries => { disk = entries })
  assert.equal(localSongRows.hasCachedSongMetadata(poisoned[0].musicInfo, poisoned[0].key), false)
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: poisoned[0].key,
    keyedMeta: poisoned[0].musicInfo,
    metaStore: poisoned.map(entry => entry.musicInfo),
  }).via, 'fallback')
  assert.equal(localSongRows.resolveCachedSongMetadata({
    cacheKey: poisoned[0].key,
    keyedMeta: poisoned[0].musicInfo,
    metaStore: poisoned.map(entry => entry.musicInfo),
  }).musicInfo.name, '638844272')

  const catalog = {
    638844272: { name: '小河淌水', singer: 'DJ铁柱', interval: '01:48', album: '笑比恨先出现', pic: 'https://img1.kuwo.cn/star/albumcover/a.jpg' },
    2689279: { name: '东南苦山行', singer: '殷正洋', interval: '03:59', album: '雨中的歉意', pic: 'https://img1.kuwo.cn/star/albumcover/b.jpg' },
    193290598: { name: '如愿', singer: '王菲', interval: '04:25', album: '如愿', pic: 'https://img1.kuwo.cn/star/albumcover/c.jpg' },
  }
  const fetchInfo = cachedMetadata.createCachedSongMetadataFetcher({
    loadStored: async() => (await index.load()).map(entry => entry.musicInfo),
    fetch: async parsed => {
      const hit = catalog[parsed.songmid]
      assert.ok(hit, `unexpected mid ${parsed.songmid}`)
      // Mimic parseKwSearchMusicInfo → toNewMusicInfo for the working rid API.
      const body = kwMusicInfoParse.parseKwSearchMusicInfo({
        abslist: [{
          SONGNAME: hit.name,
          ARTIST: hit.singer,
          ALBUM: hit.album,
          ALBUMID: '1',
          DURATION: '100',
          MUSICRID: `MUSIC_${parsed.songmid}`,
          web_albumpic_short: 'x/y.jpg',
        }],
      }, parsed.songmid)
      return {
        id: parsed.id,
        source: 'kw',
        name: body.name,
        singer: body.artist,
        interval: hit.interval,
        meta: {
          songId: body.songmid,
          albumName: body.album,
          picUrl: hit.pic,
          qualitys: [{ type: parsed.quality, size: null }],
          _qualitys: { [parsed.quality]: { size: null } },
        },
      }
    },
    prepare: song => song,
    persist: index.remember,
  })

  for (const entry of poisoned) {
    const parsed = localSongRows.parseAudioCacheKey(entry.key)
    const resolved = await fetchInfo(parsed)
    assert.equal(resolved.name, catalog[parsed.songmid].name)
    assert.equal(resolved.singer, catalog[parsed.songmid].singer)
    assert.equal(resolved.interval, catalog[parsed.songmid].interval)
    assert.equal(resolved.meta.albumName, catalog[parsed.songmid].album)
    assert.equal(resolved.meta.picUrl, catalog[parsed.songmid].pic)
  }

  assert.equal(disk.length, 3)
  for (const entry of disk) {
    const mid = localSongRows.parseAudioCacheKey(entry.key).songmid
    assert.equal(entry.musicInfo.name, catalog[mid].name)
    assert.equal(localSongRows.hasCachedSongMetadata(entry.musicInfo, entry.key), true)
    assert.equal(localSongRows.resolveCachedSongMetadata({
      cacheKey: entry.key,
      keyedMeta: entry.musicInfo,
      metaStore: disk.map(item => item.musicInfo),
    }).via, 'metaStore')
  }

  // Playback with full metadata must write the index immediately (no network).
  const playKey = 'kw_kw_999_320k'
  await index.remember(playKey, {
    id: 'kw_999', source: 'kw', name: '播放时写入', singer: '现场歌手', interval: '02:00',
    meta: { songId: '999', albumName: '现场专辑', picUrl: 'https://cover', qualitys: [], _qualitys: {} },
  })
  assert.equal(disk.find(entry => entry.key == playKey).musicInfo.name, '播放时写入')
  assert.equal(disk.find(entry => entry.key == playKey).musicInfo.meta.albumName, '现场专辑')
})

const chartTestRecord = (startedAt, listenedMs) => ({
  id: `chart:${startedAt}`,
  deviceId: 'chart',
  startedAt,
  endedAt: startedAt + listenedMs,
  listenedMs,
  song: { source: 'kw', songmid: '638844272', name: '测试歌曲', singer: '歌手' },
})

const chartTestTranslate = locale => {
  const messages = JSON.parse(readFileSync(join(root, `src/lang/${locale}.json`), 'utf8').replace(/^\uFEFF/, ''))
  return (key, params = {}) => Object.entries(params).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    messages[key],
  )
}

test('today chart retains 32 minutes, displays short listens, and positions slots within measured width', () => {
  const now = new Date(2026, 9, 9, 20, 16).getTime()
  const records = [
    chartTestRecord(new Date(2026, 9, 9, 8, 30).getTime(), 16 * 60_000),
    chartTestRecord(new Date(2026, 9, 9, 18, 10).getTime(), 15 * 60_000 + 50_000),
    chartTestRecord(new Date(2026, 9, 9, 20, 5).getTime(), 10_000),
  ]
  const stats = playRange.buildRangeStats(records, 'today', now)
  assert.equal(stats.listenedMs, 32 * 60_000)
  assert.equal(stats.chart.reduce((total, bucket) => total + bucket.listenedMs, 0), stats.listenedMs)
  assert.equal(stats.chart.length, 12)
  // Display minutes round to zero; the chart must still use the precise duration.
  assert.equal(stats.chart[10].minutes, 0)
  for (const width of [180, 303, 375, 800]) {
    const geometry = playChartLayout.buildStatsChartLayout(stats.chart, width, 118, 4)
    assert.equal(geometry.slotWidth, width / 12)
    assert.equal(geometry.points[4].height, 118)
    assert.equal(geometry.points[9].height, 950_000 / 960_000 * 118)
    assert.equal(geometry.points[10].height, 4)
    assert.equal(geometry.points[10].empty, false)
    assert.equal(geometry.points[0].height, 0)
    assert.equal(geometry.points[0].empty, true)
    geometry.points.forEach((point, index) => {
      assert.equal(point.x, (index + 0.5) * geometry.slotWidth)
      assert.ok(point.x > 0 && point.x < width)
      assert.ok(Number.isFinite(point.y) && point.y >= 0 && point.y <= 118)
    })
  }
})

test('today axis labels keep 0/6/12/18 ticks, highlight the current slot, and stay localized', () => {
  const now = new Date(2026, 9, 9, 20, 16).getTime()
  const buckets = playRange.buildTodayHourlyBuckets([], now)
  const expectedHours = Array.from({ length: 12 }, (_, index) => index * 2)
  assert.deepEqual(buckets.map(bucket => bucket.hour), expectedHours)
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const translate = chartTestTranslate(locale)
    const labels = buckets.map(bucket => playChartLayout.statsBucketLabel(bucket, 'today', translate))
    assert.deepEqual(labels.map(label => label.show), expectedHours.map(hour => hour % 6 == 0), locale)
    assert.deepEqual(
      labels.filter(label => label.show).map(label => label.text),
      [0, 6, 12, 18].map(hour => translate('stats_hour_label', { hour })),
      locale,
    )
    assert.equal(labels.filter(label => label.highlight).length, 1, locale)
    assert.equal(labels[10].highlight, true, locale)
    assert.equal(labels[10].show, false, locale)
    assert.equal(translate('stats_minute_less_than_one'), '<1', locale)
    assert.equal(translate('stats_hour_end').length > 0, true, locale)
  }
})

test('bar and line modes share finite geometry across all ranges, singleton and long all-time history', () => {
  const now = new Date(2026, 9, 9, 20, 16).getTime()
  const scenarios = [
    { range: 'today', records: [], kind: 'hour2', length: 12 },
    { range: 'days7', records: [], kind: 'day', length: 7 },
    { range: 'month', records: [], kind: 'day', length: 9 },
    { range: 'year', records: [], kind: 'month', length: 10 },
    { range: 'all', records: [], kind: 'month', length: 1 },
    { range: 'all', records: [chartTestRecord(new Date(2026, 7, 1).getTime(), 1000)], kind: 'month', length: 3 },
    { range: 'all', records: [chartTestRecord(new Date(2023, 0, 1).getTime(), 1000)], kind: 'year', length: 4 },
  ]
  for (const scenario of scenarios) {
    const buckets = playRange.buildRangeStats(scenario.records, scenario.range, now).chart
    assert.equal(buckets.length, scenario.length)
    assert.equal(buckets.every(bucket => bucket.kind === scenario.kind), true)
    assert.equal(buckets.filter(bucket => bucket.isCurrent).length, 1)
    const before = structuredClone(buckets)
    let lastGeometry
    for (const selectedMode of ['bar', 'line', 'bar']) {
      assert.equal(playChartMode.normalizeStatsChartMode(selectedMode), selectedMode)
      const geometry = playChartLayout.buildStatsChartLayout(buckets, 303, 118)
      for (const point of geometry.points) {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.height))
        assert.ok(point.x >= 0 && point.x <= geometry.width)
        assert.ok(point.height >= 0 && point.height <= 118)
        const label = playChartLayout.statsBucketLabel(point.bucket, scenario.range, chartTestTranslate('en-us'))
        if (point.bucket.isCurrent) assert.equal(label.highlight, true)
        if (point.bucket.kind == 'hour2' && point.bucket.hour % 6 == 0) assert.equal(label.show, true)
      }
      if (lastGeometry) assert.deepEqual(geometry, lastGeometry)
      lastGeometry = geometry
    }
    assert.deepEqual(buckets, before)
  }
  assert.deepEqual(playChartLayout.buildStatsChartLayout([], 0, 118).points, [])
  for (const width of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
    const singleton = playRange.buildChartBuckets([], 'all', now)
    const geometry = playChartLayout.buildStatsChartLayout(singleton, width, 118)
    assert.ok(geometry.width > 0)
    assert.equal(geometry.points[0].x, geometry.width / 2)
  }
})

test('migrated screens reject new color literals', () => {
  const checked = spawnSync(process.execPath, ['scripts/check-lux-color-literals.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (checked.status != 0) {
    process.stderr.write(checked.stdout || '')
    process.stderr.write(checked.stderr || '')
  }
  assert.equal(checked.status, 0)
})

test.after(() => {
  rmSync(outDir, { recursive: true, force: true })
})
