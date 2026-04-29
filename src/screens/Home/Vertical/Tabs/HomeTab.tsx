/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useCallback, startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, ScrollView, TouchableOpacity, View, useWindowDimensions, type GestureResponderEvent } from 'react-native'
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

const BOTTOM_DOCK_BASE_HEIGHT = 164

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
}
interface LbOtherBoardState {
  boardId: string
  boardName: string
  songs: LX.Music.MusicInfoOnline[]
  loading: boolean
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

const getTone = (index: number) => cardTones[index % cardTones.length]

const pickCover = (list: LX.Music.MusicInfo[]) => {
  for (const song of list) {
    if (song.meta.picUrl) return song.meta.picUrl
  }
  return null
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

// Pre-defined style objects to ensure stable references for memo comparisons
const DISPLAY_FLEX = { display: 'flex' as const }
const DISPLAY_NONE = { display: 'none' as const }

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
  display: 'flex' | 'none'
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
  display,
}: AllContentProps) => {
  const t = useI18n()
  return (
    <View style={{ display }}>
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
  lbAllData: Partial<Record<'new' | 'trending' | 'top', Partial<Record<LX.OnlineSource, LbSourceState>>>>
  activeFilter: 'new' | 'trending' | 'top'
  lbPageWidth: number
  lbTrackWidth: number
  display: 'flex' | 'none'
}

const LbContent = memo(({
  lbAllData,
  activeFilter,
  lbPageWidth,
  lbTrackWidth,
  display,
}: LbContentProps) => {
  const t = useI18n()
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

  return (
    <View style={{ display }}>
      {leaderboardState.sources.map(src => {
        const srcData = lbAllData[activeFilter]?.[src]
        const boardId = srcData?.boardId ?? ''
        const boardName = srcData?.boardName ?? ''
        const songs = srcData?.songs ?? []
        const loading = srcData?.loading ?? true
        const chunks: LX.Music.MusicInfoOnline[][] = []
        for (let i = 0; i < songs.length; i += 3) chunks.push(songs.slice(i, i + 3))

        return (
          <View key={src} style={styles.lbSourceSection}>
            <View style={styles.sectionHeader}>
              <Text size={18} color="#16181f" style={styles.lbBoardTitle} numberOfLines={1}>
                {loading ? '...' : `${t(`source_real_${src}`)}：${boardName || '—'}`}
              </Text>
              <TouchableOpacity activeOpacity={0.82} onPress={() => { handleViewAll(src, boardId, boardName) }}>
                <Text size={12} color="#8a8f9d" style={styles.sectionLink}>{t('home_action_see_all')}</Text>
              </TouchableOpacity>
            </View>

            {loading
              ? <View style={styles.lbEmpty}><Text size={13} color="#8a8f9d">加载中...</Text></View>
              : chunks.length
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

            {!loading && chunks.length > 1
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
  lbOtherData: Partial<Record<LX.OnlineSource, LbOtherBoardState[]>>
  lbPageWidth: number
  lbTrackWidth: number
  display: 'flex' | 'none'
}

const OtherContent = memo(({
  lbOtherData,
  lbPageWidth,
  lbTrackWidth,
  display,
}: OtherContentProps) => {
  const t = useI18n()
  const [selectedOtherSource, setSelectedOtherSource] = useState<LX.OnlineSource>(leaderboardState.sources[0] ?? 'kw')
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

  return (
    <View style={{ display }}>
      <View style={styles.sourceRow}>
        {leaderboardState.sources.map(src => (
          <TouchableOpacity
            key={src}
            style={[styles.filterChip, selectedOtherSource === src ? styles.filterChipActive : null]}
            activeOpacity={0.85}
            onPress={() => { setSelectedOtherSource(src) }}
          >
            <Text size={12} color={selectedOtherSource === src ? '#31351b' : '#5d6271'} style={styles.filterChipText}>
              {SOURCE_SHORT_LABELS[src] ?? src}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {(() => {
        const srcBoards = lbOtherData[selectedOtherSource]
        if (!srcBoards) return <View style={styles.lbEmpty}><Text size={13} color="#8a8f9d">加载中...</Text></View>
        if (!srcBoards.length) return <View style={styles.lbEmpty}><Text size={13} color="#8a8f9d">暂无榜单数据</Text></View>
        return <>{srcBoards.map(entry => {
          const { boardId, boardName, songs, loading } = entry
          const chunks: LX.Music.MusicInfoOnline[][] = []
          for (let i = 0; i < songs.length; i += 3) chunks.push(songs.slice(i, i + 3))
          return (
            <View key={boardId} style={styles.lbSourceSection}>
              <View style={styles.sectionHeader}>
                <Text size={18} color="#16181f" style={styles.lbBoardTitle} numberOfLines={1}>
                  {loading ? '...' : (boardName || '—')}
                </Text>
                <TouchableOpacity activeOpacity={0.82} onPress={() => { handleViewAll(selectedOtherSource, boardId, boardName) }}>
                  <Text size={12} color="#8a8f9d" style={styles.sectionLink}>{t('home_action_see_all')}</Text>
                </TouchableOpacity>
              </View>

              {loading
                ? <View style={styles.lbEmpty}><Text size={13} color="#8a8f9d">加载中...</Text></View>
                : chunks.length
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

              {!loading && chunks.length > 1
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
        })}</>
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
  const [lbAllData, setLbAllData] = useState<Partial<Record<'new' | 'trending' | 'top', Partial<Record<LX.OnlineSource, LbSourceState>>>>>({})
  const [lbOtherData, setLbOtherData] = useState<Partial<Record<LX.OnlineSource, LbOtherBoardState[]>>>({})
  const lbTokensRef = useRef<Record<'new' | 'trending' | 'top' | 'other', number>>({ new: 0, trending: 0, top: 0, other: 0 })
  const filterContentAnim = useRef(new Animated.Value(1)).current

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

  // Fade-in after filter switch (triggered after state update in handleFilterPress callback)
  useEffect(() => {
    Animated.timing(filterContentAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [activeFilter, filterContentAnim])

  const loadOneFilter = useCallback(async(filter: 'new' | 'trending' | 'top') => {
    const token = ++lbTokensRef.current[filter]
    const sources = leaderboardState.sources
    setLbAllData(prev => ({
      ...prev,
      [filter]: Object.fromEntries(sources.map(src => [src, { boardId: '', boardName: '', songs: [], loading: true }])),
    }))
    sources.forEach(async(src) => {
      try {
        const boards = await getBoardsList(src)
        if (lbTokensRef.current[filter] !== token) return
        if (!boards.length) {
          setLbAllData(prev => ({ ...prev, [filter]: { ...prev[filter], [src]: { boardId: '', boardName: '', songs: [], loading: false } } }))
          return
        }
        const board = findBoardForFilter(boards, filter, src)
        const detail = await getListDetail(board.id, 1)
        if (lbTokensRef.current[filter] !== token) return
        const songs = detail.list
        setLbAllData(prev => ({ ...prev, [filter]: { ...prev[filter], [src]: { boardId: board.id, boardName: board.name, songs, loading: false } } }))
        const prewarm = () => {
          void Promise.all(songs.flatMap(s => s.meta.picUrl ? [s.meta.picUrl] : []).map(async url => getCachedImageUri(url).catch(() => null)))
        }
        if (src === 'kg' && songs.length) {
          void Promise.all(songs.map(async(song) => getPicUrl({ musicInfo: song, isRefresh: false }).catch(() => null))).then(prewarm)
        } else {
          prewarm()
        }
      } catch {
        if (lbTokensRef.current[filter] === token) {
          setLbAllData(prev => ({ ...prev, [filter]: { ...prev[filter], [src]: { boardId: '', boardName: '', songs: [], loading: false } } }))
        }
      }
    })
  }, [])

  const loadOtherFilter = useCallback(async() => {
    const token = ++lbTokensRef.current.other
    setLbOtherData({})
    const sources = leaderboardState.sources
    sources.forEach(async(src) => {
      try {
        const boards = await getBoardsList(src)
        if (lbTokensRef.current.other !== token) return
        const usedIds = new Set(
          (['new', 'trending', 'top'] as const).map(f => findBoardForFilter(boards, f, src).id),
        )
        const otherBoards = boards.filter(b => !usedIds.has(b.id))
        if (!otherBoards.length) {
          setLbOtherData(prev => ({ ...prev, [src]: [] }))
          return
        }
        setLbOtherData(prev => ({
          ...prev,
          [src]: otherBoards.map(b => ({ boardId: b.id, boardName: b.name, songs: [], loading: true })),
        }))
        otherBoards.forEach(async(board) => {
          try {
            const detail = await getListDetail(board.id, 1)
            if (lbTokensRef.current.other !== token) return
            const songs = detail.list
            setLbOtherData(prev => ({
              ...prev,
              [src]: (prev[src] ?? []).map(e => e.boardId === board.id ? { ...e, songs, loading: false } : e),
            }))
          } catch {
            if (lbTokensRef.current.other === token) {
              setLbOtherData(prev => ({
                ...prev,
                [src]: (prev[src] ?? []).map(e => e.boardId === board.id ? { ...e, loading: false } : e),
              }))
            }
          }
        })
      } catch {
        if (lbTokensRef.current.other === token) {
          setLbOtherData(prev => ({ ...prev, [src]: [] }))
        }
      }
    })
  }, [])

  useEffect(() => {
    void loadOneFilter('new')
    void loadOneFilter('trending')
    void loadOneFilter('top')
    void loadOtherFilter()
  }, [loadOneFilter, loadOtherFilter])

  const greetingName = displayName.trim() || DEFAULT_USER_NAME

  const lbPageWidth = width - 36
  const lbTrackWidth = lbPageWidth - 58

  const rankedItems = useMemo(() => {
    const items = [...libraryItems]
    switch (activeFilter) {
      case 'new':
        return items.reverse()
      case 'top':
        return items.sort((a, b) => (playlistMetaMap[b.id]?.count ?? 0) - (playlistMetaMap[a.id]?.count ?? 0))
      case 'trending':
        return items.sort((a, b) => {
          const scoreA = Number(a.id === LIST_IDS.LOVE) * 3 + Number(a.id === LIST_IDS.DEFAULT)
          const scoreB = Number(b.id === LIST_IDS.LOVE) * 3 + Number(b.id === LIST_IDS.DEFAULT)
          return scoreB - scoreA
        })
      default:
        return items
    }
  }, [activeFilter, libraryItems, playlistMetaMap])
  const featuredItem = rankedItems[0] ?? null
  const featuredCardWidth = Math.min(Math.max(width - 76, 300), 344)
  const featuredCardGap = 12
  const dailyLists = rankedItems.slice(0, 3)
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

  // Fade-out first, then swap content, then fade-in (via useEffect above)
  const handleFilterPress = useCallback((id: FilterId) => {
    Animated.timing(filterContentAnim, {
      toValue: 0,
      duration: 80,
      useNativeDriver: true,
    }).start(() => {
      startTransition(() => { setActiveFilter(id) })
    })
  }, [filterContentAnim])

  const isLbFilter = activeFilter === 'new' || activeFilter === 'trending' || activeFilter === 'top'
  const lbActiveFilter: 'new' | 'trending' | 'top' = isLbFilter ? activeFilter as 'new' | 'trending' | 'top' : 'new'

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: 24 + BOTTOM_DOCK_BASE_HEIGHT + gestureInsetBottom }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.greetingBlock}>
          <Text size={30} color="#16181f" style={styles.greetingTitle}>{`${t('home_greeting_short')}, ${greetingName}`}</Text>
        </View>

        <View style={styles.filterRow}>
          {filterChips.map(({ id, key }) => {
            const active = activeFilter === id
            return (
              <TouchableOpacity
                key={id}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                activeOpacity={0.85}
                onPress={() => { handleFilterPress(id) }}
              >
                <Text size={12} color={active ? '#31351b' : '#5d6271'} style={styles.filterChipText}>{t(key)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Animated.View style={{ opacity: filterContentAnim, transform: [{ translateY: filterContentAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <AllContent
            featuredCards={featuredCards}
            dailyLists={dailyLists}
            playlistMetaMap={playlistMetaMap}
            isPlay={isPlay}
            isPlaylistCurrent={isPlaylistCurrent}
            handlePlayPlaylistPress={handlePlayPlaylistPress}
            featuredCardWidth={featuredCardWidth}
            featuredCardGap={featuredCardGap}
            display={activeFilter === 'all' ? DISPLAY_FLEX.display : DISPLAY_NONE.display}
          />
          <LbContent
            lbAllData={lbAllData}
            activeFilter={lbActiveFilter}
            lbPageWidth={lbPageWidth}
            lbTrackWidth={lbTrackWidth}
            display={isLbFilter ? DISPLAY_FLEX.display : DISPLAY_NONE.display}
          />
          <OtherContent
            lbOtherData={lbOtherData}
            lbPageWidth={lbPageWidth}
            lbTrackWidth={lbTrackWidth}
            display={activeFilter === 'other' ? DISPLAY_FLEX.display : DISPLAY_NONE.display}
          />
        </Animated.View>
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
  },
  filterChipActive: {
    backgroundColor: '#d9ef62',
  },
  filterChipText: {
    fontWeight: '600',
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
