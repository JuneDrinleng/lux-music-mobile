import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ListRenderItem,
} from 'react-native'
import { BlurView } from '@react-native-community/blur'
import { X } from 'lucide-react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { addListMusics, createList, getListMusics, removeListMusics, removeUserList, setActiveList, updateListMusicPosition, updateUserList } from '@/core/list'
import { addMusicToQueueAndPlay, playListAsQueue } from '@/core/player/player'
import { APP_LAYER_INDEX, LIST_IDS } from '@/config/constant'
import { search as searchOnlineMusic } from '@/core/search/music'
import { addHistoryWord, clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import settingState from '@/store/setting/state'
import { useSettingValue } from '@/store/setting/hook'
import { type Source as OnlineSearchSource } from '@/store/search/music/state'
import { useI18n } from '@/lang'
import listState from '@/store/list/state'
import commonState from '@/store/common/state'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import musicSdk from '@/utils/musicSdk'
import { debounce } from '@/utils'
import { setNavActiveId, updateSetting } from '@/core/common'
import { DEFAULT_USER_AVATAR, getUserAvatar } from '@/utils/data'

const SHOW_LISTENING_STATISTICS = false
const BOTTOM_DOCK_BASE_HEIGHT = 112
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
const sourceTagColorMap: Record<string, { text: string, background: string }> = {
  tx: { text: '#31c27c', background: '#ecfdf3' },
  wy: { text: '#d81e06', background: '#fef2f2' },
  kg: { text: '#2f88ff', background: '#eff6ff' },
  kw: { text: '#f59e0b', background: '#fffbeb' },
  mg: { text: '#e11d8d', background: '#fdf2f8' },
}
const playlistCardTones = [
  { surface: '#f6e2e7', accent: '#cf385b', ink: '#652233' },
  { surface: '#ebe4d7', accent: '#8a6745', ink: '#45301d' },
  { surface: '#e4e8f1', accent: '#556b96', ink: '#293548' },
  { surface: '#ece6f2', accent: '#7f5da5', ink: '#413052' },
] as const
const hasNativeBlurView = Boolean(UIManager.getViewManagerConfig?.(Platform.OS === 'ios' ? 'BlurView' : 'AndroidBlurView'))

const getSourceTagColor = (source: string) => {
  return sourceTagColorMap[source.toLowerCase()] ?? { text: '#111827', background: '#e5e7eb' }
}
const getSourceMenuLabel = (source: SourceMenu['action']) => {
  return source == 'all' ? 'All' : source.toUpperCase()
}

const getPlaylistCardTone = (index: number) => {
  return playlistCardTones[index % playlistCardTones.length]
}

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
const isUserListInfo = (listInfo: LX.List.MyListInfo | null): listInfo is LX.List.UserListInfo => {
  return Boolean(listInfo && 'locationUpdateTime' in listInfo)
}

const stats: Array<{ day: string, height: `${number}%`, active?: boolean }> = [
  { day: 'Mon', height: '40%' },
  { day: 'Tue', height: '65%' },
  { day: 'Wed', height: '85%' },
  { day: 'Thu', height: '50%', active: true },
  { day: 'Fri', height: '70%' },
  { day: 'Sat', height: '95%' },
  { day: 'Sun', height: '30%' },
]
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

export default () => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const bottomDockHeight = BOTTOM_DOCK_BASE_HEIGHT
  const headerTopPadding = statusBarHeight + 18
  const headerHeight = headerTopPadding + 44 + 16
  const shouldUseSearchBlur = hasNativeBlurView
  const modalBottomInset = useMemo(() => {
    const screenHeight = Dimensions.get('screen').height
    const windowHeight = Dimensions.get('window').height
    const extraInset = Math.max(0, screenHeight - windowHeight)
    if (!extraInset) return 0
    if (Platform.OS == 'android') return Math.max(0, extraInset - statusBarHeight)
    return extraInset
  }, [statusBarHeight])
  const playlists = useMyList()
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_USER_AVATAR)
  const detailSceneWidth = Dimensions.get('window').width
  const [playlistMetaMap, setPlaylistMetaMap] = useState<Record<string, { count: number, pic: string | null }>>({})
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
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
  const [importLoading, setImportLoading] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([])
  const [importSelectedMap, setImportSelectedMap] = useState<Record<string, true>>({})
  const [isDetailTransitioning, setDetailTransitioning] = useState(false)
  const playlistSortMode = useSettingValue('list.playlistSortMode')
  const [playlistDisplayMode, setPlaylistDisplayMode] = useState<'grid' | 'list'>('grid')
  const detailRequestIdRef = useRef(0)
  const importRequestIdRef = useRef(0)
  const searchRequestIdRef = useRef(0)
  const searchTipRequestIdRef = useRef(0)
  const searchInputRef = useRef<TextInput>(null)
  const sourceMenuVisibleRef = useRef(false)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
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
  const setKeepPlayBarVisible = (visible: boolean) => {
    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', visible)
  }
  const lovePlaylist = useMemo(() => playlists.find(list => list.id === LIST_IDS.LOVE) ?? null, [playlists])
  const defaultPlaylist = useMemo(() => playlists.find(list => list.id === LIST_IDS.DEFAULT) ?? null, [playlists])
  const displayPlaylists = useMemo(() => {
    const userPlaylists = playlists.filter((list): list is LX.List.UserListInfo => list.id !== LIST_IDS.LOVE && list.id !== LIST_IDS.DEFAULT)
    if (playlistSortMode === 'default') return userPlaylists
    return userPlaylists
      .map((list, index) => ({
        list,
        index,
        time: getPlaylistSortTime(list),
      }))
      .sort((a, b) => {
        const diff = b.time - a.time
        if (diff) return diff
        return a.index - b.index
      })
      .map(item => item.list)
  }, [playlists, playlistSortMode])
  const likedSongsCount = lovePlaylist ? playlistMetaMap[lovePlaylist.id]?.count ?? 0 : 0
  const defaultSongsCount = defaultPlaylist ? playlistMetaMap[defaultPlaylist.id]?.count ?? 0 : 0
  const featuredLibraryCards = useMemo(() => {
    const cards: Array<{
      id: string
      list: LX.List.MyListInfo
      title: string
      count: number
      cover: string | null
      icon: string
    }> = []

    if (lovePlaylist) {
      cards.push({
        id: lovePlaylist.id,
        list: lovePlaylist,
        title: t('list_name_love'),
        count: likedSongsCount,
        cover: playlistMetaMap[lovePlaylist.id]?.pic ?? null,
        icon: 'heart',
      })
    }
    if (defaultPlaylist) {
      cards.push({
        id: defaultPlaylist.id,
        list: defaultPlaylist,
        title: t('list_name_default'),
        count: defaultSongsCount,
        cover: playlistMetaMap[defaultPlaylist.id]?.pic ?? null,
        icon: 'play-circle',
      })
    }

    return cards
  }, [defaultPlaylist, defaultSongsCount, likedSongsCount, lovePlaylist, playlistMetaMap, t])
  const isPlaylistTimeSort = playlistSortMode == 'time'
  const playlistSortIcon = isPlaylistTimeSort ? 'sort-ascending' : 'sort-descending'
  const isPlaylistListMode = playlistDisplayMode == 'list'
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
    let isUnmounted = false

    void getUserAvatar().then((path) => {
      if (isUnmounted) return
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
    })

    const handleUserAvatarUpdated = (path: string | null) => {
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
    }
    global.app_event.on('userAvatarUpdated', handleUserAvatarUpdated)

    return () => {
      isUnmounted = true
      global.app_event.off('userAvatarUpdated', handleUserAvatarUpdated)
    }
  }, [])
  useEffect(() => {
    return () => {
      setKeepPlayBarVisible(false)
    }
  }, [])
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
      if (song.meta.picUrl) return song.meta.picUrl
    }
    return null
  }

  const updatePlaylistMeta = useCallback(async(ids: string[]) => {
    if (!ids.length) return
    const result = await Promise.all(ids.map(async(id) => {
      const list = await getListMusics(id)
      return {
        id,
        count: list.length,
        pic: pickCover(list),
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
  }, [])

  const loadDetailSongs = useCallback(async(id: string, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    const list = await getListMusics(id)
    if (requestId !== detailRequestIdRef.current) return
    setDetailSongs([...list])
    if (showLoading) setDetailLoading(false)
  }, [])
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
    if (!selectedListId && !isDetailTransitioning) return
    detailRequestIdRef.current += 1
    const finish = () => {
      detailScrollOffsetRef.current = 0
      setSelectedListId(null)
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
  }, [animateDetailScene, detailSceneAnim, isDetailTransitioning, selectedListId])

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
        void loadDetailSongs(selectedListId)
      }
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [loadDetailSongs, refreshLovedSongMap, selectedListId, updatePlaylistMeta])
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
  const getSongRowKey = useCallback((song: LX.Music.MusicInfo, fallbackIndex = 0) => {
    return `${song.source}_${song.id}_${fallbackIndex}`
  }, [])
  const measureDetailListWrap = useCallback(() => {
    detailListWrapRef.current?.measureInWindow((_, y, _width, height) => {
      detailListPageYRef.current = y
      if (height > 0) detailListHeightRef.current = height
    })
  }, [])
  const handleDetailWrapLayout = useCallback((event: LayoutChangeEvent) => {
    detailListHeightRef.current = event.nativeEvent.layout.height
    requestAnimationFrame(() => {
      measureDetailListWrap()
    })
  }, [measureDetailListWrap])
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
      await loadDetailSongs(listId)
    }
  }, [clearDragPressGuard, dragOpacity, dragScale, loadDetailSongs, resetDragRowShifts, updatePlaylistMeta])
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
  const handleCancelRemoveSong = useCallback(() => {
    setPendingDeleteSong(null)
  }, [])
  const handleConfirmRemoveSong = useCallback(async() => {
    if (!selectedListId || !pendingDeleteSong || dragStateRef.current.active) {
      setPendingDeleteSong(null)
      return true
    }
    try {
      await removeListMusics(selectedListId, [pendingDeleteSong.id])
      await Promise.all([
        loadDetailSongs(selectedListId),
        updatePlaylistMeta([selectedListId]),
      ])
    } catch {
      await loadDetailSongs(selectedListId)
    }
    setPendingDeleteSong(null)
    return true
  }, [loadDetailSongs, pendingDeleteSong, selectedListId, updatePlaylistMeta])
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
  }, [measureDetailListWrap, selectedListId])
  useEffect(() => {
    if (selectedListId) return
    setPendingDeleteSong(null)
    resetSongDragState()
  }, [resetSongDragState, selectedListId])
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
    setSelectedListId(list.id)
    setDetailSongs([])
    setDetailLoading(true)
    animateDetailScene(1)
    void loadDetailSongs(list.id, true)
  }, [animateDetailScene, loadDetailSongs, resetSongDragState])

  const handlePlaySong = useCallback(async(listId: string, song: LX.Music.MusicInfo, fallbackIndex: number) => {
    setActiveList(listId)
    const latestList = await getListMusics(listId)
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await playListAsQueue(listId, targetIndex)
  }, [])
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
  const handleTogglePlaylistSort = useCallback(() => {
    updateSetting({ 'list.playlistSortMode': playlistSortMode == 'default' ? 'time' : 'default' })
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
  const canRenameSelectedList = isUserListInfo(selectedListInfo)
  const handleShowRenameListModal = useCallback(() => {
    if (!isUserListInfo(selectedListInfo)) return
    renameListDialogRef.current?.show(selectedListInfo.name)
  }, [selectedListInfo])
  const handleShowRemoveListModal = useCallback(() => {
    if (!isUserListInfo(selectedListInfo)) return
    removeListDialogRef.current?.show('')
  }, [selectedListInfo])
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
  const handleRemoveSelectedList = useCallback(async() => {
    if (!isUserListInfo(selectedListInfo)) return false
    await removeUserList([selectedListInfo.id])
    handleCloseDetail(true)
    return true
  }, [handleCloseDetail, selectedListInfo])
  const selectedListMeta = selectedListInfo ? playlistMetaMap[selectedListInfo.id] : null
  const importSelectedCount = useMemo(() => Object.keys(importSelectedMap).length, [importSelectedMap])
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
  const handleCloseImportDrawer = useCallback(() => {
    if (importSubmitting) return
    setImportDrawerVisible(false)
  }, [importSubmitting])
  const handleToggleImportSong = useCallback((songId: string) => {
    setImportSelectedMap((prev) => {
      const next = { ...prev }
      if (next[songId]) delete next[songId]
      else next[songId] = true
      return next
    })
  }, [])
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
      void loadDetailSongs(selectedListId)
      void updatePlaylistMeta([selectedListId])
    } finally {
      setImportSubmitting(false)
    }
  }, [importCandidates, importSelectedMap, importSubmitting, loadDetailSongs, selectedListId, updatePlaylistMeta])
  useEffect(() => {
    importRequestIdRef.current += 1
    setImportDrawerVisible(false)
    setImportLoading(false)
    setImportSubmitting(false)
    setImportCandidates([])
    setImportSelectedMap({})
  }, [selectedListId])
  const renderSongItem: ListRenderItem<LX.Music.MusicInfo> = useCallback(({ item, index }) => {
    if (!selectedListId) return null
    const songKey = getSongRowKey(item, index)
    const isDraggingRow = draggingSongKey == songKey && dragStateRef.current.active
    const shiftAnim = getSongShiftAnim(songKey)
    const sourceTagColor = getSourceTagColor(item.source)
    return (
      <View
        onLayout={(event) => { handleSongRowLayout(item, index, event) }}
        style={styles.songItemWrap}
      >
        <Animated.View
          style={[
            styles.songItem,
            isDraggingRow ? styles.songItemGhost : null,
            { transform: [{ translateY: shiftAnim }] },
          ]}
        >
          <TouchableOpacity
            style={styles.songMain}
            activeOpacity={0.8}
            delayLongPress={180}
            onLongPress={(event) => { handleStartSongDrag(item, index, event) }}
            onPress={() => {
              if (skipNextSongPressRef.current) {
                if (dragStateRef.current.active) {
                  void handleFinishSongDrag()
                } else {
                  clearDragPressGuard()
                }
                return
              }
              void handlePlaySong(selectedListId, item, index)
            }}
          >
            <Image style={styles.songPic} url={item.meta.picUrl ?? null} />
            <View style={styles.songInfo}>
              <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
              <View style={styles.songMetaRow}>
                <Text size={10} color={sourceTagColor.text} style={[styles.songSource, { backgroundColor: sourceTagColor.background }]}>{item.source.toUpperCase()}</Text>
                <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.songActions}>
            <Text size={11} color="#9ca3af" style={styles.songInterval}>{item.interval ?? '--:--'}</Text>
            <TouchableOpacity
              style={styles.songActionBtn}
              activeOpacity={0.75}
              onPress={() => { handleShowRemoveSongModal(item) }}
            >
              <MaterialCommunityIcon name="trash-can-outline" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    )
  }, [clearDragPressGuard, draggingSongKey, getSongRowKey, getSongShiftAnim, handleFinishSongDrag, handlePlaySong, handleShowRemoveSongModal, handleSongRowLayout, handleStartSongDrag, selectedListId])
  const detailHeader = useMemo(() => {
    if (!selectedListInfo) return null
    return (
      <>
        <View style={[styles.header, { paddingTop: statusBarHeight + 18 }]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.82} onPress={() => { handleCloseDetail() }}>
              <View style={styles.detailBackBtnInner}>
                <Icon name="chevron-left" rawSize={20} color="#232733" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.detailHeroCard}>
          <View style={styles.detailHero}>
          <Image style={styles.detailHeroCover} url={selectedListMeta?.pic ?? null} />
          <View style={styles.detailHeroText}>
            <View style={styles.detailHeroNameRow}>
              <Text size={22} color="#111827" style={[styles.profileName, styles.detailHeroName]} numberOfLines={1}>{selectedListInfo.name}</Text>
              {canRenameSelectedList
                ? <View style={styles.detailHeroActions}>
                    <TouchableOpacity style={styles.detailHeroIconBtn} activeOpacity={0.8} onPress={handleShowRenameListModal}>
                      <MaterialCommunityIcon name="pencil-outline" size={16} color="#111827" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.detailHeroIconBtn, styles.detailHeroDeleteBtn]} activeOpacity={0.8} onPress={handleShowRemoveListModal}>
                      <MaterialCommunityIcon name="trash-can-outline" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                : null}
            </View>
            <Text size={12} color="#6b7280">{t('me_songs_count', { num: selectedListMeta?.count ?? 0 })}</Text>
          </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size={18} color="#111827" style={styles.sectionTitle}>{t('me_songs')}</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={handleOpenImportDrawer}>
              <Text size={13} color="#111827" style={styles.sectionTag}>{`+ ${t('list_import')}`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    )
  }, [canRenameSelectedList, handleCloseDetail, handleOpenImportDrawer, handleShowRemoveListModal, handleShowRenameListModal, selectedListInfo, selectedListMeta?.pic, selectedListMeta?.count, statusBarHeight, t])
  const renderImportCandidateItem: ListRenderItem<ImportCandidate> = useCallback(({ item }) => {
    const sourceTagColor = getSourceTagColor(item.musicInfo.source)
    const isSelected = Boolean(importSelectedMap[item.id])
    return (
      <TouchableOpacity style={styles.importSongItem} activeOpacity={0.85} onPress={() => { handleToggleImportSong(item.id) }}>
        <Icon name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} rawSize={22} color={isSelected ? '#111827' : '#9ca3af'} />
        <View style={styles.importSongMain}>
          <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.musicInfo.name}</Text>
          <View style={styles.songMetaRow}>
            <Text size={10} color={sourceTagColor.text} style={[styles.songSource, { backgroundColor: sourceTagColor.background }]}>{item.musicInfo.source.toUpperCase()}</Text>
            <Text size={11} color="#6b7280" numberOfLines={1}>{item.musicInfo.singer}</Text>
          </View>
          <Text size={10} color="#9ca3af" numberOfLines={1}>{item.fromListName}</Text>
        </View>
      </TouchableOpacity>
    )
  }, [handleToggleImportSong, importSelectedMap])

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
  const handleClearSearchPreview = useCallback(() => {
    setSearchText('')
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
  const handleEnterSearchMode = useCallback(() => {
    global.app_event.openVerticalSearchPage({
      keyword: searchText.trim(),
      source: searchSource,
      submit: Boolean(searchText.trim()),
    })
  }, [searchSource, searchText])

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
    if (selectedListId) {
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
    selectedListId,
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
    const sourceTagColor = getSourceTagColor(item.source)
    return (
      <View style={styles.songItem}>
        <TouchableOpacity
          style={styles.songMain}
          activeOpacity={0.8}
          onPress={() => { void handlePlaySearchSong(item) }}
        >
          <Image style={styles.songPic} url={item.meta.picUrl ?? null} />
          <View style={styles.songInfo}>
            <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.songMetaRow}>
              <Text size={10} color={sourceTagColor.text} style={[styles.songSource, { backgroundColor: sourceTagColor.background }]}>{item.source.toUpperCase()}</Text>
              <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.searchSongActions}>
          <Text size={11} color="#9ca3af" style={styles.searchSongInterval}>{item.interval ?? '--:--'}</Text>
          <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={() => { void handleToggleSearchLoved(item) }}>
            {isLoved
              ? <Text size={17} color="#ef4444" style={styles.searchLoveFilled}>{'\u2665'}</Text>
              : <Icon name="love" rawSize={17} color="#9ca3af" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={() => { handleShowMusicAddModal(item) }}>
            <Text size={18} color="#9ca3af" style={styles.searchAddText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }, [handlePlaySearchSong, handleShowMusicAddModal, handleToggleSearchLoved, lovedSongMap])
  const searchAssistKeyword = searchText.trim()
  const searchAssistList = useMemo(() => {
    return searchAssistKeyword ? searchTipList : searchHistoryList
  }, [searchAssistKeyword, searchHistoryList, searchTipList])
  const renderSourceMenuControl = useCallback(({
    textColor,
    iconColor,
    iconSize,
    onPress,
  }: {
    textColor: string
    iconColor: string
    iconSize: number
    onPress: () => void
  }) => {
    return (
      <View style={styles.sourceMenuAnchor}>
        <Animated.View
          style={[
            styles.sourceMenuSheet,
            {
              width: sourceMenuWidth,
              height: sourceMenuHeight,
              borderRadius: sourceMenuRadius,
            },
          ]}
        >
          <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.sourceMenuHeadBtn}>
            <View style={styles.sourceMenuSheetHead}>
              <Text size={12} color={textColor} style={styles.sourceText}>{searchSourceLabel}</Text>
              <Animated.View style={[styles.sourceChevronWrap, { transform: [{ rotate: sourceChevronRotate }] }]}>
                <Icon name="chevron-right-2" rawSize={iconSize} color={iconColor} />
              </Animated.View>
            </View>
          </TouchableOpacity>
          <Animated.View
            pointerEvents={isSourceMenuVisible ? 'auto' : 'none'}
            style={[
              styles.sourceMenuSheetList,
              {
                opacity: sourceMenuListOpacity,
                transform: [{ translateY: sourceMenuListTranslateY }],
              },
            ]}
          >
            {sourceMenus.map((menu, index) => {
              const isActive = menu.action === searchSource
              const tone = menu.action === 'all'
                ? { text: '#6b7280', background: '#f3f4f6' }
                : getSourceTagColor(menu.action)
              return (
                <TouchableOpacity
                  key={menu.action}
                  activeOpacity={0.78}
                  style={[
                    styles.sourcePanelItem,
                    isActive ? styles.sourcePanelItemActive : null,
                    index < sourceMenus.length - 1 ? styles.sourcePanelItemBorder : null,
                  ]}
                  onPress={() => { handleSelectSource(menu.action) }}
                >
                  <View style={[styles.sourcePanelBadge, { backgroundColor: tone.background }]}>
                    <Text size={10} color={tone.text} style={styles.sourcePanelBadgeText}>
                      {menu.action == 'all' ? 'ALL' : menu.action.toUpperCase()}
                    </Text>
                  </View>
                  <Text size={13} color="#111827" style={styles.sourcePanelLabel}>
                    {getSourceMenuLabel(menu.action)}
                  </Text>
                  <View style={styles.sourcePanelCheck}>
                    {isActive ? <MaterialCommunityIcon name="check" size={16} color="#111827" /> : null}
                  </View>
                </TouchableOpacity>
              )
            })}
          </Animated.View>
        </Animated.View>
      </View>
    )
  }, [handleSelectSource, isSourceMenuVisible, searchSource, searchSourceLabel, sourceChevronRotate, sourceMenuHeight, sourceMenuListOpacity, sourceMenuListTranslateY, sourceMenuRadius, sourceMenuWidth])

  const searchHeader = useMemo(() => {
    return (
      <View style={[styles.searchResultHeader, { paddingTop: statusBarHeight + 18 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.8} onPress={handleExitSearch}>
            <View style={styles.detailBackBtnInner}>
              <Icon name="chevron-left" rawSize={20} color="#232733" />
            </View>
          </TouchableOpacity>
          <View style={styles.searchResultSearchWrap}>
            <View style={styles.searchWrap}>
              {shouldUseSearchBlur
                ? <>
                    <BlurView
                      style={StyleSheet.absoluteFillObject}
                      blurType={Platform.OS === 'ios' ? 'chromeMaterialLight' : 'light'}
                      blurAmount={Platform.OS === 'ios' ? 34 : 24}
                      blurRadius={Platform.OS === 'android' ? 24 : undefined}
                      downsampleFactor={Platform.OS === 'android' ? 6 : undefined}
                      overlayColor={Platform.OS === 'android' ? 'rgba(255,255,255,0.16)' : 'transparent'}
                      reducedTransparencyFallbackColor="rgba(255,255,255,0.72)"
                    />
                    <View style={styles.searchGlassTint} pointerEvents="none" />
                  </>
                : <View style={styles.searchGlassFallback} pointerEvents="none" />}
              <View style={styles.searchGlassRim} pointerEvents="none" />
              <View style={styles.searchContent}>
                <Icon name="search-2" rawSize={18} color="#666d7b" />
                {isSearchInputEditing
                  ? <TextInput
                      ref={searchInputRef}
                      style={styles.searchInput}
                      value={searchText}
                      onChangeText={handleSearchTextChange}
                      disableFullscreenUI
                      blurOnSubmit
                      autoFocus
                      onBlur={handleSearchInputBlur}
                      onSubmitEditing={({ nativeEvent }) => { handleSubmitSearch(nativeEvent.text ?? searchText) }}
                      returnKeyType="search"
                      placeholder={t('me_search_placeholder')}
                      placeholderTextColor="#9aa1ae"
                    />
                  : <TouchableOpacity style={styles.searchInputDisplay} activeOpacity={0.85} onPress={handleBeginSearchInputEdit}>
                      <Text size={13} color={searchText ? '#232733' : '#9aa1ae'} numberOfLines={1} style={styles.searchInputText}>
                        {searchText || t('me_search_placeholder')}
                      </Text>
                    </TouchableOpacity>}
                {renderSourceMenuControl({
                  textColor: '#666d7b',
                  iconColor: '#666d7b',
                  iconSize: 13,
                  onPress: handleToggleSearchSourceMenu,
                })}
              </View>
            </View>
          </View>
        </View>
      </View>
    )
  }, [handleBeginSearchInputEdit, handleExitSearch, handleSearchInputBlur, handleSearchTextChange, handleSubmitSearch, handleToggleSearchSourceMenu, isSearchInputEditing, renderSourceMenuControl, searchText, shouldUseSearchBlur, statusBarHeight, t])

  if (isSearchMode) {
    const searchHeaderHeight = statusBarHeight + 18 + 44 + 16
    return (
      <>
        <View style={styles.searchModeRoot}>
          {isSourceMenuVisible
            ? <Animated.View style={[styles.sourceMenuPageBackdropWrap, styles.sourceMenuBackdrop, { opacity: sourceMenuBackdropOpacity }]}>
                <TouchableOpacity style={styles.sourceMenuPageBackdrop} activeOpacity={1} onPress={closeSourceMenu} />
              </Animated.View>
            : null}
          <View style={styles.searchResultHeaderFloating}>
            {searchHeader}
          </View>
          {isSearchInputEditing
            ? <View style={[styles.searchAssistPanel, { top: searchHeaderHeight }]}>
                {!searchAssistKeyword
                  ? <View style={styles.searchAssistTitleRow}>
                      <Text size={13} color="#6b7280">{t('search_history_search')}</Text>
                      {searchHistoryList.length
                        ? (
                            <TouchableOpacity
                              style={styles.searchAssistClearBtn}
                              activeOpacity={0.8}
                              onPress={handleClearSearchHistoryList}
                            >
                              <Icon name="eraser" rawSize={14} color="#9ca3af" />
                            </TouchableOpacity>
                          )
                        : null}
                    </View>
                  : null}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.searchAssistContent}
                >
                  {searchAssistList.length
                    ? searchAssistList.map((keyword, index) => {
                      return (
                        <TouchableOpacity
                          key={`${keyword}_${index}`}
                          style={styles.searchAssistChip}
                          activeOpacity={0.82}
                          onPress={() => { handlePickSearchKeyword(keyword) }}
                          onLongPress={!searchAssistKeyword ? () => { handleRemoveSearchHistoryItem(keyword) } : undefined}
                        >
                          <Text size={13} color="#111827" numberOfLines={1} style={styles.searchAssistChipText}>{keyword}</Text>
                        </TouchableOpacity>
                      )
                    })
                    : (
                        <View style={styles.searchAssistEmpty}>
                          <Text size={13} color="#9ca3af">
                            {searchAssistKeyword
                              ? searchTipLoading
                                ? t('me_searching')
                                : t('me_search_no_match')
                              : t('me_search_hint')}
                          </Text>
                        </View>
                      )}
                </ScrollView>
              </View>
            : null}
          <FlatList
            style={styles.searchResultList}
            contentContainerStyle={[
              styles.detailContent,
              styles.searchResultContent,
              { paddingTop: searchHeaderHeight, paddingBottom: 16 + bottomDockHeight },
            ]}
            data={searchResults}
            renderItem={renderSearchResultItem}
            keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
            ListEmptyComponent={(
              <View style={styles.emptyCard}>
                <Text size={13} color="#6b7280">
                  {searchLoading
                    ? t('me_searching')
                    : searchKeyword
                      ? t('me_search_no_match')
                      : t('me_search_hint')}
                </Text>
              </View>
            )}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            initialNumToRender={12}
            windowSize={8}
            maxToRenderPerBatch={12}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
          />
        </View>
        <MusicAddModal ref={musicAddModalRef} />
      </>
    )
  }

  const renderDetailScene = () => {
    if (!selectedListInfo) return null
    const draggingSourceTagColor = draggingSong ? getSourceTagColor(draggingSong.source) : null
    return (
      <>
        <View
          ref={detailListWrapRef}
          style={styles.detailListWrap}
          onLayout={handleDetailWrapLayout}
          collapsable={false}
          {...detailListPanResponder.panHandlers}
        >
          <FlatList
            ref={detailListRef}
            style={styles.container}
            contentContainerStyle={[styles.detailContent, { paddingBottom: bottomDockHeight }]}
            data={detailSongs}
            renderItem={renderSongItem}
            keyExtractor={(item, index) => getSongRowKey(item, index)}
            ListHeaderComponent={detailHeader}
            ListEmptyComponent={(
              <View style={styles.emptyCard}>
                <Text size={13} color="#6b7280">{detailLoading ? t('me_loading_songs') : t('me_no_songs')}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            windowSize={isSongDragActive ? 4 : 6}
            maxToRenderPerBatch={isSongDragActive ? 6 : 8}
            updateCellsBatchingPeriod={isSongDragActive ? 24 : 16}
            removeClippedSubviews={false}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            onScroll={handleDetailListScroll}
            onContentSizeChange={handleDetailListContentSizeChange}
            scrollEventThrottle={16}
            scrollEnabled={!isSongDragActive}
          />
          {draggingSong
            ? <Animated.View
                pointerEvents="none"
                style={[
                  styles.songDragOverlay,
                  {
                    transform: [{ translateY: dragTop }, { scale: dragScale }],
                    opacity: dragOpacity,
                  },
                ]}
              >
                <View style={[styles.songItem, styles.songDragCard]}>
                  <View style={styles.songMain}>
                    <Image style={styles.songPic} url={draggingSong.meta.picUrl ?? null} />
                    <View style={styles.songInfo}>
                      <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{draggingSong.name}</Text>
                      <View style={styles.songMetaRow}>
                        <Text
                          size={10}
                          color={draggingSourceTagColor?.text ?? '#111827'}
                          style={[
                            styles.songSource,
                            { backgroundColor: draggingSourceTagColor?.background ?? '#e5e7eb' },
                          ]}
                        >
                          {draggingSong.source.toUpperCase()}
                        </Text>
                        <Text size={11} color="#6b7280" numberOfLines={1}>{draggingSong.singer}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.songActions}>
                    <Text size={11} color="#9ca3af" style={styles.songInterval}>{draggingSong.interval ?? '--:--'}</Text>
                    <View style={styles.songActionBtn}>
                      <MaterialCommunityIcon name="drag-horizontal-variant" size={16} color="#6b7280" />
                    </View>
                  </View>
                </View>
              </Animated.View>
            : null}
        </View>
        <Modal
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
          navigationBarTranslucent={true}
          presentationStyle="overFullScreen"
          visible={isImportDrawerVisible}
          onRequestClose={handleCloseImportDrawer}
        >
          <View style={styles.importDrawerMask}>
            <TouchableOpacity style={styles.importDrawerBackdrop} activeOpacity={1} onPress={handleCloseImportDrawer} />
            <View style={[styles.importDrawerPanel, { marginBottom: modalBottomInset }]}>
              <View style={styles.importDrawerHeader}>
                <TouchableOpacity activeOpacity={0.8} onPress={handleCloseImportDrawer}>
                  <Text size={13} color="#6b7280">{t('cancel')}</Text>
                </TouchableOpacity>
                <Text size={15} color="#111827" style={styles.importDrawerTitle}>{t('list_import')}</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => { void handleImportSelectedSongs() }}
                  disabled={importSelectedCount < 1 || importSubmitting}
                >
                  <Text size={13} color={(importSelectedCount < 1 || importSubmitting) ? '#9ca3af' : '#111827'} style={styles.importDrawerConfirm}>
                    {`${t('list_add_title_first_add')}${importSelectedCount > 0 ? `(${importSelectedCount})` : ''}`}
                  </Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={importCandidates}
                renderItem={renderImportCandidateItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.importDrawerContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={(
                  <View style={styles.emptyCard}>
                    <Text size={13} color="#6b7280">{importLoading ? t('list_loading') : t('me_no_songs')}</Text>
                  </View>
                )}
              />
            </View>
          </View>
        </Modal>
        <PromptDialog
          ref={renameListDialogRef}
          title={t('list_rename_title')}
          placeholder={t('list_create_input_placeholder')}
          confirmText={t('metadata_edit_modal_confirm')}
          cancelText={t('cancel')}
          bgHide={false}
          onConfirm={async(value) => handleRenameList(value)}
        />
        <PromptDialog
          ref={removeListDialogRef}
          title={t('list_remove_tip', { name: selectedListInfo.name })}
          confirmText={t('list_remove_tip_button')}
          cancelText={t('cancel')}
          showInput={false}
          bgHide={false}
          onConfirm={async() => handleRemoveSelectedList()}
        />
        <PromptDialog
          ref={removeSongDialogRef}
          title={t('list_remove_tip', { name: pendingDeleteSong?.name ?? '' })}
          confirmText={t('list_remove_tip_button')}
          cancelText={t('cancel')}
          showInput={false}
          bgHide={false}
          onCancel={handleCancelRemoveSong}
          onHide={handleCancelRemoveSong}
          onConfirm={async() => handleConfirmRemoveSong()}
        />
      </>
    )
  }

  const homeScene = (
    <View style={styles.container}>
      {isSourceMenuVisible
        ? <Animated.View style={[styles.sourceMenuPageBackdropWrap, styles.sourceMenuBackdrop, { opacity: sourceMenuBackdropOpacity }]}>
            <TouchableOpacity style={styles.sourceMenuPageBackdrop} activeOpacity={1} onPress={closeSourceMenu} />
          </Animated.View>
        : null}
      <View style={[styles.header, styles.headerFloating, { paddingTop: headerTopPadding }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.avatarButton} activeOpacity={0.82} onPress={() => { setNavActiveId('nav_setting') }}>
            <View style={styles.avatarBubble}>
              <View style={styles.avatarInner}>
                <Image style={styles.avatarImage} url={avatarUrl} />
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.searchDock}>
            <View style={styles.searchWrap}>
              {shouldUseSearchBlur
                ? <>
                    <BlurView
                      style={StyleSheet.absoluteFillObject}
                      blurType={Platform.OS === 'ios' ? 'chromeMaterialLight' : 'light'}
                      blurAmount={Platform.OS === 'ios' ? 34 : 24}
                      blurRadius={Platform.OS === 'android' ? 24 : undefined}
                      downsampleFactor={Platform.OS === 'android' ? 6 : undefined}
                      overlayColor={Platform.OS === 'android' ? 'rgba(255,255,255,0.16)' : 'transparent'}
                      reducedTransparencyFallbackColor="rgba(255,255,255,0.72)"
                    />
                    <View style={styles.searchGlassTint} pointerEvents="none" />
                  </>
                : <View style={styles.searchGlassFallback} pointerEvents="none" />}
              <View style={styles.searchGlassRim} pointerEvents="none" />
              <View style={styles.searchContent}>
                <Icon name="search-2" rawSize={17} color="#666d7b" />
                <TouchableOpacity style={styles.searchInputTrigger} activeOpacity={0.85} onPress={handleEnterSearchMode}>
                  <Text size={14} color={searchText ? '#232733' : '#9aa1ae'} numberOfLines={1} style={styles.searchInputText}>
                    {searchText || t('me_search_placeholder')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  activeOpacity={0.8}
                  onPress={handleClearSearchPreview}
                  disabled={!searchText.length}
                >
                  <X size={16} color={searchText.length ? '#666d7b' : '#bcc2cf'} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 2, paddingBottom: bottomDockHeight }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.greetingBlock}>
          <Text size={30} color="#16181f" style={styles.greetingTitle}>{t('me_my_playlists')}</Text>
        </View>

        <View style={styles.quickRow}>
          {featuredLibraryCards.map((card, index) => {
            const tone = getPlaylistCardTone(index)
            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.quickCard,
                  { backgroundColor: tone.surface },
                  index === featuredLibraryCards.length - 1 ? styles.quickCardLast : null,
                ]}
                activeOpacity={0.86}
                onPress={() => { handleOpenList(card.list) }}
              >
                <View style={styles.quickMedia}>
                  {card.cover
                    ? <Image style={styles.quickMediaImage} url={card.cover} />
                    : <View style={[styles.quickMediaImage, styles.listPicFallback, { backgroundColor: tone.surface }]}>
                        <MaterialCommunityIcon name={card.icon} size={24} color={tone.accent} />
                      </View>}
                </View>
                <View style={styles.quickInfo}>
                  <Text size={15} color="#1c1c1e" style={styles.quickTitle} numberOfLines={1}>{card.title}</Text>
                  <View style={styles.quickMetaRow}>
                    <MaterialCommunityIcon name={card.icon} size={12} color={tone.accent} />
                    <Text size={12} color="#8e8e93" style={styles.quickMeta}>{t('me_tracks_count', { num: card.count })}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size={18} color="#111827" style={styles.sectionTitle}>{t('me_my_playlists')}</Text>
            <View style={styles.sectionHeaderActions}>
              <View style={styles.displaySwitch}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.displaySwitchItem, !isPlaylistListMode ? styles.displaySwitchItemActive : null]}
                  onPress={() => { setPlaylistDisplayMode('grid') }}
                >
                  <MaterialCommunityIcon name="view-grid-outline" size={15} color={!isPlaylistListMode ? '#19171c' : '#8b818a'} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.displaySwitchItem, isPlaylistListMode ? styles.displaySwitchItemActive : null]}
                  onPress={() => { setPlaylistDisplayMode('list') }}
                >
                  <MaterialCommunityIcon name="format-list-bulleted" size={15} color={isPlaylistListMode ? '#19171c' : '#8b818a'} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.sectionIconBtn, isPlaylistTimeSort ? styles.sectionIconBtnActive : null]}
                onPress={handleTogglePlaylistSort}
              >
                <MaterialCommunityIcon name={playlistSortIcon} size={15} color={isPlaylistTimeSort ? '#111827' : '#6b7280'} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.sectionIconBtn}
                onPress={handleShowCreateListModal}
              >
                <MaterialCommunityIcon name="plus" size={16} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={isPlaylistListMode ? styles.listPanel : styles.listGrid}>
            {displayPlaylists.length
              ? displayPlaylists.map((item, index) => {
                const tone = getPlaylistCardTone(index + 2)
                return (
                  isPlaylistListMode
                    ? <TouchableOpacity key={item.id} style={[styles.listRowItem, index < displayPlaylists.length - 1 ? styles.listRowSpacing : null]} activeOpacity={0.84} onPress={() => { handleOpenList(item) }}>
                          <View style={styles.listRowCoverWrap}>
                            {playlistMetaMap[item.id]?.pic
                              ? <Image style={styles.listRowCover} url={playlistMetaMap[item.id]?.pic ?? null} />
                              : <View style={[styles.listRowCover, styles.listPicFallback, { backgroundColor: tone.surface }]}>
                                  <MaterialCommunityIcon name="music-note-eighth" size={20} color={tone.accent} />
                                </View>}
                          </View>
                          <View style={styles.listRowInfo}>
                            <Text size={15} color="#171a22" style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
                            <Text size={12} color="#7d8190" style={styles.listRowSubtitle}>{t('me_songs_count', { num: playlistMetaMap[item.id]?.count ?? 0 })}</Text>
                          </View>
                          <View style={styles.listRowAction}>
                            <Icon name="chevron-right" rawSize={14} color="#aab0bd" />
                          </View>
                        </TouchableOpacity>
                    : <TouchableOpacity key={item.id} style={styles.listItem} activeOpacity={0.84} onPress={() => { handleOpenList(item) }}>
                        <View style={styles.listPicWrap}>
                          {playlistMetaMap[item.id]?.pic
                            ? <Image style={styles.listPic} url={playlistMetaMap[item.id]?.pic ?? null} />
                            : <View style={[styles.listPic, styles.listPicFallback, { backgroundColor: tone.surface }]}>
                                <MaterialCommunityIcon name="music-note-eighth" size={24} color={tone.accent} />
                              </View>}
                        </View>
                        <View style={styles.listInfo}>
                          <Text size={14} color="#19171c" style={styles.listTitle} numberOfLines={2}>{item.name}</Text>
                          <Text size={11} color="#7a7179">{t('me_songs_count', { num: playlistMetaMap[item.id]?.count ?? 0 })}</Text>
                        </View>
                      </TouchableOpacity>
                )
              })
              : <View style={styles.emptyCard}>
                  <Text size={13} color="#7a7179">{t('me_my_playlists')}</Text>
                  <TouchableOpacity style={styles.emptyActionBtn} activeOpacity={0.85} onPress={handleShowCreateListModal}>
                    <Text size={13} color="#19171c" style={styles.emptyActionText}>{t('me_create_new')}</Text>
                  </TouchableOpacity>
                </View>}
          </View>
        </View>

        {SHOW_LISTENING_STATISTICS
          ? <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text size={18} color="#111827" style={styles.sectionTitle}>Listening Statistics</Text>
                <Text size={11} color="#111827" style={styles.sectionTag}>Last 7 Days</Text>
              </View>
              <View style={styles.statsCard}>
                {stats.map(item => (
                  <View key={item.day} style={styles.statsCol}>
                    <View style={styles.statsBarBg}>
                      <View style={[styles.statsBar, { height: item.height, opacity: item.active ? 1 : 0.45 }]} />
                    </View>
                    <Text size={10} color={item.active ? '#111827' : '#9ca3af'} style={item.active ? styles.dayActive : styles.day}>
                      {item.day}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          : null}
      </ScrollView>
      <PromptDialog
        ref={createListDialogRef}
        title={t('me_create_new')}
        placeholder={t('list_create_input_placeholder')}
        confirmText={t('metadata_edit_modal_confirm')}
        cancelText={t('cancel')}
        bgHide={false}
        onConfirm={async(value) => handleCreateList(value)}
      />
    </View>
  )
  const shouldRenderDetailScene = Boolean(selectedListInfo)

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
              {renderDetailScene()}
            </Animated.View>
          </>
        : null}
    </View>
  )
}

