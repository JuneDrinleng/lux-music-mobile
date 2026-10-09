/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, InteractionManager, ScrollView, TouchableOpacity, View, useWindowDimensions, type GestureResponderEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import Image from '@/components/common/Image'
import {
  DOCK_BASE_HEIGHT as BOTTOM_DOCK_BASE_HEIGHT,
  DeltaPill,
  EmptyState,
  Hairline,
  IconButton,
  MagSegmented,
  MagTopBar,
  RankedRow,
  SectionHeader,
  SkeletonRow,
  TextButton,
} from '@/components/magazine'
import useLinkedPlaylistId from '@/components/playlist/hooks/useLinkedPlaylistId'
import { weekdayKey } from '@/components/stats/statsShared'
import { useTodayListenedMinutes } from '@/components/stats/useTodayListening'
import { LIST_IDS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { pause, play, playListAsQueue } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { DEFAULT_USER_AVATAR, DEFAULT_USER_NAME, getListMusics, getUserAvatar, getUserName } from '@/utils/data'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { getBoardsList, getListDetail } from '@/core/leaderboard'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'
import { handlePlay as handleLbPlayAction } from '@/screens/Home/Views/Leaderboard/listAction'
import { pickMusicCover } from '@/utils/musicCover'
import { getPicUrl } from '@/core/music/online'
import { cacheImageUri, getCachedImageUri, peekCachedImageUri } from '@/utils/imageCache'
import { formatMinutes } from '@/utils/formatMinutes'
import { formatHomeDailyMeta, resolveHomeListCover, type HomeCoverSong } from '@/utils/homeBootGate'
import { getHomePlaylistMetaSnapshot, subscribeHomePlaylistMeta, toHomeCoverSong } from '@/utils/homeFirstScreenBoot'
import { peekPlaylistCover } from '@/utils/playlistCoverStore'
import { getData, saveData } from '@/plugins/storage'
import { getPlayRecords, subscribePlayHistory } from '@/utils/playHistory/store'
import { previousRangeBounds, recordInBounds } from '@/utils/playHistory/range'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'
import { magazineRoles } from '@/theme/magazineRoles'
import {
  COVER_LIST,
  H1_AFTER_TOP,
  PAGE_GUTTER,
  SECTION_TO_LIST,
  TABS_AFTER_EYEBROW,
  magType,
} from '@/theme/magazineType'

const OTHER_BOARD_PAGE_SIZE = 4
const OTHER_BOARD_DETAIL_CONCURRENCY = 2
const COVER_PREWARM_LIMIT = 6
const LEADERBOARD_HOME_CACHE_KEY = '@leaderboard_home_cache_v1'
const LB_PREVIEW_LIMIT = 5
const DAILY_PREVIEW_LIMIT = 4

const defaultFilterBoardKeywords: Record<'new' | 'trending' | 'top', string[]> = {
  new: ['新歌'],
  trending: ['飙升', '趋势'],
  top: ['热歌', '热门', 'TOP'],
}
const sourceBoardOverrides: Partial<Record<LX.OnlineSource, Partial<Record<'new' | 'trending' | 'top', string[]>>>> = {
  kg: { new: ['流行音乐'], top: ['TOP'] },
}

const SOURCE_SHORT_LABELS: Partial<Record<LX.OnlineSource, string>> = {
  kw: '酷我',
  kg: '酷狗',
  tx: '企鹅',
  wy: '网易',
  mg: '咪咕',
}

const findBoardForFilter = (boards: BoardItem[], filter: 'new' | 'trending' | 'top', source: LX.OnlineSource): BoardItem => {
  const keywords = sourceBoardOverrides[source]?.[filter] ?? defaultFilterBoardKeywords[filter]
  for (const keyword of keywords) {
    const found = boards.find(b => b.name.includes(keyword))
    if (found) return found
  }
  return boards[0]
}

interface LbSourceState {
  boardId: string
  boardName: string
  songs: LX.Music.MusicInfoOnline[]
  loading: boolean
  loaded: boolean
  error: boolean
}
interface LbOtherBoardState {
  boardId: string
  boardName: string
  songs: LX.Music.MusicInfoOnline[]
  loading: boolean
  loaded: boolean
  error: boolean
}
interface LbOtherSourceState {
  entries: LbOtherBoardState[]
  boards: BoardItem[]
  nextIndex: number
  loading: boolean
  loadingMore: boolean
  done: boolean
  loaded: boolean
  error: boolean
}
interface LeaderboardHomeCache {
  lbAllData?: LbAllData
  lbOtherData?: LbOtherData
  updatedAt: number
}
interface DiscoverCard {
  id: string
  sourceListId: string | null
  tag: string
  title: string
  subtitle: string
  count: number | null
  cover: string | null
}
interface LibraryItem {
  id: string
  title: string
  tag: string
  subtitle: string
}

type FilterId = 'all' | 'new' | 'trending' | 'top' | 'other'
type LbFilterId = Exclude<FilterId, 'all' | 'other'>
type LbAllData = Partial<Record<LbFilterId, Partial<Record<LX.OnlineSource, LbSourceState>>>>
type LbOtherData = Partial<Record<LX.OnlineSource, LbOtherSourceState>>
const LB_FILTER_IDS: LbFilterId[] = ['new', 'trending', 'top']

const homeCoverLookup = {
  mapped: (song: HomeCoverSong) => peekPlaylistCover(song.source, song.id),
  isCached: (url: string) => peekCachedImageUri(url) != null,
}

const createLbSourceState = (state: Partial<LbSourceState> = {}): LbSourceState => ({
  boardId: '',
  boardName: '',
  songs: [],
  loading: false,
  loaded: false,
  error: false,
  ...state,
})

const createLbOtherSourceState = (state: Partial<LbOtherSourceState> = {}): LbOtherSourceState => ({
  entries: [],
  boards: [],
  nextIndex: 0,
  loading: false,
  loadingMore: false,
  done: false,
  loaded: false,
  error: false,
  ...state,
})

const normalizeCachedLbAllData = (data?: LbAllData): LbAllData => {
  const next: LbAllData = {}
  for (const filter of LB_FILTER_IDS) {
    const filterData = data?.[filter]
    if (!filterData) continue
    const nextFilterData: Partial<Record<LX.OnlineSource, LbSourceState>> = {}
    for (const source of Object.keys(filterData) as LX.OnlineSource[]) {
      const entry = filterData[source]
      if (!entry?.boardId) continue
      nextFilterData[source] = createLbSourceState({
        ...entry,
        loading: false,
        loaded: true,
        error: false,
      })
    }
    if (Object.keys(nextFilterData).length) next[filter] = nextFilterData
  }
  return next
}

const normalizeCachedLbOtherData = (data?: LbOtherData): LbOtherData => {
  const next: LbOtherData = {}
  for (const source of Object.keys(data ?? {}) as LX.OnlineSource[]) {
    const sourceState = data?.[source]
    if (!sourceState) continue
    const entries = sourceState.entries
      .filter(entry => entry.boardId)
      .map(entry => ({
        ...entry,
        loading: false,
        loaded: true,
        error: false,
      }))
    next[source] = createLbOtherSourceState({
      ...sourceState,
      entries,
      loading: false,
      loadingMore: false,
      loaded: true,
      error: false,
    })
  }
  return next
}

const prewarmRuntimeCoverCache = (songs: LX.Music.MusicInfoOnline[]) => {
  const urls = songs
    .map(song => song.meta.picUrl)
    .filter((url): url is string => Boolean(url))
  if (!urls.length) return
  void Promise.all(urls.map(async url => getCachedImageUri(url).catch(() => null)))
}

const prewarmVisibleCovers = (source: LX.OnlineSource, songs: LX.Music.MusicInfoOnline[]) => {
  const visibleSongs = songs.slice(0, COVER_PREWARM_LIMIT)
  if (!visibleSongs.length) return

  void InteractionManager.runAfterInteractions(() => {
    if (source === 'kg') {
      void Promise.all(visibleSongs.map(async song => getPicUrl({
        musicInfo: song,
        isRefresh: false,
        allowToggleSource: false,
      }).catch(() => null))).then(() => {
        prewarmRuntimeCoverCache(visibleSongs)
      })
      return
    }
    prewarmRuntimeCoverCache(visibleSongs)
  })
}

const runWithConcurrency = async<T,>(items: T[], limit: number, handler: (item: T) => Promise<void>) => {
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async() => {
    while (index < items.length) {
      const item = items[index++]
      await handler(item)
    }
  })
  await Promise.all(workers)
}

