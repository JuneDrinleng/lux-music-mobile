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
const setup = (overrides = {}) => {
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
    'react-native': { ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', View: 'View', Image: 'NativeImage', StyleSheet: { absoluteFillObject: {}, create: value => value }, AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/components/common/Text': { default: 'Text', __esModule: true },
    '@/components/common/Image': { default: 'Image', defaultHeaders: { 'User-Agent': 'test' }, __esModule: true },
    '@/components/magazine': { SectionHeader: 'SectionHeader', MagTopBar: 'MagTopBar', SongRow: 'SongRow', Rule: 'Rule', DOCK_BASE_HEIGHT: 122 },
    '@/components/stats/statsShared': { weekdayKey: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
    '@/config/constant': { APP_LAYER_INDEX: { controls: 10 } },
    '@/lang': { useI18n: () => key => key },
    '@/theme/LuxTheme': { sharedLuxStyles: fn => () => fn({}), useLuxTheme: () => ({ colors: {} }) },
    '@/theme/luxColorMath': { rgbaHex: (color, alpha) => `${color}@${alpha}` },
    '@/theme/magazineRoles': { magazineRoles: () => ({ ink: 'ink', quiet: 'quiet', paper: 'paper', placeholder: 'placeholder' }) },
    '@/theme/magazineType': { PAGE_GUTTER: 22, magType: { h2: { size: 32 } } },
    '@/store/setting/hook': { useSettingValue: () => 'en_us' },
    '@/utils/pixelRatio': { setSpText: n => n, scaleSizeH: n => n },
    '@/utils/tools': { createStyle: value => value },
    '@/store/common/state': { default: { componentIds: { home: 'home' } }, __esModule: true },
    '@/store/common/hook': { useStatusbarHeight: () => 24 },
    '@/utils/hooks/useBackHandler': { useBackHandler() {} },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0, __esModule: true },
    '@/utils/imageCache': { peekCachedImageUri: () => null, cacheImageUri: async() => null, forgetCachedImageUri() {} },
    './useCoverDate': { useCoverDate: () => new Date(2026, 9, 23).getTime() },
    './DailyCover': { DailyCover: 'DailyCover' },
    './useRecommendations': { useRecommendations: () => state },
    './actions': { playRecommendations: async value => { played.push(value) }, startRecommendationRadio: async value => { seeds.push(value); return { items } } },
    './RecommendationViews': {
      RecommendationButton: 'RecommendationButton',
      RecommendationStatus: 'RecommendationStatus',
      useRecommendationAction: () => ({ pending: false, run: async(fn, success) => { await fn(); if (success) successes.push(success) } }),
    },
  }
  Object.assign(dependencies, overrides)
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
  const files = ['RecommendationSection', 'DailyCover', 'DailyRecommendationPage', 'WeeklyCover'].map(name => readFileSync(new URL(`../src/components/recommend/${name}.tsx`, import.meta.url), 'utf8')).join('\n')
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
    './Tabs/HomeTab': { default: 'HomeTab', __esModule: true },
    './Tabs/PlaylistTab': { default: 'PlaylistTab', __esModule: true },
    './Tabs/SettingsTab': { default: 'SettingsTab', __esModule: true },
    '@/screens/AudioEffects': { default: 'AudioEffectsPage', __esModule: true },
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


test('daily home cover skips coverless items for both background and the first three mini covers', () => {
  const env = setup()
  const { DailyCover } = env.load('../../components/recommend/DailyCover')
  const { FrostedCover } = env.load('../../components/recommend/FrostedCover')
  const withCovers = [items[0], { ...items[1], musicInfo: { meta: { picUrl: 'meta-cover' } } },
    { ...items[2], song: { ...items[2].song, img: 'song-cover' } }, items[3],
    { ...items[4], song: { ...items[4].song, img: 'third-cover' } },
    { ...items[5], song: { ...items[5].song, img: 'fourth-cover' } }]
  const all = nodes(env.host.render(DailyCover, { items: withCovers }))
  assert.equal(all.find(n => n.type === FrostedCover).props.uri, 'meta-cover')
  assert.deepEqual(all.filter(n => n.type === 'Image').map(n => n.props.url), ['meta-cover', 'song-cover', 'third-cover'])
  assert.equal(all.find(n => n.type === 'Text' && n.props.size === 100).props.style[0].includeFontPadding, false)
  assert.equal(nodes(env.host.render(DailyCover, { items })).find(n => n.type === FrostedCover).props.uri, undefined)
})

test('weekly cover uses playlist metadata and never the now-playing artwork; keeps count optional', () => {
  const env = setup()
  const { WeeklyCover } = env.load('../../components/recommend/WeeklyCover')
  const { FrostedCover } = env.load('../../components/recommend/FrostedCover')
  const props = { cover: 'playlist-cover', count: 30 }
  let all = nodes(env.host.render(WeeklyCover, props))
  assert.equal(all.find(n => n.type === FrostedCover).props.uri, 'playlist-cover')
  assert.equal(all.find(n => n.type === 'Image').props.url, 'playlist-cover')
  assert.equal(all.find(n => n.props.size === 13).props.children, 'recommend_cover_week_count')
  all = nodes(env.host.render(WeeklyCover, { cover: null }))
  assert.equal(all.find(n => n.type === FrostedCover).props.uri, undefined)
  assert.equal(all.find(n => n.props.size === 13).props.children, 'recommend_cover_week')
  const home = readFileSync(new URL('../src/screens/Home/Vertical/Tabs/HomeTab.tsx', import.meta.url), 'utf8')
  assert.match(home, /const featuredCover = featuredMeta\?\.cover \?\? null/)
  assert.doesNotMatch(home, /currentMusicInfo\?\.meta.picUrl/)
})

test('native blur 14 and paper tint fall back to placeholder on missing cover or image error, then recover for new URI', () => {
  const env = setup()
  const { FrostedCover } = env.load('../../components/recommend/FrostedCover')
  const render = uri => env.host.render(FrostedCover, { uri })
  let tree = render('cover')
  const image = nodes(tree).find(n => n.type === 'NativeImage')
  assert.equal(image.props.source.uri, 'cover')
  assert.equal(image.props.blurRadius, 14)
  assert.equal(image.props.fadeDuration, 0)
  assert.equal(image.props.resizeMode, 'cover')
  assert.equal(image.props.resizeMethod, 'resize')
  assert.ok(nodes(tree).some(n => n.props.style?.backgroundColor === 'paper@0.66'))
  image.props.onError()
  tree = render('cover')
  assert.equal(nodes(tree).filter(n => n.type === 'NativeImage').length, 0)
  assert.equal(tree.props.style.backgroundColor, 'placeholder')
  assert.equal(nodes(tree).filter(n => n.type === 'View').length, 1)
  assert.equal(nodes(render('next-cover')).filter(n => n.type === 'NativeImage').length, 1)
  assert.equal(nodes(render(undefined)).filter(n => n.type === 'NativeImage').length, 0)
  for (const name of ['FrostedCover', 'DailyCover', 'WeeklyCover']) {
    assert.doesNotMatch(readFileSync(new URL(`../src/components/recommend/${name}.tsx`, import.meta.url), 'utf8'), /BlurView/)
  }
})

test('date line height scales with Text size and keeps the kicker gap at font scales 1, 1.3, 2', () => {
  const { dayNumberMetrics } = moduleLoader()('../../components/recommend/coverModel')
  for (const fontScale of [1, 1.3, 2]) {
    const metrics = dayNumberMetrics(n => n * fontScale, n => n)
    assert.equal(metrics.fontSize, 100 * fontScale)
    assert.equal(metrics.lineHeight, 104 * fontScale)
    assert.ok(metrics.lineHeight >= metrics.fontSize)
    assert.ok(metrics.gap >= 10)
    // Native font scaling also multiplies both the glyph size and line box equally.
    const native = dayNumberMetrics(n => Math.floor(n / fontScale), n => n)
    assert.ok(native.lineHeight * fontScale >= native.fontSize * fontScale)
  }
})

test('local Monday–Sunday range and ISO week handle year boundaries and DST weeks', () => {
  const { currentRecommendationWeek } = moduleLoader()('../../components/recommend/coverModel')
  for (const [date, start, end, expectedWeek] of [
    [new Date(2026, 9, 23), [9, 19], [9, 25], 43],
    [new Date(2021, 0, 1), [11, 28], [0, 3], 53],
    [new Date(2025, 11, 31), [11, 29], [0, 4], 1],
    [new Date(2026, 2, 8), [2, 2], [2, 8], 10],
  ]) {
    const { monday, sunday, week } = currentRecommendationWeek(date)
    assert.deepEqual([monday.getMonth(), monday.getDate()], start)
    assert.deepEqual([sunday.getMonth(), sunday.getDate()], end)
    assert.equal(week, expectedWeek)
  }
})

test('card copy localizes Chinese titles, numeric months, and the English preview strings', () => {
  const langs = ['zh-cn', 'zh-tw', 'en-us'].map(locale => JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, '')))
  assert.deepEqual(langs.map(l => l.home_discover_title), ['本周发现', '本週發現', 'Discover Weekly'])
  const fill = (s, values) => s.replace(/\{(\w+)\}/g, (_, k) => values[k])
  assert.equal(fill(langs[0].recommend_cover_today, { month: 10, year: 2026 }), '今日 · 2026 年 10 月')
  assert.equal(fill(langs[2].recommend_cover_today, { month: langs[2].recommend_month_10, year: 2026 }), 'TODAY · OCT 2026')
  assert.equal(fill(langs[2].recommend_cover_weekly, { start: 'OCT 19', end: '25' }), 'THIS WEEK · OCT 19 – 25')
  assert.equal(fill(langs[2].recommend_cover_week_count, { week: 43, count: 30 }), 'Week 43 · 30 songs')
})

