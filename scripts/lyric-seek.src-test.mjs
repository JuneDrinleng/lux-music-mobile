import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (path, deps = {}, globals = {}) => {
  const js = ts.transpileModule(readFileSync(join(root, path), 'utf8'), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,${Object.keys(globals).join(',')}){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports, ...Object.values(globals))
  return module.exports
}
const common = load('src/utils/common.ts')
const locales = ['zh-cn', 'zh-tw', 'en-us'].map(lang => JSON.parse(readFileSync(join(root, `src/lang/${lang}.json`), 'utf8')))
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)]
const jsx = (type, props) => ({ type, props })

const fixture = (locale = locales[0]) => {
  const slots = []; const effects = []
  let cursor = 0; let dirty = false; let tree
  const ref = { current: null }
  const env = {
    active: true,
    line: 0,
    isPlay: false,
    id: 'song',
    lines: [
      { time: 0, text: 'First', extendedLyrics: ['translation', 'romaji'] },
      { time: 1850, text: '', extendedLyrics: [] },
      { time: 118900, text: 'Third', extendedLyrics: ['third translation'] },
      { time: 120000, text: '', extendedLyrics: [] },
    ],
    seeks: [],
    plays: 0,
    locked: false,
    scrolls: [],
    shares: [],
    settings: [],
  }
  const hooks = {
    forwardRef: component => props => component(props, ref),
    useState: initial => {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => {
        if (!Object.is(slots[index], value)) dirty = true
        slots[index] = value
      }]
    },
    useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial } },
    useMemo: (compute, deps) => {
      const index = cursor++; const old = slots[index]
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { deps, value: compute() }
      return slots[index].value
    },
    useCallback: (callback, deps) => hooks.useMemo(() => callback, deps),
    useImperativeHandle: (ref, create) => { ref.current = create() },
    useEffect: (effect, deps) => {
      const index = cursor++; const previous = effects[index]
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects[index] = { deps, effect, pending: true, cleanup: previous?.cleanup }
      }
    },
  }
  const roles = { paper: 'paper', placeholder: 'placeholder', ink: 'ink', muted: 'muted' }
  const deps = {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...Object.fromEntries(['FlatList', 'TouchableOpacity', 'View'].map(name => [name, name])), Share: { share: async value => { env.shares.push(value) } } },
    '@/components/common/Text': { default: 'Text' },
    '@/components/lyric/KaraokeLine': { default: 'KaraokeLine' },
    '@/components/common/Icon': { Icon: 'Icon' },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/common/Image': { default: 'Image' },
    '@/components/MusicAddModal': { default: 'MusicAddModal' },
    '@/components/shareCard/LyricSelectionSheet': { LyricSelectionSheet: 'LyricSelectionSheet' },
    '@/components/shareCard/ShareCardPage': { ShareCardPage: 'ShareCardPage' },
    '@/utils/dataSpace': { onDataSpaceWillChange: () => () => {} },
    '@/components/magazine': { Hairline: 'Hairline', PrimaryButton: 'PrimaryButton', SecondaryButton: 'SecondaryButton', MagSegmented: 'MagSegmented' },
    '@/config/constant': { LIST_IDS: { LOVE: 'love' }, MUSIC_TOGGLE_MODE: {}, MUSIC_TOGGLE_MODE_LIST: [] },
    '@/core/together/control': { blockTogetherMemberControl: () => env.locked },
    '@/core/common': { updateSetting(value) { env.settings.push(value) } },
    '@/core/list': { getListMusics: async() => [] },
    '@/core/player/player': { play: () => { env.plays++ } },
    '@/lang': { useI18n: () => (key, args = {}) => locale[key].replace(/\{(\w+)\}/g, (_, name) => args[name]) },
    '@/plugins/lyric': { useLrcPlay: () => ({ line: env.line }), useLrcSet: () => env.lines },
    '@/store/player/hook': {
      usePlayerMusicInfo: () => ({ id: env.id }),
      usePlayMusicInfo: () => ({}),
      useIsPlay: () => env.isPlay,
      useProgress: () => ({}),
    },
    '@/store/setting/hook': { useSettingValue: () => '' },
    '@/utils/common': common,
    '@/utils/tools': { createStyle: value => value },
    '@/theme/LuxTheme': {
      useLuxTheme: () => ({ colors: {} }),
      sharedLuxStyles: builder => {
        const style = builder()
        return () => style
      },
    },
    '@/theme/magazineRoles': { magazineRoles: () => roles },
    '@/theme/magazineType': { PAGE_GUTTER: 22, magType: { rowTitle: { size: 16 }, meta: { size: 12 } } },
    './PlayerTransport': { PlayerTransport: 'PlayerTransport', playerTransportControlStyles: {} },
  }
  const component = load('src/screens/PlayDetail/Vertical/Lyric.tsx', deps, {
    global: { app_event: { on() {}, off() {}, setProgress: time => { env.seeks.push(time) } } },
  }).default
  const list = () => walk(tree).find(node => node.type === 'FlatList').props
  const render = () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      dirty = false; cursor = 0
      tree = component({ active: env.active })
      list().ref.current = { scrollToIndex: args => { env.scrolls.push(args) } }
      for (const effect of effects.filter(Boolean)) {
        if (!effect.pending) continue
        effect.pending = false
        effect.cleanup?.(); effect.cleanup = effect.effect()
      }
      if (!dirty) return
    }
    throw new Error('Unstable render')
  }
  const row = index => list().renderItem({ item: list().data[index], index })
  const tap = (index, long = false) => {
    const target = walk(row(index)).find(node => node.type === 'TouchableOpacity')
    target.props[long ? 'onLongPress' : 'onPress'](); render()
  }
  const button = () => list().data.flatMap((_, index) => walk(row(index))).find(node => node.type === 'PrimaryButton')
  render()
  return { env, render, list, row, tap, button, ref, deps, root: () => tree }
}