const styles = createStyle({
  sceneRoot: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  scene: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  sceneOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 4,
  },
  detailSceneShade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 3,
    backgroundColor: '#000000',
  },
  detailScene: {},
  container: {
    flex: 1,
    backgroundColor: '#eef0fb',
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
    backgroundColor: '#eef0fb',
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
    backgroundColor: '#eef0fb',
  },
  searchModeRoot: {
    flex: 1,
    backgroundColor: '#eef0fb',
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
    backgroundColor: '#ffffff',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
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
    backgroundColor: '#eef0fb',
  },
  detailBackBtn: {
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
  detailBackBtnInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3eef2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
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
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    color: '#232733',
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
    backgroundColor: 'rgba(17,24,39,0.04)',
  },
  sourceMenuSheet: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9d9de',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000000',
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
    borderTopColor: '#ececf0',
    paddingTop: 1,
  },
  sourcePanelItem: {
    height: SOURCE_MENU_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sourcePanelItemActive: {
    backgroundColor: '#f4f4f7',
  },
  sourcePanelItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececf0',
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
    borderColor: 'rgba(244,247,252,0.72)',
    backgroundColor: '#ffffff',
    shadowColor: '#76809b',
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
    backgroundColor: 'rgba(255,255,255,0.44)',
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
    borderColor: 'rgba(244,247,252,0.72)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#76809b',
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
  detailHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  detailHeroIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f4fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroDeleteBtn: {
    marginLeft: 8,
    backgroundColor: '#fee2e2',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displaySwitch: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: 'rgba(255,255,255,0.76)',
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  displaySwitchItem: {
    width: 34,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displaySwitchItemActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#687189',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  sectionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionIconBtnActive: {
    borderColor: '#dfe9bc',
    backgroundColor: '#eef3d7',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionTag: {
    fontWeight: '500',
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listPanel: {
    width: '100%',
  },
  statsCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    padding: 12,
    height: 184,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  statsBarBg: {
    width: '74%',
    flex: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: '#e5e7eb',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  statsBar: {
    width: '100%',
    backgroundColor: '#111827',
  },
  day: {
    marginTop: 8,
  },
  dayActive: {
    marginTop: 8,
    fontWeight: '700',
  },
  listItem: {
    width: '48.4%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.72)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#76809b',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  listPicWrap: {
    height: 126,
    backgroundColor: '#f2f5fb',
  },
  listPic: {
    width: '100%',
    height: '100%',
  },
  listPicFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  listRowItem: {
    width: '100%',
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.72)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#76809b',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  listRowSpacing: {
    marginBottom: 10,
  },
  listRowCoverWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f2f5fb',
  },
  listRowCover: {
    width: '100%',
    height: '100%',
  },
  listRowInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  listRowTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  listRowSubtitle: {
    fontWeight: '500',
  },
  listRowAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f7fb',
  },
  listTitle: {
    fontWeight: '700',
    marginBottom: 5,
  },
  songItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#76809b',
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
    backgroundColor: '#e5e7eb',
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
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    borderColor: '#d1d5db',
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
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  importDrawerPanel: {
    maxHeight: '72%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#ffffff',
    shadowColor: '#111827',
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
    borderColor: '#edf0f7',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#76809b',
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
  emptyCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.72)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#76809b',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionBtn: {
    marginTop: 12,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#d9ef62',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    fontWeight: '700',
  },
})