test('blurred background waits for the shared cache, handles URI races, cache failure and unmount', async() => {
  const requests = new Map()
  const hits = new Map([['https://cover/hit', 'file:///shared-hit']])
  const env = setup({
    '@/utils/imageCache': {
      peekCachedImageUri: uri => hits.get(uri) ?? null,
      forgetCachedImageUri() {},
      cacheImageUri: uri => new Promise((resolve, reject) => { requests.set(uri, { resolve, reject }) }),
    },
  })
  const { FrostedCover } = env.load('../../components/recommend/FrostedCover')
  const render = uri => env.host.render(FrostedCover, { uri })
  const native = tree => nodes(tree).find(n => n.type === 'NativeImage')
  const flush = () => new Promise(resolve => setImmediate(resolve))
  const hit = native(render('https://cover/hit'))
  assert.equal(hit.props.source.uri, 'file:///shared-hit')
  assert.equal(native(render('https://cover/first')), undefined)
  assert.equal(native(render('https://cover/second')), undefined)
  requests.get('https://cover/first').resolve('file:///old')
  await flush()
  assert.equal(native(render('https://cover/second')), undefined)
  requests.get('https://cover/second').resolve('file:///shared-second')
  await flush()
  const loaded = native(render('https://cover/second'))
  assert.equal(loaded.props.source.uri, 'file:///shared-second')
  assert.equal(native(render('https://cover/second')).props.source, loaded.props.source)
  loaded.props.onError()
  assert.equal(native(render('https://cover/second')), undefined)
  render('https://cover/rejected')
  requests.get('https://cover/rejected').reject(Error('offline'))
  await flush()
  assert.equal(native(render('https://cover/rejected')), undefined)
  render('https://cover/missing')
  requests.get('https://cover/missing').resolve(null)
  await flush()
  assert.equal(native(render('https://cover/missing')), undefined)
  render('https://cover/unmounted')
  env.host.dispose()
  requests.get('https://cover/unmounted').resolve('file:///too-late')
  await flush()
  assert.equal(native(render('https://cover/unmounted')), undefined)
  env.host.dispose()
})