test('6.2 preserves timed objects, extended fields and empty rows so highlighting and scrolling keep the parser index', () => {
  const f = fixture()
  assert.equal(f.list().data, f.env.lines)
  assert.equal(f.list().data.length, 4)
  assert.deepEqual(f.list().data[0].extendedLyrics, ['translation', 'romaji'])
  f.env.line = 2; f.render()
  assert.equal(f.env.scrolls.at(-1).index, 2)
  assert.ok(walk(f.row(2)).some(node => node.type === 'KaraokeLine' && node.props.size === 28 && node.props.line.text === 'Third'))
  f.tap(2)
  assert.deepEqual(f.env.seeks, [])
  assert.equal(f.env.plays, 0)
  assert.equal(f.button().props.label, '从 01:58 播放')
  assert.ok(walk(f.row(2)).some(node => node.props?.children === '按住行即预览'))
  assert.equal(f.button().props.compact, true)
  assert.equal(f.button().props.labelSize, 13)
})

test('6.2 confirmation seeks exact seconds (including fractions), resumes paused playback and dismisses', () => {
  for (const playing of [false, true]) {
    const f = fixture(); f.env.isPlay = playing
    f.tap(2)
    f.button().props.onPress(); f.render()
    assert.deepEqual(f.env.seeks, [118.9])
    assert.equal(f.env.plays, playing ? 0 : 1)
    assert.equal(f.button(), undefined)
  }
})

test('6.2 empty-line taps remain usable and zero/fraction/minute labels format mm:ss', () => {
  const f = fixture()
  for (const [index, label, time] of [[0, '00:00', 0], [1, '00:01', 1.85], [3, '02:00', 120]]) {
    f.tap(index)
    assert.equal(f.button().props.label, `从 ${label} 播放`)
    f.button().props.onPress(); f.render()
    assert.equal(f.env.seeks.at(-1), time)
    assert.equal(f.button(), undefined)
  }
  f.env.lines = [{ time: 6000000, text: '', extendedLyrics: [] }]; f.render(); f.tap(0)
  assert.equal(f.button().props.label, '从 100:00 播放')
})

test('6.2 scroll, drag, outside touches, new active line, lyric replacement, track change and leaving dismiss without seeking', () => {
  const actions = [
    f => f.list().onScroll(),
    f => f.list().onScrollBeginDrag(),
    f => f.root().props.onTouchEnd(),
    f => f.ref.current.dismissSeek(),
    f => { f.env.line = 1 },
    f => { f.env.lines = f.env.lines.slice() },
    f => { f.env.id = 'next-song' },
    f => { f.env.active = false },
  ]
  for (const action of actions) {
    const f = fixture(); f.tap(2)
    assert.ok(f.button())
    action(f); f.render()
    assert.equal(f.button(), undefined)
    assert.deepEqual(f.env.seeks, [])
    assert.equal(f.env.plays, 0)
  }
})

test('6.2 tapping another row replaces selection; holding previews without seeking; row touches protect confirm from outside dismissal', () => {
  const f = fixture(); f.tap(2); f.tap(1, true)
  assert.equal(f.button().props.label, '从 00:01 播放')
  let stopped = false
  f.row(1).props.onTouchEnd({ stopPropagation() { stopped = true } })
  assert.equal(stopped, true)
  assert.deepEqual(f.env.seeks, [])
  assert.equal(f.env.plays, 0)
})

test('6.2 three languages have matching time interpolation and preview hint', () => {
  for (const locale of locales) {
    assert.equal(typeof locale.player_lyric_seek_hint, 'string')
    assert.deepEqual([...locale.player_lyric_seek_play.matchAll(/\{(\w+)\}/g)].map(match => match[1]), ['time'])
    const f = fixture(locale); f.tap(2)
    assert.equal(f.button().props.label, locale.player_lyric_seek_play.replace('{time}', '01:58'))
  }
})