const openLibrary = () => {
  setNavActiveId('nav_love')
}
const openPlaylistDetail = (listId: string | null | undefined) => {
  if (!listId) {
    openLibrary()
    return
  }
  global.app_event.openPlaylistDetail(listId)
}

const filterChips = [
  { id: 'all', key: 'home_tag_all' },
  { id: 'new', key: 'home_tag_new' },
  { id: 'trending', key: 'home_tag_trending' },
  { id: 'top', key: 'home_tag_top' },
  { id: 'other', key: 'home_tag_other' },
] as const

const useYesterdayListenedMinutes = (): number => {
  const [minutes, setMinutes] = useState(0)
  useEffect(() => {
    const update = () => {
      const bounds = previousRangeBounds('today', Date.now())
      if (!bounds) {
        setMinutes(0)
        return
      }
      let listenedMs = 0
      for (const record of getPlayRecords()) {
        if (recordInBounds(record, bounds)) listenedMs += record.listenedMs
      }
      setMinutes(Math.floor(listenedMs / 60_000))
    }
    update()
    return subscribePlayHistory(update)
  }, [])
  return minutes
}

// ---------- Animation utilities ----------

const ContentReveal = memo(({ children }: { children: React.ReactNode }) => {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [anim])
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    }}>
      {children}
    </Animated.View>
  )
})

// ---------- AllContent ----------
interface AllContentProps {
  discover: DiscoverCard
  dailyLists: LibraryItem[]
  playlistMetaMap: Record<string, { count: number, cover: string | null }>
  isPlay: boolean
  isPlaylistCurrent: (listId: string | null | undefined) => boolean
  handlePlayPlaylist: (listId: string | null | undefined) => void
  handlePlayPlaylistPress: (listId: string | null | undefined) => (event: GestureResponderEvent) => void
  coverWidth: number
}

