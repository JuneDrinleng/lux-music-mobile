/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (file, dependencies = {}) => {
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`)
    return dependencies[name]
  }, module, module.exports)
  return module.exports
}
const selection = load('src/utils/shareCard/selection.ts')
const model = load('src/utils/shareCard/model.ts', { './selection': selection })
const lines = Array.from({ length: 9 }, (_, i) => ({ time: i * 5000, text: `Line ${i}`, translation: `Translation ${i}` }))
const open = index => selection.openLineSelection('song/revision', lines, index)
const toggle = (state, index) => selection.toggleShareLine(state, 'song/revision', lines, index)

test('long press selects only its line; invalid/blank lines cannot become a card', () => {
  assert.deepEqual(open(3).indices, [3])
  for (const index of [-1, 9, 1.5, NaN]) assert.deepEqual(open(index).indices, [])
  assert.deepEqual(selection.openLineSelection('s', [{ text: '  ', time: 0 }], 0).indices, [])
})

test('checkboxes support contiguous and separate lines, preserve lyric order and remove individually', () => {
  const initial = open(3)
  const next = toggle(toggle(initial, 4).selection, 2).selection
  assert.deepEqual(next.indices, [2, 3, 4])
  assert.deepEqual(selection.describeSelection(next), { count: 3, first: 3, last: 5, contiguous: true })
  const separate = toggle(next, 3).selection
  assert.deepEqual(separate.indices, [2, 4])
  assert.equal(selection.describeSelection(separate).contiguous, false)
  assert.deepEqual(initial.indices, [3])
})

test('inclusive ranges work in either direction and reject more than six without changing selection', () => {
  const initial = open(2)
  for (const [a, b] of [[0, 5], [5, 0]]) {
    assert.deepEqual(selection.selectShareRange(initial, initial.source, lines, a, b).selection.indices, [0, 1, 2, 3, 4, 5])
  }
  const rejected = selection.selectShareRange(initial, initial.source, lines, 0, 6)
  assert.equal(rejected.error, 'limit')
  assert.equal(rejected.selection, initial)
  assert.equal(selection.selectShareRange(initial, initial.source, lines, -1, 0).error, 'invalid')
})

test('six-line limit applies to multiple selection, removal and clear remain possible', () => {
  let state = open(0)
  for (let i = 1; i < 6; i++) state = toggle(state, i).selection
  assert.equal(toggle(state, 6).error, 'limit')
  assert.equal(toggle(state, 6).selection, state)
  state = toggle(state, 2).selection
  assert.equal(toggle(state, 8).selection.indices.length, 6)
  const cleared = selection.clearShareLines(state)
  assert.deepEqual(cleared.indices, [])
  assert.deepEqual(selection.selectedShareLines(cleared, cleared.source, lines), [])
  assert.equal(selection.describeSelection(cleared).first, null)
})

test('song/revision changes reject stale sheet events and exports; malformed external selections fail closed', () => {
  const initial = open(2)
  assert.equal(selection.toggleShareLine(initial, 'other', lines, 3).error, 'stale')
  assert.equal(selection.selectShareRange(initial, 'other', lines, 0, 2).error, 'stale')
  assert.deepEqual(selection.selectedShareLines(initial, 'other', lines), [])
  for (const indices of [[-1], [9], [1, 1], [0, 1, 2, 3, 4, 5, 6]]) {
    assert.deepEqual(selection.selectedShareLines({ ...initial, indices }, initial.source, lines), [])
  }
  const exported = selection.selectedShareLines(initial, initial.source, lines)
  exported[0].text = 'changed'
  assert.equal(lines[2].text, 'Line 2')
})

const lyricContent = { title: 'Song', artist: 'Artist', cover: 'cover.jpg', lines: lines.slice(0, 3) }
const report = { title: '2026 / 10', minutes: 100, playCount: 10, songCount: 5, artistCount: 3, topSongs: [{ name: 'Song', singer: 'Artist', playCount: 7 }] }
test('all tabs share exact export size and frame; three backgrounds preserve content', () => {
  for (const tab of model.SHARE_CARD_TABS) {
    for (const background of model.SHARE_CARD_BACKGROUNDS) {
      const card = model.buildShareCard({ lyrics: lyricContent, monthly: report, annual: report }, { ...model.initialShareCardOptions(tab), background }, 'June')
      assert.equal(card.canExport, true)
      assert.deepEqual(card.size, { width: 1080, height: 1440 })
      assert.deepEqual(card.frame, model.SHARE_CARD_FRAME)
      assert.equal(card.background, background)
      assert.equal(card.watermark, '@June')
    }
  }
})

test('watermark uses edited profile nickname and respects nickname switch', () => {
  assert.equal(model.nicknameWatermark('  新昵称  '), '@新昵称')
  assert.equal(model.nicknameWatermark('@June'), '@June')
  assert.equal(model.nicknameWatermark('June', false), '')
  assert.equal(model.nicknameWatermark('  '), '')
})

test('cover and translation options never mutate sources or remove original lyrics', () => {
  const before = JSON.stringify(lyricContent)
  const card = model.buildShareCard({ lyrics: lyricContent }, { ...model.initialShareCardOptions('lyrics'), showCover: false, showTranslation: false, showNickname: false }, 'June')
  assert.equal(card.content.cover, undefined)
  assert.equal(card.content.lines[0].translation, undefined)
  assert.equal(card.content.lines[0].text, 'Line 0')
  assert.equal(card.watermark, '')
  assert.equal(JSON.stringify(lyricContent), before)
})

test('missing tab data and empty reports disable export; lyric line limits also apply at the card boundary', () => {
  for (const tab of model.SHARE_CARD_TABS) assert.equal(model.buildShareCard({}, model.initialShareCardOptions(tab), '').canExport, false)
  assert.equal(model.buildShareCard({ monthly: { ...report, playCount: 0 } }, model.initialShareCardOptions('monthly'), '').canExport, false)
  for (const cardLines of [[], lines, [{ text: '', time: 0 }]]) {
    assert.equal(model.buildShareCard({ lyrics: { ...lyricContent, lines: cardLines } }, model.initialShareCardOptions('lyrics'), '').canExport, false)
  }
})

const nativeCalls = []
const { captureAndShareCard, nativeCardExport } = load('src/utils/shareCard/export.ts', {
  './model': model,
  'react-native-view-shot': {
    captureRef: async(...args) => { nativeCalls.push(['captureRef', ...args]); return 'file:///card.png' },
    releaseCapture: uri => { nativeCalls.push(['releaseCapture', uri]) },
  },
  '@/utils/nativeModules/utils': { shareImage: async(...args) => { nativeCalls.push(['shareImage', ...args]) } },
})
test('native adapter captures the card ref, shares its file and releases it; unmounted refs fail capture', async() => {
  const ref = { current: {} }
  await captureAndShareCard(true, nativeCardExport(ref, 'Share'))
  assert.deepEqual(nativeCalls, [
    ['captureRef', ref, { width: 1080, height: 1440, format: 'png', result: 'tmpfile' }],
    ['shareImage', 'Share', 'file:///card.png'],
    ['releaseCapture', 'file:///card.png'],
  ])
  await assert.rejects(captureAndShareCard(true, nativeCardExport({ current: null }, 'Share')), /not mounted/)
})
const exportFixture = () => {
  const calls = []
  const dependencies = {
    capture: async options => { calls.push(['capture', options]); return 'file:///cache/card.png' },
    share: async uri => { calls.push(['share', uri]) },
    release: uri => { calls.push(['release', uri]) },
  }
  return { calls, dependencies }
}

test('capture uses exact PNG output dimensions and releases after native share copies the image', async() => {
  const { calls, dependencies } = exportFixture()
  assert.equal(await captureAndShareCard(true, dependencies), 'image')
  assert.deepEqual(calls, [
    ['capture', { width: 1080, height: 1440, format: 'png', result: 'tmpfile' }],
    ['share', 'file:///cache/card.png'],
    ['release', 'file:///cache/card.png'],
  ])
})

test('capture failure invokes monthly text fallback without attempting image share', async() => {
  const { calls, dependencies } = exportFixture()
  dependencies.capture = async() => { throw new Error('native capture unavailable') }
  assert.equal(await captureAndShareCard(true, dependencies, async() => { calls.push(['fallback']) }), 'fallback')
  assert.deepEqual(calls, [['fallback']])
  await assert.rejects(captureAndShareCard(true, dependencies), /native capture unavailable/)
})

test('share failure propagates, releases original capture and never invokes text fallback', async() => {
  const { calls, dependencies } = exportFixture()
  dependencies.share = async() => { throw new Error('chooser unavailable') }
  await assert.rejects(captureAndShareCard(true, dependencies, async() => { calls.push(['fallback']) }), /chooser unavailable/)
  assert.equal(calls.at(-1)[0], 'release')
  assert.equal(calls.some(([name]) => name === 'fallback'), false)
})

test('empty cards perform no capture; empty capture URI and fallback failure are handled', async() => {
  const { calls, dependencies } = exportFixture()
  await assert.rejects(captureAndShareCard(false, dependencies), /empty share card/)
  assert.deepEqual(calls, [])
  dependencies.capture = async() => ''
  await assert.rejects(captureAndShareCard(true, dependencies), /no file/)
  await assert.rejects(captureAndShareCard(true, dependencies, async() => { throw new Error('text share failed') }), /text share failed/)
  assert.deepEqual(calls, [])
})


test('export canvas contains short and long preview cards at 3:4 without stretching', () => {
  for (const [width, height] of [[300, 280], [300, 400], [300, 760]]) {
    const canvas = model.shareCardCanvas(width, height)
    assert.equal(canvas.width / canvas.height, 3 / 4)
    assert.ok(canvas.width >= width && canvas.height >= height)
  }
})
