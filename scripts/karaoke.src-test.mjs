/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import Lyric from '../node_modules/lrc-file-parser/dist/lrc-file-parser.esm.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(root, path), 'utf8')
const load = (path, deps = {}, globals = {}) => {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports, ...Object.values(globals))
  return module.exports
}
const math = load('src/plugins/lyricWords.ts')
// Execute the actual SDK converter declarations, without HTTP/crypto imports.
const sdk = (path, name, deps = {}) => {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const declaration = source.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(source) === name)
  assert.ok(declaration, name)
  return new Script(`(function(${Object.keys(deps).join(',')}){return (${declaration.initializer.getText(source)})})`).runInThisContext()(...Object.values(deps))
}

const samples = [
  ['tx QRC: absolute suffix timings', () => sdk('src/utils/musicSdk/tx/lyric.js', 'parseTools').parseLyric('[1000,900]童年(1000,400)的(1500,400)')],
  ['wy YRC: absolute prefix triplets', () => sdk('src/utils/musicSdk/wy/lyric.js', 'parseTools').parseLyric(['[1000,900](1000,400,0)童年(1500,400,0)的'])],
  ['kg KRC: relative prefix triplets', () => sdk('src/utils/musicSdk/kg/lyric.js', 'parseLyric', { headExp: /^.*\[id:\$\w+\]\n/, decodeName: value => value })('[1000,900]<0,400,0>童年<500,400,0>的')],
  ['kw LRCX: encoded pairs converted by lrcTools', () => {
    const lxlyric = sdk('src/utils/musicSdk/kw/util.js', 'lrcTools').parse('[00:01.000]<400,-400>童年<900,100>的')
    return { lyric: '[00:01.000]童年的', lxlyric }
  }],
  ['mg MRC: absolute suffix pairs', () => sdk('src/utils/musicSdk/mg/lyric.js', 'mrcTools').parseLyric('[1000,900]童年(1000,400)的(1500,400)')],
]
for (const [name, convert] of samples) {
  test(`6.3 parser source coverage: ${name}`, () => {
    const { lyric, lxlyric } = convert()
    assert.equal(lxlyric, '[00:01.000]<0,400>童年<500,400>的')
    const words = math.parseWordLyrics(lxlyric).get(1000)
    assert.deepEqual(words, [{ text: '童年', startMs: 1000, endMs: 1400 }, { text: '的', startMs: 1500, endMs: 1900 }])
    assert.equal(math.matchingWords(math.timedText(lyric)[0], words), words)
  })
}

test('6.3 fill math: before/start/mid/end/after, zero duration, gaps, invalid position, line fallback', () => {
  const word = { text: 'swing', startMs: 1000, endMs: 1400 }
  assert.deepEqual([0, 1000, 1200, 1400, 9999].map(time => math.wordFill(word, time)), [0, 0, 0.5, 1, 1])
  assert.equal(math.wordFill(word, NaN), 0)
  assert.equal(math.wordFill({ ...word, endMs: 1000 }, 1000), 1)
  assert.equal(math.matchingWords({ time: 0, text: 'plain' }), undefined)
  assert.equal(math.matchingWords({ time: 0, text: 'mismatch' }, [word]), undefined)
  assert.equal(math.parseWordLyrics('[00:01.000]<0,-20>bad').size, 0)
  assert.equal(math.parseWordLyrics('[00:01.000]<50,100>a<0,100>b').size, 0)
  assert.deepEqual(math.timedText('[00:01.000][00:02.000] \r\n[00:03.000]next').map(line => line.text), ['', '', 'next'])
  assert.equal(math.parseWordLyrics('[00:01.000]<0,100>Hello <200,300>world!').get(1000)[0].text, 'Hello ')
})

test('6.3 plugin integrates real line parser: words, blank rows, offsets, translation/romaji toggles and replacement', async() => {
  const slots = []; const effects = []
  const plugin = load('src/plugins/lyric.ts', {
    react: { useState: value => { const slot = { value }; slots.push(slot); return [value, value => { slot.value = value }] }, useEffect: effect => { effects.push(effect) } },
    'lrc-file-parser': { default: Lyric },
    './lyricWords': math,
  })
  await plugin.init()
  plugin.useLrcSet(); const cleanup = effects[0]()
  plugin.toggleTranslation(true); plugin.toggleRoma(true)
  plugin.setLyric('[offset:200]\n[00:01.000]Hello\n[00:02.000]\n[00:03.000]next', '[00:01.000]你好', '[00:01.000]he-lo', '[00:01.000]<0,400>Hello')
  assert.equal(slots[0].value.length, 3)
  assert.equal(slots[0].value[1].text, '')
  assert.deepEqual(slots[0].value[0].words, [{ text: 'Hello', startMs: 1000, endMs: 1400 }])
  assert.deepEqual(slots[0].value[0].extendedLyrics, ['你好', 'he-lo'])
  assert.equal(slots[0].value[0].translation, '你好')
  assert.equal(slots[0].value[0].roma, 'he-lo')
  assert.equal(plugin.getLyricClockOffset(), 300)
  plugin.toggleTranslation(false)
  assert.deepEqual(slots[0].value[0].extendedLyrics, ['he-lo'])
  assert.equal(slots[0].value[0].translation, '你好', 'preview extras remain available independently')
  plugin.setLyric('[00:01.000]plain')
  assert.equal(slots[0].value[0].words, undefined)
  assert.equal(slots[0].value[0].translation, undefined)
  cleanup()
})