test('recommendation memo boundaries and stable playback callbacks keep current playback state', () => {
  const source = name => readFileSync(new URL(`../src/components/recommend/${name}.tsx`, import.meta.url), 'utf8')
  for (const name of ['RecommendationSection', 'DailyCover', 'WeeklyCover', 'FrostedCover']) {
    assert.match(source(name), new RegExp(`export const ${name} = memo\\(`))
  }
  assert.match(source('DailyCover'), /useMemo\(\(\) => coveredRecommendations\(items\)\.slice\(0, 3\), \[items\]\)/)
  assert.match(source('RecommendationSection'), /<WeeklyCover cover=\{discover.cover\} count=\{discover.count\}/)
  const home = readFileSync(new URL('../src/screens/Home/Vertical/Tabs/HomeTab.tsx', import.meta.url), 'utf8')
  assert.match(home, /handlePlayPlaylist=\{handlePlayPlaylist\}/)
  assert.match(home, /const onOpenWeekly = useCallback\([\s\S]*?\[discover.sourceListId\]\)/)
  assert.match(home, /const onPlayWeekly = useCallback\([\s\S]*?\[discover.sourceListId, handlePlayPlaylist\]\)/)
  assert.match(home, /onOpenWeekly=\{onOpenWeekly\}/)
  assert.match(home, /onPlayWeekly=\{onPlayWeekly\}/)
  assert.match(home, /playbackRef.current = \{ isPlay, isPlaylistCurrent \}/)
  assert.match(home, /const handlePlayPlaylist = useCallback\(async[\s\S]*?playbackRef.current.isPlaylistCurrent\(listId\)[\s\S]*?playbackRef.current.isPlay[\s\S]*?\}, \[\]\)/)
  const cache = readFileSync(new URL('../src/utils/imageCache.ts', import.meta.url), 'utf8')
  assert.match(cache, /inflightTaskMap.get\(uri\)/)
  assert.match(source('FrostedCover'), /import \{ cacheImageUri, forgetCachedImageUri, peekCachedImageUri \} from '@\/utils\/imageCache'/)
})

