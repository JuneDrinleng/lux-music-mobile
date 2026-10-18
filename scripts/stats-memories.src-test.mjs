/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const moduleLoader = (dependencies = {}) => {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const js = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(name => {
      if (name in dependencies) return dependencies[name]
      const path = name.startsWith('@/') ? join(root, 'src', name.slice(2)) : resolve(dirname(file), name)
      return load(existsSync(`${path}.ts`) ? `${path}.ts` : join(path, 'index.ts'))
    }, module, module.exports)
    return module.exports
  }
  return name => load(join(root, 'src/utils/memories', `${name}.ts`))
}
const load = moduleLoader()
const layout = load('layout')
const { buildMemoryTimeline, groupMemoryTimeline, visibleMilestones } = load('timeline')
const { emptyMilestoneState, evaluate } = load('milestones')
const at = Date.parse
const now = at('2026-10-17T12:00:00Z')
const record = (time, id, hours = 1) => ({
  id,
  deviceId: 'device',
  startedAt: at(time),
  endedAt: at(time) + hours * 3_600_000,
  listenedMs: hours * 3_600_000,
  song: { name: 'Lemon', singer: 'Artist', source: 'wy', songmid: 'lemon' },
})

test('5A remains the setting default; stats entry uses Magazine/Replay and monthly entry selects all three layouts', () => {
  assert.equal(layout.DEFAULT_MEMORIES_LAYOUT, 'monthly')
  for (const invalid of [undefined, null, '', 'magazine', 'replay', {}, 6]) {
    assert.equal(layout.normalizeMemoriesLayout(invalid), 'monthly')
  }
  for (const value of ['monthly', 'cards', 'timeline']) {
    assert.equal(layout.selectStatsLayout(value, 'magazine'), 'magazine')
    assert.equal(layout.selectStatsLayout(value, 'replay'), 'replay')
    assert.equal(layout.selectStatsLayout(value, 'magazine', true), value)
    assert.equal(layout.selectStatsLayout(value, 'replay', true), value)
  }
})

const preference = (disk, beforeRead = async() => {}) => moduleLoader({
  '@/config/constant': { storageDataPrefix: { memoriesLayout: 'layout' } },
  '@/plugins/storage': {
    getData: async key => { const snapshot = disk.get(key); await beforeRead(); return snapshot },
    saveData: async(key, value) => { disk.set(key, value) },
  },
})('layoutStore')

test('new setting uses local persistence, not the existing Magazine/Replay key; switches notify and survive reopening', async() => {
  const disk = new Map([['statsPageStyle', 'replay']])
  const store = preference(disk)
  assert.equal(store.getMemoriesLayout(), 'monthly')
  assert.equal(await store.hydrateMemoriesLayout(), 'monthly')
  const updates = []
  const stop = store.subscribeMemoriesLayout(value => { updates.push(value) })
  store.setMemoriesLayout('cards')
  store.setMemoriesLayout('timeline')
  assert.deepEqual(updates, ['cards', 'timeline'])
  assert.equal(disk.get('statsPageStyle'), 'replay')
  assert.equal(await preference(disk).hydrateMemoriesLayout(), 'timeline')
  stop()
  store.setMemoriesLayout('monthly')
  assert.equal(updates.length, 2)
})

test('late hydration cannot undo a setting selected while storage was loading', async() => {
  let release
  const waiting = new Promise(resolve => { release = resolve })
  const store = preference(new Map([['layout', 'timeline']]), () => waiting)
  const hydration = store.hydrateMemoriesLayout()
  store.setMemoriesLayout('cards')
  release()
  assert.equal(await hydration, 'cards')
})