const jsx = (type, props) => ({ type, props })
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)]
const base = {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', TouchableOpacity: 'TouchableOpacity' },
  '@/components/common/Text': { default: 'Text' },
  '@/components/magazine': { SecondaryButton: 'SecondaryButton' },
  '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: builder => () => builder() },
  '@/theme/magazineRoles': { magazineRoles: () => ({ display: 'ink', faint: 'muted' }) },
  '@/utils/tools': { createStyle: value => value },
}

test('6.3 preview renders two lines, independent pills, unavailable disabled state, and lyric navigation in all locales', () => {
  for (const lang of ['zh-cn', 'zh-tw', 'en-us']) {
    const locale = JSON.parse(read(`src/lang/${lang}.json`))
    const values = []; let cursor = 0; let opened = 0
    const component = load('src/components/lyric/LyricPreview.tsx', {
      ...base,
      react: { memo: value => value, useMemo: fn => fn(), useState: initial => { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], fn => { values[index] = fn(values[index]) }] } },
      '@/lang': { useI18n: () => key => { assert.ok(locale[key]); return locale[key] } },
      '@/plugins/lyricWords': math,
      './KaraokeLine': { default: 'KaraokeLine' },
    }).default
    const props = { lines: [{ text: 'current', translation: 'translated', roma: 'romaji' }, { text: 'next' }], index: 0, active: true, onPress: () => { opened++ } }
    const render = () => { cursor = 0; return walk(component(props)) }
    let nodes = render()
    const text = nodes => nodes.filter(node => node.type === 'Text').map(node => node.props.children)
    const pills = () => nodes.filter(node => node.type === 'SecondaryButton')
    assert.deepEqual(text(nodes).slice(0, 2), ['translated', 'next'])
    assert.equal(nodes.find(node => node.type === 'KaraokeLine').props.line.text, 'current')
    nodes.find(node => node.type === 'TouchableOpacity').props.onPress(); assert.equal(opened, 1)
    pills()[1].props.onPress(); nodes = render(); assert.ok(text(nodes).includes('romaji'))
    pills()[0].props.onPress(); nodes = render(); assert.ok(!text(nodes).includes('translated'))
    assert.ok(text(nodes).includes('romaji'))
    props.lines = [{ text: 'plain' }]; nodes = render()
    assert.ok(pills().every(node => node.props.disabled && !node.props.selected))
    const before = [...values]; pills()[0].props.onPress(); assert.deepEqual(values, before)
  }
})

