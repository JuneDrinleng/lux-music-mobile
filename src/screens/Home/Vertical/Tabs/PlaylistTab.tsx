/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
  type FlatList,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ListRenderItem,
  type TextInput,
} from 'react-native'
import { type SegmentedIconSwitchItem } from '@/components/common/SegmentedIconSwitch'
import { type PromptDialogType } from '@/components/common/PromptDialog'
import { type MusicAddModalType } from '@/components/MusicAddModal'
import { type MusicMultiAddModalType } from '@/components/MusicMultiAddModal'
import SearchMusicResultRow from '@/components/search/SearchMusicResultRow'
import PlaylistDetailHeader from '@/components/playlist/PlaylistDetailHeader'
import PlaylistDetailSongItem from '@/components/playlist/PlaylistDetailSongItem'
import PlaylistDetailView from '@/components/playlist/PlaylistDetailView'
import PlaylistLibraryScene from '@/components/playlist/PlaylistLibraryScene'
import { usePlaylistCardDrag } from '@/components/playlist/hooks/usePlaylistCardDrag'
import { createSongRowKeyStore, stableSongRowKey } from '@/components/playlist/songRowKey'
import PlaylistSearchScene from '@/components/playlist/PlaylistSearchScene'
import useLinkedPlaylistId from '@/components/playlist/hooks/useLinkedPlaylistId'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { MdiIcon } from '@/components/common/MdiIcon'
import Image from '@/components/common/Image'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { addListMusics, createList, getListMusics, removeListMusics, removeUserList, setActiveList, setTempList, updateListMusicPosition, updateUserList } from '@/core/list'
import { addMusicToQueueAndPlay, pause, play, playList, playListAsQueue } from '@/core/player/player'
import { APP_LAYER_INDEX, LIST_IDS } from '@/config/constant'
import { search as searchOnlineMusic } from '@/core/search/music'
import { getListDetailAll } from '@/core/songlist'
import { addHistoryWord, clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import settingState from '@/store/setting/state'
import { useSettingValue } from '@/store/setting/hook'
import { DEFAULT_USER_AVATAR, DEFAULT_USER_NAME, getUserAvatar, getUserGender, getUserName, getUserSignature } from '@/utils/data'
import { setNavActiveId, updateSetting } from '@/core/common'
import { type Source as OnlineSearchSource } from '@/store/search/music/state'
import { useIsPlay } from '@/store/player/hook'
import { useI18n } from '@/lang'
import { type OnlinePlaylistDetailPayload, type PlaylistDetailPayload } from '@/event/appEvent'
import listState from '@/store/list/state'
import commonState from '@/store/common/state'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { applyMusicCoverFallback, pickMusicCover } from '@/utils/musicCover'
import musicSdk from '@/utils/musicSdk'
import { debounce } from '@/utils'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { memoLuxColors, sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { limeColors, type LuxColors } from '@/theme/luxTokens'

const BOTTOM_DOCK_BASE_HEIGHT = 164
const SOURCE_MENU_PANEL_WIDTH = 156
const SOURCE_MENU_ROW_HEIGHT = 44
const SOURCE_MENU_EXPAND_DURATION = 132
const SOURCE_MENU_REVEAL_DURATION = 156
const SOURCE_MENU_REVEAL_DELAY = 52
const DETAIL_TRANSITION_FORWARD_DURATION = 318
const DETAIL_TRANSITION_BACKWARD_DURATION = 304
const DETAIL_TRANSITION_HOME_PARALLAX = 0.28
const sourceMenus = [
  { action: 'all', label: 'all' },
  { action: 'kg', label: 'kg' },
  { action: 'kw', label: 'kw' },
  { action: 'mg', label: 'mg' },
  { action: 'tx', label: 'tx' },
  { action: 'wy', label: 'wy' },
] as const
const readSourceTagColorMap = memoLuxColors((colors: LuxColors) => ({
  tx: { text: colors.source.tx.text, background: colors.source.tx.background },
  wy: { text: colors.source.wy.text, background: colors.source.wy.background },
  kg: { text: colors.source.kg.text, background: colors.source.kg.background },
  kw: { text: colors.source.kw.text, background: colors.source.kw.background },
  mg: { text: colors.source.mg.text, background: colors.source.mg.background },
}))
const readPlaylistCardTones = memoLuxColors((colors: LuxColors) => ([
  { surface: colors.playlistCovers[0].surface, accent: colors.playlistCovers[0].accent, ink: colors.playlistCovers[0].ink },
  { surface: colors.playlistCovers[1].surface, accent: colors.playlistCovers[1].accent, ink: colors.playlistCovers[1].ink },
  { surface: colors.playlistCovers[2].surface, accent: colors.playlistCovers[2].accent, ink: colors.playlistCovers[2].ink },
  { surface: colors.playlistCovers[3].surface, accent: colors.playlistCovers[3].accent, ink: colors.playlistCovers[3].ink },
] as const))
const getSourceTagColor = (source: string, colors: LuxColors = limeColors) => {
  return readSourceTagColorMap(colors)[source.toLowerCase()] ?? { text: colors.source.unknown.text, background: colors.source.unknown.background }
}
const getSourceMenuLabel = (source: SourceMenu['action']) => {
  return source == 'all' ? 'All' : source.toUpperCase()
}

const getPlaylistCardTone = (index: number, colors: LuxColors = limeColors) => {
  return readPlaylistCardTones(colors)[index % readPlaylistCardTones(colors).length]
}

const playlistSnapshotCache = new Map<string, {
  songs: LX.Music.MusicInfo[]
  count: number
  pic: string | null
}>()

const parsePlaylistTimeFromName = (name: string): number | null => {
  const match = name.match(/((?:19|20)\d{2})\s*(?:[./-]|\u5e74)\s*(1[0-2]|0?[1-9])(?:\s*(?:[./-]|\u6708)\s*(3[01]|[12]\d|0?[1-9]))?/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  let day = Number(match[3] || 0)
  if (!day) {
    if (/\u4e0b(?:\u65ec)?/.test(name)) day = 25
    else if (/\u4e2d(?:\u65ec)?/.test(name)) day = 15
    else if (/\u4e0a(?:\u65ec)?/.test(name)) day = 5
    else day = 1
  }
  const time = new Date(year, month - 1, day).getTime()
  return Number.isNaN(time) ? null : time
}

const parsePlaylistTimeFromId = (id: string): number | null => {
  const msMatch = id.match(/(?:^|_)(\d{13})(?:$|_)/)
  if (msMatch) {
    const time = Number(msMatch[1])
    if (Number.isFinite(time) && time > 0) return time
  }
  const secMatch = id.match(/(?:^|_)(\d{10})(?:$|_)/)
  if (secMatch) {
    const time = Number(secMatch[1]) * 1000
    if (Number.isFinite(time) && time > 0) return time
  }
  return null
}

const getPlaylistSortTime = (listInfo: LX.List.UserListInfo): number => {
  return parsePlaylistTimeFromName(listInfo.name) ??
    parsePlaylistTimeFromId(listInfo.id) ??
    (listInfo.locationUpdateTime ?? 0)
}

type SourceMenu = typeof sourceMenus[number]
type SearchResultItem = LX.Music.MusicInfoOnline
interface ImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
}
interface PlaylistTabProps {
  onSharedTopBarVisibleChange?: (visible: boolean) => void
}
const isUserListInfo = (listInfo: LX.List.MyListInfo | null): listInfo is LX.List.UserListInfo => {
  return Boolean(listInfo && 'locationUpdateTime' in listInfo)
}
const getOnlinePlaylistDetailKey = (detail: OnlinePlaylistDetailPayload) => `online_songlist__${detail.source}__${detail.id}`

const SONG_DRAG_ROW_GAP = 10
const SONG_DRAG_ROW_FALLBACK_HEIGHT = 72
const SONG_DRAG_AUTO_SCROLL_EDGE = 96
const SONG_DRAG_AUTO_SCROLL_SPEED = 16
const SONG_DRAG_LAYOUT_ANIMATION_MAX_ITEMS = 240

const clampIndex = (value: number, max: number) => {
  if (max < 0) return 0
  if (value < 0) return 0
  if (value > max) return max
  return value
}
const moveArrayItem = <T,>(list: T[], from: number, to: number) => {
  if (from === to) return list
  const next = [...list]
  const [target] = next.splice(from, 1)
  next.splice(to, 0, target)
  return next
}

export default ({ onSharedTopBarVisibleChange }: PlaylistTabProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()

  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const gestureInsetBottom = useSystemGestureInsetBottom()
  const bottomDockHeight = BOTTOM_DOCK_BASE_HEIGHT + gestureInsetBottom
  const headerTopPadding = statusBarHeight + 18
  const headerHeight = headerTopPadding + 44 + 16
  const playlists = useMyList()
  const isPlay = useIsPlay()
  const detailSceneWidth = Dimensions.get('window').width
  const [playlistMetaMap, setPlaylistMetaMap] = useState<Record<string, { count: number, pic: string | null }>>(() => {
    const next: Record<string, { count: number, pic: string | null }> = {}
    for (const [id, value] of playlistSnapshotCache) {
      next[id] = {
        count: value.count,
        pic: value.pic,
      }
    }
    return next
  })
  const [selectedDetail, setSelectedDetail] = useState<PlaylistDetailPayload | null>(null)
  const [detailSongs, setDetailSongs] = useState<LX.Music.MusicInfo[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchSource, setSearchSource] = useState<SourceMenu['action']>('all')
  const [isSourceMenuVisible, setSourceMenuVisible] = useState(false)
  const [isSearchMode, setSearchMode] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [lovedSongMap, setLovedSongMap] = useState<Record<string, true>>({})
  const [isSearchInputEditing, setSearchInputEditing] = useState(false)
  const [searchHistoryList, setSearchHistoryList] = useState<string[]>([])
  const [searchTipList, setSearchTipList] = useState<string[]>([])
  const [searchTipLoading, setSearchTipLoading] = useState(false)
  const [isImportDrawerVisible, setImportDrawerVisible] = useState(false)
  const [, setImportLoading] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([])
  const [importSelectedMap, setImportSelectedMap] = useState<Record<string, true>>({})
  const [isDetailTransitioning, setDetailTransitioning] = useState(false)
  const linkedPlaylistId = useLinkedPlaylistId()
  const playlistSortMode = useSettingValue('list.playlistSortMode')
  const playlistCustomOrderStr = useSettingValue('list.playlistCustomOrder')
  const playlistCustomOrder: string[] = useMemo(() => {
    if (!playlistCustomOrderStr) return []
    try { return JSON.parse(playlistCustomOrderStr) as string[] } catch { return [] }
  }, [playlistCustomOrderStr])
  const [playlistDisplayMode, setPlaylistDisplayMode] = useState<'grid' | 'list'>('grid')
  const detailRequestIdRef = useRef(0)
  const importRequestIdRef = useRef(0)
  const searchRequestIdRef = useRef(0)
  const searchTipRequestIdRef = useRef(0)
  const searchInputRef = useRef<TextInput>(null)
  const sourceMenuVisibleRef = useRef(false)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const musicMultiAddModalRef = useRef<MusicMultiAddModalType>(null)
  const createListDialogRef = useRef<PromptDialogType>(null)
  const renameListDialogRef = useRef<PromptDialogType>(null)
  const removeListDialogRef = useRef<PromptDialogType>(null)
  const removeSongDialogRef = useRef<PromptDialogType>(null)
  const detailListRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const detailListWrapRef = useRef<View>(null)
  const detailSongsRef = useRef<LX.Music.MusicInfo[]>([])
  const songRowLayoutRef = useRef(new Map<string, number>())
  const detailListPageYRef = useRef(0)
  const detailListHeightRef = useRef(0)
  const detailListContentHeightRef = useRef(0)
  const detailScrollOffsetRef = useRef(0)
  const songShiftAnimMapRef = useRef(new Map<string, Animated.Value>())
  const songShiftTargetMapRef = useRef(new Map<string, number>())
  const dragPressGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextSongPressRef = useRef(false)
  const dragStateRef = useRef({
    active: false,
    listId: null as string | null,
    song: null as LX.Music.MusicInfo | null,
    songKey: null as string | null,
    fromIndex: -1,
    toIndex: -1,
    rowHeight: SONG_DRAG_ROW_FALLBACK_HEIGHT,
    rowStep: SONG_DRAG_ROW_FALLBACK_HEIGHT + SONG_DRAG_ROW_GAP,
    startVisualTop: 0,
    startScrollOffset: 0,
    pressOffsetY: 0,
  })
  const dragTop = useRef(new Animated.Value(0)).current
  const dragScale = useRef(new Animated.Value(1)).current
  const dragOpacity = useRef(new Animated.Value(0)).current
  const detailSceneAnim = useRef(new Animated.Value(0)).current
  const sourceMenuExpandAnim = useRef(new Animated.Value(0)).current
  const sourceMenuListAnim = useRef(new Animated.Value(0)).current
  const detailTransitionTokenRef = useRef(0)
  const [isSongDragActive, setSongDragActive] = useState(false)
  const [draggingSong, setDraggingSong] = useState<LX.Music.MusicInfo | null>(null)
  const [draggingSongKey, setDraggingSongKey] = useState<string | null>(null)
  const [pendingDeleteSong, setPendingDeleteSong] = useState<LX.Music.MusicInfo | null>(null)
  const [pendingPlaylistOrder, setPendingPlaylistOrder] = useState<string[] | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | number | null>(DEFAULT_USER_AVATAR)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [nickname, setNickname] = useState(DEFAULT_USER_NAME)
  const [signature, setSignature] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('unknown')
  const defaultSignature = t('me_profile_status')
  const genderBadgeText = gender === 'unknown' ? '?' : null
  const genderIconName = gender === 'male' ? 'gender-male' : gender === 'female' ? 'gender-female' : null
  const genderBadgeStyle = gender === 'male'
    ? styles.profileHeroBadgeMale
    : gender === 'female'
      ? styles.profileHeroBadgeFemale
      : styles.profileHeroBadgeUnknown
  const avatarDisplayUrl = useMemo(() => {
    if (!avatarUrl) return DEFAULT_USER_AVATAR
    if (typeof avatarUrl != 'string') return avatarUrl
    const normalizedAvatarUrl = avatarUrl.startsWith('file://') ? avatarUrl.replace(/^file:\/\//, '') : avatarUrl
    if (normalizedAvatarUrl.startsWith('/')) return `file://${normalizedAvatarUrl}?v=${avatarVersion}`
    return `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}`
  }, [avatarUrl, avatarVersion])
  const handleOpenProfileDetail = useCallback(() => {
    global.app_event.openSettingsProfileDetail()
    setNavActiveId('nav_setting')
  }, [])
  const selectedListId = selectedDetail?.type == 'local' ? selectedDetail.listId : null
  const selectedOnlineDetail = selectedDetail?.type == 'onlineSonglist' ? selectedDetail : null
  const selectedDetailCacheKey = selectedListId ?? (selectedOnlineDetail ? getOnlinePlaylistDetailKey(selectedOnlineDetail) : null)
  const setKeepPlayBarVisible = (visible: boolean) => {
    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', visible)
  }
  const lovePlaylist = useMemo(() => playlists.find(list => list.id === LIST_IDS.LOVE) ?? null, [playlists])
  const displayPlaylists = useMemo(() => {
    const userPlaylists = playlists.filter((list): list is LX.List.UserListInfo => list.id !== LIST_IDS.LOVE && list.id !== LIST_IDS.DEFAULT)
    if (playlistSortMode === 'custom') {
      const effectiveOrder = pendingPlaylistOrder ?? playlistCustomOrder
      const orderMap = new Map(effectiveOrder.map((id, i) => [id, i]))
      // Newly created playlists (not yet in custom order) go first so they are
      // immediately visible after 转存 / create, instead of buried at the end.
      const ordered: LX.List.UserListInfo[] = []
      const unordered: LX.List.UserListInfo[] = []
      for (const list of userPlaylists) {
        if (orderMap.has(list.id)) ordered.push(list)
        else unordered.push(list)
      }
      ordered.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
      return [...unordered, ...ordered]
    }
    return userPlaylists
      .map((list, index) => ({
        list,
        index,
        time: getPlaylistSortTime(list),
      }))
      .sort((a, b) => {
        const diff = playlistSortMode === 'default' ? (b.time - a.time) : (a.time - b.time)
        if (diff) return diff
        return a.index - b.index
      })
      .map(item => item.list)
  }, [playlists, playlistSortMode, playlistCustomOrder, pendingPlaylistOrder])
  // Clear pending order once the store catches up
  useEffect(() => {
    if (pendingPlaylistOrder && JSON.stringify(playlistCustomOrder) === JSON.stringify(pendingPlaylistOrder)) {
      setPendingPlaylistOrder(null)
    }
  }, [pendingPlaylistOrder, playlistCustomOrder])
  // Keep custom order in sync when new playlists are created outside drag/drop
  // (e.g. MusicAddModal / 一键转存 → CreateUserList).
  useEffect(() => {
    if (playlistSortMode !== 'custom') return
    if (!playlistCustomOrder.length) return
    const userIds = playlists
      .filter(list => list.id !== LIST_IDS.LOVE && list.id !== LIST_IDS.DEFAULT)
      .map(list => list.id)
    const missing = userIds.filter(id => !playlistCustomOrder.includes(id))
    if (!missing.length) return
    updateSetting({ 'list.playlistCustomOrder': JSON.stringify([...missing, ...playlistCustomOrder]) })
  }, [playlists, playlistSortMode, playlistCustomOrder])
  const {
    playlistScrollRef,
    playlistSectionRef,
    isPlaylistDragActive,
    draggingPlaylistId,
    playlistShiftAnimMap,
    dragControllerRef,
    handlePlaylistCardLayout,
    handlePlaylistSectionLayout,
    handlePlaylistScroll,
    handlePlaylistScrollBeginDrag,
    handlePlaylistScrollLayout,
    handlePlaylistContentSizeChange,
    handleActiveTouchMove,
    handleActiveTouchEnd,
    handleActiveTouchCancel,
    playlistPanHandlers,
  } = usePlaylistCardDrag({
    displayPlaylists,
    playlistDisplayMode,
    playlistSortMode,
    autoScrollTopInset: headerHeight,
    autoScrollBottomInset: bottomDockHeight,
    setPendingPlaylistOrder,
  })
  const featuredLibraryCards = useMemo(() => {
    return []
  }, [])
  const isPlaylistTimeSort = playlistSortMode == 'time'
  const isPlaylistCustomSort = playlistSortMode == 'custom'
  const playlistSortIcon = isPlaylistTimeSort ? 'sort-clock-ascending' : isPlaylistCustomSort ? 'tune' : 'sort-clock-descending'
  const isPlaylistListMode = playlistDisplayMode == 'list'
  const displaySwitchItems = useMemo<SegmentedIconSwitchItem[]>(() => [
    {
      key: 'grid',
      renderIcon: active => (
        <MaterialCommunityIcon
          name="view-grid"
          size={15}
          color={active ? colors.ink.list : colors.ink.displayIdle}
          style={[styles.displaySwitchIcon, styles.displaySwitchGridIcon]}
        />
      ),
    },
    {
      key: 'list',
      renderIcon: active => (
        <MaterialCommunityIcon
          name="view-list"
          size={15}
          color={active ? colors.ink.list : colors.ink.displayIdle}
          style={[styles.displaySwitchIcon, styles.displaySwitchListIcon]}
        />
      ),
    },
  ], [colors])
  const homeSceneParallax = detailSceneWidth * DETAIL_TRANSITION_HOME_PARALLAX
  const detailSceneTranslateX = useMemo(() => detailSceneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [detailSceneWidth, 0],
  }), [detailSceneAnim, detailSceneWidth])
  const homeSceneTranslateX = useMemo(() => detailSceneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -homeSceneParallax],
  }), [detailSceneAnim, homeSceneParallax])
  const detailSceneShadeOpacity = useMemo(() => detailSceneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.065],
  }), [detailSceneAnim])

  useEffect(() => {
    return () => {
      setKeepPlayBarVisible(false)
    }
  }, [])
  useEffect(() => {
    let isUnmounted = false
    void getUserAvatar().then((path) => {
      if (isUnmounted) return
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    })
    const handleAvatarUpdate = (path: string | null) => {
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    }
    const handleFocus = () => {
      void getUserAvatar().then((path) => {
        setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
        setAvatarVersion(version => version + 1)
      })
    }
    global.app_event.on('userAvatarUpdated', handleAvatarUpdate)
    global.app_event.on('focus', handleFocus)
    return () => {
      isUnmounted = true
      global.app_event.off('userAvatarUpdated', handleAvatarUpdate)
      global.app_event.off('focus', handleFocus)
    }
  }, [])
  useEffect(() => {
    let isUnmounted = false
    void getUserName().then((name) => {
      if (isUnmounted) return
      setNickname(name ?? DEFAULT_USER_NAME)
    })
    const handleNameUpdate = (name: string) => {
      setNickname(name.trim() ? name : DEFAULT_USER_NAME)
    }
    global.app_event.on('userNameUpdated', handleNameUpdate)
    return () => {
      isUnmounted = true
      global.app_event.off('userNameUpdated', handleNameUpdate)
    }
  }, [])
  useEffect(() => {
    let isUnmounted = false
    void getUserSignature().then((value) => {
      if (isUnmounted) return
      setSignature(value?.trim() ?? '')
    })
    const handleSignatureUpdate = (value: string) => {
      setSignature(value.trim())
    }
    global.app_event.on('userSignatureUpdated', handleSignatureUpdate)
    return () => {
      isUnmounted = true
      global.app_event.off('userSignatureUpdated', handleSignatureUpdate)
    }
  }, [])
  useEffect(() => {
    let isUnmounted = false
    void getUserGender().then((value) => {
      if (isUnmounted) return
      setGender(value ?? 'unknown')
    })
    const handleGenderUpdate = (value: 'male' | 'female' | 'unknown') => {
      setGender(value)
    }
    global.app_event.on('userGenderUpdated', handleGenderUpdate)
    return () => {
      isUnmounted = true
      global.app_event.off('userGenderUpdated', handleGenderUpdate)
    }
  }, [])
  useEffect(() => {
    onSharedTopBarVisibleChange?.(!isSearchMode)
    return () => {
      onSharedTopBarVisibleChange?.(true)
    }
  }, [isSearchMode, onSharedTopBarVisibleChange])
  useEffect(() => {
    detailSongsRef.current = detailSongs
  }, [detailSongs])
  useEffect(() => {
    if (Platform.OS != 'android') return
    if (!UIManager.setLayoutAnimationEnabledExperimental) return
    UIManager.setLayoutAnimationEnabledExperimental(true)
  }, [])
  useEffect(() => {
    return () => {
      if (!dragPressGuardTimerRef.current) return
      clearTimeout(dragPressGuardTimerRef.current)
      dragPressGuardTimerRef.current = null
    }
  }, [])

  const pickCover = (list: LX.Music.MusicInfo[]) => {
    for (const song of list) {
      const cover = pickMusicCover(song)
      if (cover) return cover
    }
    return null
  }
  const cachePlaylistSnapshot = useCallback((id: string, list: LX.Music.MusicInfo[], picOverride?: string | null) => {
    const songs = [...list]
    const pic = picOverride ?? pickCover(songs)
    playlistSnapshotCache.set(id, {
      songs,
      count: songs.length,
      pic,
    })
    return {
      count: songs.length,
      pic,
    }
  }, [])

  const updatePlaylistMeta = useCallback(async(ids: string[]) => {
    if (!ids.length) return
    const result = await Promise.all(ids.map(async(id) => {
      const list = await getListMusics(id)
      const cached = cachePlaylistSnapshot(id, list)
      return {
        id,
        count: cached.count,
        pic: cached.pic,
      }
    }))
    setPlaylistMetaMap((prev) => {
      const next = { ...prev }
      for (const item of result) {
        next[item.id] = {
          count: item.count,
          pic: item.pic,
        }
      }
      return next
    })
  }, [cachePlaylistSnapshot])

  const loadLocalDetailSongs = useCallback(async(id: string, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    const list = await getListMusics(id)
    if (requestId !== detailRequestIdRef.current) return
    const cached = cachePlaylistSnapshot(id, list)
    setPlaylistMetaMap((prev) => ({
      ...prev,
      [id]: cached,
    }))
    setDetailSongs([...list])
    if (showLoading) setDetailLoading(false)
  }, [cachePlaylistSnapshot])
  const animateDetailScene = useCallback((toValue: 0 | 1, onFinish?: () => void) => {
    const token = ++detailTransitionTokenRef.current
    setDetailTransitioning(true)
    detailSceneAnim.stopAnimation()
    const animation = Animated.timing(detailSceneAnim, {
      toValue,
      duration: toValue ? DETAIL_TRANSITION_FORWARD_DURATION : DETAIL_TRANSITION_BACKWARD_DURATION,
      easing: toValue
        ? Easing.bezier(0.36, 0.66, 0.04, 1)
        : Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (token !== detailTransitionTokenRef.current) return
      if (finished) onFinish?.()
      setDetailTransitioning(false)
    })
  }, [detailSceneAnim])
  const clearDetailSelection = useCallback((immediate = false) => {
    if (!selectedDetail && !isDetailTransitioning) return
    detailRequestIdRef.current += 1
    const finish = () => {
      detailScrollOffsetRef.current = 0
      setSelectedDetail(null)
      setDetailSongs([])
      setDetailLoading(false)
    }
    if (immediate) {
      detailTransitionTokenRef.current += 1
      detailSceneAnim.stopAnimation()
      detailSceneAnim.setValue(0)
      setDetailTransitioning(false)
      finish()
      return
    }
    animateDetailScene(0, finish)
  }, [animateDetailScene, detailSceneAnim, isDetailTransitioning, selectedDetail])

  const refreshLovedSongMap = useCallback(async() => {
    const list = await getListMusics(LIST_IDS.LOVE)
    const next: Record<string, true> = {}
    for (const song of list) {
      next[String(song.id)] = true
    }
    setLovedSongMap(next)
  }, [])

  useEffect(() => {
    void updatePlaylistMeta(playlists.map(list => list.id))
    if (selectedListId && !playlists.some(list => list.id === selectedListId)) {
      clearDetailSelection(true)
    }
  }, [clearDetailSelection, playlists, selectedListId, updatePlaylistMeta])

  useEffect(() => {
    void refreshLovedSongMap()
  }, [refreshLovedSongMap])

  useEffect(() => {
    const handleMusicUpdate = (ids: string[]) => {
      void updatePlaylistMeta(ids)
      if (ids.includes(LIST_IDS.LOVE)) void refreshLovedSongMap()
      if (selectedListId && ids.includes(selectedListId)) {
        void loadLocalDetailSongs(selectedListId)
      }
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [loadLocalDetailSongs, refreshLovedSongMap, selectedListId, updatePlaylistMeta])
  useEffect(() => {
    const handleVerticalSearchStateUpdated = (payload: { keyword: string, source: SourceMenu['action'] }) => {
      setSearchText(payload.keyword)
      setSearchSource(payload.source)
    }
    global.app_event.on('verticalSearchStateUpdated', handleVerticalSearchStateUpdated)
    return () => {
      global.app_event.off('verticalSearchStateUpdated', handleVerticalSearchStateUpdated)
    }
  }, [])
  const songRowKeyStoreRef = useRef(createSongRowKeyStore())
  const getSongRowKey = useCallback((song: LX.Music.MusicInfo, fallbackIndex = 0) => {
    return stableSongRowKey(song, fallbackIndex, detailSongsRef.current, songRowKeyStoreRef.current)
  }, [])
  const measureDetailListWrap = useCallback(() => {
    detailListWrapRef.current?.measureInWindow((_, y, _width, height) => {
      detailListPageYRef.current = y
      if (height > 0) detailListHeightRef.current = height
    })
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const handleDetailWrapLayout = useCallback((event: LayoutChangeEvent) => {
    detailListHeightRef.current = event.nativeEvent.layout.height
    requestAnimationFrame(() => {
      measureDetailListWrap()
    })
  }, [measureDetailListWrap])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const handleDetailListScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (!dragStateRef.current.active && draggingSong) {
      setDraggingSong(null)
      setDraggingSongKey(null)
      if (dragPressGuardTimerRef.current) {
        clearTimeout(dragPressGuardTimerRef.current)
        dragPressGuardTimerRef.current = null
      }
      skipNextSongPressRef.current = false
    }
    detailScrollOffsetRef.current = event.nativeEvent.contentOffset.y
  }, [draggingSong])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const handleDetailListContentSizeChange = useCallback((_width: number, height: number) => {
    detailListContentHeightRef.current = height
  }, [])
  const clearDragPressGuard = useCallback((delay = 0) => {
    if (dragPressGuardTimerRef.current) {
      clearTimeout(dragPressGuardTimerRef.current)
      dragPressGuardTimerRef.current = null
    }
    if (delay <= 0) {
      skipNextSongPressRef.current = false
      return
    }
    dragPressGuardTimerRef.current = setTimeout(() => {
      skipNextSongPressRef.current = false
      dragPressGuardTimerRef.current = null
    }, delay)
  }, [])
  const getSongShiftAnim = useCallback((songKey: string) => {
    const current = songShiftAnimMapRef.current.get(songKey)
    if (current) return current
    const next = new Animated.Value(0)
    songShiftAnimMapRef.current.set(songKey, next)
    return next
  }, [])
  const setSongShiftTarget = useCallback((songKey: string, value: number, immediate = false) => {
    const prevTarget = songShiftTargetMapRef.current.get(songKey) ?? 0
    if (prevTarget == value) return
    songShiftTargetMapRef.current.set(songKey, value)
    const anim = getSongShiftAnim(songKey)
    if (immediate) {
      anim.stopAnimation()
      anim.setValue(value)
      return
    }
    Animated.spring(anim, {
      toValue: value,
      useNativeDriver: true,
      speed: 22,
      bounciness: 8,
    }).start()
  }, [getSongShiftAnim])
  const getDragShiftForIndex = useCallback((index: number, sourceIndex: number, targetIndex: number, rowOffset: number) => {
    if (targetIndex > sourceIndex && index > sourceIndex && index <= targetIndex) return -rowOffset
    if (targetIndex < sourceIndex && index >= targetIndex && index < sourceIndex) return rowOffset
    return 0
  }, [])
  const updateDragRowShifts = useCallback((sourceIndex: number, previousTarget: number, nextTarget: number, rowOffset: number) => {
    if (sourceIndex < 0) return
    const maxIndex = detailSongsRef.current.length - 1
    if (maxIndex < 0) return
    const rangeFrom = Math.max(0, Math.min(sourceIndex, previousTarget, nextTarget))
    const rangeTo = Math.min(maxIndex, Math.max(sourceIndex, previousTarget, nextTarget))
    for (let i = rangeFrom; i <= rangeTo; i++) {
      const song = detailSongsRef.current[i]
      if (!song) continue
      const key = getSongRowKey(song, i)
      const shift = getDragShiftForIndex(i, sourceIndex, nextTarget, rowOffset)
      setSongShiftTarget(key, shift)
    }
  }, [getDragShiftForIndex, getSongRowKey, setSongShiftTarget])
  const resetDragRowShifts = useCallback((immediate = false) => {
    for (const [key, value] of songShiftTargetMapRef.current) {
      if (!value) continue
      setSongShiftTarget(key, 0, immediate)
    }
  }, [setSongShiftTarget])
  const resetSongDragState = useCallback(() => {
    resetDragRowShifts(true)
    dragStateRef.current.active = false
    setSongDragActive(false)
    dragStateRef.current.song = null
    dragStateRef.current.songKey = null
    dragStateRef.current.listId = null
    dragStateRef.current.fromIndex = -1
    dragStateRef.current.toIndex = -1
    dragStateRef.current.startVisualTop = 0
    dragStateRef.current.startScrollOffset = 0
    dragTop.stopAnimation()
    dragScale.stopAnimation()
    dragOpacity.stopAnimation()
    dragTop.setValue(0)
    dragScale.setValue(1)
    dragOpacity.setValue(0)
    setDraggingSong(null)
    setDraggingSongKey(null)
    clearDragPressGuard()
  }, [clearDragPressGuard, dragOpacity, dragScale, dragTop, resetDragRowShifts])
  const handleCloseDetail = useCallback((immediate = false) => {
    resetSongDragState()
    clearDetailSelection(immediate)
  }, [clearDetailSelection, resetSongDragState])
  const handleFinishSongDrag = useCallback(async() => {
    if (!dragStateRef.current.active) return
    const { listId, song, fromIndex, toIndex } = dragStateRef.current
    dragStateRef.current.active = false
    setSongDragActive(false)
    resetDragRowShifts(true)
    if (fromIndex != toIndex && detailSongsRef.current.length <= SONG_DRAG_LAYOUT_ANIMATION_MAX_ITEMS) {
      LayoutAnimation.configureNext({
        duration: 120,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      })
    }
    if (fromIndex != toIndex) {
      setDetailSongs((prev) => moveArrayItem(prev, fromIndex, toIndex))
    }
    Animated.parallel([
      Animated.spring(dragScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }),
      Animated.timing(dragOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDraggingSong(null)
      setDraggingSongKey(null)
      clearDragPressGuard(120)
    })
    if (!listId || !song || fromIndex == toIndex) return
    try {
      await updateListMusicPosition(listId, toIndex, [song.id])
      await updatePlaylistMeta([listId])
    } catch {
      await loadLocalDetailSongs(listId)
    }
  }, [clearDragPressGuard, dragOpacity, dragScale, loadLocalDetailSongs, resetDragRowShifts, updatePlaylistMeta])
  const handleStartSongDrag = useCallback((item: LX.Music.MusicInfo, index: number, event: GestureResponderEvent) => {
    if (!selectedListId || detailSongsRef.current.length < 2) return
    if (dragStateRef.current.active) return
    resetDragRowShifts(true)
    skipNextSongPressRef.current = true
    const songKey = getSongRowKey(item, index)
    const rowHeight = songRowLayoutRef.current.get(songKey) ?? SONG_DRAG_ROW_FALLBACK_HEIGHT
    const rowStep = rowHeight + SONG_DRAG_ROW_GAP
    const pressOffsetY = event.nativeEvent.locationY
    const visualTop = event.nativeEvent.pageY - detailListPageYRef.current - pressOffsetY
    const startScrollOffset = detailScrollOffsetRef.current
    dragStateRef.current.active = true
    dragStateRef.current.listId = selectedListId
    dragStateRef.current.song = item
    dragStateRef.current.songKey = songKey
    dragStateRef.current.fromIndex = index
    dragStateRef.current.toIndex = index
    dragStateRef.current.rowHeight = rowHeight
    dragStateRef.current.rowStep = rowStep
    dragStateRef.current.startVisualTop = visualTop
    dragStateRef.current.startScrollOffset = startScrollOffset
    dragStateRef.current.pressOffsetY = pressOffsetY
    setSongDragActive(true)
    setDraggingSong(item)
    setDraggingSongKey(songKey)
    dragScale.setValue(1)
    dragOpacity.setValue(0)
    dragTop.setValue(visualTop)
    Animated.parallel([
      Animated.spring(dragScale, {
        toValue: 1.06,
        useNativeDriver: true,
        speed: 16,
        bounciness: 8,
      }),
      Animated.timing(dragOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start()
  }, [dragOpacity, dragScale, dragTop, getSongRowKey, resetDragRowShifts, selectedListId])
  const handleShowRemoveSongModal = useCallback((song: LX.Music.MusicInfo) => {
    if (!selectedListId || dragStateRef.current.active) return
    setPendingDeleteSong(song)
    removeSongDialogRef.current?.show('')
  }, [selectedListId])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const handleCancelRemoveSong = useCallback(() => {
    setPendingDeleteSong(null)
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const handleConfirmRemoveSong = useCallback(async() => {
    if (!selectedListId || !pendingDeleteSong || dragStateRef.current.active) {
      setPendingDeleteSong(null)
      return true
    }
    try {
      await removeListMusics(selectedListId, [pendingDeleteSong.id])
      await Promise.all([
        loadLocalDetailSongs(selectedListId),
        updatePlaylistMeta([selectedListId]),
      ])
    } catch {
      await loadLocalDetailSongs(selectedListId)
    }
    setPendingDeleteSong(null)
    return true
  }, [loadLocalDetailSongs, pendingDeleteSong, selectedListId, updatePlaylistMeta])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const detailListPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => dragStateRef.current.active,
    onMoveShouldSetPanResponder: () => dragStateRef.current.active,
    onStartShouldSetPanResponderCapture: () => dragStateRef.current.active,
    onMoveShouldSetPanResponderCapture: () => dragStateRef.current.active,
    onPanResponderMove: (_event, gestureState) => {
      if (!dragStateRef.current.active) return
      const visibleTop = gestureState.moveY - detailListPageYRef.current - dragStateRef.current.pressOffsetY
      dragTop.setValue(visibleTop)
      const pointerY = gestureState.moveY - detailListPageYRef.current
      const maxScrollOffset = Math.max(0, detailListContentHeightRef.current - detailListHeightRef.current)
      if (pointerY < SONG_DRAG_AUTO_SCROLL_EDGE) {
        const nextOffset = Math.max(0, detailScrollOffsetRef.current - SONG_DRAG_AUTO_SCROLL_SPEED)
        if (nextOffset != detailScrollOffsetRef.current) {
          detailScrollOffsetRef.current = nextOffset
          detailListRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
        }
      } else if (pointerY > detailListHeightRef.current - SONG_DRAG_AUTO_SCROLL_EDGE) {
        const nextOffset = Math.min(maxScrollOffset, detailScrollOffsetRef.current + SONG_DRAG_AUTO_SCROLL_SPEED)
        if (nextOffset != detailScrollOffsetRef.current) {
          detailScrollOffsetRef.current = nextOffset
          detailListRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
        }
      }
      const contentDelta =
        (visibleTop - dragStateRef.current.startVisualTop) +
        (detailScrollOffsetRef.current - dragStateRef.current.startScrollOffset)
      const roughIndex = dragStateRef.current.fromIndex + Math.round(contentDelta / dragStateRef.current.rowStep)
      const targetIndex = clampIndex(roughIndex, Math.max(detailSongsRef.current.length - 1, 0))
      if (targetIndex == dragStateRef.current.toIndex) return
      const prevTarget = dragStateRef.current.toIndex
      dragStateRef.current.toIndex = targetIndex
      updateDragRowShifts(dragStateRef.current.fromIndex, prevTarget, targetIndex, dragStateRef.current.rowStep)
    },
    onPanResponderRelease: () => {
      void handleFinishSongDrag()
    },
    onPanResponderTerminate: () => {
      void handleFinishSongDrag()
    },
  }), [dragTop, handleFinishSongDrag, updateDragRowShifts])
  const handleSongRowLayout = useCallback((song: LX.Music.MusicInfo, index: number, event: LayoutChangeEvent) => {
    const key = getSongRowKey(song, index)
    songRowLayoutRef.current.set(key, event.nativeEvent.layout.height)
  }, [getSongRowKey])
  useEffect(() => {
    measureDetailListWrap()
  }, [measureDetailListWrap, selectedDetailCacheKey])
  useEffect(() => {
    if (selectedDetailCacheKey) return
    setPendingDeleteSong(null)
    resetSongDragState()
  }, [resetSongDragState, selectedDetailCacheKey])
  useEffect(() => {
    if (isSongDragActive || !draggingSong) return
    const timer = setTimeout(() => {
      if (dragStateRef.current.active) return
      setDraggingSong(null)
      setDraggingSongKey(null)
      clearDragPressGuard()
    }, 240)
    return () => {
      clearTimeout(timer)
    }
  }, [clearDragPressGuard, draggingSong, isSongDragActive])

  const handleOpenList = useCallback((list: LX.List.MyListInfo) => {
    resetSongDragState()
    global.app_event.openPlaylistDetail({ type: 'local', listId: list.id })
  }, [resetSongDragState])

  const handlePlaySong = useCallback(async(listId: string, song: LX.Music.MusicInfo, fallbackIndex: number) => {
    setActiveList(listId)
    const latestList = await getListMusics(listId)
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await playListAsQueue(listId, targetIndex)
  }, [])
  const handlePlayOnlineDetailSong = useCallback(async(song: LX.Music.MusicInfo, fallbackIndex: number) => {
    if (!selectedOnlineDetail) return
    const fallbackCover = selectedOnlineDetail.img ?? null
    let latestList = applyMusicCoverFallback(detailSongsRef.current, fallbackCover)
    if (!latestList.length) {
      latestList = applyMusicCoverFallback(
        await getListDetailAll(selectedOnlineDetail.source, selectedOnlineDetail.id),
        fallbackCover,
      )
    }
    if (!latestList.length) return
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await setTempList(getOnlinePlaylistDetailKey(selectedOnlineDetail), latestList)
    await playList(LIST_IDS.TEMP, targetIndex)
  }, [selectedOnlineDetail])
  const handlePlaySearchSong = useCallback(async(song: LX.Music.MusicInfoOnline) => {
    await addMusicToQueueAndPlay(song)
  }, [])
  const handleToggleSearchLoved = useCallback(async(song: LX.Music.MusicInfoOnline) => {
    const songId = String(song.id)
    const isLoved = Boolean(lovedSongMap[songId])
    setLovedSongMap((prev) => {
      const next = { ...prev }
      if (isLoved) delete next[songId]
      else next[songId] = true
      return next
    })
    try {
      if (isLoved) await removeListMusics(LIST_IDS.LOVE, [songId])
      else await addListMusics(LIST_IDS.LOVE, [song], settingState.setting['list.addMusicLocationType'])
    } catch {
      setLovedSongMap((prev) => {
        const next = { ...prev }
        if (isLoved) next[songId] = true
        else delete next[songId]
        return next
      })
    }
  }, [lovedSongMap])
  const handleShowMusicAddModal = useCallback((song: LX.Music.MusicInfoOnline) => {
    musicAddModalRef.current?.show({
      musicInfo: song,
      listId: '',
      isMove: false,
    })
  }, [])
  const handleShowCreateListModal = useCallback(() => {
    createListDialogRef.current?.show('')
  }, [])
  const isPlaylistCurrent = useCallback((listId: string | null | undefined) => {
    if (!listId || !linkedPlaylistId) return false
    return linkedPlaylistId === listId
  }, [linkedPlaylistId])
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
  const handleTogglePlaylistSort = useCallback(() => {
    const nextMode = playlistSortMode == 'default' ? 'time' : playlistSortMode == 'time' ? 'custom' : 'default'
    updateSetting({ 'list.playlistSortMode': nextMode })
  }, [playlistSortMode])
  const handleCreateList = useCallback(async(name: string) => {
    if (!name) return false
    const isDuplicated = listState.userList.some(list => list.name == name)
    if (isDuplicated) {
      const shouldContinue = await confirmDialog({
        message: t('list_duplicate_tip'),
      })
      if (!shouldContinue) return false
    }
    await createList({ name })
    return true
  }, [t])
  const selectedListInfo = selectedListId ? playlists.find(list => list.id === selectedListId) ?? null : null
  const selectedDetailSnapshot = selectedDetailCacheKey ? playlistSnapshotCache.get(selectedDetailCacheKey) ?? null : null
  const canRenameSelectedList = isUserListInfo(selectedListInfo)
  const handleShowRenameListModal = useCallback(() => {
    if (!isUserListInfo(selectedListInfo)) return
    renameListDialogRef.current?.show(selectedListInfo.name)
  }, [selectedListInfo])
  const handleShowRemoveListModal = useCallback(() => {
    if (!isUserListInfo(selectedListInfo)) return
    removeListDialogRef.current?.show('')
  }, [selectedListInfo])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const handleRenameList = useCallback(async(name: string) => {
    if (!isUserListInfo(selectedListInfo)) return false
    const targetName = name.trim().substring(0, 100)
    if (!targetName.length) return false
    if (targetName == selectedListInfo.name) return true
    await updateUserList([{
      id: selectedListInfo.id,
      name: targetName,
      source: selectedListInfo.source,
      sourceListId: selectedListInfo.sourceListId,
      locationUpdateTime: selectedListInfo.locationUpdateTime,
    }])
    return true
  }, [selectedListInfo])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until detail handlers are fully retired
  const handleRemoveSelectedList = useCallback(async() => {
    if (!isUserListInfo(selectedListInfo)) return false
    await removeUserList([selectedListInfo.id])
    handleCloseDetail(true)
    return true
  }, [handleCloseDetail, selectedListInfo])
  const selectedListMeta = selectedListInfo ? playlistMetaMap[selectedListInfo.id] : null
  const detailHeroName = selectedOnlineDetail?.name ?? selectedListInfo?.name ?? ''
  const detailHeroCover = selectedOnlineDetail?.img ?? selectedListMeta?.pic ?? selectedDetailSnapshot?.pic ?? null
  const detailSongCount = selectedOnlineDetail
    ? selectedDetailSnapshot?.count ?? detailSongs.length
    : selectedListMeta?.count ?? selectedDetailSnapshot?.count ?? detailSongs.length
  const detailHeroMetaText = selectedOnlineDetail
    ? [selectedOnlineDetail.author?.trim(), detailLoading && !detailSongCount ? t('me_loading_songs') : t('me_songs_count', { num: detailSongCount })]
        .filter(Boolean)
        .join(' / ')
    : t('me_songs_count', { num: detailSongCount })
  const detailHeroSourceTone = selectedOnlineDetail ? getSourceTagColor(selectedOnlineDetail.source, colors) : null
  const detailHeroSourceLabel = selectedOnlineDetail ? t(`source_real_${selectedOnlineDetail.source}`) : ''
  const handleShowPlaylistTransferModal = useCallback(() => {
    if (!selectedOnlineDetail || detailLoading || !detailSongs.length) return
    const transferSongs = applyMusicCoverFallback(detailSongs, detailHeroCover)
    musicMultiAddModalRef.current?.show({
      selectedList: [...transferSongs],
      listId: '',
      isMove: false,
      defaultNewListName: detailHeroName,
    })
  }, [detailHeroCover, detailHeroName, detailLoading, detailSongs, selectedOnlineDetail])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until import drawer UI is rewired
  const importSelectedCount = useMemo(() => Object.keys(importSelectedMap).length, [importSelectedMap])
  const areAllImportSongsSelected = useMemo(() => {
    return importCandidates.length > 0 && importCandidates.every(candidate => importSelectedMap[candidate.id])
  }, [importCandidates, importSelectedMap])
  const loadImportCandidates = useCallback(async(targetListId: string) => {
    const requestId = ++importRequestIdRef.current
    setImportLoading(true)
    try {
      const currentSongs = await getListMusics(targetListId)
      const existingSongIds = new Set(currentSongs.map(song => `${song.source}_${song.id}`))
      const otherLists = playlists.filter(list => list.id !== targetListId && list.id !== LIST_IDS.DEFAULT)
      const listSongs = await Promise.all(otherLists.map(async(list) => {
        const songs = await getListMusics(list.id)
        return { listName: list.name, songs }
      }))
      const dedupeMap = new Set<string>()
      const candidates: ImportCandidate[] = []
      for (const { listName, songs } of listSongs) {
        for (const song of songs) {
          const songKey = `${song.source}_${song.id}`
          if (existingSongIds.has(songKey) || dedupeMap.has(songKey)) continue
          dedupeMap.add(songKey)
          candidates.push({
            id: songKey,
            musicInfo: song,
            fromListName: listName,
          })
        }
      }
      if (requestId !== importRequestIdRef.current) return
      setImportCandidates(candidates)
    } finally {
      if (requestId === importRequestIdRef.current) setImportLoading(false)
    }
  }, [playlists])
  const handleOpenImportDrawer = useCallback(() => {
    if (!selectedListId) return
    setImportDrawerVisible(true)
    setImportCandidates([])
    setImportSelectedMap({})
    void loadImportCandidates(selectedListId)
  }, [loadImportCandidates, selectedListId])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until import drawer UI is rewired
  const handleCloseImportDrawer = useCallback(() => {
    if (importSubmitting) return
    setImportDrawerVisible(false)
  }, [importSubmitting])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until import drawer UI is rewired
  const handleToggleImportSong = useCallback((songId: string) => {
    setImportSelectedMap((prev) => {
      const next = { ...prev }
      if (next[songId]) delete next[songId]
      else next[songId] = true
      return next
    })
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until import drawer UI is rewired
  const handleToggleSelectAllImportSongs = useCallback(() => {
    if (!importCandidates.length) return
    setImportSelectedMap(() => {
      if (areAllImportSongsSelected) return {}
      const next: Record<string, true> = {}
      for (const candidate of importCandidates) next[candidate.id] = true
      return next
    })
  }, [areAllImportSongsSelected, importCandidates])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until import drawer UI is rewired
  const handleImportSelectedSongs = useCallback(async() => {
    if (!selectedListId || importSubmitting) return
    const selectedSongs = importCandidates
      .filter(candidate => importSelectedMap[candidate.id])
      .map(candidate => candidate.musicInfo)
    if (!selectedSongs.length) return
    setImportSubmitting(true)
    try {
      await addListMusics(selectedListId, selectedSongs, settingState.setting['list.addMusicLocationType'])
      setImportDrawerVisible(false)
      setImportSelectedMap({})
      setImportCandidates([])
      void loadLocalDetailSongs(selectedListId)
      void updatePlaylistMeta([selectedListId])
    } finally {
      setImportSubmitting(false)
    }
  }, [importCandidates, importSelectedMap, importSubmitting, loadLocalDetailSongs, selectedListId, updatePlaylistMeta])
  useEffect(() => {
    importRequestIdRef.current += 1
    setImportDrawerVisible(false)
    setImportLoading(false)
    setImportSubmitting(false)
    setImportCandidates([])
    setImportSelectedMap({})
  }, [selectedListId])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until list render is rewired
  const renderSongItem: ListRenderItem<LX.Music.MusicInfo> = useCallback(({ item, index }) => {
    if (!selectedDetail) return null
    const songKey = getSongRowKey(item, index)
    const isDraggingRow = draggingSongKey == songKey && dragStateRef.current.active
    const shiftAnim = getSongShiftAnim(songKey)
    const sourceTagColor = getSourceTagColor(item.source, colors)
    const canEditSongs = Boolean(selectedListId)
    return (
      <PlaylistDetailSongItem
        song={item}
        sourceTone={sourceTagColor}
        shiftAnim={shiftAnim}
        fallbackCover={detailHeroCover}
        listId={selectedListId}
        isGhost={isDraggingRow}
        canEdit={canEditSongs}
        onLayout={(event) => { handleSongRowLayout(item, index, event) }}
        onLongPress={canEditSongs ? (event: GestureResponderEvent) => { handleStartSongDrag(item, index, event) } : undefined}
        onPress={() => {
          if (skipNextSongPressRef.current) {
            if (dragStateRef.current.active) {
              void handleFinishSongDrag()
            } else {
              clearDragPressGuard()
            }
            return
          }
          if (selectedListId) {
            void handlePlaySong(selectedListId, item, index)
            return
          }
          void handlePlayOnlineDetailSong(item, index)
        }}
        onRemove={canEditSongs ? () => { handleShowRemoveSongModal(item) } : undefined}
      />
    )
  }, [clearDragPressGuard, detailHeroCover, draggingSongKey, getSongRowKey, getSongShiftAnim, handleFinishSongDrag, handlePlayOnlineDetailSong, handlePlaySong, handleShowRemoveSongModal, handleSongRowLayout, handleStartSongDrag, selectedDetail, selectedListId, colors])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover after PlaylistDetailView extraction; keep until header is rewired
  const detailHeader = useMemo(() => {
    if (!selectedOnlineDetail && !selectedListInfo) return null
    const detailActionLabel = selectedOnlineDetail
      ? t('playlist_transfer_all')
      : selectedListId
        ? t('list_import')
        : null
    const detailActionDisabled = selectedOnlineDetail
      ? detailLoading || !detailSongs.length
      : false
    return (
      <PlaylistDetailHeader
        statusBarHeight={statusBarHeight}
        cover={detailHeroCover}
        name={detailHeroName}
        metaText={detailHeroMetaText}
        sectionTitle={t('me_songs')}
        sourceCode={selectedOnlineDetail?.source}
        sourceLabel={detailHeroSourceLabel}
        sourceTone={detailHeroSourceTone}
        canRename={canRenameSelectedList}
        actionLabel={detailActionLabel}
        actionDisabled={detailActionDisabled}
        onBack={handleCloseDetail}
        onRename={handleShowRenameListModal}
        onRemove={handleShowRemoveListModal}
        onActionPress={selectedOnlineDetail ? handleShowPlaylistTransferModal : handleOpenImportDrawer}
      />
    )
  }, [canRenameSelectedList, detailHeroCover, detailHeroMetaText, detailHeroName, detailHeroSourceLabel, detailHeroSourceTone, detailLoading, detailSongs.length, handleCloseDetail, handleOpenImportDrawer, handleShowPlaylistTransferModal, handleShowRemoveListModal, handleShowRenameListModal, selectedListId, selectedListInfo, selectedOnlineDetail, statusBarHeight, t])

  const openSourceMenu = useCallback(() => {
    sourceMenuVisibleRef.current = true
    setSourceMenuVisible(true)
    sourceMenuExpandAnim.stopAnimation()
    sourceMenuListAnim.stopAnimation()
    sourceMenuExpandAnim.setValue(0)
    sourceMenuListAnim.setValue(0)
    Animated.sequence([
      Animated.timing(sourceMenuExpandAnim, {
        toValue: 1,
        duration: SOURCE_MENU_EXPAND_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(SOURCE_MENU_REVEAL_DELAY),
      Animated.timing(sourceMenuListAnim, {
        toValue: 1,
        duration: SOURCE_MENU_REVEAL_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start()
  }, [sourceMenuExpandAnim, sourceMenuListAnim])
  const closeSourceMenu = useCallback(() => {
    if (!sourceMenuVisibleRef.current) return
    sourceMenuVisibleRef.current = false
    sourceMenuExpandAnim.stopAnimation()
    sourceMenuListAnim.stopAnimation()
    Animated.sequence([
      Animated.timing(sourceMenuListAnim, {
        toValue: 0,
        duration: 110,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(sourceMenuExpandAnim, {
        toValue: 0,
        duration: 128,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished && !sourceMenuVisibleRef.current) setSourceMenuVisible(false)
    })
  }, [sourceMenuExpandAnim, sourceMenuListAnim])
  const toggleSourceMenu = useCallback(() => {
    if (sourceMenuVisibleRef.current) {
      closeSourceMenu()
      return
    }
    openSourceMenu()
  }, [closeSourceMenu, openSourceMenu])
  const handleToggleSearchSourceMenu = useCallback(() => {
    toggleSourceMenu()
  }, [toggleSourceMenu])
  const searchSourceLabel = useMemo(() => getSourceMenuLabel(searchSource), [searchSource])
  const sourceChevronRotate = useMemo(() => sourceMenuExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '-90deg'],
  }), [sourceMenuExpandAnim])
  const sourceMenuBackdropOpacity = useMemo(() => sourceMenuListAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  }), [sourceMenuListAnim])
  const sourceMenuWidth = useMemo(() => sourceMenuExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [58, SOURCE_MENU_PANEL_WIDTH],
  }), [sourceMenuExpandAnim])
  const sourceMenuHeight = useMemo(() => sourceMenuListAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      26,
      26 + sourceMenus.length * SOURCE_MENU_ROW_HEIGHT,
    ],
  }), [sourceMenuListAnim])
  const sourceMenuRadius = useMemo(() => sourceMenuExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [9, 14],
  }), [sourceMenuExpandAnim])
  const sourceMenuListOpacity = useMemo(() => sourceMenuListAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  }), [sourceMenuListAnim])
  const sourceMenuListTranslateY = useMemo(() => sourceMenuListAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  }), [sourceMenuListAnim])
  const forceDismissSearchInput = useCallback(() => {
    searchInputRef.current?.blur()
    Keyboard.dismiss()
  }, [])
  const loadSearchHistoryList = useCallback(() => {
    void getSearchHistory().then((list) => {
      setSearchHistoryList(list)
    })
  }, [])
  const requestSearchTips = useMemo(() => debounce((keyword: string, source: SourceMenu['action']) => {
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) return
    const requestId = ++searchTipRequestIdRef.current
    setSearchTipLoading(true)

    const sourceSdk = (musicSdk as Record<string, { tipSearch?: { search?: (text: string) => Promise<string[]> } } | undefined>)[source]
    const kwSdk = (musicSdk as Record<string, { tipSearch?: { search?: (text: string) => Promise<string[]> } | undefined }>).kw
    const tipSearchApi = source != 'all' && sourceSdk?.tipSearch?.search ? sourceSdk.tipSearch : kwSdk?.tipSearch

    if (!tipSearchApi?.search) {
      if (requestId !== searchTipRequestIdRef.current) return
      setSearchTipList([])
      setSearchTipLoading(false)
      return
    }

    void tipSearchApi.search(normalizedKeyword).then((list) => {
      if (requestId !== searchTipRequestIdRef.current) return
      if (!Array.isArray(list)) {
        setSearchTipList([])
        return
      }
      setSearchTipList(
        list
          .map(item => typeof item == 'string' ? item.trim() : '')
          .filter(Boolean),
      )
    }).catch(() => {
      if (requestId !== searchTipRequestIdRef.current) return
      setSearchTipList([])
    }).finally(() => {
      if (requestId === searchTipRequestIdRef.current) setSearchTipLoading(false)
    })
  }, 220), [])
  const handleSelectSource = useCallback((action: SourceMenu['action']) => {
    setSearchSource(action)
    closeSourceMenu()
    if (!isSearchInputEditing) return
    const keyword = searchText.trim()
    if (!keyword) {
      searchTipRequestIdRef.current += 1
      setSearchTipLoading(false)
      setSearchTipList([])
      loadSearchHistoryList()
      return
    }
    requestSearchTips(keyword, action)
  }, [closeSourceMenu, isSearchInputEditing, loadSearchHistoryList, requestSearchTips, searchText])

  const runSearch = useCallback(async(keyword: string, source: SourceMenu['action']) => {
    const requestId = ++searchRequestIdRef.current
    setSearchLoading(true)
    try {
      const lowerKeyword = keyword.trim().toLowerCase()
      if (!lowerKeyword) {
        if (requestId !== searchRequestIdRef.current) return
        setSearchResults([])
        return
      }
      const results = await searchOnlineMusic(lowerKeyword, 1, source as OnlineSearchSource)
      if (requestId !== searchRequestIdRef.current) return
      setSearchResults(results)
    } catch {
      if (requestId !== searchRequestIdRef.current) return
      setSearchResults([])
    } finally {
      if (requestId === searchRequestIdRef.current) setSearchLoading(false)
    }
  }, [])
  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text)
    if (!isSearchInputEditing) return
    const keyword = text.trim()
    if (!keyword) {
      searchTipRequestIdRef.current += 1
      setSearchTipLoading(false)
      setSearchTipList([])
      loadSearchHistoryList()
      return
    }
    requestSearchTips(keyword, searchSource)
  }, [isSearchInputEditing, loadSearchHistoryList, requestSearchTips, searchSource])
  const handleSearchInputBlur = useCallback(() => {
    requestAnimationFrame(() => {
      setSearchInputEditing(false)
    })
  }, [])

  const handleSubmitSearch = useCallback((text: string) => {
    forceDismissSearchInput()
    const input = (text || searchText).trim()
    setSearchText(text || searchText)
    setSearchInputEditing(false)
    searchTipRequestIdRef.current += 1
    setSearchTipLoading(false)
    setSearchTipList([])

    if (!input) {
      setSearchMode(false)
      setSearchKeyword('')
      setSearchResults([])
      closeSourceMenu()
      forceDismissSearchInput()
      return
    }

    setSearchKeyword(input)
    setSearchMode(true)
    setSearchResults([])
    closeSourceMenu()
    void addHistoryWord(input)
    void runSearch(input, searchSource)
    forceDismissSearchInput()
  }, [closeSourceMenu, forceDismissSearchInput, runSearch, searchSource, searchText])
  const handleExitSearch = useCallback(() => {
    setSearchMode(false)
    setSearchInputEditing(false)
    setSearchKeyword('')
    setSearchResults([])
    closeSourceMenu()
    searchTipRequestIdRef.current += 1
    setSearchTipLoading(false)
    setSearchTipList([])
    forceDismissSearchInput()
  }, [closeSourceMenu, forceDismissSearchInput])
  useBackHandler(useCallback(() => {
    if (Object.keys(commonState.componentIds).length != 1) return false
    if (commonState.navActiveId != 'nav_love') return false
    if (isImportDrawerVisible && !importSubmitting) {
      setImportDrawerVisible(false)
      return true
    }
    if (selectedDetail) {
      handleCloseDetail()
      return true
    }
    if (isSearchMode || isSearchInputEditing) {
      handleExitSearch()
      return true
    }
    if (isSourceMenuVisible) {
      closeSourceMenu()
      forceDismissSearchInput()
      return true
    }
    return false
  }, [
    forceDismissSearchInput,
    handleExitSearch,
    importSubmitting,
    isImportDrawerVisible,
    isSearchInputEditing,
    isSearchMode,
    isSourceMenuVisible,
    closeSourceMenu,
    handleCloseDetail,
    selectedDetail,
  ]))

  useEffect(() => {
    if (!isSearchMode || !searchKeyword) return
    void runSearch(searchKeyword, searchSource)
  }, [isSearchMode, searchKeyword, searchSource, runSearch])
  const handleBeginSearchInputEdit = useCallback(() => {
    setSearchInputEditing(true)
    closeSourceMenu()
    const keyword = searchText.trim()
    if (!keyword) {
      searchTipRequestIdRef.current += 1
      setSearchTipLoading(false)
      setSearchTipList([])
      loadSearchHistoryList()
      return
    }
    requestSearchTips(keyword, searchSource)
  }, [closeSourceMenu, loadSearchHistoryList, requestSearchTips, searchSource, searchText])
  const handlePickSearchKeyword = useCallback((keyword: string) => {
    setSearchText(keyword)
    handleSubmitSearch(keyword)
  }, [handleSubmitSearch])
  const handleClearSearchHistoryList = useCallback(() => {
    clearHistoryList()
    setSearchHistoryList([])
  }, [])
  const handleRemoveSearchHistoryItem = useCallback((keyword: string) => {
    setSearchHistoryList((list) => {
      const index = list.indexOf(keyword)
      if (index < 0) return list
      const nextList = [...list]
      nextList.splice(index, 1)
      removeHistoryWord(index)
      return nextList
    })
  }, [])
  const renderSearchResultItem: ListRenderItem<SearchResultItem> = useCallback(({ item }) => {
    const isLoved = Boolean(lovedSongMap[String(item.id)])
    return (
      <SearchMusicResultRow
        item={item}
        isLoved={isLoved}
        onPress={() => { void handlePlaySearchSong(item) }}
        onToggleLoved={() => { void handleToggleSearchLoved(item) }}
        onAdd={() => { handleShowMusicAddModal(item) }}
      />
    )
  }, [handlePlaySearchSong, handleShowMusicAddModal, handleToggleSearchLoved, lovedSongMap])
  const searchAssistKeyword = searchText.trim()
  const searchAssistList = useMemo(() => {
    return searchAssistKeyword ? searchTipList : searchHistoryList
  }, [searchAssistKeyword, searchHistoryList, searchTipList])
  if (isSearchMode) {
    return (
      <PlaylistSearchScene
        styles={styles}
        t={t}
        statusBarHeight={statusBarHeight}
        bottomDockHeight={bottomDockHeight}
        isSourceMenuVisible={isSourceMenuVisible}
        sourceMenuBackdropOpacity={sourceMenuBackdropOpacity}
        sourceMenuWidth={sourceMenuWidth}
        sourceMenuHeight={sourceMenuHeight}
        sourceMenuRadius={sourceMenuRadius}
        sourceMenuListOpacity={sourceMenuListOpacity}
        sourceMenuListTranslateY={sourceMenuListTranslateY}
        sourceChevronRotate={sourceChevronRotate}
        sourceMenus={sourceMenus}
        searchSource={searchSource}
        searchSourceLabel={searchSourceLabel}
        searchInputRef={searchInputRef}
        isSearchInputEditing={isSearchInputEditing}
        searchText={searchText}
        searchKeyword={searchKeyword}
        searchLoading={searchLoading}
        searchResults={searchResults}
        searchAssistKeyword={searchAssistKeyword}
        searchAssistList={searchAssistList}
        searchHistoryList={searchHistoryList}
        searchTipLoading={searchTipLoading}
        musicAddModalRef={musicAddModalRef}
        renderSearchResultItem={renderSearchResultItem}
        getSourceMenuLabel={getSourceMenuLabel}
        onCloseSourceMenu={closeSourceMenu}
        onExitSearch={handleExitSearch}
        onBeginSearchInputEdit={handleBeginSearchInputEdit}
        onSearchInputBlur={handleSearchInputBlur}
        onSearchTextChange={handleSearchTextChange}
        onSubmitSearch={handleSubmitSearch}
        onToggleSearchSourceMenu={handleToggleSearchSourceMenu}
        onSelectSource={handleSelectSource}
        onClearSearchHistoryList={handleClearSearchHistoryList}
        onPickSearchKeyword={handlePickSearchKeyword}
        onRemoveSearchHistoryItem={handleRemoveSearchHistoryItem}
      />
    )
  }


  const profileHeroCard = (
    <TouchableOpacity style={styles.profileHero} activeOpacity={0.82} onPress={handleOpenProfileDetail}>
      <View style={styles.profileHeroAvatarWrap}>
        <View style={styles.profileHeroAvatarInner}>
          <Image style={styles.profileHeroAvatar} url={avatarDisplayUrl} resizeMode="contain" />
        </View>
        <View style={[styles.profileHeroBadge, genderBadgeStyle]}>
          {genderIconName
            ? <MdiIcon name={genderIconName} size={12} color={colors.ink.icon} />
            : <Text size={10} color={colors.ink.onControl} style={styles.profileHeroBadgeText}>{genderBadgeText}</Text>}
        </View>
      </View>
      <View style={styles.profileHeroContent}>
        <Text size={24} color={colors.ink.subpageTitle} style={styles.profileHeroName}>{nickname}</Text>
        <Text size={13} color={colors.ink.option} numberOfLines={2}>{signature || defaultSignature}</Text>
        <View style={styles.profileHeroMetaRow}>
          <View style={styles.profileHeroMetaPill}>
            <Text size={12} color={colors.ink.pill} style={styles.profileHeroMetaText}>{t('me_today_listening', { num: 70 })}</Text>
          </View>
        </View>
      </View>
      <View style={styles.profileHeroArrow}>
        <Icon name="chevron-right-2" rawSize={16} color={colors.ink.heroArrow} />
      </View>
    </TouchableOpacity>
  )

  const quickActionsRow = (
    <View style={styles.quickActionsRow}>
      {lovePlaylist
        ? <TouchableOpacity
            style={styles.quickActionItem}
            activeOpacity={0.78}
            onPress={() => { handleOpenList(lovePlaylist) }}
          >
            <View style={styles.quickActionIconWrap}>
              <MdiIcon name="heart" size={36} color={colors.ink.icon} />
            </View>
            <Text size={12} color={colors.ink.option} style={styles.quickActionLabel}>{t('list_name_love')}</Text>
          </TouchableOpacity>
        : null}
      <TouchableOpacity
        style={styles.quickActionItem}
        activeOpacity={0.78}
        onPress={() => { toast(t('toast_in_development')) }}
      >
        <View style={styles.quickActionIconWrap}>
          <MdiIcon name="download" size={36} color={colors.ink.icon} />
        </View>
        <Text size={12} color={colors.ink.option} style={styles.quickActionLabel}>{t('me_quick_local')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.quickActionItem}
        activeOpacity={0.78}
        onPress={() => { toast(t('toast_in_development')) }}
      >
        <View style={styles.quickActionIconWrap}>
          <MdiIcon name="chart-bar" size={36} color={colors.ink.icon} />
        </View>
        <Text size={12} color={colors.ink.option} style={styles.quickActionLabel}>{t('me_quick_statistics')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.quickActionItem}
        activeOpacity={0.78}
        onPress={() => { toast(t('toast_in_development')) }}
      >
        <View style={styles.quickActionIconWrap}>
          <MdiIcon name="account-multiple" size={36} color={colors.ink.icon} />
        </View>
        <Text size={12} color={colors.ink.option} style={styles.quickActionLabel}>{t('me_quick_listen_together')}</Text>
      </TouchableOpacity>
    </View>
  )

  const homeScene = (
    <PlaylistLibraryScene
      styles={styles}
      t={t}
      headerHeight={headerHeight}
      bottomDockHeight={bottomDockHeight}
      profileHero={profileHeroCard}
      quickActionsRow={quickActionsRow}
      hideGreeting
      featuredLibraryCards={featuredLibraryCards}
      displayPlaylists={displayPlaylists}
      playlistMetaMap={playlistMetaMap}
      playlistDisplayMode={playlistDisplayMode}
      displaySwitchItems={displaySwitchItems}
      isPlaylistTimeSort={isPlaylistTimeSort}
      isPlaylistCustomSort={isPlaylistCustomSort}
      playlistSortIcon={playlistSortIcon}
      playlistAddIcon="playlist-plus"
      isPlaylistListMode={isPlaylistListMode}
      isPlay={isPlay}
      isSourceMenuVisible={isSourceMenuVisible}
      sourceMenuBackdropOpacity={sourceMenuBackdropOpacity}
      createListDialogRef={createListDialogRef}
      getPlaylistCardTone={(index) => getPlaylistCardTone(index, colors)}
      isPlaylistCurrent={isPlaylistCurrent}
      isPlaylistDragActive={isPlaylistDragActive}
      draggingPlaylistId={draggingPlaylistId}
      playlistShiftAnimMap={playlistShiftAnimMap}
      dragControllerRef={dragControllerRef}
      playlistSectionRef={playlistSectionRef}
      playlistScrollRef={playlistScrollRef}
      onPlaylistScroll={handlePlaylistScroll}
      onPlaylistScrollBeginDrag={handlePlaylistScrollBeginDrag}
      onPlaylistTouchMove={handleActiveTouchMove}
      onPlaylistTouchEnd={handleActiveTouchEnd}
      onPlaylistTouchCancel={handleActiveTouchCancel}
      playlistPanHandlers={playlistPanHandlers}
      onPlaylistScrollLayout={handlePlaylistScrollLayout}
      onPlaylistContentSizeChange={handlePlaylistContentSizeChange}
      onPlaylistCardLayout={handlePlaylistCardLayout}
      onPlaylistSectionLayout={handlePlaylistSectionLayout}
      onCloseSourceMenu={closeSourceMenu}
      onOpenList={handleOpenList}
      onPlaylistDisplayModeChange={setPlaylistDisplayMode}
      onTogglePlaylistSort={handleTogglePlaylistSort}
      onShowCreateListModal={handleShowCreateListModal}
      onPlayPlaylistPress={handlePlayPlaylistPress}
      onCreateList={handleCreateList}
    />
  )
  const shouldRenderDetailScene = Boolean(selectedOnlineDetail ?? selectedListInfo)

  return (
    <View style={styles.sceneRoot}>
      <Animated.View
        pointerEvents={shouldRenderDetailScene ? 'none' : 'auto'}
        renderToHardwareTextureAndroid={isDetailTransitioning}
        shouldRasterizeIOS={isDetailTransitioning}
        style={[
          styles.scene,
          { transform: [{ translateX: homeSceneTranslateX }] },
        ]}
      >
        {homeScene}
      </Animated.View>
      {shouldRenderDetailScene
        ? <>
            <Animated.View pointerEvents="none" style={[styles.detailSceneShade, { opacity: detailSceneShadeOpacity }]} />
            <Animated.View
              renderToHardwareTextureAndroid={isDetailTransitioning}
              shouldRasterizeIOS={isDetailTransitioning}
              style={[
                styles.scene,
                styles.sceneOverlay,
                styles.detailScene,
                {
                  transform: [{ translateX: detailSceneTranslateX }],
                },
              ]}
            >
              <PlaylistDetailView detail={selectedDetail} onClose={handleCloseDetail} bottomPadding={bottomDockHeight} />
            </Animated.View>
          </>
        : null}
    </View>
  )
}

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  sceneRoot: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  scene: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  sceneOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 4,
  },
  detailSceneShade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 3,
    backgroundColor: colors.scrim.mask,
  },
  detailScene: {},
  container: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 0,
  },
  scroll: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 0,
    paddingHorizontal: 18,
  },
  detailListWrap: {
    flex: 1,
    position: 'relative',
  },
  header: {
    position: 'relative',
    overflow: 'visible',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  searchResultHeader: {
    position: 'relative',
    overflow: 'visible',
    paddingHorizontal: 18,
  },
  searchResultHeaderFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: APP_LAYER_INDEX.controls,
    elevation: 0,
    backgroundColor: colors.bg.app,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarButton: {
    borderRadius: 22,
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.card,
    padding: 2,
    shadowColor: colors.shadow.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface.avatar,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  searchResultSearchWrap: {
    flex: 1,
    marginLeft: 12,
  },
  searchDock: {
    flex: 1,
    marginLeft: 12,
    position: 'relative',
    zIndex: 8,
  },
  searchResultList: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  searchModeRoot: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  searchResultContent: {
    paddingBottom: 16,
  },
  searchAssistPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: APP_LAYER_INDEX.controls - 1,
    elevation: 0,
    backgroundColor: colors.surface.card,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchAssistTitleRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchAssistClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchAssistContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 8,
  },
  searchAssistChip: {
    maxWidth: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line.neutral,
    backgroundColor: colors.surface.card,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  searchAssistChipText: {
    maxWidth: 280,
  },
  searchAssistEmpty: {
    minHeight: 96,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: APP_LAYER_INDEX.controls,
    elevation: 0,
    backgroundColor: colors.bg.app,
  },
  detailBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.backBubble,
    padding: 2,
  },
  detailBackBtnInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface.backInner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.searchField.border,
    backgroundColor: colors.surface.search,
  },
  searchContent: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    color: colors.ink.input,
    fontSize: 14,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  searchInputDisplay: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
    height: '100%',
  },
  searchInputTrigger: {
    flex: 1,
    marginLeft: 10,
    height: '100%',
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
  sourceMenuAnchor: {
    position: 'relative',
    marginLeft: 2,
    width: 58,
    height: 26,
    zIndex: APP_LAYER_INDEX.controls + 2,
  },
  sourceText: {
    fontWeight: '600',
  },
  sourceChevronWrap: {
    marginLeft: 2,
  },
  sourceMenuHeadBtn: {
    height: 26,
  },
  sourceMenuPageBackdropWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 1,
  },
  sourceMenuPageBackdrop: {
    flex: 1,
  },
  sourceMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim.wash,
  },
  sourceMenuSheet: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line.panel,
    backgroundColor: colors.surface.card,
    overflow: 'hidden',
    shadowColor: colors.shadow.black,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sourceMenuSheetHead: {
    height: 26,
    paddingLeft: 9,
    paddingRight: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceMenuSheetList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line.hairline,
    paddingTop: 1,
  },
  sourcePanelItem: {
    height: SOURCE_MENU_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sourcePanelItemActive: {
    backgroundColor: colors.surface.sourceActive,
  },
  sourcePanelItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line.hairline,
  },
  sourcePanelBadge: {
    width: 30,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sourcePanelBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sourcePanelLabel: {
    fontWeight: '600',
    flex: 1,
  },
  sourcePanelCheck: {
    width: 18,
    alignItems: 'flex-end',
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 22,
  },
  quickCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.glass.rim72,
    backgroundColor: colors.surface.card,
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginRight: 10,
    padding: 14,
  },
  quickCardLast: {
    marginRight: 0,
  },
  quickMedia: {
    height: 112,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.glass.fill44,
  },
  quickMediaImage: {
    width: '100%',
    height: '100%',
  },
  quickInfo: {
    paddingTop: 12,
    paddingHorizontal: 2,
    paddingBottom: 0,
  },
  quickTitle: {
    fontWeight: '600',
    marginBottom: 5,
  },
  quickMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickMeta: {
    fontWeight: '500',
    marginLeft: 5,
  },
  section: {
    marginBottom: 18,
  },
  greetingBlock: {
    marginBottom: 18,
  },
  greetingTitle: {
    fontWeight: '700',
  },
  detailHeroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.glass.rim72,
    backgroundColor: colors.glass.fill88,
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  detailHeroCover: {
    width: 92,
    height: 92,
    borderRadius: 18,
  },
  detailHeroText: {
    flex: 1,
    marginLeft: 12,
  },
  detailHeroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  detailHeroName: {
    flexShrink: 1,
    marginBottom: 0,
  },
  detailHeroMeta: {
    marginTop: 2,
  },
  detailHeroSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  detailHeroSourceBadge: {
    marginRight: 8,
  },
  detailHeroSourceText: {
    flexShrink: 1,
    fontWeight: '500',
  },
  detailHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  detailHeroIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface.cancel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroDeleteBtn: {
    marginLeft: 8,
    backgroundColor: colors.iconWrap.red,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  playlistSectionHeader: {
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  playlistSectionTitleWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  playlistSectionTitle: {
    flexShrink: 1,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistSectionHeaderActions: {
    flexShrink: 0,
    marginLeft: 'auto',
  },
  displaySwitch: {
    marginRight: 10,
  },
  displaySwitchIcon: {
    width: 18,
    lineHeight: 15,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  displaySwitchGridIcon: {
    transform: [{ translateX: -0.5 }, { translateY: -0.5 }],
  },
  displaySwitchListIcon: {
    transform: [{ translateX: 0.5 }, { translateY: -0.5 }],
  },
  sectionIconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionIconBtnActive: {},
  sortIconImg: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionTag: {
    fontWeight: '500',
  },
  detailActionBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line.detail,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionBtnDisabled: {
    backgroundColor: colors.surface.actionDisabled,
    borderColor: colors.line.detailDisabled,
  },
  detailActionBtnText: {
    fontWeight: '600',
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    overflow: 'visible',
  },
  listPanel: {
    width: '100%',
    overflow: 'visible',
  },
  listItem: {
    width: '48.4%',
    marginBottom: 14,
  },
  listPicWrap: {
    aspectRatio: 1,
    borderRadius: 18,
  },
  listPicClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    overflow: 'hidden',
  },
  listPic: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  listPicFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    paddingTop: 7,
  },
  listRowItem: {
    width: '100%',
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  listRowSpacing: {
    marginBottom: 1,
  },
  listRowCoverWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface.songlistCard,
    shadowColor: colors.shadow.softCard,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  listRowCover: {
    width: '100%',
    height: '100%',
  },
  listRowInfo: {
    flex: 1,
    marginLeft: 13,
    marginRight: 12,
  },
  listRowTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  listRowSubtitle: {
    fontWeight: '500',
  },
  listRowPlayButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass.fill52,
    borderWidth: 1,
    borderColor: colors.glass.stroke,
  },
  listTitle: {
    fontWeight: '600',
    marginBottom: 1,
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
    backgroundColor: colors.surface.card,
  },
  pauseBarSmall: {
    width: 3,
  },
  pauseBarDark: {
    backgroundColor: colors.ink.miniPlay,
  },
  songItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surface.importMuted,
    backgroundColor: colors.glass.fill90,
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  songItemWrap: {
    position: 'relative',
  },
  songItemGhost: {
    opacity: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  songMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songPic: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  songInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  songMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  songSource: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.line.neutral,
    marginRight: 6,
    fontWeight: '600',
  },
  songActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  songInterval: {
    marginRight: 4,
    minWidth: 40,
    textAlign: 'right',
  },
  songDragOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: APP_LAYER_INDEX.playQueue,
    elevation: APP_LAYER_INDEX.playQueue,
  },
  songDragCard: {
    shadowColor: colors.shadow.black,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    borderColor: colors.line.soft,
  },
  searchSongActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  searchSongInterval: {
    marginRight: 4,
    minWidth: 38,
    textAlign: 'right',
  },
  songActionBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchLoveFilled: {
    lineHeight: 18,
    fontWeight: '700',
  },
  searchAddText: {
    lineHeight: 19,
    fontWeight: '700',
  },
  importDrawerMask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    zIndex: APP_LAYER_INDEX.playQueue,
    elevation: APP_LAYER_INDEX.playQueue,
  },
  importDrawerBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim.menu,
  },
  importDrawerPanel: {
    maxHeight: '72%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.surface.importMuted,
    backgroundColor: colors.surface.card,
    shadowColor: colors.shadow.dialog,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -5 },
    elevation: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  importDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  importDrawerTitle: {
    fontWeight: '600',
  },
  importDrawerConfirm: {
    fontWeight: '600',
  },
  importDrawerContent: {
    paddingBottom: 24,
  },
  importSongItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surface.importMuted,
    backgroundColor: colors.glass.fill92,
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  importSongMain: {
    flex: 1,
    marginLeft: 8,
  },
  searchResultStatus: {
    width: '100%',
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  searchResultStatusText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.glass.rim72,
    backgroundColor: colors.glass.fill88,
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlaylistCard: {
    backgroundColor: colors.surface.card,
    paddingVertical: 16,
  },
  emptyActionBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.accent.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    fontWeight: '700',
  },
  profileHero: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  quickActionItem: {
    alignItems: 'center',
    minWidth: 64,
  },
  quickActionIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionIconImg: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  quickActionLabel: {
    fontWeight: '500',
  },
  profileHeroAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
    padding: 4,
    backgroundColor: colors.surface.card,
  },
  profileHeroAvatarInner: {
    flex: 1,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: colors.surface.well,
  },
  profileHeroAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: colors.surface.well,
  },
  profileHeroBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.badge.online,
    borderWidth: 3,
    borderColor: colors.line.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroBadgeMale: {
    backgroundColor: colors.badge.male,
  },
  profileHeroBadgeFemale: {
    backgroundColor: colors.badge.female,
  },
  profileHeroBadgeUnknown: {
    backgroundColor: colors.badge.unknown,
  },
  profileHeroBadgeText: {
    fontWeight: '700',
    lineHeight: 13,
  },
  genderBadgeImgSmall: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
  },
  profileHeroContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  profileHeroName: {
    fontWeight: '700',
    marginBottom: 3,
  },
  profileHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },
  profileHeroMetaPill: {
    borderRadius: 999,
    backgroundColor: colors.accent.soft,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginRight: 8,
  },
  profileHeroMetaPillMuted: {
    borderRadius: 999,
    backgroundColor: colors.surface.well,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  profileHeroMetaText: {
    fontWeight: '700',
  },
  profileHeroArrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistDragHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistDragHitGrid: {
    width: '100%',
  },
  // Grid lift shadow stays on the cover. Putting backgroundColor + elevation
  // on the whole card (cover + title) painted the rounded white plate behind
  // the playlist name. No zIndex: Android reparents a view when zIndex
  // changes and drops the in-flight touch.
  playlistDragLiftedCover: {
    elevation: 4,
    shadowColor: colors.shadow.black,
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  playlistDragLiftedList: {
    elevation: 4,
    backgroundColor: colors.surface.card,
    borderRadius: 16,
    shadowColor: colors.shadow.black,
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
})))