test('timeline groups dates descending, keeps distinct events on one day and does not mutate its input', () => {
  const history = [record('2025-10-17T12:00:00Z', 'old'), record('2026-09-30T12:00:00Z', 'reached', 100)]
  const state = evaluate(history, emptyMilestoneState(), 'UTC').state
  const groups = buildMemoryTimeline(history, state, now, 'UTC')
  assert.deepEqual(groups.map(group => group.date), ['2026-10-17', '2026-10-01', '2026-09-30', '2025-11-01'])
  assert.equal(groups[0].items[0].kind, 'anniversary')
  assert.equal(groups[1].items[0].kind, 'monthly')
  assert.equal(groups[1].items[0].report.month, 9)
  assert.equal(groups[2].items[0].kind, 'milestone')
  const entries = [groups[2].items[0], groups[0].items[0], { ...groups[2].items[0], id: 'another' }]
  const snapshot = JSON.stringify(entries)
  const grouped = groupMemoryTimeline(entries)
  assert.equal(grouped[1].items.length, 2)
  assert.equal(JSON.stringify(entries), snapshot)
  assert.deepEqual(buildMemoryTimeline([], emptyMilestoneState(), now, 'UTC'), [])
})

test('monthly timeline uses local calendar boundaries, omits current/future months and opens the actual report month', () => {
  const history = [record('2026-10-01T06:30:00Z', 'sep-in-la'), record('2026-10-02T12:00:00Z', 'oct'), record('2027-01-01', 'future')]
  const groups = buildMemoryTimeline(history, emptyMilestoneState(), now, 'America/Los_Angeles')
  assert.deepEqual(groups.map(group => group.date), ['2026-10-01'])
  assert.equal(groups[0].items[0].report.month, 9)
  assert.equal(groups[0].items[0].report.songCount, 1)
})

test('UI ignore action persists per space, suppresses progress after reopening and retains achieved timeline events', async() => {
  const disk = new Map()
  let space = 'local'
  const store = moduleLoader({
    '@/config/constant': { storageDataPrefix: { memoriesMilestones: 'milestones' } },
    '@/utils/dataSpace': { getActiveSpace: () => space, namespacedKey: (key, id) => `${key}@${id}` },
    '../playHistory/store': { getPlayRecords: () => [] },
    '@/plugins/storage': {
      getData: async key => structuredClone(disk.get(key) ?? null),
      saveData: async(key, value) => { disk.set(key, structuredClone(value)) },
    },
  })('store')
  const history = [record('2026-09-30T12:00:00Z', 'reached', 100)]
  await store.evaluateMilestones(history, 'UTC')
  await store.ignoreMilestone('uniqueSongs:1000')
  assert.equal(visibleMilestones(history, await store.loadMilestoneState(), 'UTC').some(item => item.id == 'uniqueSongs:1000'), false)
  await store.ignoreMilestone('artistHours:100:Artist')
  assert.equal(buildMemoryTimeline(history, await store.loadMilestoneState(), now, 'UTC').flatMap(group => group.items).filter(item => item.kind == 'milestone').length, 1)
  space = 'lux:server:alice'
  assert.deepEqual((await store.loadMilestoneState()).ignored, [])
  space = 'local'
  assert.deepEqual((await store.loadMilestoneState()).ignored, ['uniqueSongs:1000', 'artistHours:100:Artist'])
})

test('5B This week is a Monday-based calendar period and keeps the existing rolling seven-day range', () => {
  const { rangeBounds, previousRangeBounds, buildRangeStats } = load('../playHistory/range')
  const wednesday = new Date(2026, 9, 14, 12).getTime()
  const monday = new Date(2026, 9, 12).getTime()
  const sunday = new Date(2026, 9, 11, 12).toISOString()
  const current = rangeBounds('week', wednesday)
  assert.equal(current.start, monday)
  assert.equal(current.end, new Date(2026, 9, 15).getTime())
  assert.deepEqual(previousRangeBounds('week', wednesday), { start: new Date(2026, 9, 5).getTime(), end: new Date(2026, 9, 8).getTime() })
  const history = [record(sunday, 'sunday'), record(new Date(2026, 9, 12, 12).toISOString(), 'monday')]
  const stats = buildRangeStats(history, 'week', wednesday)
  assert.equal(stats.songs[0].playCount, 1)
  assert.equal(stats.dayCount, 3)
  assert.equal(stats.chart.length, 3)
  assert.equal(buildRangeStats(history, 'days7', wednesday).songs[0].playCount, 2)
})

