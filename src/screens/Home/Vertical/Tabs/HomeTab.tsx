/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Easing, InteractionManager, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions, type GestureResponderEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { Disc3, Ellipsis, Heart, Play } from 'lucide-react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import useLinkedPlaylistId from '@/components/playlist/hooks/useLinkedPlaylistId'
import { LIST_IDS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { pause, play, playListAsQueue } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { DEFAULT_USER_NAME, getListMusics, getUserName } from '@/utils/data'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { getBoardsList, getListDetail } from '@/core/leaderboard'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'
import { handlePlay as handleLbPlayAction } from '@/screens/Home/Views/Leaderboard/listAction'
import { pickMusicCover } from '@/utils/musicCover'
import { getPicUrl } from '@/core/music/online'
import { getCachedImageUri } from '@/utils/imageCache'
import { getData, saveData } from '@/plugins/storage'

const BOTTOM_DOCK_BASE_HEIGHT = 164
const OTHER_BOARD_PAGE_SIZE = 4
const OTHER_BOARD_DETAIL_CONCURRENCY = 2
const COVER_PREWARM_LIMIT = 6
const LEADERBOARD_HOME_CACHE_KEY = '@leaderboard_home_cache_v1'

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
interface FeaturedCard {
  id: string
  sourceListId: string | null
  eyebrow: string
  title: string
  subtitle: string
  count: number
  cover: string | null
  tone: typeof heroCardTones[number]
}
interface LibraryItem {
  id: string
  title: string
  tag: string
  subtitle: string
  tone: typeof cardTones[number]
}

const cardTones = [
  { surface: '#f2d6e6', accent: '#cf4f8f', ink: '#4f2340', soft: '#f9edf4' },
  { surface: '#e7ecfa', accent: '#5f76d9', ink: '#26355f', soft: '#f2f5fd' },
  { surface: '#e8f0d7', accent: '#8caf33', ink: '#435817', soft: '#f5f8ea' },
  { surface: '#f4e6d8', accent: '#c68444', ink: '#5b3b1c', soft: '#faf2ea' },
] as const
const heroCardTones = [
  { surface: '#f3d7ed', accent: '#613060', ink: '#16181f', textSoft: '#61556d' },
  { surface: '#dff0ad', accent: '#435817', ink: '#1f2613', textSoft: '#526236' },
  { surface: '#f3e6d5', accent: '#6b4b2e', ink: '#22170e', textSoft: '#705640' },
] as const
type FilterId = 'all' | 'new' | 'trending' | 'top' | 'other'
type LbFilterId = Exclude<FilterId, 'all' | 'other'>
type LbAllData = Partial<Record<LbFilterId, Partial<Record<LX.OnlineSource, LbSourceState>>>>
type LbOtherData = Partial<Record<LX.OnlineSource, LbOtherSourceState>>
const LB_FILTER_IDS: LbFilterId[] = ['new', 'trending', 'top']

const getTone = (index: number) => cardTones[index % cardTones.length]

const pickCover = (list: LX.Music.MusicInfo[]) => {
  for (const song of list) {
    if (song.meta.picUrl) return song.meta.picUrl
  }
  return null
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

// ---------- Animation utilities ----------

// Shared pulsing opacity for skeleton placeholders
const usePulseAnim = (): Animated.Value => {
  const anim = useRef(new Animated.Value(0.45)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.9, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.45, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => { loop.stop() }
  }, [anim])
  return anim
}

// Fade + slide-up on mount — wraps content that replaces a skeleton
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

// Skeleton rows that look like song rows with cover image (for new/trending/top)
const SKELETON_SONG_WIDTHS = [
  { title: '70%', sub: '48%' },
  { title: '58%', sub: '38%' },
  { title: '74%', sub: '52%' },
] as const
const SkeletonSongRows = memo(({ pulse }: { pulse: Animated.Value }) => (
  <>
    {SKELETON_SONG_WIDTHS.map((w, i) => (
      <View key={i} style={[skeletonStyles.songRow, i < 2 ? skeletonStyles.rowSpacing : null]}>
        <Animated.View style={[skeletonStyles.cover, { opacity: pulse }]} />
        <View style={skeletonStyles.info}>
          <Animated.View style={[skeletonStyles.line, { width: w.title, marginBottom: 6, opacity: pulse }]} />
          <Animated.View style={[skeletonStyles.lineSm, { width: w.sub, opacity: pulse }]} />
        </View>
      </View>
    ))}
  </>
))

// Skeleton rows for text-only boards (for "other" clip)
const SKELETON_TEXT_WIDTHS = [
  { title: '65%', sub: '44%' },
  { title: '52%', sub: '36%' },
  { title: '68%', sub: '48%' },
] as const
const SkeletonTextRows = memo(({ pulse }: { pulse: Animated.Value }) => (
  <>
    {SKELETON_TEXT_WIDTHS.map((w, i) => (
      <View key={i} style={[skeletonStyles.textRow, i < 2 ? skeletonStyles.rowSpacing : null]}>
        <Animated.View style={[skeletonStyles.rankNum, { opacity: pulse }]} />
        <View style={skeletonStyles.info}>
          <Animated.View style={[skeletonStyles.line, { width: w.title, marginBottom: 6, opacity: pulse }]} />
          <Animated.View style={[skeletonStyles.lineSm, { width: w.sub, opacity: pulse }]} />
        </View>
      </View>
    ))}
  </>
))

// Skeleton title bar (header of each source section)
const SkeletonTitle = memo(({ pulse }: { pulse: Animated.Value }) => (
  <Animated.View style={[skeletonStyles.title, { opacity: pulse }]} />
))

const skeletonStyles = {
  songRow: { minHeight: 70, flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 7 },
  textRow: { minHeight: 52, flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 5 },
  rowSpacing: { marginBottom: 1 },
  cover: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#e2e6ef' },
  info: { flex: 1, marginLeft: 13, marginRight: 12 },
  line: { height: 13, borderRadius: 6, backgroundColor: '#e2e6ef' },
  lineSm: { height: 11, borderRadius: 6, backgroundColor: '#e2e6ef' },
  rankNum: { width: 26, height: 12, borderRadius: 4, backgroundColor: '#e2e6ef', marginRight: 2 },
  title: { height: 18, width: '55%' as const, borderRadius: 8, backgroundColor: '#e2e6ef' },
}

// ---------- AllContent ----------
interface AllContentProps {
  featuredCards: FeaturedCard[]
  dailyLists: LibraryItem[]
  playlistMetaMap: Record<string, { count: number, cover: string | null }>
  isPlay: boolean
  isPlaylistCurrent: (listId: string | null | undefined) => boolean
  handlePlayPlaylistPress: (listId: string | null | undefined) => (event: GestureResponderEvent) => void
  featuredCardWidth: number
  featuredCardGap: number
}

const AllContent = memo(({
  featuredCards,
  dailyLists,
  playlistMetaMap,
  isPlay,
  isPlaylistCurrent,
  handlePlayPlaylistPress,
  featuredCardWidth,
  featuredCardGap,
}: AllContentProps) => {
  const t = useI18n()
  return (
    <View>
      <ScrollView
        horizontal
        style={styles.featuredScroller}
        contentContainerStyle={styles.featuredScrollerContent}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={featuredCardWidth + featuredCardGap}
        disableIntervalMomentum
      >
        {featuredCards.map((card, index) => {
          const isCardCurrent = isPlaylistCurrent(card.sourceListId)
          return (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.featuredCard,
                {
                  width: featuredCardWidth,
                  marginRight: index < featuredCards.length - 1 ? featuredCardGap : 0,
                  backgroundColor: card.tone.surface,
                },
              ]}
              activeOpacity={0.88}
              onPress={() => { openPlaylistDetail(card.sourceListId) }}
            >
              <View style={styles.featuredBody}>
                <View style={styles.featuredHeader}>
                  <Text size={12} color={card.tone.accent} style={styles.featuredEyebrow}>{card.eyebrow}</Text>
                  <Text size={23} color={card.tone.ink} style={styles.featuredTitle} numberOfLines={1}>{card.title}</Text>
                </View>
                <View style={styles.featuredBottomRow}>
                  <View style={styles.featuredContent}>
                    <Text size={12} color={card.tone.textSoft} style={styles.featuredSubtitle}>{card.subtitle}</Text>
                    <Text size={11} color={card.tone.textSoft} style={styles.featuredCount}>{t('home_daily_tracks', { count: card.count })}</Text>

                    <View style={styles.featuredActions}>
                      <TouchableOpacity
                        style={[styles.playButton, { backgroundColor: card.tone.accent }]}
                        activeOpacity={0.85}
                        onPress={handlePlayPlaylistPress(card.sourceListId)}
                      >
                        {isCardCurrent && isPlay
                          ? <View style={styles.pauseGlyph}>
                              <View style={styles.pauseBar} />
                              <View style={styles.pauseBar} />
                            </View>
                          : <Play size={16} color="#ffffff" fill="#ffffff" strokeWidth={1.8} />}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconAction} activeOpacity={0.82} onPress={() => { openPlaylistDetail(card.sourceListId) }}>
                        <Heart size={16} color={card.tone.accent} strokeWidth={2} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconAction} activeOpacity={0.82} onPress={() => { openPlaylistDetail(card.sourceListId) }}>
                        <Ellipsis size={16} color={card.tone.accent} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.featuredArtworkWrap}>
                    {card.cover
                      ? <Image style={styles.featuredArtwork} url={card.cover} />
                      : <View style={[styles.featuredArtwork, styles.featuredArtworkFallback, { backgroundColor: 'rgba(255,255,255,0.28)' }]}>
                          <Disc3 size={34} color={card.tone.accent} strokeWidth={1.9} />
                        </View>}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text size={21} color="#16181f" style={styles.sectionTitle}>{t('home_section_daily')}</Text>
        <TouchableOpacity activeOpacity={0.82} onPress={openLibrary}>
          <Text size={12} color="#8a8f9d" style={styles.sectionLink}>{t('home_action_see_all')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dailyList}>
        {dailyLists.length
          ? dailyLists.map((item, index) => {
            const meta = playlistMetaMap[item.id]
            const isItemCurrent = isPlaylistCurrent(item.id)
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.dailyRow, index < dailyLists.length - 1 ? styles.dailyRowSpacing : null]}
                activeOpacity={0.84}
                onPress={() => { openPlaylistDetail(item.id) }}
              >
                <View style={styles.dailyCoverWrap}>
                  {meta?.cover
                    ? <Image style={styles.dailyCover} url={meta.cover} />
                    : <View style={[styles.dailyCover, styles.dailyCoverFallback, { backgroundColor: item.tone.surface }]}>
                        <Disc3 size={20} color={item.tone.accent} strokeWidth={1.9} />
                      </View>}
                </View>
                <View style={styles.dailyInfo}>
                  <Text size={15} color="#171a22" style={styles.dailyTitle} numberOfLines={1}>{item.title}</Text>
                  <Text size={12} color="#7d8190" numberOfLines={1}>{`${item.tag} · ${t('home_daily_tracks', { count: meta?.count ?? 0 })}`}</Text>
                </View>
                <TouchableOpacity
                  style={styles.dailyPlayButton}
                  activeOpacity={0.82}
                  onPress={handlePlayPlaylistPress(item.id)}
                >
                  {isItemCurrent && isPlay
                    ? <View style={styles.pauseGlyphSmall}>
                        <View style={[styles.pauseBar, styles.pauseBarSmall, styles.pauseBarDark]} />
                        <View style={[styles.pauseBar, styles.pauseBarSmall, styles.pauseBarDark]} />
                      </View>
                    : <Play size={13} color="#303340" fill="#303340" strokeWidth={2} />}
                </TouchableOpacity>
              </TouchableOpacity>
            )
          })
          : <View style={styles.emptyCard}>
              <Text size={13} color="#7d8190">{t('home_daily_empty')}</Text>
            </View>}
      </View>
    </View>
  )
})

