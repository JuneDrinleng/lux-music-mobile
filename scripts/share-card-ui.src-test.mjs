/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const jsx = (type, props) => ({ type, props })
export const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children), ...walk(node.props?.footerContent)]
export const shareCardFixture = (file = 'src/components/shareCard/ShareCardPage.tsx', locale = 'zh-cn', overrides = {}) => {
  const slots = []; const effects = []; const events = new Map(); const beforeSpace = new Set()
  let cursor = 0; let tree; let props; let space = 'local'
  const env = { captures: [], shares: [], releases: [], textShares: [], toasts: [], closed: 0, history: [], failCapture: false, failShare: false, name: Promise.resolve('June') }
  const hooks = {
    memo: value => value,
    useState: initial => {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial } },
    useMemo: (compute, deps) => {
      const i = cursor++; const old = slots[i]
      if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) slots[i] = { deps, value: compute() }
      return slots[i].value
    },
    useEffect: (effect, deps) => {
      const i = cursor++; const old = effects[i]
      if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) effects[i] = { deps, effect, pending: true, cleanup: old?.cleanup }
    },
  }
  const messages = JSON.parse(readFileSync(join(root, `src/lang/${locale}.json`), 'utf8'))
  const t = (key, args = {}) => {
    assert.equal(typeof messages[key], 'string', `Missing ${locale}: ${key}`)
    return messages[key].replace(/\{(\w+)\}/g, (_, name) => args[name])
  }
  const roles = { paper: '#eef0fb', paperRaised: '#fff', ink: '#111827', onInk: '#fff', onAccent: '#111827', accent: '#c8e600', muted: '#767d89', display: '#16181f', eyebrow: '#838995', quiet: '#a9aeb8', hairline: '#e1e6ef', list: '#20242d' }
  const deps = {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ...Object.fromEntries(['Modal', 'ScrollView', 'View', 'FlatList', 'TouchableOpacity'].map(name => [name, name])), Share: { share: async value => { env.textShares.push(value) } } },
    'react-native-svg': { default: 'Svg', Text: 'SvgText' },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/Image': { default: 'Image' },
    '@/components/magazine': Object.fromEntries(['BackButton', 'MagSegmented', 'PrimaryButton', 'SecondaryButton', 'TextButton', 'TextTabs', 'MagazineSheet', 'Hairline', 'SectionHeader', 'Rule'].map(name => [name, name])),
    '@/lang': { useI18n: () => t },
    '@/store/common/hook': { useStatusbarHeight: () => 44 },
    '@/theme/LuxTheme': { sharedLuxStyles: builder => () => builder({}), useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => roles },
    '@/utils/tools': { createStyle: value => value, toast: value => { env.toasts.push(value) } },
    '@/utils/data': { getUserName: () => env.name },
    '@/utils/dataSpace': { getActiveSpace: () => space, onDataSpaceWillChange: listener => { beforeSpace.add(listener); return () => beforeSpace.delete(listener) } },
    '@/utils/playHistory/store': { getPlayRecords: () => env.history, subscribePlayHistory: listener => { env.historyChanged = listener; return () => {} } },
    'react-native-view-shot': { captureRef: async(ref, options) => { env.captures.push([ref, options]); await env.captureWait; if (env.failCapture) throw Error('capture'); return 'file:///card.png' }, releaseCapture: uri => env.releases.push(uri) },
    '@/utils/nativeModules/utils': { shareImage: async(...args) => { env.shares.push(args); if (env.failShare) throw Error('share') } },
    ...overrides,
  }
  const cache = new Map()
  const load = path => {
    if (cache.has(path)) return cache.get(path).exports
    const module = { exports: {} }; cache.set(path, module)
    const js = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
    new Script(`(function(require,module,exports,global){${js}\n})`, { filename: path }).runInThisContext()(name => {
      if (name in deps) return deps[name]
      const next = name.startsWith('@/') ? join(root, 'src', name.slice(2)) : resolve(dirname(path), name)
      return load(['.ts', '.tsx', '/index.ts'].map(ext => next + ext).find(existsSync))
    }, module, module.exports, { app_event: { on: (name, fn) => events.set(name, fn), off: name => events.delete(name) } })
    return module.exports
  }
  const component = Object.values(load(join(root, file)))[0]
  const render = nextProps => {
    props = nextProps ?? props; cursor = 0; tree = component(props)
    for (const node of walk(tree)) if (node.props?.ref) node.props.ref.current = {}
    for (const effect of effects.filter(Boolean)) if (effect.pending) { effect.pending = false; effect.cleanup?.(); effect.cleanup = effect.effect() }
    return tree
  }
  return {
    env,
    t,
    roles,
    render,
    load,
    tree: () => tree,
    nodes: type => walk(tree).filter(node => node.type === type),
    updateName: name => events.get('userNameUpdated')?.(name),
    changeSpace: () => { beforeSpace.forEach(fn => fn()); space = 'lux:other:user' },
  }
}