// Execute the real stats shell with lightweight hooks and leaf surfaces, as in the src UI tests.
const statsFixture = (pageStyle, memoriesLayout) => {
  const slots = []; let cursor = 0; let back; let closed = 0
  const model = { pageStyle, memoriesLayout, setRange: value => { model.range = value } }
  const jsx = (type, props) => ({ type, props })
  const deps = {
    react: {
      useState: initial => {
        const i = cursor++
        if (!(i in slots)) slots[i] = initial
        return [slots[i], value => { slots[i] = value }]
      },
      useEffect() {},
      useCallback: fn => fn,
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Animated: { View: 'View' }, useWindowDimensions: () => ({ width: 375 }) },
    '@/components/common/overlaySlideTransition': { useOverlaySlideTransition: () => ({ requestClose: fn => fn() }) },
    '@/theme/LuxTheme': { sharedLuxStyles: () => () => ({}), useLuxTheme() {} },
    '@/theme/magazineRoles': {},
    '@/utils/tools': {},
    '@/utils/hooks/useBackHandler': { useBackHandler: fn => { back = fn } },
    '@/utils/memories/layout': layout,
    './useListeningStatsModel': { useListeningStatsModel: () => model },
    ...Object.fromEntries(['MemoriesStatsPage', 'MonthlyReportPage', 'ListeningStatsMagazine', 'ListeningStatsReplay'].map(name => [`./${name}`, { [name]: name }])),
  }
  const module = { exports: {} }
  const file = join(root, 'src/components/stats/ListeningStatsPage.tsx')
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, name)
    return deps[name]
  }, module, module.exports)
  return {
    render: () => { cursor = 0; return module.exports.default({ onClose: () => { closed++ } }).props.children },
    back: () => back(),
    closed: () => closed,
    model,
  }
}

for (const style of ['magazine', 'replay']) {
  for (const selected of ['monthly', 'cards', 'timeline']) {
    test(`stats entry → ${style}; 月报 → selected ${selected}; report/back → original stats`, () => {
      const f = statsFixture(style, selected)
      const rootType = style === 'magazine' ? 'ListeningStatsMagazine' : 'ListeningStatsReplay'
      const entry = f.render()
      assert.equal(entry.type, rootType)
      entry.props.onOpenMonthly()
      let report = f.render()
      assert.equal(report.type, selected === 'monthly' ? 'MonthlyReportPage' : 'MemoriesStatsPage')
      if (selected !== 'monthly') {
        assert.equal(report.props.timeline, selected === 'timeline')
        // Both the generic monthly tab and dated card/timeline deep links bypass the layout selector.
        report.props.onOpenMonthly()
        assert.equal(f.render().type, 'MonthlyReportPage')
        f.render().props.onClose()
        f.render().props.onOpenMonthly()
        report = f.render()
        const month = { year: 2025, month: 9 }
        report.props.onOpenMonthly(month)
        assert.deepEqual(f.render().props.initialMonth, month)
        assert.equal(f.render().type, 'MonthlyReportPage')
      }
      f.render().props.onClose()
      assert.equal(f.render().type, rootType)
      assert.equal(f.closed(), 0)
      f.render().props.onOpenMonthly()
      f.render()
      f.back()
      assert.equal(f.render().type, rootType)
      f.render().props.onClose()
      assert.equal(f.closed(), 1)
    })
  }
}

test('5C annual replay stays available and its monthly button uses the selected report surface', () => {
  const f = statsFixture('magazine', 'timeline')
  f.render().props.onOpenMonthly()
  f.render().props.onOpenReplay()
  assert.equal(f.render().type, 'ListeningStatsReplay')
  assert.equal(f.model.range, 'year')
  f.render().props.onOpenMonthly()
  assert.equal(f.render().type, 'MemoriesStatsPage')
  assert.equal(f.render().props.timeline, true)
  f.back()
  assert.equal(f.render().type, 'ListeningStatsMagazine')
})
