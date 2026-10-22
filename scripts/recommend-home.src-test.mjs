/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { moduleLoader, hookHost } from './recommend.src-test.mjs'

const nodes = root => {
  const result = []
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    result.push(node)
    visit(node.props?.children)
  }
  visit(root)
  return result
}
const items = Array.from({ length: 30 }, (_, i) => ({ key: `s${i}`, song: { source: 'kw', songmid: String(i), name: `Song ${i}`, interval: '03:41' }, reasons: ['library'] }))
const setup = () => {
  const host = hookHost()
  const played = []
  const seeds = []
  const successes = []
  let retries = 0
  const state = { batch: { items, failures: [] }, loading: false, failed: false, reload: async retry => { retries += Number(retry) } }
  const jsx = (type, props) => ({ type, props })
  const dependencies = {
    react: host.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', View: 'View', StyleSheet: { absoluteFillObject: {} } },
    '@/components/common/Text': { default: 'Text', __esModule: true },
    '@/components/common/Image': { default: 'Image', __esModule: true },
    '@/components/magazine': { SectionHeader: 'SectionHeader', MagTopBar: 'MagTopBar', SongRow: 'SongRow', Rule: 'Rule', DOCK_BASE_HEIGHT: 122 },
    '@/components/stats/statsShared': { weekdayKey: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
    '@/config/constant': { APP_LAYER_INDEX: { controls: 10 } },
    '@/lang': { useI18n: () => key => key },
    '@/theme/LuxTheme': { sharedLuxStyles: fn => () => fn({}), useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({ ink: 'ink', quiet: 'quiet' }) },
    '@/theme/magazineType': { PAGE_GUTTER: 22, magType: { h2: { size: 32 } } },
    '@/utils/tools': { createStyle: value => value },
    '@/store/common/state': { default: { componentIds: { home: 'home' } }, __esModule: true },
    '@/store/common/hook': { useStatusbarHeight: () => 24 },
    '@/utils/hooks/useBackHandler': { useBackHandler() {} },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0, __esModule: true },
    './DailyCover': { DailyCover: 'DailyCover' },
    './useRecommendations': { useRecommendations: () => state },
    './actions': { playRecommendations: async value => { played.push(value) }, startRecommendationRadio: async value => { seeds.push(value); return { items } } },
    './RecommendationViews': {
      RecommendationButton: 'RecommendationButton',
      RecommendationStatus: 'RecommendationStatus',
      useRecommendationAction: () => ({ pending: false, run: async(fn, success) => { await fn(); if (success) successes.push(success) } }),
    },
  }
  const load = moduleLoader(dependencies)
  return { host, played, seeds, successes, state, dependencies, retries: () => retries, load }
}

test('equal-height RecCards have one-line titles and no nested buttons; action row is outside the carousel', () => {
  const { host, load } = setup()
  const { RecCard, RecommendationSection } = load('../../components/recommend/RecommendationSection')
  const tree = host.render(RecommendationSection, { discover: { title: 'Weekly', cover: null, sourceListId: 'weekly' } })
  tree.props.onLayout({ nativeEvent: { layout: { width: 349 } } })
  const mounted = host.render(RecommendationSection, { discover: { title: 'Weekly', cover: null, sourceListId: 'weekly' } })
  const carousel = nodes(mounted).find(n => n.type === 'ScrollView')
  const cards = nodes(carousel).filter(n => n.type === RecCard)
  assert.equal(cards.length, 2)
  const rendered = cards.map(n => RecCard(n.props))
  assert.deepEqual(rendered.map(n => n.props.style.height), [283, 283])
  assert.equal(cards[0].props.width, 300)
  assert.equal(carousel.props.snapToInterval, 314)
  assert.equal(carousel.props.snapToAlignment, 'start')
  assert.equal(carousel.props.decelerationRate, 'fast')
  // Last content offset = 300 + 14 + 300 - 349 = 265; its right edge equals the viewport.
  assert.equal(cards[0].props.width + cards[0].props.gap + cards[1].props.width - 349, 265)
  for (const card of rendered) {
    assert.equal(nodes(card).filter(n => n.type === 'TouchableOpacity').length, 1)
    assert.equal(nodes(card).filter(n => n.type === 'RecommendationButton').length, 0)
    assert.equal(nodes(card).find(n => n.type === 'Text' && n.props.size === 22).props.numberOfLines, 1)
  }
  assert.equal(nodes(carousel).filter(n => n.type === 'RecommendationButton').length, 0)
  assert.equal(nodes(mounted).filter(n => n.type === 'RecommendationButton').length, 2)
  const topChildren = mounted.props.children
  assert.equal(topChildren[2].props.children[0].type, 'RecommendationButton')
  assert.equal(topChildren[3].type, 'RecommendationStatus')
})

