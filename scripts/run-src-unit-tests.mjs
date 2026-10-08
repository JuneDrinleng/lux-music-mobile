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

test.after(() => {
  rmSync(outDir, { recursive: true, force: true })
})