test('memoized card date hook refreshes at midnight and resume, and cleans up timers/listeners', () => {
  const OriginalDate = global.Date
  const originalTimeout = global.setTimeout
  const originalClear = global.clearTimeout
  let now = new OriginalDate(2026, 9, 23, 23, 59).getTime()
  let timer
  let listener
  let removed = false
  class ClockDate extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [now])) }
  }
  const env = setup({
    'react-native': {
      AppState: {
        addEventListener: (event, callback) => {
          assert.equal(event, 'change')
          listener = callback
          return { remove: () => { removed = true } }
        },
      },
    },
  })
  try {
    global.Date = ClockDate
    global.setTimeout = (callback, delay) => { timer = { callback, delay }; return timer }
    global.clearTimeout = () => { timer = undefined }
    const { useCoverDate } = env.load('../../components/recommend/useCoverDate')
    const render = () => env.host.render(useCoverDate)
    assert.equal(render(), new OriginalDate(2026, 9, 23).getTime())
    assert.equal(timer.delay, 60_000)
    now += 60_000
    timer.callback()
    assert.equal(render(), new OriginalDate(2026, 9, 24).getTime())
    now = new OriginalDate(2026, 9, 26, 10).getTime()
    listener('active')
    assert.equal(render(), new OriginalDate(2026, 9, 26).getTime())
    env.host.dispose()
    assert.equal(timer, undefined)
    assert.equal(removed, true)
  } finally {
    global.Date = OriginalDate
    global.setTimeout = originalTimeout
    global.clearTimeout = originalClear
  }
})

test('cover date labels and colors respond to date, language and theme changes through memo', () => {
  let day = new Date(2026, 9, 23).getTime()
  let language = 'en_us'
  let ink = 'light-ink'
  const t = (key, values) => `${key}:${JSON.stringify(values)}`
  const env = setup({
    './useCoverDate': { useCoverDate: () => day },
    '@/lang': { useI18n: () => t },
    '@/store/setting/hook': { useSettingValue: () => language },
    '@/theme/magazineRoles': { magazineRoles: () => ({ ink }) },
  })
  const { DailyCover } = env.load('../../components/recommend/DailyCover')
  const render = () => nodes(env.host.render(DailyCover, { items }))
  assert.match(render().find(n => n.props.size === 11).props.children, /recommend_month_10/)
  language = 'zh_cn'
  assert.match(render().find(n => n.props.size === 11).props.children, /"month":10/)
  day = new Date(2026, 10, 1).getTime()
  ink = 'dark-ink'
  const changed = render()
  assert.match(changed.find(n => n.props.size === 11).props.children, /"month":11/)
  assert.equal(changed.find(n => n.props.size === 100).props.children, 1)
  assert.equal(changed.find(n => n.props.size === 100).props.color, 'dark-ink')
  env.host.dispose()
})