test('play follows the settled index; radio always uses first daily song; cards navigate independently', async() => {
  const env = setup()
  const { RecommendationSection, RecCard } = env.load('../../components/recommend/RecommendationSection')
  let weeklyPlayed = 0
  let weeklyOpened = 0
  let dailyOpened = 0
  const previous = global.app_event
  global.app_event = { openDailyRecommendations: () => { dailyOpened++ } }
  const props = { discover: { title: 'Weekly', cover: null, sourceListId: 'weekly' }, onPlayWeekly: () => { weeklyPlayed++ }, onOpenWeekly: () => { weeklyOpened++ } }
  const render = () => env.host.render(RecommendationSection, props)
  const button = (tree, label) => nodes(tree).find(n => n.type === 'RecommendationButton' && n.props.label === label)
  try {
    render().props.onLayout({ nativeEvent: { layout: { width: 349 } } })
    let tree = render()
    const carousel = nodes(tree).find(n => n.type === 'ScrollView')
    assert.equal(carousel.props.onScroll, undefined)
    assert.equal(carousel.props.onScrollEndDrag, undefined)
    await button(tree, 'recommend_play_current').props.onPress()
    assert.deepEqual(env.played, [items])
    carousel.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 265 } } })
    tree = render()
    button(tree, 'recommend_play_current').props.onPress()
    assert.equal(weeklyPlayed, 1)
    assert.equal(env.played.length, 1)
    const dots = nodes(tree).filter(n => n.props.style?.some?.(s => s?.width === 16 || s?.width === 6))
    assert.equal(dots[1].props.style[1].width, 16)
    await button(tree, 'recommend_play_radio').props.onPress()
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(env.seeds, [items[0].song])
    assert.deepEqual(env.successes, ['recommend_radio_started'])
    const cards = nodes(tree).filter(n => n.type === RecCard)
    cards[0].props.onPress(); cards[1].props.onPress()
    assert.equal(dailyOpened, 1); assert.equal(weeklyOpened, 1)
    env.state.loading = true
    tree = render()
    assert.equal(button(tree, 'recommend_play_radio').props.disabled, true)
    assert.equal(button(tree, 'recommend_play_current').props.disabled, false)
    props.discover.sourceListId = null
    assert.equal(button(render(), 'recommend_play_current').props.disabled, true)
    carousel.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 0 } } })
    assert.equal(button(render(), 'recommend_play_current').props.disabled, true)
    const status = nodes(render()).find(n => n.type === 'RecommendationStatus')
    status.props.reload()
    assert.equal(env.retries(), 1)
  } finally { global.app_event = previous; env.host.dispose() }
})

test('detail renders all daily songs with source, reason, interval; row, play all, radio, retry, back work', async() => {
  const env = setup()
  const { DailyRecommendationPage } = env.load('../../components/recommend/DailyRecommendationPage')
  let closed = 0
  const tree = env.host.render(DailyRecommendationPage, { onClose: () => { closed++ } })
  const all = nodes(tree)
  const rows = all.filter(n => n.type === 'SongRow')
  assert.equal(rows.length, items.length)
  assert.deepEqual(rows.map(n => n.props.index), items.map((_, i) => i + 1))
  assert.equal(rows[0].props.source, 'kw')
  assert.equal(rows[0].props.sourceLabel, 'kw')
  assert.equal(rows[0].props.duration, '03:41')
  assert.equal(rows[0].props.subtitle, 'recommend_reason_library')
  await rows[7].props.onPress()
  assert.deepEqual(env.played, [[items[7]]])
  await all.find(n => n.type === 'RecommendationButton' && n.props.fill).props.onPress()
  assert.deepEqual(env.played.at(-1), items)
  await all.find(n => n.type === 'RecommendationButton' && !n.props.fill).props.onPress()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(env.seeds, [items[0].song])
  assert.deepEqual(env.successes, ['recommend_radio_started'])
  all.find(n => n.type === 'MagTopBar').props.onBack()
  assert.equal(closed, 1)
  all.find(n => n.type === 'RecommendationStatus').props.reload()
  assert.equal(env.retries(), 1)
  env.state.loading = true
  const loading = nodes(env.host.render(DailyRecommendationPage, { onClose() {} }))
  assert.ok(loading.filter(n => n.type === 'RecommendationButton').every(n => n.props.disabled))
})