const sources = { lyrics: { title: '晴天', artist: '周杰伦', album: '叶惠美', lines: [{ text: '刮风这天', time: 0, translation: 'The windy day' }, { text: '我试过握着你手', time: 1000 }, { text: '但偏偏 雨渐渐', time: 2000 }] }, monthly: { title: '2025/03', minutes: 10, songCount: 2, artistCount: 1, playCount: 3, topSongs: [] } }
const open = locale => {
  const f = shareCardFixture(undefined, locale)
  f.render({ sources, initialTab: 'monthly', onClose: () => { f.env.closed++ }, monthlyFallback: async() => { f.env.textShares.push('fallback') } })
  f.nodes('View').find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 300, height: 300 } } }); f.render()
  return f
}

test('2B opens the requested tab; PNG system share alone is available; capture-only fallback and chooser failure stay distinct', async() => {
  const f = open()
  assert.equal(f.nodes('TextTabs')[0].props.value, 'monthly')
  assert.equal(f.nodes('PrimaryButton').length, 1)
  await f.nodes('PrimaryButton')[0].props.onPress(); await new Promise(resolve => setImmediate(resolve)); f.render()
  assert.equal(f.env.shares.length, 1)
  assert.equal(f.env.textShares.length, 0)
  assert.deepEqual(f.env.releases, ['file:///card.png'])
  f.env.failCapture = true
  f.nodes('PrimaryButton')[0].props.onPress(); await new Promise(resolve => setImmediate(resolve)); f.render()
  assert.deepEqual(f.env.textShares, ['fallback'])
  f.env.failCapture = false; f.env.failShare = true
  f.nodes('PrimaryButton')[0].props.onPress(); await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.env.textShares.length, 1)
  assert.equal(f.env.toasts.length, 1)
})

test('2B switches tabs/backgrounds/toggles in all locales; missing yearly history disables sharing', async() => {
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const f = open(locale); await Promise.resolve(); f.render()
    f.nodes('TextTabs')[0].props.onChange('lyrics'); f.render()
    assert.ok(f.nodes('Text').some(node => node.props.children === '@June'))
    f.nodes('SecondaryButton')[2].props.onPress(); f.render()
    assert.equal(f.nodes('Text').some(node => node.props.children === '@June'), false)
    f.nodes('TouchableOpacity').find(node => node.props.accessibilityLabel === f.t('share_card_background_ink')).props.onPress(); f.render()
    assert.equal(f.nodes('TouchableOpacity').find(node => node.props.accessibilityLabel === f.t('share_card_background_ink')).props.accessibilityState.selected, true)
    f.nodes('TextTabs')[0].props.onChange('annual'); f.render()
    assert.equal(f.nodes('PrimaryButton')[0].props.disabled, true)
    assert.ok(f.nodes('Text').some(node => node.props.children === f.t('share_card_empty')))
  }
})

test('2B ignores stale profile loads after a nickname edit or data-space switch and closes locally', async() => {
  const f = open(); f.nodes('TextTabs')[0].props.onChange('lyrics'); f.render()
  f.updateName('New name'); await Promise.resolve(); f.render()
  assert.ok(f.nodes('Text').some(node => node.props.children === '@New name'))
  f.changeSpace(); await Promise.resolve(); f.render()
  assert.equal(f.env.closed, 1)
  assert.equal(f.nodes('Text').some(node => node.props.children === '@New name'), false)
})