const AllContent = memo(({
  discover,
  dailyLists,
  playlistMetaMap,
  isPlay,
  isPlaylistCurrent,
  handlePlayPlaylist,
  handlePlayPlaylistPress,
  coverWidth,
}: AllContentProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const discoverMeta = formatHomeDailyMeta(
    discover.tag,
    discover.count,
    discover.count == null ? '' : t('home_daily_tracks', { count: discover.count }),
  )

  return (
    <View>
      <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.discoverKicker}>
        {t('home_discover_kicker')}
      </Text>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => { openPlaylistDetail(discover.sourceListId) }}
      >
        {discover.cover
          ? <Image style={[styles.discoverCover, { width: coverWidth }]} url={discover.cover} />
          : <View style={[styles.discoverCover, styles.discoverCoverFallback, { width: coverWidth, backgroundColor: r.placeholder }]} />}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => { openPlaylistDetail(discover.sourceListId) }}
      >
        <Text size={magType.section.size} color={r.display} style={styles.discoverTitle} numberOfLines={1}>
          {discover.title}
        </Text>
      </TouchableOpacity>
      <Text size={magType.lead.size} color={r.muted} style={styles.discoverSubtitle}>
        {discover.subtitle}
      </Text>
      <View style={styles.discoverMetaRow}>
        <Text size={magType.meta.size} color={r.muted} style={styles.discoverMeta} numberOfLines={1}>
          {discoverMeta}
        </Text>
        <TextButton
          label={t('home_play_now')}
          onPress={() => { handlePlayPlaylist(discover.sourceListId) }}
        />
      </View>

      <SectionHeader
        title={t('home_section_daily')}
        linkLabel={t('home_action_see_all_arrow')}
        onLinkPress={openLibrary}
      />

      <View style={styles.dailyList}>
        {dailyLists.length
          ? dailyLists.map((item, index) => {
            const meta = playlistMetaMap[item.id]
            const isItemCurrent = isPlaylistCurrent(item.id)
            const last = index === dailyLists.length - 1
            return (
              <View key={item.id}>
                <TouchableOpacity
                  style={styles.dailyRow}
                  activeOpacity={0.7}
                  onPress={() => { openPlaylistDetail(item.id) }}
                >
                  <View style={styles.dailyCoverWrap}>
                    {meta?.cover
                      ? <Image style={styles.dailyCover} url={meta.cover} />
                      : <View style={[styles.dailyCover, { backgroundColor: r.placeholder }]} />}
                  </View>
                  <View style={styles.dailyInfo}>
                    <Text size={magType.rowTitle.size} color={r.ink} style={styles.dailyTitle} numberOfLines={1}>{item.title}</Text>
                    <Text size={magType.meta.size} color={r.muted} numberOfLines={1}>
                      {formatHomeDailyMeta(item.tag, meta ? meta.count : null, meta ? t('home_daily_tracks', { count: meta.count }) : '')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dailyPlayHit}
                    activeOpacity={0.7}
                    onPress={handlePlayPlaylistPress(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('home_play_now')}
                  >
                    <View style={[styles.dailyPlayButton, { borderColor: r.ink }]}>
                      {isItemCurrent && isPlay
                        ? <MdiIcon name="pause" rawSize={18} color={r.ink} />
                        : <MdiIcon name="play" rawSize={18} color={r.ink} />}
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
                {last ? null : <Hairline />}
              </View>
            )
          })
          : <EmptyState title={t('home_daily_empty')} />}
      </View>
    </View>
  )
})

// ---------- LbContent ----------
interface LbContentProps {
  lbAllData: LbAllData
  activeFilter: LbFilterId
}

const ChartRowSkeleton = memo(({ count = LB_PREVIEW_LIMIT }: { count?: number }) => (
  <View>
    {Array.from({ length: count }, (_, index) => (
      <SkeletonRow key={index} last={index === count - 1} />
    ))}
  </View>
))

const LbContent = memo(({
  lbAllData,
  activeFilter,
}: LbContentProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const handleLbPlay = useCallback((boardId: string, songs: LX.Music.MusicInfoOnline[], index: number) => {
    void handleLbPlayAction(boardId, songs, index)
  }, [])
  const handleViewAll = useCallback((src: LX.OnlineSource, boardId: string, boardName: string) => {
    if (!boardId) return
    global.app_event.openPlaylistDetail({ type: 'leaderboard', boardId, source: src, name: boardName })
  }, [])

  const [settledFilter, setSettledFilter] = useState<LbFilterId | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettledFilter(activeFilter)
    }, 200)
    return () => { clearTimeout(timer) }
  }, [activeFilter])

  return (
    <View>
      {leaderboardState.sources.map((src, sourceIndex) => {
        const srcData = lbAllData[activeFilter]?.[src]
        const boardId = srcData?.boardId ?? ''
        const boardName = srcData?.boardName ?? ''
        const songs = (srcData?.songs ?? []).slice(0, LB_PREVIEW_LIMIT)
        const loading = srcData?.loading ?? true
        const showLoading = loading && !songs.length
        const showSongSkeleton = settledFilter !== activeFilter || showLoading
        const sourceLabel = t(`source_real_${src}`)
        const boardMeta = t('home_board_meta', { source: sourceLabel })
        const firstSection = sourceIndex === 0

        return (
          <View key={src} style={styles.lbSourceSection}>
            {showSongSkeleton
              ? (
                <>
                  {!firstSection
                    ? <SectionHeader title={boardName || '—'} showRule />
                    : null}
                  <ChartRowSkeleton />
                </>
                )
              : (
                <>
                  <SectionHeader
                    title={boardName || '—'}
                    linkLabel={t('home_action_see_all_arrow')}
                    onLinkPress={() => { handleViewAll(src, boardId, boardName) }}
                    showRule={!firstSection}
                  />
                  <Text size={magType.sectionMeta.size} color={r.eyebrow} style={styles.boardMeta}>{boardMeta}</Text>
                  <ContentReveal key={`${src}-${activeFilter}`}>
                    {songs.length
                      ? songs.map((song, index) => (
                        <RankedRow
                          key={song.id}
                          rank={index + 1}
                          title={song.name}
                          subtitle={song.singer}
                          coverUri={pickMusicCover(song)}
                          last={index === songs.length - 1}
                          onPress={() => { handleLbPlay(boardId, srcData?.songs ?? songs, index) }}
                        />
                      ))
                      : <EmptyState title={t('home_charts_empty')} />}
                  </ContentReveal>
                </>
                )}
          </View>
        )
      })}
    </View>
  )
})

// ---------- OtherContent ----------
interface OtherContentProps {
  lbOtherData: LbOtherData
  selectedOtherSource: LX.OnlineSource
  onSourceChange: (source: LX.OnlineSource) => void
}