// ---------- LbContent ----------
interface LbContentProps {
  lbAllData: LbAllData
  activeFilter: LbFilterId
  lbPageWidth: number
  lbTrackWidth: number
}

const LbContent = memo(({
  lbAllData,
  activeFilter,
  lbPageWidth,
  lbTrackWidth,
}: LbContentProps) => {
  const t = useI18n()
  const pulse = usePulseAnim()
  const lbScrollXMapRef = useRef<Partial<Record<LX.OnlineSource, Animated.Value>>>({})
  const getLbScrollX = useCallback((src: LX.OnlineSource): Animated.Value => {
    const existing = lbScrollXMapRef.current[src]
    if (existing) return existing
    const val = new Animated.Value(0)
    lbScrollXMapRef.current[src] = val
    return val
  }, [])
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
    return () => clearTimeout(timer)
  }, [activeFilter])

  return (
    <View>
      {leaderboardState.sources.map(src => {
        const srcData = lbAllData[activeFilter]?.[src]
        const boardId = srcData?.boardId ?? ''
        const boardName = srcData?.boardName ?? ''
        const songs = srcData?.songs ?? []
        const loading = srcData?.loading ?? true
        const showLoading = loading && !songs.length
        // settledFilter 落后于 activeFilter：activeFilter 刚变化时 spinner 在首次渲染立即出现
        const showSongSkeleton = settledFilter !== activeFilter || showLoading
        const chunks: LX.Music.MusicInfoOnline[][] = []
        for (let i = 0; i < songs.length; i += 3) chunks.push(songs.slice(i, i + 3))

        return (
          <View key={src} style={styles.lbSourceSection}>
            <View style={styles.sectionHeader}>
              {showLoading
                ? <SkeletonTitle pulse={pulse} />
                : <Text size={18} color="#16181f" style={styles.lbBoardTitle} numberOfLines={1}>
                    {`${t(`source_real_${src}`)}：${boardName || '—'}`}
                  </Text>}
              {!showLoading
                ? <TouchableOpacity activeOpacity={0.82} onPress={() => { handleViewAll(src, boardId, boardName) }}>
                    <Text size={12} color="#8a8f9d" style={styles.sectionLink}>{t('home_action_see_all')}</Text>
                  </TouchableOpacity>
                : null}
            </View>

            {showSongSkeleton
              ? <View style={styles.lbSpinnerArea}>
                  <ActivityIndicator size="large" color="#8a8f9d" />
                </View>
              : <ContentReveal key={`${src}-${activeFilter}`}>
                  {chunks.length
                    ? <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        snapToAlignment="start"
                        snapToInterval={lbPageWidth}
                        disableIntervalMomentum
                        scrollEventThrottle={16}
                        onScroll={Animated.event(
                          [{ nativeEvent: { contentOffset: { x: getLbScrollX(src) } } }],
                          { useNativeDriver: false },
                        )}
                      >
                        {chunks.map((chunk, chunkIndex) => (
                          <View key={chunkIndex} style={{ width: lbPageWidth }}>
                            {chunk.map((song, songIndex) => {
                              const absIndex = chunkIndex * 3 + songIndex
                              const coverUrl = pickMusicCover(song)
                              return (
                                <TouchableOpacity
                                  key={song.id}
                                  style={[styles.dailyRow, songIndex < chunk.length - 1 ? styles.dailyRowSpacing : null]}
                                  activeOpacity={0.84}
                                  onPress={() => { handleLbPlay(boardId, songs, absIndex) }}
                                >
                                  <Text size={15} color="#8a8f9d" style={styles.lbRankNum}>
                                    {absIndex + 1}
                                  </Text>
                                  <View style={styles.dailyCoverWrap}>
                                    {coverUrl
                                      ? <Image style={styles.dailyCover} url={coverUrl} />
                                      : <View style={[styles.dailyCover, styles.dailyCoverFallback, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                          <Disc3 size={20} color="#8a8f9d" strokeWidth={1.9} />
                                        </View>}
                                  </View>
                                  <View style={styles.dailyInfo}>
                                    <Text size={15} color="#171a22" style={styles.dailyTitle} numberOfLines={1}>{song.name}</Text>
                                    <Text size={12} color="#7d8190" numberOfLines={1}>{song.singer}</Text>
                                  </View>
                                  <TouchableOpacity
                                    style={styles.dailyPlayButton}
                                    activeOpacity={0.82}
                                    onPress={(event) => { event.stopPropagation(); handleLbPlay(boardId, songs, absIndex) }}
                                  >
                                    <Play size={13} color="#303340" fill="#303340" strokeWidth={2} />
                                  </TouchableOpacity>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        ))}
                      </ScrollView>
                    : <View style={styles.lbEmpty}><Text size={13} color="#8a8f9d">暂无榜单数据</Text></View>}
                </ContentReveal>}

            {!showSongSkeleton && chunks.length > 1
              ? <View style={styles.lbScrollTrack}>
                  <Animated.View
                    style={[
                      styles.lbScrollThumb,
                      {
                        width: lbTrackWidth / chunks.length,
                        transform: [{
                          translateX: getLbScrollX(src).interpolate({
                            inputRange: [0, lbPageWidth * (chunks.length - 1)],
                            outputRange: [0, lbTrackWidth * (chunks.length - 1) / chunks.length],
                            extrapolate: 'clamp',
                          }),
                        }],
                      },
                    ]}
                  />
                </View>
              : null}
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
  lbPageWidth: number
  lbTrackWidth: number
}

const OtherContent = memo(({
  lbOtherData,
  selectedOtherSource,
  onSourceChange,
  lbPageWidth,
  lbTrackWidth,
}: OtherContentProps) => {
  const t = useI18n()
  const pulse = usePulseAnim()
  const lbOtherScrollXMapRef = useRef<Record<string, Animated.Value>>({})
  const getOtherScrollX = useCallback((boardId: string): Animated.Value => {
    const existing = lbOtherScrollXMapRef.current[boardId]
    if (existing) return existing
    const val = new Animated.Value(0)
    lbOtherScrollXMapRef.current[boardId] = val
    return val
  }, [])
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

  // 挂载时立刻显示 spinner，200ms 后清除
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

  return (
    <View>
      <View style={styles.sourceRow}>
        {leaderboardState.sources.map(src => (
          <Pressable
            key={src}
            style={[styles.filterChip, selectedOtherSource === src ? styles.filterChipActive : null]}
            android_ripple={{ color: 'rgba(217,239,98,0.5)', foreground: true, borderless: false }}
            onPressIn={() => {
              if (src === selectedOtherSource) return
              setIsSwitching(true)
              if (switchTimerRef.current) clearTimeout(switchTimerRef.current)
              switchTimerRef.current = setTimeout(() => {
                setIsSwitching(false)
                switchTimerRef.current = null
              }, 400)
            }}
            onPress={() => { onSourceChange(src) }}
          >
            <Text size={12} color={selectedOtherSource === src ? '#31351b' : '#5d6271'} style={styles.filterChipText}>
              {SOURCE_SHORT_LABELS[src] ?? src}
            </Text>
          </Pressable>
        ))}
      </View>
      {(() => {
        const srcState = lbOtherData[selectedOtherSource]
        const srcBoards = !srcState || (srcState.loading && !srcState.entries.length) ? undefined : srcState.entries

        if (isSwitching || !srcBoards) {
          return (
            <View style={styles.spinnerContainer}>
              <ActivityIndicator size="large" color="#8a8f9d" />
            </View>
          )
        }
        if (!srcBoards.length) {
          return <View style={styles.lbEmpty}><Text size={13} color="#8a8f9d">暂无榜单数据</Text></View>
        }
        return (
          <ContentReveal key={selectedOtherSource}>
            {srcBoards.map(entry => {
          const { boardId, boardName, songs, loading } = entry
          const showLoading = loading && !songs.length
          const chunks: LX.Music.MusicInfoOnline[][] = []
          for (let i = 0; i < songs.length; i += 3) chunks.push(songs.slice(i, i + 3))
          return (
            <View key={boardId} style={styles.lbSourceSection}>
              <View style={styles.sectionHeader}>
                {showLoading
                  ? <SkeletonTitle pulse={pulse} />
                  : <Text size={18} color="#16181f" style={styles.lbBoardTitle} numberOfLines={1}>
                      {boardName || '—'}
                    </Text>}
                {!showLoading
                  ? <TouchableOpacity activeOpacity={0.82} onPress={() => { handleViewAll(selectedOtherSource, boardId, boardName) }}>
                      <Text size={12} color="#8a8f9d" style={styles.sectionLink}>{t('home_action_see_all')}</Text>
                    </TouchableOpacity>
                  : null}
              </View>

              {showLoading
                ? <SkeletonTextRows pulse={pulse} />
                : <ContentReveal key={boardId}>
                    {chunks.length
                      ? <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          decelerationRate="fast"
                          snapToAlignment="start"
                          snapToInterval={lbPageWidth}
                          disableIntervalMomentum
                          scrollEventThrottle={16}
                          onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { x: getOtherScrollX(boardId) } } }],
                            { useNativeDriver: false },
                          )}
                        >
                          {chunks.map((chunk, chunkIndex) => (
                            <View key={chunkIndex} style={{ width: lbPageWidth }}>
                              {chunk.map((song, songIndex) => {
                                const absIndex = chunkIndex * 3 + songIndex
                                return (
                                  <TouchableOpacity
                                    key={song.id}
                                    style={[styles.otherRow, songIndex < chunk.length - 1 ? styles.dailyRowSpacing : null]}
                                    activeOpacity={0.84}
                                    onPress={() => { handleLbPlay(boardId, songs, absIndex) }}
                                  >
                                    <Text size={14} color="#8a8f9d" style={styles.lbRankNum}>{absIndex + 1}</Text>
                                    <View style={styles.dailyInfo}>
                                      <Text size={14} color="#171a22" style={styles.dailyTitle} numberOfLines={1}>{song.name}</Text>
                                      <Text size={12} color="#7d8190" numberOfLines={1}>{song.singer}</Text>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.dailyPlayButton}
                                      activeOpacity={0.82}
                                      onPress={(event) => { event.stopPropagation(); handleLbPlay(boardId, songs, absIndex) }}
                                    >
                                      <Play size={13} color="#303340" fill="#303340" strokeWidth={2} />
                                    </TouchableOpacity>
                                  </TouchableOpacity>
                                )
                              })}
                            </View>
                          ))}
                        </ScrollView>
                      : <View style={styles.lbEmpty}><Text size={13} color="#8a8f9d">暂无榜单数据</Text></View>}
                  </ContentReveal>}

              {!showLoading && chunks.length > 1
                ? <View style={styles.lbScrollTrack}>
                    <Animated.View
                      style={[
                        styles.lbScrollThumb,
                        {
                          width: lbTrackWidth / chunks.length,
                          transform: [{
                            translateX: getOtherScrollX(boardId).interpolate({
                              inputRange: [0, lbPageWidth * (chunks.length - 1)],
                              outputRange: [0, lbTrackWidth * (chunks.length - 1) / chunks.length],
                              extrapolate: 'clamp',
                            }),
                          }],
                        },
                      ]}
                    />
                  </View>
                : null}
            </View>
          )
        })}
          </ContentReveal>
        )
      })()}
    </View>
  )
})

// ---------- HomeTab ----------
export default memo(() => {
  const t = useI18n()
  const { width } = useWindowDimensions()
  const statusBarHeight = useStatusbarHeight()
  const activeNavId = useNavActiveId()
  const playlists = useMyList()
  const playMusicInfo = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const linkedPlaylistId = useLinkedPlaylistId()
  const [displayName, setDisplayName] = useState(DEFAULT_USER_NAME)
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [playlistMetaMap, setPlaylistMetaMap] = useState<Record<string, { count: number, cover: string | null }>>({})
  const playlistMetaRequestRef = useRef(0)
  const topPadding = statusBarHeight + 18 + 44 + 16
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
  const activeFilterRef = useRef<FilterId>(activeFilter)
  const chipAnimsRef = useRef<Record<FilterId, Animated.Value>>({
    all: new Animated.Value(1),
    new: new Animated.Value(0),
    trending: new Animated.Value(0),
    top: new Animated.Value(0),
    other: new Animated.Value(0),
  })
  const prevActiveFilterRef = useRef<FilterId>('all')

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
      .map((list, index) => ({
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
        tone: getTone(index),
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
        cover: pickCover(musics),
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
  }, [libraryItems])

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

  // Load filter data on demand when user switches — mirrors the upstream pattern.
  // lbFilterLoadedRef prevents re-fetching if data is already loaded/loading.
  useEffect(() => {
    if (activeFilter === 'all') return
    if (activeFilter === 'other') {
      void loadOtherSource(selectedOtherSource)
      return
    }
    void loadOneFilter(activeFilter)
  }, [activeFilter, loadOneFilter, loadOtherSource, selectedOtherSource])

  const greetingName = displayName.trim() || DEFAULT_USER_NAME

  const lbPageWidth = width - 36
  const lbTrackWidth = lbPageWidth - 58

  const rankedItems = useMemo(() => [...libraryItems], [libraryItems])
  const featuredItem = rankedItems[0] ?? null
  const featuredCardWidth = Math.min(Math.max(width - 76, 300), 344)
  const featuredCardGap = 12
  const dailyLists = useMemo(() => rankedItems.slice(0, 3), [rankedItems])
  const currentMusic = playMusicInfo.musicInfo
  const currentMusicInfo = currentMusic
    ? 'metadata' in currentMusic
      ? currentMusic.metadata.musicInfo
      : currentMusic
    : null
  const featuredCover = currentMusicInfo?.meta.picUrl ?? (featuredItem ? playlistMetaMap[featuredItem.id]?.cover : null) ?? null
  const featuredStat = featuredItem ? playlistMetaMap[featuredItem.id]?.count ?? 0 : 0
  const isPlaylistCurrent = useCallback((listId: string | null | undefined) => {
    if (!listId || !linkedPlaylistId) return false
    return linkedPlaylistId === listId
  }, [linkedPlaylistId])
  const featuredCards = useMemo(() => {
    const cards = [
      {
        id: featuredItem?.id ?? 'discover-weekly',
        sourceListId: featuredItem?.id ?? null,
        eyebrow: featuredItem?.title ?? t('home_discover_badge'),
        title: t('home_discover_title'),
        subtitle: t('home_discover_subtitle'),
        count: featuredStat,
        cover: featuredCover,
        tone: heroCardTones[0],
      },
      ...rankedItems.slice(1, 3).map((item, index) => ({
        id: item.id,
        sourceListId: item.id,
        eyebrow: item.tag,
        title: item.title,
        subtitle: item.subtitle,
        count: playlistMetaMap[item.id]?.count ?? 0,
        cover: playlistMetaMap[item.id]?.cover ?? null,
        tone: heroCardTones[(index + 1) % heroCardTones.length],
      })),
    ]

    return cards
  }, [featuredCover, featuredItem?.id, featuredItem?.title, featuredStat, playlistMetaMap, rankedItems, t])

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

  const animateChipTo = useCallback((id: FilterId) => {
    const anims = chipAnimsRef.current
    const prev = prevActiveFilterRef.current
    prevActiveFilterRef.current = id
    if (prev !== id) {
      Animated.timing(anims[prev], { toValue: 0, duration: 80, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
    }
    Animated.timing(anims[id], { toValue: 1, duration: 80, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
  }, [])

  const handleFilterPressIn = useCallback((id: FilterId) => {
    animateChipTo(id)
  }, [animateChipTo])

  const handleFilterPress = useCallback((id: FilterId) => {
    setActiveFilter(id)
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
        <View style={styles.greetingBlock}>
          <Text size={30} color="#16181f" style={styles.greetingTitle}>{`${t('home_greeting_short')}, ${greetingName}`}</Text>
        </View>

        <View style={styles.filterRow}>
          {filterChips.map(({ id, key }) => (
            <Pressable
              key={id}
              style={styles.filterChip}
              android_ripple={{ color: 'rgba(217,239,98,0.5)', foreground: true, borderless: false }}
              onPressIn={() => { handleFilterPressIn(id) }}
              onPress={() => { handleFilterPress(id) }}
            >
              <Animated.View style={[styles.filterChipActiveOverlay, { opacity: chipAnimsRef.current[id] }]} />
              <Text size={12} color={activeFilter === id ? '#31351b' : '#5d6271'} style={styles.filterChipText}>{t(key)}</Text>
            </Pressable>
          ))}
        </View>

        <View>
          {activeFilter === 'all' && (
            <ContentReveal>
              <AllContent
                featuredCards={featuredCards}
                dailyLists={dailyLists}
                playlistMetaMap={playlistMetaMap}
                isPlay={isPlay}
                isPlaylistCurrent={isPlaylistCurrent}
                handlePlayPlaylistPress={handlePlayPlaylistPress}
                featuredCardWidth={featuredCardWidth}
                featuredCardGap={featuredCardGap}
              />
            </ContentReveal>
          )}
          {isLbFilter && (
            <LbContent
              lbAllData={lbAllData}
              activeFilter={lbActiveFilter}
              lbPageWidth={lbPageWidth}
              lbTrackWidth={lbTrackWidth}
            />
          )}
          {activeFilter === 'other' && (
            <OtherContent
              lbOtherData={lbOtherData}
              selectedOtherSource={selectedOtherSource}
              onSourceChange={handleOtherSourceChange}
              lbPageWidth={lbPageWidth}
              lbTrackWidth={lbTrackWidth}
            />
          )}
        </View>
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  greetingBlock: {
    marginBottom: 16,
  },
  greetingTitle: {
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  filterChip: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  filterChipActive: {
    backgroundColor: '#d9ef62',
  },
  filterChipActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: '#d9ef62',
  },
  filterChipText: {
    fontWeight: '600',
  },
  spinnerContainer: {
    minHeight: 200,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  lbSpinnerArea: {
    minHeight: 160,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  featuredCard: {
    overflow: 'hidden',
    borderRadius: 22,
    shadowColor: '#84789b',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  featuredScroller: {
    marginBottom: 22,
  },
  featuredScrollerContent: {
    paddingRight: 6,
  },
  featuredBody: {
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingTop: 14,
    paddingBottom: 14,
    paddingRight: 16,
  },
  featuredHeader: {
    marginBottom: 4,
    paddingRight: 92,
  },
  featuredBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featuredContent: {
    flex: 1,
    paddingRight: 12,
  },
  featuredEyebrow: {
    fontWeight: '600',
    marginBottom: 5,
  },
  featuredTitle: {
    fontWeight: '700',
  },
  featuredSubtitle: {
    lineHeight: 17,
    marginBottom: 8,
    marginRight: 2,
  },
  featuredCount: {
    marginBottom: 8,
  },
  featuredActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#613060',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pauseGlyph: {
    width: 14,
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pauseGlyphSmall: {
    width: 10,
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pauseBar: {
    width: 4,
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  pauseBarSmall: {
    width: 3,
  },
  pauseBarDark: {
    backgroundColor: '#303340',
  },
  iconAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  featuredArtworkWrap: {
    marginTop: -34,
    width: 102,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  featuredArtwork: {
    width: 96,
    height: 116,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  featuredArtworkFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionLink: {
    fontWeight: '600',
  },
  dailyList: {
    marginTop: 2,
  },
  dailyRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  dailyRowSpacing: {
    marginBottom: 1,
  },
  dailyCoverWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#747b8f',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  dailyCover: {
    width: '100%',
    height: '100%',
  },
  dailyCoverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyInfo: {
    flex: 1,
    marginLeft: 13,
    marginRight: 12,
  },
  dailyTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  dailyPlayButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(230,234,243,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  lbSourceSection: {
    marginTop: 28,
  },
  otherRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  lbBoardTitle: {
    fontWeight: '700',
  },
  lbRankNum: {
    width: 26,
    textAlign: 'center',
    fontWeight: '700',
    marginRight: 2,
  },
  lbEmpty: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbScrollTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(22,24,31,0.08)',
    marginTop: 10,
    marginLeft: 28,
    marginRight: 30,
    overflow: 'hidden',
  },
  lbScrollThumb: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(22,24,31,0.28)',
  },
})