test('yearly aggregation uses local years, deduplicates sessions, ignores future history and ranks like monthly memories', () => {
  const f = open()
  const { annualShareReport } = f.load(join(root, 'src/utils/shareCard/reports.ts'))
  const record = (id, time, song = 'A', singer = 'One & Two') => ({ id, deviceId: 'd', startedAt: Date.parse(time), endedAt: Date.parse(time) + 60_000, listenedMs: 60_000, song: { source: 'wy', songmid: song, name: song, singer } })
  const first = record('first', '2025-01-01T08:00:00Z')
  const history = [first, first, record('old', '2025-01-01T07:59:59Z'), record('last', '2026-01-01T07:59:59Z'), record('new', '2026-01-01T08:00:00Z'), record('B', '2025-06-01T12:00:00Z', 'B')]
  const report = annualShareReport(history, 2025, Date.parse('2026-01-01T08:00:00Z'), 'America/Los_Angeles')
  assert.equal(report.playCount, 3)
  assert.equal(report.minutes, 3)
  assert.equal(report.songCount, 2)
  assert.equal(report.artistCount, 2)
  assert.deepEqual(report.topSongs.map(song => [song.name, song.playCount]), [['A', 2], ['B', 1]])
  assert.equal(annualShareReport(history, 2025, first.startedAt, 'America/Los_Angeles').playCount, 1)
})


test('2B suppresses duplicate presses and discards captures that finish after a data-space switch', async() => {
  const f = open()
  let finish
  f.env.captureWait = new Promise(resolve => { finish = resolve })
  const button = f.nodes('PrimaryButton')[0]
  button.props.onPress(); button.props.onPress()
  assert.equal(f.env.captures.length, 1)
  f.changeSpace(); finish(); await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.env.shares.length, 0)
  assert.equal(f.env.textShares.length, 0)
  assert.deepEqual(f.env.releases, ['file:///card.png'])
})

test('2A checks the initial line, caps selection at six, clears and exports ordered timestamped lines', () => {
  const f = shareCardFixture('src/components/shareCard/LyricSelectionSheet.tsx')
  const lines = Array.from({ length: 8 }, (_, i) => ({ time: i * 1000, text: `Line ${i}` }))
  let generated
  f.render({ source: 'song', lines, initialIndex: 2, song: 'Song', onClose() {}, onGenerate: value => { generated = value } })
  const row = i => f.nodes('FlatList')[0].props.renderItem({ item: f.nodes('FlatList')[0].props.data[i] })
  assert.equal(row(2).props.accessibilityState.checked, true)
  for (const i of [0, 1, 3, 4, 5, 6]) { row(i).props.onPress(); f.render() }
  assert.equal(f.nodes('MagazineSheet')[0].props.figure.value, '6')
  assert.equal(f.env.toasts.length, 1)
  f.nodes('PrimaryButton')[0].props.onPress()
  assert.deepEqual(generated.map(line => line.time), [0, 1000, 2000, 3000, 4000, 5000])
  f.nodes('MagazineSheet')[0].props.headerAction.onPress(); f.render()
  assert.equal(f.nodes('PrimaryButton')[0].props.disabled, true)
})

test('monthly 分享月报 opens the selected month in 2B and defers existing text share to its fallback', async() => {
  const f = shareCardFixture('src/components/stats/MonthlyReportPage.tsx', 'zh-cn', { '@/components/shareCard/ShareCardPage': { ShareCardPage: 'ShareCardPage' } })
  const now = new Date(2025, 2, 15, 12).getTime()
  const record = { id: 'd:1', deviceId: 'd', startedAt: now - 120000, endedAt: now - 60000, listenedMs: 60000, song: { source: 'wy', songmid: 'song', name: 'Song', singer: 'Artist' } }
  f.render({ model: { records: [record], now, t: f.t }, bottomPadding: 0, onClose() {} })
  f.nodes('SecondaryButton').find(node => node.props.label === f.t('monthly_share')).props.onPress(); f.render()
  const preview = f.nodes('ShareCardPage')[0]
  assert.equal(preview.props.initialTab, 'monthly')
  assert.equal(preview.props.sources.monthly.title, f.t('monthly_month', { year: 2025, month: 3 }))
  assert.equal(preview.props.sources.annual.playCount, 1)
  assert.equal(f.env.textShares.length, 0)
  await preview.props.monthlyFallback()
  assert.equal(f.env.textShares.length, 1)
  preview.props.onClose(); f.render()
  assert.equal(f.nodes('ShareCardPage').length, 0)
})