test('6.3 native fill measures word widths and updates clips without React renders; pause/seek/rate cleanup', () => {
  const slots = []; const effects = []; const handlers = new Map(); const frames = new Map()
  let cursor = 0; let playing = true; let now = 0; let id = 0; let rate = 1
  const playerState = { progress: { nowPlayTime: 1 } }
  const component = load('src/components/lyric/KaraokeLine.tsx', {
    ...base,
    react: { memo: fn => fn, useEffect: fn => { effects.push(fn) }, useState: initial => [initial, () => {}], useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial } } },
    '@/plugins/lyric': { getLyricClockOffset: () => 0 },
    '@/plugins/lyricWords': math,
    '@/store/player/hook': { useIsPlay: () => playing },
    '@/store/player/state': { default: playerState },
    '@/store/setting/hook': { useSettingValue: () => rate },
  }, { performance: { now: () => now }, requestAnimationFrame: callback => { frames.set(++id, callback); return id }, cancelAnimationFrame: id => frames.delete(id), global: { state_event: { on: (name, fn) => handlers.set(name, fn), off: name => handlers.delete(name) } } }).default
  const line = { text: 'Hello', words: [{ text: 'Hello', startMs: 1000, endMs: 1400 }] }
  const render = () => { cursor = 0; effects.length = 0; return component({ line, size: 19, active: true }) }
  const tree = render(); const updates = []
  assert.equal(walk(tree).length, 7, 'one word: four Views, two full-line Texts and one measurement Text')
  const measured = walk(tree).find(node => node.type === 'Text' && node.props.onLayout)
  const refs = walk(tree).filter(node => node.props.ref)
  for (const node of refs) node.props.ref({ setNativeProps: props => { if (node === refs[0]) updates.push(props.style.width) } })
  measured.props.onLayout({ nativeEvent: { layout: { width: 80 } } })
  let cleanup = effects[0]()
  assert.equal(updates.at(-1), 0)
  now = 200; frames.get(id)(); assert.equal(updates.at(-1), 40)
  assert.equal(slots.length, 5, 'frame callback never renders or allocates React hooks')
  now = 400; frames.get(id)(); assert.equal(updates.at(-1), 80)
  handlers.get('playProgressChanged')({ nowPlayTime: 1 }); assert.equal(updates.at(-1), 0, 'seek resets fill')
  cleanup(); assert.equal(handlers.size, 0)
  frames.clear(); playing = false; render(); cleanup = effects[0]()
  assert.equal(frames.size, 0, 'paused playback does not request frames')
  handlers.get('playProgressChanged')({ nowPlayTime: 1.2 }); assert.equal(updates.at(-1), 40)
  cleanup(); playing = true; rate = 2; render(); cleanup = effects[0]()
  now = 500; frames.get(id)(); assert.equal(updates.at(-1), 40, '2x advances 200ms in 100ms')
  cleanup()
  line.text = 'Hello world'
  line.words = [{ text: 'Hello ', startMs: 1000, endMs: 1400 }, { text: 'world', startMs: 1500, endMs: 1900 }]
  const twoWords = render()
  walk(twoWords).filter(node => node.type === 'Text' && node.props.onLayout).forEach((node, index) => node.props.onLayout({ nativeEvent: { layout: { width: [80, 120][index] } } }))
  cleanup = effects[0]()
  handlers.get('playProgressChanged')({ nowPlayTime: 1.7 })
  assert.equal(updates.at(-1), 140, 'single clip uses measured word widths: 80 + 120 * 0.5')
  cleanup()
  line.words = undefined
  const fallback = render(); assert.equal(fallback.type, 'Text'); assert.equal(fallback.props.color, 'ink')
})

test('6.3 core passes cached lxlrc to the mobile plugin; desktop and Bluetooth retain plain LRC', async() => {
  const calls = []
  const plugin = Object.fromEntries(['play', 'pause', 'setPlaybackRate', 'toggleTranslation', 'toggleRoma', 'init'].map(name => [name, () => {}]))
  plugin.setLyric = (...args) => { calls.push(['mobile', ...args]) }
  const desktop = { setDesktopLyric: async(...args) => { calls.push(['desktop', ...args]) } }
  const core = load('src/core/lyric.ts', {
    '@/plugins/lyric': plugin,
    '@/core/desktopLyric': desktop,
    '@/plugins/player': {},
    '@/store/player/state': { default: { musicInfo: { id: 'song', lrc: 'lrc', tlrc: 'tlrc', rlrc: 'rlrc', lxlrc: 'words' }, isPlay: false } },
    '@/store/setting/state': { default: { setting: { 'player.isShowBluetoothFullLyric': true } } },
    '@/plugins/player/utils': { updateNowPlayingTitles: async info => { calls.push(['bluetooth', info]) } },
  })
  await core.setLyric()
  assert.deepEqual(calls, [['mobile', 'lrc', 'tlrc', 'rlrc', 'words'], ['desktop', 'lrc', 'tlrc', 'rlrc'], ['bluetooth', { lyric: 'lrc' }]])
})


test('6.3 wrapped lyrics allocate static source-word clips and preserve every word', () => {
  const component = load('src/components/lyric/KaraokeLine.tsx', {
    ...base,
    react: { memo: fn => fn, useEffect() {}, useRef: initial => ({ current: initial }), useState: () => [true, () => {}] },
    '@/plugins/lyric': {},
    '@/plugins/lyricWords': math,
    '@/store/player/hook': { useIsPlay: () => false },
    '@/store/player/state': { default: {} },
    '@/store/setting/hook': { useSettingValue: () => 1 },
  }).default
  const words = [{ text: 'Hello ', startMs: 1000, endMs: 1400 }, { text: 'world', startMs: 1500, endMs: 1900 }]
  const tree = component({ line: { text: 'Hello world', words }, active: false, size: 28 })
  assert.equal(walk(tree).length, 11, '1 + 5 nodes per source word; no character splitting')
  assert.deepEqual(walk(tree).filter(node => node.props.onLayout).map(node => walk(node).find(child => child.type === 'Text').props.children), ['Hello ', 'world'])
})