test('all new recommendation copy has three-language parity and identical placeholders', () => {
  const locales = ['zh-cn', 'zh-tw', 'en-us'].map(locale => JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, '')))
  const files = ['RecommendationSection', 'DailyCover', 'DailyRecommendationPage'].map(name => readFileSync(new URL(`../src/components/recommend/${name}.tsx`, import.meta.url), 'utf8')).join('\n')
  const keys = [...files.matchAll(/t\('(recommend_[^']+)'/g)].map(match => match[1])
  keys.push(...Array.from({ length: 12 }, (_, i) => `recommend_month_${i + 1}`))
  for (const key of keys) {
    for (const locale of locales) assert.ok(locale[key], key)
    const placeholders = locales.map(locale => (locale[key].match(/\{\w+\}/g) ?? []).sort())
    assert.deepEqual(placeholders[0], placeholders[1], key)
    assert.deepEqual(placeholders[0], placeholders[2], key)
  }
})


test('daily detail follows pushed-page navigation, disables pager gestures, closes on back and tab changes', () => {
  const env = setup()
  const previousApp = global.app_event
  const previousState = global.state_event
  const app = new EventEmitter()
  for (const event of ['closePlaylistDetail', 'closeLocalSongs', 'closeListeningStats', 'closeListenTogether', 'closeDailyRecommendations']) app[event] = () => app.emit(event)
  app.verticalSearchPageVisibleChanged = () => {}
  app.settingsSearchStateUpdated = () => {}
  global.app_event = app
  global.state_event = new EventEmitter()
  const load = moduleLoader({
    ...env.dependencies,
    '@/store/common/state': { default: { navActiveId: 'nav_search' }, __esModule: true },
    '@/core/common': { setNavActiveId() {} },
    'react-native-pager-view': { default: 'PagerView', __esModule: true },
    '@/components/recommend/DailyRecommendationPage': { DailyRecommendationPage: 'DailyRecommendationPage' },
    './SearchPage': { default: 'SearchPage', __esModule: true },
    './SharedTopBar': { default: 'SharedTopBar', __esModule: true },
    './Tabs/HomeTab': { default: 'HomeTab', __esModule: true },
    './Tabs/PlaylistTab': { default: 'PlaylistTab', __esModule: true },
    './Tabs/SettingsTab': { default: 'SettingsTab', __esModule: true },
  })
  const Main = load('../../screens/Home/Vertical/Main').default
  const render = () => nodes(env.host.render(Main, {}))
  try {
    assert.equal(render().find(n => n.type === 'DailyRecommendationPage'), undefined)
    app.emit('openDailyRecommendations')
    let tree = render()
    assert.equal(tree.find(n => n.type === 'PagerView').props.scrollEnabled, false)
    tree.find(n => n.type === 'DailyRecommendationPage').props.onClose()
    assert.equal(render().find(n => n.type === 'DailyRecommendationPage'), undefined)
    app.emit('openDailyRecommendations')
    render()
    global.state_event.emit('navActiveIdUpdated', 'nav_love')
    assert.equal(render().find(n => n.type === 'DailyRecommendationPage'), undefined)
    app.emit('openDailyRecommendations')
    render()
    app.emit('openPlaylistDetail', 'weekly')
    tree = render()
    assert.equal(tree.find(n => n.type === 'DailyRecommendationPage'), undefined)
    assert.equal(tree.find(n => n.type === 'SearchPage').props.covered, true)
  } finally {
    env.host.dispose()
    assert.equal(app.listenerCount('openDailyRecommendations'), 0)
    global.app_event = previousApp
    global.state_event = previousState
  }
})