const OtherContent = memo(({
  lbOtherData,
  selectedOtherSource,
  onSourceChange,
}: OtherContentProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const handleLbPlay = useCallback((boardId: string, songs: LX.Music.MusicInfoOnline[], index: number) => {
    void handleLbPlayAction(boardId, songs, index)
  }, [])
  const handleViewAll = useCallback((src: LX.OnlineSource, boardId: string, boardName: string) => {
    if (!boardId) return
    global.app_event.openPlaylistDetail({ type: 'leaderboard', boardId, source: src, name: boardName })
  }, [])

  const [isSwitching, setIsSwitching] = useState(true)
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSourceRef = useRef(selectedOtherSource)

  useEffect(() => {
    switchTimerRef.current = setTimeout(() => {
      setIsSwitching(false)
      switchTimerRef.current = null
    }, 200)
    return () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (prevSourceRef.current === selectedOtherSource) return
    prevSourceRef.current = selectedOtherSource
    setIsSwitching(true)
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current)
    switchTimerRef.current = setTimeout(() => {
      setIsSwitching(false)
      switchTimerRef.current = null
    }, 200)
  }, [selectedOtherSource])

  const handleSourcePress = useCallback((src: LX.OnlineSource) => {
    if (src === selectedOtherSource) return
    setIsSwitching(true)
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current)
    switchTimerRef.current = setTimeout(() => {
      setIsSwitching(false)
      switchTimerRef.current = null
    }, 400)
    onSourceChange(src)
  }, [onSourceChange, selectedOtherSource])

  const srcState = lbOtherData[selectedOtherSource]
  const srcBoards = !srcState || (srcState.loading && !srcState.entries.length) ? undefined : srcState.entries
  const showBoardSkeleton = isSwitching || !srcBoards

  return (
    <View>
      <View style={styles.sourceLine} accessibilityRole="tablist">
        <Text size={13} color={r.muted} style={styles.sourceLabel}>{t('home_source_label')}</Text>
        <View style={styles.sourceOptions}>
          {leaderboardState.sources.map((src, index) => {
            const selected = src === selectedOtherSource
            const label = SOURCE_SHORT_LABELS[src] ?? src
            return (
              <View key={src} style={styles.sourceOptionWrap}>
                {index > 0
                  ? <Text size={13} color={r.quiet} style={styles.sourceSlash}>{' / '}</Text>
                  : null}
                <TouchableOpacity
                  style={styles.sourceOption}
                  activeOpacity={0.7}
                  onPress={() => { handleSourcePress(src) }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  {selected ? <View style={styles.sourceDot} /> : null}
                  <Text
                    size={13}
                    color={r.ink}
                    style={selected ? styles.sourceOptionOn : styles.sourceOptionOff}
                  >{label}</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      </View>

      {showBoardSkeleton
        ? <ChartRowSkeleton />
        : !srcBoards.length
            ? <EmptyState title={t('home_charts_empty')} />
            : (
            <ContentReveal key={selectedOtherSource}>
              {srcBoards.map((entry, boardIndex) => {
                const { boardId, boardName, songs: allSongs, loading } = entry
                const songs = allSongs.slice(0, LB_PREVIEW_LIMIT)
                const showLoading = loading && !songs.length
                const boardMeta = t('home_board_meta', { source: t(`source_real_${selectedOtherSource}`) })
                const firstSection = boardIndex === 0
                return (
                  <View key={boardId} style={styles.lbSourceSection}>
                    {showLoading
                      ? <ChartRowSkeleton />
                      : (
                        <>
                          <SectionHeader
                            title={boardName || '—'}
                            linkLabel={t('home_action_see_all_arrow')}
                            onLinkPress={() => { handleViewAll(selectedOtherSource, boardId, boardName) }}
                            showRule={!firstSection}
                          />
                          <Text size={magType.sectionMeta.size} color={r.eyebrow} style={styles.boardMeta}>{boardMeta}</Text>
                          <ContentReveal key={boardId}>
                            {songs.length
                              ? songs.map((song, index) => (
                                <RankedRow
                                  key={song.id}
                                  rank={index + 1}
                                  title={song.name}
                                  subtitle={song.singer}
                                  coverUri={pickMusicCover(song)}
                                  last={index === songs.length - 1}
                                  onPress={() => { handleLbPlay(boardId, allSongs, index) }}
                                />
                              ))
                              : <EmptyState title={t('home_charts_empty')} />}
                          </ContentReveal>
                        </>
                        )}
                  </View>
                )
              })}
            </ContentReveal>
              )}
    </View>
  )
})

// ---------- HomeTab ----------
export default memo(() => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  const t = useI18n()
  const { width } = useWindowDimensions()
  const statusBarHeight = useStatusbarHeight()
  const activeNavId = useNavActiveId()
  const playlists = useMyList()
  const playMusicInfo = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const linkedPlaylistId = useLinkedPlaylistId()
  const searchSource = useSettingValue('search.defaultSource')
  const todayListenedMinutes = useTodayListenedMinutes()
  const yesterdayListenedMinutes = useYesterdayListenedMinutes()
  const [displayName, setDisplayName] = useState(DEFAULT_USER_NAME)
  const [avatarUrl, setAvatarUrl] = useState<string | number | null>(DEFAULT_USER_AVATAR)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [playlistMetaMap, setPlaylistMetaMap] = useState<Record<string, { count: number, cover: string | null }>>(getHomePlaylistMetaSnapshot)
  const playlistMetaRequestRef = useRef(0)
  const topPadding = statusBarHeight
  const gestureInsetBottom = useSystemGestureInsetBottom()
  const [lbAllData, setLbAllData] = useState<LbAllData>({})
  const [lbOtherData, setLbOtherData] = useState<LbOtherData>({})
  const [selectedOtherSource, setSelectedOtherSource] = useState<LX.OnlineSource>(leaderboardState.sources[0] ?? 'kw')
  const lbOtherDataRef = useRef<LbOtherData>({})
  const lbTokensRef = useRef<Record<LbFilterId, number>>({ new: 0, trending: 0, top: 0 })
  const lbOtherTokensRef = useRef<Partial<Record<LX.OnlineSource, number>>>({})
  const lbFilterLoadedRef = useRef<Partial<Record<LbFilterId, boolean>>>({})
  const lbFilterLoadingRef = useRef<Partial<Record<LbFilterId, boolean>>>({})
  const lbOtherSourceLoadedRef = useRef<Partial<Record<LX.OnlineSource, boolean>>>({})
  const lbOtherSourceLoadingRef = useRef<Partial<Record<LX.OnlineSource, boolean>>>({})
  const leaderboardHomeCacheReadyRef = useRef(false)

  useEffect(() => {
    let isUnmounted = false

    void getUserName().then((name) => {
      if (isUnmounted) return
      setDisplayName(name?.trim() ? name.trim() : DEFAULT_USER_NAME)
    })

    const handleUserNameUpdated = (name: string) => {
      setDisplayName(name.trim() ? name.trim() : DEFAULT_USER_NAME)
    }
    global.app_event.on('userNameUpdated', handleUserNameUpdated)

    return () => {
      isUnmounted = true
      global.app_event.off('userNameUpdated', handleUserNameUpdated)
    }
  }, [])

  useEffect(() => {
    let isUnmounted = false

    const syncAvatar = async() => {
      const path = await getUserAvatar()
      if (isUnmounted) return
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    }

    void syncAvatar()

    const handleUserAvatarUpdated = (path: string | null) => {
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    }
    const handleFocus = () => {
      void syncAvatar()
    }
    global.app_event.on('userAvatarUpdated', handleUserAvatarUpdated)
    global.app_event.on('focus', handleFocus)

    return () => {
      isUnmounted = true
      global.app_event.off('userAvatarUpdated', handleUserAvatarUpdated)
      global.app_event.off('focus', handleFocus)
    }
  }, [])

  const updateLbOtherData = useCallback((updater: (prev: LbOtherData) => LbOtherData) => {
    setLbOtherData(prev => {
      const next = updater(prev)
      lbOtherDataRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    let isUnmounted = false

    void getData<LeaderboardHomeCache>(LEADERBOARD_HOME_CACHE_KEY).then(cache => {
      if (isUnmounted || !cache) return
      const cachedAllData = normalizeCachedLbAllData(cache.lbAllData)
      const cachedOtherData = normalizeCachedLbOtherData(cache.lbOtherData)
      if (Object.keys(cachedAllData).length) setLbAllData(cachedAllData)
      if (Object.keys(cachedOtherData).length) {
        lbOtherDataRef.current = cachedOtherData
        setLbOtherData(cachedOtherData)
      }
    }).finally(() => {
      if (!isUnmounted) leaderboardHomeCacheReadyRef.current = true
    })

    return () => {
      isUnmounted = true
    }
  }, [])

  useEffect(() => {
    if (!leaderboardHomeCacheReadyRef.current) return
    const cachedAllData = normalizeCachedLbAllData(lbAllData)
    const cachedOtherData = normalizeCachedLbOtherData(lbOtherData)
    if (!Object.keys(cachedAllData).length && !Object.keys(cachedOtherData).length) return
    const cacheData: LeaderboardHomeCache = {
      lbAllData: cachedAllData,
      lbOtherData: cachedOtherData,
      updatedAt: Date.now(),
    }
    void saveData(LEADERBOARD_HOME_CACHE_KEY, cacheData).catch(() => {})
  }, [lbAllData, lbOtherData])

  const libraryItems = useMemo(() => {
    const lovePlaylist = playlists.find(list => list.id === LIST_IDS.LOVE)
    const defaultPlaylist = playlists.find(list => list.id === LIST_IDS.DEFAULT)
    const customPlaylists = playlists.filter(list => list.id !== LIST_IDS.LOVE && list.id !== LIST_IDS.DEFAULT)

    return [lovePlaylist, defaultPlaylist, ...customPlaylists.slice(0, 5)]
      .filter((list): list is LX.List.MyListInfo => Boolean(list))
      .map((list) => ({
        id: list.id,
        title: list.id === LIST_IDS.LOVE
          ? t('list_name_love')
          : list.id === LIST_IDS.DEFAULT
            ? t('list_name_default')
            : list.name,
        tag: list.id === LIST_IDS.LOVE
          ? t('home_daily_tag_loved')
          : list.id === LIST_IDS.DEFAULT
            ? t('home_daily_tag_default')
            : t('home_daily_tag_custom'),
        subtitle: list.id === LIST_IDS.LOVE
          ? t('home_card_love_subtitle')
          : list.id === LIST_IDS.DEFAULT
            ? t('home_card_default_subtitle')
            : t('home_card_custom_subtitle'),
      }))
  }, [playlists, t])

  const refreshPlaylistMeta = useCallback(async() => {
    const requestId = ++playlistMetaRequestRef.current
    if (!libraryItems.length) {
      setPlaylistMetaMap({})
      return
    }

    const result = await Promise.all(libraryItems.map(async(item) => {
      const musics = await getListMusics(item.id)
      return {
        id: item.id,
        count: musics.length,
        cover: resolveHomeListCover(musics.map(toHomeCoverSong), homeCoverLookup),
      }
    }))

    if (playlistMetaRequestRef.current !== requestId) return

    const next: Record<string, { count: number, cover: string | null }> = {}
    for (const item of result) {
      next[item.id] = {
        count: item.count,
        cover: item.cover,
      }
    }
    setPlaylistMetaMap(next)
    const coverUrls = Object.values(next)
      .map(item => item.cover)
      .filter((url): url is string => Boolean(url))
    if (coverUrls.length) {
      void Promise.all(coverUrls.map(async url => cacheImageUri(url).catch(() => null)))
    }
  }, [libraryItems])

  useEffect(() => {
    return subscribeHomePlaylistMeta(() => {
      const snapshot = getHomePlaylistMetaSnapshot()
      if (!Object.keys(snapshot).length) return
      setPlaylistMetaMap(prev => ({ ...prev, ...snapshot }))
    })
  }, [])

  useEffect(() => {
    void refreshPlaylistMeta()
  }, [refreshPlaylistMeta])

  useEffect(() => {
    const handleListsUpdated = () => {
      void refreshPlaylistMeta()
    }
    const handleListMusicUpdate = (ids: string[]) => {
      if (!ids.some(id => libraryItems.some(item => item.id === id))) return
      void refreshPlaylistMeta()
    }

    global.state_event.on('mylistUpdated', handleListsUpdated)
    global.app_event.on('myListMusicUpdate', handleListMusicUpdate)
    global.app_event.on('focus', handleListsUpdated)

    return () => {
      global.state_event.off('mylistUpdated', handleListsUpdated)
      global.app_event.off('myListMusicUpdate', handleListMusicUpdate)
      global.app_event.off('focus', handleListsUpdated)
    }
  }, [libraryItems, refreshPlaylistMeta])

  useEffect(() => {
    if (activeNavId !== 'nav_search') return
    void refreshPlaylistMeta()
  }, [activeNavId, refreshPlaylistMeta])

  const loadOneFilter = useCallback(async(filter: LbFilterId) => {
    if (lbFilterLoadedRef.current[filter] === true) return
    if (lbFilterLoadingRef.current[filter] === true) return
    lbFilterLoadingRef.current[filter] = true
    const token = ++lbTokensRef.current[filter]
    const sources = leaderboardState.sources

    setLbAllData(prev => ({
      ...prev,
      [filter]: Object.fromEntries(sources.map(src => [
        src,
        createLbSourceState({
          ...prev[filter]?.[src],
          loading: true,
        }),
      ])),
    }))

    await Promise.all(sources.map(async(src) => {
      try {
        const boards = await getBoardsList(src)
        if (lbTokensRef.current[filter] !== token) return
        if (!boards.length) {
          setLbAllData(prev => ({
            ...prev,
            [filter]: {
              ...prev[filter],
              [src]: createLbSourceState({
                ...prev[filter]?.[src],
                loading: false,
                loaded: true,
              }),
            },
          }))
          return
        }
        const board = findBoardForFilter(boards, filter, src)
        const detail = await getListDetail(board.id, 1)
        if (lbTokensRef.current[filter] !== token) return
        const songs = detail.list
        setLbAllData(prev => ({
          ...prev,
          [filter]: {
            ...prev[filter],
            [src]: createLbSourceState({
              boardId: board.id,
              boardName: board.name,
              songs,
              loading: false,
              loaded: true,
            }),
          },
        }))
        prewarmVisibleCovers(src, songs)
      } catch {
        if (lbTokensRef.current[filter] === token) {
          setLbAllData(prev => ({
            ...prev,
            [filter]: {
              ...prev[filter],
              [src]: createLbSourceState({
                ...prev[filter]?.[src],
                loading: false,
                loaded: true,
                error: true,
              }),
            },
          }))
        }
      }
    }))

    if (lbTokensRef.current[filter] === token) {
      lbFilterLoadedRef.current[filter] = true
      lbFilterLoadingRef.current[filter] = false
    }
  }, [])

  const loadOtherSource = useCallback(async(source: LX.OnlineSource) => {
    if (lbOtherSourceLoadingRef.current[source]) return
    const currentState = lbOtherDataRef.current[source]
    if (lbOtherSourceLoadedRef.current[source] && currentState?.done) return

    lbOtherSourceLoadingRef.current[source] = true
    const token = (lbOtherTokensRef.current[source] ?? 0) + 1
    lbOtherTokensRef.current[source] = token

    try {
      let sourceState = lbOtherDataRef.current[source]
      const shouldRefreshVisibleBatch = !lbOtherSourceLoadedRef.current[source]
      if (!sourceState?.loaded || shouldRefreshVisibleBatch) {
        updateLbOtherData(prev => ({
          ...prev,
          [source]: createLbOtherSourceState({
            ...prev[source],
            loading: true,
          }),
        }))

        const boards = await getBoardsList(source)
        if (lbOtherTokensRef.current[source] !== token) return
        const usedIds = new Set(LB_FILTER_IDS.map(filter => findBoardForFilter(boards, filter, source).id))
        const otherBoards = boards.filter(board => !usedIds.has(board.id))
        const entries = sourceState?.entries ?? []
        updateLbOtherData(prev => ({
          ...prev,
          [source]: createLbOtherSourceState({
            ...prev[source],
            entries,
            boards: otherBoards,
            nextIndex: shouldRefreshVisibleBatch && entries.length ? Math.min(entries.length, otherBoards.length) : 0,
            loading: false,
            loaded: true,
            done: !otherBoards.length,
          }),
        }))
      }

      sourceState = lbOtherDataRef.current[source]
      if (!sourceState || sourceState.done) return

      const refreshSize = shouldRefreshVisibleBatch && sourceState.entries.length
        ? Math.min(sourceState.entries.length, OTHER_BOARD_PAGE_SIZE)
        : OTHER_BOARD_PAGE_SIZE
      const startIndex = shouldRefreshVisibleBatch && sourceState.entries.length ? 0 : sourceState.nextIndex
      const batch = sourceState.boards.slice(startIndex, startIndex + refreshSize)
      if (!batch.length) {
        updateLbOtherData(prev => ({
          ...prev,
          [source]: createLbOtherSourceState({
            ...prev[source],
            loading: false,
            loadingMore: false,
            done: true,
          }),
        }))
        return
      }

      const batchIds = new Set(batch.map(board => board.id))
      const nextIndex = shouldRefreshVisibleBatch && sourceState.entries.length
        ? Math.max(sourceState.nextIndex, batch.length)
        : startIndex + batch.length

      updateLbOtherData(prev => {
        const prevState = createLbOtherSourceState(prev[source])
        const batchEntries = batch.map(board => createLbSourceState({
          boardId: board.id,
          boardName: board.name,
          loading: true,
        }))
        const refreshedEntries = prevState.entries.map(entry => batchIds.has(entry.boardId) ? { ...entry, loading: true } : entry)
        const refreshedEntryIds = new Set(refreshedEntries.map(entry => entry.boardId))
        const entries = shouldRefreshVisibleBatch && prevState.entries.length
          ? [...refreshedEntries, ...batchEntries.filter(entry => !refreshedEntryIds.has(entry.boardId))]
          : [...prevState.entries, ...batchEntries]
        return {
          ...prev,
          [source]: createLbOtherSourceState({
            ...prevState,
            entries,
            nextIndex,
            loading: false,
            loadingMore: true,
            loaded: true,
          }),
        }
      })

      await runWithConcurrency(batch, OTHER_BOARD_DETAIL_CONCURRENCY, async(board) => {
        try {
          const detail = await getListDetail(board.id, 1)
          if (lbOtherTokensRef.current[source] !== token) return
          updateLbOtherData(prev => {
            const prevState = createLbOtherSourceState(prev[source])
            return {
              ...prev,
              [source]: createLbOtherSourceState({
                ...prevState,
                entries: prevState.entries.map(entry => entry.boardId === board.id
                  ? {
                      ...entry,
                      songs: detail.list,
                      loading: false,
                      loaded: true,
                      error: false,
                    }
                  : entry),
              }),
            }
          })
        } catch {
          if (lbOtherTokensRef.current[source] !== token) return
          updateLbOtherData(prev => {
            const prevState = createLbOtherSourceState(prev[source])
            return {
              ...prev,
              [source]: createLbOtherSourceState({
                ...prevState,
                entries: prevState.entries.map(entry => entry.boardId === board.id
                  ? {
                      ...entry,
                      loading: false,
                      loaded: true,
                      error: true,
                    }
                  : entry),
              }),
            }
          })
        }
      })

      if (lbOtherTokensRef.current[source] === token) {
        lbOtherSourceLoadedRef.current[source] = true
        updateLbOtherData(prev => {
          const prevState = createLbOtherSourceState(prev[source])
          return {
            ...prev,
            [source]: createLbOtherSourceState({
              ...prevState,
              loading: false,
              loadingMore: false,
              done: prevState.nextIndex >= prevState.boards.length,
            }),
          }
        })
      }
    } catch {
      if (lbOtherTokensRef.current[source] === token) {
        updateLbOtherData(prev => ({
          ...prev,
          [source]: createLbOtherSourceState({
            ...prev[source],
            loading: false,
            loadingMore: false,
            loaded: true,
            done: true,
            error: true,
          }),
        }))
      }
    } finally {
      if (lbOtherTokensRef.current[source] === token) lbOtherSourceLoadingRef.current[source] = false
    }
  }, [updateLbOtherData])

  useEffect(() => {
    if (activeFilter === 'all') return
    if (activeFilter === 'other') {
      void loadOtherSource(selectedOtherSource)
      return
    }
    void loadOneFilter(activeFilter)
  }, [activeFilter, loadOneFilter, loadOtherSource, selectedOtherSource])

  const greetingName = displayName.trim() || DEFAULT_USER_NAME
  const now = Date.now()
  const mastheadDate = `${t('stats_date_md', { month: new Date(now).getMonth() + 1, day: new Date(now).getDate() })} ${t(weekdayKey[new Date(now).getDay()])}`
  const masthead = t('home_masthead', { date: mastheadDate })

  const rankedItems = useMemo(() => [...libraryItems], [libraryItems])
  const featuredItem = rankedItems[0] ?? null
  const dailyLists = useMemo(() => rankedItems.slice(0, DAILY_PREVIEW_LIMIT), [rankedItems])
  const coverWidth = Math.max(0, width - PAGE_GUTTER * 2)
  const currentMusic = playMusicInfo.musicInfo
  const currentMusicInfo = currentMusic
    ? 'metadata' in currentMusic
      ? currentMusic.metadata.musicInfo
      : currentMusic
    : null
  const featuredMeta = featuredItem ? playlistMetaMap[featuredItem.id] : undefined
  const featuredCover = currentMusicInfo?.meta.picUrl ?? featuredMeta?.cover ?? null
  const featuredStat = featuredItem ? (featuredMeta ? featuredMeta.count : null) : 0
  const isPlaylistCurrent = useCallback((listId: string | null | undefined) => {
    if (!listId || !linkedPlaylistId) return false
    return linkedPlaylistId === listId
  }, [linkedPlaylistId])

  const discover = useMemo<DiscoverCard>(() => ({
    id: featuredItem?.id ?? 'discover-weekly',
    sourceListId: featuredItem?.id ?? null,
    tag: featuredItem?.tag ?? t('home_daily_tag_loved'),
    title: t('home_discover_title'),
    subtitle: t('home_discover_subtitle'),
    count: featuredStat,
    cover: featuredCover,
  }), [featuredCover, featuredItem?.id, featuredItem?.tag, featuredStat, t])

  const handlePlayPlaylist = useCallback(async(listId: string | null | undefined) => {
    if (!listId) return
    if (isPlaylistCurrent(listId)) {
      if (isPlay) await pause()
      else play()
      return
    }
    await playListAsQueue(listId, 0)
  }, [isPlay, isPlaylistCurrent])
  const handlePlayPlaylistPress = useCallback((listId: string | null | undefined) => (event: GestureResponderEvent) => {
    event.stopPropagation()
    void handlePlayPlaylist(listId)
  }, [handlePlayPlaylist])

  const handleFilterChange = useCallback((id: string) => {
    setActiveFilter(id as FilterId)
  }, [])

  const handleOtherSourceChange = useCallback((source: LX.OnlineSource) => {
    setSelectedOtherSource(source)
  }, [])

  const handleContentScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (activeFilter !== 'other') return
    const distanceToBottom = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y
    if (distanceToBottom > 180) return
    void loadOtherSource(selectedOtherSource)
  }, [activeFilter, loadOtherSource, selectedOtherSource])

  const handleOpenSearch = useCallback(() => {
    global.app_event.openVerticalSearchPage({
      keyword: '',
      source: searchSource,
      submit: false,
    })
  }, [searchSource])

  const handleOpenSettings = useCallback(() => {
    setNavActiveId('nav_setting')
  }, [])

  const avatarDisplayUrl = useMemo(() => {
    if (!avatarUrl) return DEFAULT_USER_AVATAR
    if (typeof avatarUrl != 'string') return avatarUrl
    const normalizedAvatarUrl = avatarUrl.startsWith('file://') ? avatarUrl.replace(/^file:\/\//, '') : avatarUrl
    if (normalizedAvatarUrl.startsWith('/')) return `file://${normalizedAvatarUrl}?v=${avatarVersion}`
    return `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}`
  }, [avatarUrl, avatarVersion])

  const listenDelta = todayListenedMinutes - yesterdayListenedMinutes
  const showDeltaPill = listenDelta !== 0 || todayListenedMinutes > 0
  const deltaDirection = listenDelta > 0 ? 'up' as const : listenDelta < 0 ? 'down' as const : 'none' as const
  const deltaLabel = listenDelta !== 0
    ? `${formatMinutes(Math.abs(listenDelta))}${t('stats_unit_minute')}`
    : `${formatMinutes(todayListenedMinutes)}${t('stats_unit_minute')}`

  const filterTabs = useMemo(() => filterChips.map(({ id, key }) => ({
    id,
    label: t(key),
  })), [t])

  const isLbFilter = activeFilter === 'new' || activeFilter === 'trending' || activeFilter === 'top'
  const lbActiveFilter: LbFilterId = isLbFilter ? activeFilter : 'new'

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: 24 + BOTTOM_DOCK_BASE_HEIGHT + gestureInsetBottom }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        scrollEventThrottle={120}
        onScroll={handleContentScroll}
      >
        <MagTopBar
          masthead={masthead}
          trailing={
            <>
              <IconButton
                name="magnify"
                accessibilityLabel={t('action_search')}
                onPress={handleOpenSearch}
              />
              <TouchableOpacity
                style={styles.avatarButton}
                activeOpacity={0.82}
                onPress={handleOpenSettings}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={t('bottom_nav_settings')}
              >
                <Image style={styles.avatarImage} url={avatarDisplayUrl} resizeMode="contain" />
              </TouchableOpacity>
            </>
          }
        />

        <Text size={magType.h1.size} color={r.display} style={styles.greetingTitle}>
          {`${t('home_greeting_short')}, ${greetingName}`}
        </Text>

        <View style={styles.metaRow}>
          {showDeltaPill
            ? <DeltaPill label={deltaLabel} direction={deltaDirection} />
            : null}
          <Text size={magType.meta.size} color={r.muted} style={styles.metaText}>
            {t('home_today_listened', { num: formatMinutes(todayListenedMinutes) })}
          </Text>
        </View>

        <MagSegmented
          items={filterTabs}
          value={activeFilter}
          onChange={handleFilterChange}
          style={styles.filterSegmented}
        />

        <View>
          {activeFilter === 'all' && (
            <ContentReveal>
              <AllContent
                discover={discover}
                dailyLists={dailyLists}
                playlistMetaMap={playlistMetaMap}
                isPlay={isPlay}
                isPlaylistCurrent={isPlaylistCurrent}
                handlePlayPlaylist={(listId) => { void handlePlayPlaylist(listId) }}
                handlePlayPlaylistPress={handlePlayPlaylistPress}
                coverWidth={coverWidth}
              />
            </ContentReveal>
          )}
          {isLbFilter && (
            <LbContent
              lbAllData={lbAllData}
              activeFilter={lbActiveFilter}
            />
          )}
          {activeFilter === 'other' && (
            <OtherContent
              lbOtherData={lbOtherData}
              selectedOtherSource={selectedOtherSource}
              onSourceChange={handleOtherSourceChange}
            />
          )}
        </View>
      </ScrollView>
    </View>
  )
})

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => {
  const r = magazineRoles(colors)
  return createStyle({
    container: {
      flex: 1,
      backgroundColor: r.paper,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: PAGE_GUTTER,
    },
    avatarButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      overflow: 'hidden',
    },
    avatarImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    greetingTitle: {
      fontWeight: '800',
      letterSpacing: -1,
      lineHeight: magType.h1.lineHeight,
      marginTop: H1_AFTER_TOP,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 8,
    },
    metaText: {
      fontWeight: '600',
    },
    filterSegmented: {
      marginTop: TABS_AFTER_EYEBROW,
      marginBottom: 14,
    },
    sourceLine: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: 12,
      gap: 8,
    },
    sourceLabel: {
      fontWeight: '600',
    },
    sourceOptions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      flexShrink: 1,
    },
    sourceOptionWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sourceSlash: {
      fontWeight: '400',
    },
    sourceOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: 4,
    },
    sourceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: r.accent,
    },
    sourceOptionOn: {
      fontWeight: '800',
    },
    sourceOptionOff: {
      fontWeight: '600',
    },
    discoverKicker: {
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    discoverCover: {
      aspectRatio: 1.15,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: r.placeholder,
    },
    discoverCoverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    discoverTitle: {
      fontWeight: '800',
      letterSpacing: -0.3,
      marginTop: 14,
    },
    discoverSubtitle: {
      marginTop: 6,
      lineHeight: 22,
    },
    discoverMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      gap: 12,
    },
    discoverMeta: {
      flex: 1,
      minWidth: 0,
    },
    dailyList: {
      marginTop: SECTION_TO_LIST,
    },
    dailyRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    dailyCoverWrap: {
      width: COVER_LIST,
      height: COVER_LIST,
      borderRadius: 6,
      overflow: 'hidden',
    },
    dailyCover: {
      width: COVER_LIST,
      height: COVER_LIST,
      borderRadius: 6,
    },
    dailyInfo: {
      flex: 1,
      minWidth: 0,
      marginLeft: 12,
      marginRight: 12,
    },
    dailyTitle: {
      fontWeight: '700',
      marginBottom: 3,
    },
    dailyPlayHit: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dailyPlayButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lbSourceSection: {
      marginBottom: 8,
    },
    boardMeta: {
      fontWeight: '600',
      letterSpacing: 1,
      marginTop: 4,
      marginBottom: 2,
    },
  })
})