test('6.2 compact shared PrimaryButton has 28 visible / 44 hit height and preview play icon', () => {
  const f = fixture(); f.tap(2)
  const component = load('src/components/magazine/PrimaryButton.tsx', {
    ...f.deps,
    react: { memo: value => value },
  }).PrimaryButton
  const button = component(f.button().props)
  assert.equal(Object.assign({}, ...button.props.style.filter(Boolean)).height, 28)
  assert.equal(28 + button.props.hitSlop.top + button.props.hitSlop.bottom, 44)
  assert.ok(walk(button).some(node => node.type === 'MdiIcon' && node.props.name === 'play' && node.props.size === 13))
  const rowStyle = Object.assign({}, ...f.row(2).props.style.flat().filter(Boolean))
  assert.equal(rowStyle.backgroundColor, 'placeholder')
  assert.equal(rowStyle.paddingVertical, 8)
  assert.equal(rowStyle.paddingHorizontal, 22)
  assert.equal(rowStyle.paddingLeft, 22)
  assert.equal(rowStyle.marginHorizontal, -22)
  assert.equal(rowStyle.gap, 8)
  assert.equal(rowStyle.flexDirection, 'row')
})

test('6.2 shared player chrome touches dismiss through the lyric ref; closed overlay disables lyric activity', () => {
  const f = fixture()
  const component = load('src/screens/PlayDetail/Vertical/index.tsx', {
    ...f.deps,
    react: { memo: value => value, useState: () => [2, () => {}], useRef: () => ({ current: null }), useCallback: value => value, useEffect() {} },
    'react-native-pager-view': { default: 'PagerView' },
    './Lyric': { default: 'Lyric' },
    './Pic': { default: 'Pic' },
    './PlayerChrome': { PlayerChrome: 'PlayerChrome' },
    '@/screens/Comment': { default: 'Comment' },
    '../context': { usePlayDetailClose: () => () => {} },
    '@/utils/hooks/useBackHandler': { useBackHandler() {} },
    '@/utils/nativeModules/utils': {},
  }).default
  const tree = component({ componentId: 'player', active: true })
  const lyric = walk(tree).find(node => node.type === 'Lyric')
  let dismissals = 0
  lyric.props.ref.current = { dismissSeek() { dismissals++ } }
  tree.props.onTouchEnd()
  assert.equal(dismissals, 1)
  assert.equal(lyric.props.active, true)
  const closedTree = walk(component({ componentId: 'player', active: false }))
  assert.equal(closedTree.find(node => node.type === 'Lyric').props.active, false)
  assert.equal(closedTree.find(node => node.type === 'Pic').props.active, false)
  assert.equal(typeof walk(tree).find(node => node.type === 'Pic').props.onLyricPress, 'function')
})


test('6.2 confirmation respects the existing together member playback control lock', () => {
  const f = fixture(); f.env.locked = true; f.tap(2)
  f.button().props.onPress(); f.render()
  assert.deepEqual(f.env.seeks, [])
  assert.equal(f.env.plays, 0)
  assert.equal(f.button(), undefined)
})


test('6.3 full lyrics preserve extended rows, add compact extra-line controls and share all lines including blanks', () => {
  const f = fixture()
  const header = walk(f.list().ListHeaderComponent)
  const segment = header.find(node => node.type === 'MagSegmented')
  assert.equal(segment.props.compact, true)
  segment.props.onChange('roma')
  assert.deepEqual(f.env.settings.at(-1), { 'player.isShowLyricTranslation': false, 'player.isShowLyricRoma': true })
  segment.props.onChange('none')
  assert.deepEqual(f.env.settings.at(-1), { 'player.isShowLyricTranslation': false, 'player.isShowLyricRoma': false })
  assert.ok(walk(f.row(0)).some(node => node.type === 'Text' && node.props.children === 'translation'))
  assert.ok(walk(f.row(0)).some(node => node.type === 'Text' && node.props.children === 'romaji'))
  header.find(node => node.type === 'SecondaryButton').props.onPress()
  assert.ok(f.env.shares[0].message.includes('First\ntranslation\nromaji\n\nThird'))
  assert.equal(f.button(), undefined)
})

test('6.7 long press retains seek selection; its card action opens 2A; track changes invalidate both surfaces', () => {
  const f = fixture()
  f.tap(2, true)
  assert.ok(f.button())
  assert.equal(walk(f.root()).some(node => node.type === 'LyricSelectionSheet'), false)
  walk(f.row(2)).find(node => node.type === 'SecondaryButton').props.onPress(); f.render()
  let sheet = walk(f.root()).find(node => node.type === 'LyricSelectionSheet')
  assert.equal(sheet.props.initialIndex, 2)
  assert.equal(sheet.props.lines[2].time, 118900)
  assert.deepEqual(f.env.seeks, [])
  assert.ok(f.button())
  sheet.props.onGenerate([sheet.props.lines[2]])
  f.render()
  assert.equal(walk(f.root()).some(node => node.type === 'LyricSelectionSheet'), false)
  assert.equal(walk(f.root()).find(node => node.type === 'ShareCardPage').props.sources.lyrics.lines[0].text, 'Third')
  f.env.id = 'different'; f.render()
  assert.equal(walk(f.root()).some(node => node.type === 'ShareCardPage'), false)
  f.tap(0, true)
  walk(f.row(0)).find(node => node.type === 'SecondaryButton').props.onPress(); f.render()
  sheet = walk(f.root()).find(node => node.type === 'LyricSelectionSheet')
  sheet.props.onClose(); f.render()
  assert.equal(walk(f.root()).some(node => node.type === 'LyricSelectionSheet'), false)
})
