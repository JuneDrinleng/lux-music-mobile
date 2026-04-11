/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions, type GestureResponderEvent } from 'react-native'
import { Disc3, Ellipsis, Heart, Play } from 'lucide-react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { LIST_IDS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { isPlayQueueMetaId, pause, play, playListAsQueue } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import listState from '@/store/list/state'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { DEFAULT_USER_NAME, getListMusics, getUserName } from '@/utils/data'

const BOTTOM_DOCK_BASE_HEIGHT = 112
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
type FilterId = 'all' | 'new' | 'trending' | 'top'

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

const getQueueSourceListId = (queueMetaId: string | null | undefined) => {
  if (!isPlayQueueMetaId(queueMetaId)) return null
  const queueBody = queueMetaId.slice('play_queue__'.length)
  const timestampSeparatorIndex = queueBody.lastIndexOf('_')
  if (timestampSeparatorIndex < 0) return queueBody
  return queueBody.slice(0, timestampSeparatorIndex)
}

export default () => {
  const t = useI18n()
  const { width } = useWindowDimensions()
  const statusBarHeight = useStatusbarHeight()
  const activeNavId = useNavActiveId()
  const playlists = useMyList()
  const playMusicInfo = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const [displayName, setDisplayName] = useState(DEFAULT_USER_NAME)
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [playlistMetaMap, setPlaylistMetaMap] = useState<Record<string, { count: number, cover: string | null }>>({})
  const [linkedPlaylistId, setLinkedPlaylistId] = useState<string | null>(null)
  const playlistMetaRequestRef = useRef(0)
  const topPadding = statusBarHeight + 18 + 44 + 16

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

  const greetingName = displayName.trim() || DEFAULT_USER_NAME
  const filterChips = [
    { id: 'all', key: 'home_tag_all' },
    { id: 'new', key: 'home_tag_new' },
    { id: 'trending', key: 'home_tag_trending' },
    { id: 'top', key: 'home_tag_top' },
  ] as const

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
  const currentQueueMetaId = playMusicInfo.listId === LIST_IDS.TEMP ? listState.tempListMeta.id : null
  const currentMusic = playMusicInfo.musicInfo
  const currentMusicInfo = currentMusic
    ? 'metadata' in currentMusic
      ? currentMusic.metadata.musicInfo
      : currentMusic
    : null
  const featuredCover = currentMusicInfo?.meta.picUrl ?? (featuredItem ? playlistMetaMap[featuredItem.id]?.cover : null) ?? null
  const featuredStat = featuredItem ? playlistMetaMap[featuredItem.id]?.count ?? 0 : 0
  const isPlaylistCurrent = (listId: string | null | undefined) => {
    if (!listId || !linkedPlaylistId) return false
    return linkedPlaylistId === listId
  }
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

  const handlePlayPlaylist = async(listId: string | null | undefined) => {
    if (!listId) return
    if (isPlaylistCurrent(listId)) {
      if (isPlay) await pause()
      else play()
      return
    }
    await playListAsQueue(listId, 0)
  }
  const handlePlayPlaylistPress = (listId: string | null | undefined) => (event: GestureResponderEvent) => {
    event.stopPropagation()
    void handlePlayPlaylist(listId)
  }

  useEffect(() => {
    let cancelled = false

    const syncLinkedPlaylist = async() => {
      const currentListId = playMusicInfo.listId
      if (!currentListId || !playMusicInfo.musicInfo) {
        if (!cancelled) setLinkedPlaylistId(null)
        return
      }

      if (currentListId !== LIST_IDS.TEMP) {
        if (!cancelled) setLinkedPlaylistId(currentListId)
        return
      }

      const sourceListId = getQueueSourceListId(currentQueueMetaId)
      if (!sourceListId) {
        if (!cancelled) setLinkedPlaylistId(null)
        return
      }

      const [tempList, sourceList] = await Promise.all([
        getListMusics(LIST_IDS.TEMP),
        getListMusics(sourceListId),
      ])
      const isSameList = tempList.length === sourceList.length && tempList.every((music, index) => {
        const sourceMusic = sourceList[index]
        return sourceMusic != null && sourceMusic.id === music.id && sourceMusic.source === music.source
      })

      if (!cancelled) {
        setLinkedPlaylistId(isSameList ? sourceListId : null)
      }
    }

    const handleListUpdate = (ids: string[]) => {
      if (!playMusicInfo.listId) return
      if (playMusicInfo.listId !== LIST_IDS.TEMP) return

      const sourceListId = getQueueSourceListId(currentQueueMetaId)
      if (!ids.includes(LIST_IDS.TEMP) && (!sourceListId || !ids.includes(sourceListId))) return
      void syncLinkedPlaylist()
    }

    void syncLinkedPlaylist()
    global.app_event.on('myListMusicUpdate', handleListUpdate)

    return () => {
      cancelled = true
      global.app_event.off('myListMusicUpdate', handleListUpdate)
    }
  }, [currentQueueMetaId, playMusicInfo.listId, playMusicInfo.musicInfo])

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: 24 + BOTTOM_DOCK_BASE_HEIGHT }]}
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
                onPress={() => { setActiveFilter(id) }}
              >
                <Text size={12} color={active ? '#31351b' : '#5d6271'} style={styles.filterChipText}>{t(key)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

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
      </ScrollView>
    </View>
  )
}

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarButton: {
    borderRadius: 22,
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 2,
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3eef2',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  searchDock: {
    flex: 1,
    marginLeft: 12,
    position: 'relative',
    zIndex: 8,
  },
  searchField: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.58)',
    backgroundColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  searchGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchGlassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  searchGlassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  searchContent: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    color: '#232733',
    fontSize: 14,
  },
  searchInputTrigger: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    justifyContent: 'center',
  },
  searchInputText: {
    lineHeight: 18,
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
  searchEmptyState: {
    minHeight: 126,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
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
  dailyMeta: {
    lineHeight: 17,
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
})
