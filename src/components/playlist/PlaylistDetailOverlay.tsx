import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  UIManager,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ListRenderItem,
} from 'react-native'

import MusicMultiAddModal, { type MusicMultiAddModalType } from '@/components/MusicMultiAddModal'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import Text from '@/components/common/Text'
import { APP_LAYER_INDEX, LIST_IDS } from '@/config/constant'
import { addListMusics, getListMusics, removeListMusics, removeUserList, setActiveList, setTempList, updateListMusicPosition, updateUserList } from '@/core/list'
import { playList, playListAsQueue } from '@/core/player/player'
import { getListDetailAll } from '@/core/songlist'
import { type OnlinePlaylistDetailPayload, type PlaylistDetailPayload } from '@/event/appEvent'
import { useI18n } from '@/lang'
import settingState from '@/store/setting/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { applyMusicCoverFallback, pickMusicCover } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'
import { getSourceTone } from '@/components/search/sourceTone'
import PlaylistDetailHeader from './PlaylistDetailHeader'
import PlaylistDetailSongItem from './PlaylistDetailSongItem'
import PlaylistImportPanel from './PlaylistImportPanel'
import PlaylistSongDragOverlay from './PlaylistSongDragOverlay'

const BOTTOM_DOCK_BASE_HEIGHT = 164
const DETAIL_TRANSITION_FORWARD_DURATION = 268
const DETAIL_TRANSITION_BACKWARD_DURATION = 220
const SONG_DRAG_ROW_GAP = 10
const SONG_DRAG_ROW_FALLBACK_HEIGHT = 72
const SONG_DRAG_AUTO_SCROLL_EDGE = 96
const SONG_DRAG_AUTO_SCROLL_SPEED = 16
const SONG_DRAG_LAYOUT_ANIMATION_MAX_ITEMS = 240

const playlistSnapshotCache = new Map<string, {
  songs: LX.Music.MusicInfo[]
  count: number
  pic: string | null
}>()

const getOnlinePlaylistDetailKey = (detail: OnlinePlaylistDetailPayload) => `online_songlist__${detail.source}__${detail.id}`

const pickCover = (list: LX.Music.MusicInfo[]) => {
  for (const song of list) {
    const cover = pickMusicCover(song)
    if (cover) return cover
  }
  return null
}

const cachePlaylistSnapshot = (id: string, list: LX.Music.MusicInfo[], picOverride?: string | null) => {
  const songs = [...list]
  const pic = picOverride ?? pickCover(songs)
  const cached = {
    songs,
    count: songs.length,
    pic,
  }
  playlistSnapshotCache.set(id, cached)
  return cached
}

const isUserListInfo = (listInfo: LX.List.MyListInfo | null): listInfo is LX.List.UserListInfo => {
  return Boolean(listInfo && 'locationUpdateTime' in listInfo)
}

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

export interface PlaylistDetailOverlayProps {
  detail: PlaylistDetailPayload
  onClose: () => void
}

interface ImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
}

export default function PlaylistDetailOverlay({ detail, onClose }: PlaylistDetailOverlayProps) {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const playlists = useMyList()
  const modalBottomInset = useMemo(() => {
    const screenHeight = Dimensions.get('screen').height
    const windowHeight = Dimensions.get('window').height
    const extraInset = Math.max(0, screenHeight - windowHeight)
    if (!extraInset) return 0
    if (Platform.OS == 'android') return Math.max(0, extraInset - statusBarHeight)
    return extraInset
  }, [statusBarHeight])
  const detailSceneWidth = Dimensions.get('window').width
  const detailSceneAnim = useRef(new Animated.Value(0)).current
  const detailTransitionTokenRef = useRef(0)
  const detailRequestIdRef = useRef(0)
  const importRequestIdRef = useRef(0)
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
  const musicMultiAddModalRef = useRef<MusicMultiAddModalType>(null)
  const renameListDialogRef = useRef<PromptDialogType>(null)
  const removeListDialogRef = useRef<PromptDialogType>(null)
  const removeSongDialogRef = useRef<PromptDialogType>(null)
  const [isDetailTransitioning, setDetailTransitioning] = useState(false)
  const [detailSongs, setDetailSongs] = useState<LX.Music.MusicInfo[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [isImportDrawerVisible, setImportDrawerVisible] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([])
  const [importSelectedMap, setImportSelectedMap] = useState<Record<string, true>>({})
  const [isSongDragActive, setSongDragActive] = useState(false)
  const [draggingSong, setDraggingSong] = useState<LX.Music.MusicInfo | null>(null)
  const [draggingSongKey, setDraggingSongKey] = useState<string | null>(null)
  const [pendingDeleteSong, setPendingDeleteSong] = useState<LX.Music.MusicInfo | null>(null)
  const selectedListId = detail.type == 'local' ? detail.listId : null
  const selectedOnlineDetail = detail.type == 'onlineSonglist' ? detail : null
  const selectedDetailCacheKey = selectedListId ?? (selectedOnlineDetail ? getOnlinePlaylistDetailKey(selectedOnlineDetail) : null)
  const selectedListInfo = selectedListId ? playlists.find(list => list.id === selectedListId) ?? null : null
  const selectedDetailSnapshot = selectedDetailCacheKey ? playlistSnapshotCache.get(selectedDetailCacheKey) ?? null : null
  const selectedListMeta = selectedListInfo ? selectedDetailSnapshot : null
  const canRenameSelectedList = isUserListInfo(selectedListInfo)
  const detailHeroName = selectedOnlineDetail?.name ?? selectedListInfo?.name ?? ''
  const detailHeroCover = selectedOnlineDetail?.img ?? selectedListMeta?.pic ?? selectedDetailSnapshot?.pic ?? null
  const detailHeroSongCount = selectedOnlineDetail
    ? selectedDetailSnapshot?.count ?? detailSongs.length
    : selectedListMeta?.count ?? selectedDetailSnapshot?.count ?? detailSongs.length
  const detailHeroMetaText = selectedOnlineDetail
    ? [selectedOnlineDetail.author, selectedOnlineDetail.play_count, t('me_songs_count', { num: detailHeroSongCount })].filter(Boolean).join(' · ')
    : t('me_songs_count', { num: detailHeroSongCount })
  const detailHeroSourceTone = selectedOnlineDetail ? getSourceTone(selectedOnlineDetail.source) : null
  const detailHeroSourceLabel = selectedOnlineDetail ? t(`source_real_${selectedOnlineDetail.source}`) : ''
  const detailSceneTranslateX = useMemo(() => detailSceneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [detailSceneWidth, 0],
  }), [detailSceneAnim, detailSceneWidth])
  const importSelectedCount = useMemo(() => Object.keys(importSelectedMap).length, [importSelectedMap])
  const areAllImportSongsSelected = useMemo(() => {
    return importCandidates.length > 0 && importCandidates.every(candidate => importSelectedMap[candidate.id])
  }, [importCandidates, importSelectedMap])

  const setKeepPlayBarVisible = (visible: boolean) => {
    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', visible)
  }

  const animateDetailScene = useCallback((toValue: 0 | 1, onFinish?: () => void) => {
    const token = ++detailTransitionTokenRef.current
    setDetailTransitioning(true)
    detailSceneAnim.stopAnimation()
    Animated.timing(detailSceneAnim, {
      toValue,
      duration: toValue ? DETAIL_TRANSITION_FORWARD_DURATION : DETAIL_TRANSITION_BACKWARD_DURATION,
      easing: toValue
        ? Easing.bezier(0.36, 0.66, 0.04, 1)
        : Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (token !== detailTransitionTokenRef.current) return
      if (finished) onFinish?.()
      setDetailTransitioning(false)
    })
  }, [detailSceneAnim])

  const loadLocalDetailSongs = useCallback(async(id: string, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    const list = await getListMusics(id)
    if (requestId !== detailRequestIdRef.current) return
    cachePlaylistSnapshot(id, list)
    setDetailSongs([...list])
    if (showLoading) setDetailLoading(false)
  }, [])

  const loadOnlineDetailSongs = useCallback(async(onlineDetail: OnlinePlaylistDetailPayload, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    const list = applyMusicCoverFallback(
      await getListDetailAll(onlineDetail.source, onlineDetail.id),
      onlineDetail.img ?? null,
    )
    if (requestId !== detailRequestIdRef.current) return
    cachePlaylistSnapshot(getOnlinePlaylistDetailKey(onlineDetail), list, onlineDetail.img ?? null)
    setDetailSongs([...list])
    if (showLoading) setDetailLoading(false)
  }, [])

  const getSongRowKey = useCallback((song: LX.Music.MusicInfo, fallbackIndex = 0) => {
    return `${song.source}_${song.id}_${fallbackIndex}`
  }, [])

  const measureDetailListWrap = useCallback(() => {
    detailListWrapRef.current?.measure((_x, _y, _width, height, _pageX, pageY) => {
      detailListPageYRef.current = pageY
      detailListHeightRef.current = height
    })
  }, [])

  const handleDetailWrapLayout = useCallback((_event: LayoutChangeEvent) => {
    measureDetailListWrap()
  }, [measureDetailListWrap])

  const handleDetailListScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    detailScrollOffsetRef.current = event.nativeEvent.contentOffset.y
    measureDetailListWrap()
  }, [measureDetailListWrap])

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
    let anim = songShiftAnimMapRef.current.get(songKey)
    if (!anim) {
      anim = new Animated.Value(0)
      songShiftAnimMapRef.current.set(songKey, anim)
      songShiftTargetMapRef.current.set(songKey, 0)
    }
    return anim
  }, [])

  const setSongShiftTarget = useCallback((songKey: string, value: number, immediate = false) => {
    const currentTarget = songShiftTargetMapRef.current.get(songKey) ?? 0
    if (currentTarget === value) return
    songShiftTargetMapRef.current.set(songKey, value)
    const anim = getSongShiftAnim(songKey)
    if (immediate) {
      anim.stopAnimation()
      anim.setValue(value)
      return
    }
    Animated.timing(anim, {
      toValue: value,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [getSongShiftAnim])

  const getDragShiftForIndex = useCallback((index: number, sourceIndex: number, targetIndex: number, rowOffset: number) => {
    if (targetIndex === sourceIndex) return 0
    if (index === sourceIndex) return 0
    if (targetIndex > sourceIndex) {
      return index > sourceIndex && index <= targetIndex ? -rowOffset : 0
    }
    return index >= targetIndex && index < sourceIndex ? rowOffset : 0
  }, [])

  const updateDragRowShifts = useCallback((sourceIndex: number, previousTarget: number, nextTarget: number, rowOffset: number) => {
    if (previousTarget === nextTarget) return
    detailSongsRef.current.forEach((song, index) => {
      const songKey = getSongRowKey(song, index)
      const shift = getDragShiftForIndex(index, sourceIndex, nextTarget, rowOffset)
      setSongShiftTarget(songKey, shift)
    })
  }, [getDragShiftForIndex, getSongRowKey, setSongShiftTarget])

  const resetDragRowShifts = useCallback((immediate = false) => {
    for (const songKey of songShiftAnimMapRef.current.keys()) {
      setSongShiftTarget(songKey, 0, immediate)
    }
  }, [setSongShiftTarget])

  const resetSongDragState = useCallback(() => {
    dragStateRef.current.active = false
    dragStateRef.current.listId = null
    dragStateRef.current.song = null
    dragStateRef.current.songKey = null
    dragStateRef.current.fromIndex = -1
    dragStateRef.current.toIndex = -1
    setSongDragActive(false)
    setDraggingSong(null)
    setDraggingSongKey(null)
    resetDragRowShifts(true)
    dragScale.stopAnimation()
    dragOpacity.stopAnimation()
    dragScale.setValue(1)
    dragOpacity.setValue(0)
    clearDragPressGuard(160)
  }, [clearDragPressGuard, dragOpacity, dragScale, resetDragRowShifts])

  const handleCloseDetail = useCallback(() => {
    detailRequestIdRef.current += 1
    resetSongDragState()
    setImportDrawerVisible(false)
    animateDetailScene(0, onClose)
  }, [animateDetailScene, onClose, resetSongDragState])

  const handleFinishSongDrag = useCallback(async() => {
    const state = dragStateRef.current
    if (!state.active || !state.listId || !state.song) {
      resetSongDragState()
      return
    }
    const fromIndex = state.fromIndex
    const toIndex = state.toIndex
    const targetSong = state.song
    const targetListId = state.listId
    state.active = false
    setSongDragActive(false)
    resetDragRowShifts()
    Animated.parallel([
      Animated.timing(dragScale, {
        toValue: 0.98,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dragOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDraggingSong(null)
      setDraggingSongKey(null)
      dragScale.setValue(1)
    })
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      clearDragPressGuard(160)
      return
    }
    const previousSongs = detailSongsRef.current
    const nextSongs = moveArrayItem(previousSongs, fromIndex, toIndex)
    if (nextSongs === previousSongs) return
    detailSongsRef.current = nextSongs
    setDetailSongs(nextSongs)
    if (nextSongs.length <= SONG_DRAG_LAYOUT_ANIMATION_MAX_ITEMS) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
    try {
      await updateListMusicPosition(targetListId, toIndex, [targetSong.id])
      cachePlaylistSnapshot(targetListId, nextSongs)
    } catch {
      void loadLocalDetailSongs(targetListId)
    } finally {
      clearDragPressGuard(160)
    }
  }, [clearDragPressGuard, dragOpacity, dragScale, loadLocalDetailSongs, resetDragRowShifts, resetSongDragState])

  const handleStartSongDrag = useCallback((item: LX.Music.MusicInfo, index: number, event: GestureResponderEvent) => {
    if (!selectedListId || isSongDragActive) return
    const rowHeight = songRowLayoutRef.current.get(getSongRowKey(item, index)) ?? SONG_DRAG_ROW_FALLBACK_HEIGHT
    const rowStep = rowHeight + SONG_DRAG_ROW_GAP
    const startScrollOffset = detailScrollOffsetRef.current
    const listPageY = detailListPageYRef.current
    const pressOffsetY = Math.max(0, event.nativeEvent.pageY - listPageY)
    const startVisualTop = pressOffsetY - Math.min(rowHeight / 2, 36)
    dragStateRef.current = {
      active: true,
      listId: selectedListId,
      song: item,
      songKey: getSongRowKey(item, index),
      fromIndex: index,
      toIndex: index,
      rowHeight,
      rowStep,
      startVisualTop,
      startScrollOffset,
      pressOffsetY,
    }
    skipNextSongPressRef.current = true
    clearDragPressGuard()
    setDraggingSong(item)
    setDraggingSongKey(getSongRowKey(item, index))
    setSongDragActive(true)
    dragTop.setValue(startVisualTop)
    dragScale.setValue(0.98)
    dragOpacity.setValue(0)
    Animated.parallel([
      Animated.timing(dragScale, {
        toValue: 1.02,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dragOpacity, {
        toValue: 1,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [clearDragPressGuard, dragOpacity, dragScale, dragTop, getSongRowKey, isSongDragActive, selectedListId])

  const handleShowRemoveSongModal = useCallback((song: LX.Music.MusicInfo) => {
    setPendingDeleteSong(song)
    removeSongDialogRef.current?.show('')
  }, [])

  const handleCancelRemoveSong = useCallback(() => {
    setPendingDeleteSong(null)
  }, [])

  const handleConfirmRemoveSong = useCallback(async() => {
    if (!selectedListId || !pendingDeleteSong) return false
    await removeListMusics(selectedListId, [String(pendingDeleteSong.id)])
    setPendingDeleteSong(null)
    await loadLocalDetailSongs(selectedListId)
    return true
  }, [loadLocalDetailSongs, pendingDeleteSong, selectedListId])

  const detailListPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => dragStateRef.current.active,
    onPanResponderMove: (_event, gestureState) => {
      const state = dragStateRef.current
      if (!state.active) return
      const listHeight = detailListHeightRef.current
      const contentHeight = detailListContentHeightRef.current
      const currentOffset = detailScrollOffsetRef.current
      let nextTop = state.startVisualTop + gestureState.dy
      const pointerY = state.pressOffsetY + gestureState.dy
      if (pointerY < SONG_DRAG_AUTO_SCROLL_EDGE && currentOffset > 0) {
        const nextOffset = Math.max(0, currentOffset - SONG_DRAG_AUTO_SCROLL_SPEED)
        detailListRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
        nextTop -= currentOffset - nextOffset
      } else if (pointerY > listHeight - SONG_DRAG_AUTO_SCROLL_EDGE && currentOffset + listHeight < contentHeight) {
        const nextOffset = Math.min(contentHeight - listHeight, currentOffset + SONG_DRAG_AUTO_SCROLL_SPEED)
        detailListRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
        nextTop += nextOffset - currentOffset
      }
      dragTop.setValue(nextTop)
      const rawTargetIndex = state.fromIndex + Math.round((nextTop - state.startVisualTop + detailScrollOffsetRef.current - state.startScrollOffset) / state.rowStep)
      const nextTargetIndex = clampIndex(rawTargetIndex, detailSongsRef.current.length - 1)
      if (nextTargetIndex === state.toIndex) return
      const previousTarget = state.toIndex
      state.toIndex = nextTargetIndex
      updateDragRowShifts(state.fromIndex, previousTarget, nextTargetIndex, state.rowStep)
    },
    onPanResponderRelease: () => {
      void handleFinishSongDrag()
    },
    onPanResponderTerminate: () => {
      void handleFinishSongDrag()
    },
  }), [dragTop, handleFinishSongDrag, updateDragRowShifts])

  const handleSongRowLayout = useCallback((song: LX.Music.MusicInfo, index: number, event: LayoutChangeEvent) => {
    songRowLayoutRef.current.set(getSongRowKey(song, index), event.nativeEvent.layout.height)
  }, [getSongRowKey])

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
    let latestList = applyMusicCoverFallback(detailSongsRef.current, detailHeroCover)
    if (!latestList.length) {
      latestList = applyMusicCoverFallback(
        await getListDetailAll(selectedOnlineDetail.source, selectedOnlineDetail.id),
        selectedOnlineDetail.img ?? null,
      )
    }
    if (!latestList.length) return
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await setTempList(getOnlinePlaylistDetailKey(selectedOnlineDetail), latestList)
    await playList(LIST_IDS.TEMP, targetIndex)
  }, [detailHeroCover, selectedOnlineDetail])

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
    handleCloseDetail()
    return true
  }, [handleCloseDetail, selectedListInfo])

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

  const handleToggleSelectAllImportSongs = useCallback(() => {
    if (!importCandidates.length) return
    setImportSelectedMap(() => {
      if (areAllImportSongsSelected) return {}
      const next: Record<string, true> = {}
      for (const candidate of importCandidates) next[candidate.id] = true
      return next
    })
  }, [areAllImportSongsSelected, importCandidates])

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
    } finally {
      setImportSubmitting(false)
    }
  }, [importCandidates, importSelectedMap, importSubmitting, loadLocalDetailSongs, selectedListId])

  const renderSongItem: ListRenderItem<LX.Music.MusicInfo> = useCallback(({ item, index }) => {
    const songKey = getSongRowKey(item, index)
    const isDraggingRow = draggingSongKey == songKey && dragStateRef.current.active
    const shiftAnim = getSongShiftAnim(songKey)
    const sourceTagColor = getSourceTone(item.source)
    const canEditSongs = Boolean(selectedListId)
    return (
      <PlaylistDetailSongItem
        song={item}
        sourceTone={sourceTagColor}
        shiftAnim={shiftAnim}
        fallbackCover={detailHeroCover}
        isGhost={isDraggingRow}
        canEdit={canEditSongs}
        onLayout={(event) => { handleSongRowLayout(item, index, event) }}
        onLongPress={canEditSongs ? (event) => { handleStartSongDrag(item, index, event) } : undefined}
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
  }, [clearDragPressGuard, detailHeroCover, draggingSongKey, getSongRowKey, getSongShiftAnim, handleFinishSongDrag, handlePlayOnlineDetailSong, handlePlaySong, handleShowRemoveSongModal, handleSongRowLayout, handleStartSongDrag, selectedListId])

  const detailHeader = useMemo(() => {
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
  }, [canRenameSelectedList, detailHeroCover, detailHeroMetaText, detailHeroName, detailHeroSourceLabel, detailHeroSourceTone, detailLoading, detailSongs.length, handleCloseDetail, handleOpenImportDrawer, handleShowPlaylistTransferModal, handleShowRemoveListModal, handleShowRenameListModal, selectedListId, selectedOnlineDetail, statusBarHeight, t])

  useEffect(() => {
    detailSongsRef.current = detailSongs
  }, [detailSongs])

  useEffect(() => {
    if (Platform.OS != 'android') return
    if (!UIManager.setLayoutAnimationEnabledExperimental) return
    UIManager.setLayoutAnimationEnabledExperimental(true)
  }, [])

  useEffect(() => {
    setKeepPlayBarVisible(false)
    detailSceneAnim.setValue(0)
    animateDetailScene(1)
    return () => {
      setKeepPlayBarVisible(false)
    }
  }, [animateDetailScene, detailSceneAnim, selectedDetailCacheKey])

  useEffect(() => {
    resetSongDragState()
    setPendingDeleteSong(null)
    setImportDrawerVisible(false)
    setImportLoading(false)
    setImportSubmitting(false)
    setImportCandidates([])
    setImportSelectedMap({})
    if (selectedListId) {
      const cached = playlistSnapshotCache.get(selectedListId)
      setDetailSongs(cached ? [...cached.songs] : [])
      setDetailLoading(!cached)
      void loadLocalDetailSongs(selectedListId, !cached)
      return
    }
    if (selectedOnlineDetail) {
      const cached = playlistSnapshotCache.get(getOnlinePlaylistDetailKey(selectedOnlineDetail))
      setDetailSongs(cached ? [...cached.songs] : [])
      setDetailLoading(!cached)
      void loadOnlineDetailSongs(selectedOnlineDetail, !cached)
    }
  }, [loadLocalDetailSongs, loadOnlineDetailSongs, resetSongDragState, selectedListId, selectedOnlineDetail])

  useEffect(() => {
    if (!selectedListId) return
    if (playlists.some(list => list.id === selectedListId)) return
    handleCloseDetail()
  }, [handleCloseDetail, playlists, selectedListId])

  useEffect(() => {
    const handleClosePlaylistDetail = () => {
      handleCloseDetail()
    }
    global.app_event.on('closePlaylistDetail', handleClosePlaylistDetail)
    return () => {
      global.app_event.off('closePlaylistDetail', handleClosePlaylistDetail)
    }
  }, [handleCloseDetail])

  useEffect(() => {
    const handleMusicUpdate = (ids: string[]) => {
      if (!selectedListId || !ids.includes(selectedListId)) return
      void loadLocalDetailSongs(selectedListId)
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [loadLocalDetailSongs, selectedListId])

  useEffect(() => {
    measureDetailListWrap()
  }, [measureDetailListWrap, selectedDetailCacheKey])

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

  useBackHandler(useCallback(() => {
    if (isImportDrawerVisible) {
      handleCloseImportDrawer()
      return true
    }
    handleCloseDetail()
    return true
  }, [handleCloseDetail, handleCloseImportDrawer, isImportDrawerVisible]))

  const draggingSourceTagColor = draggingSong ? getSourceTone(draggingSong.source) : null

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View
        renderToHardwareTextureAndroid={isDetailTransitioning}
        shouldRasterizeIOS={isDetailTransitioning}
        style={[
          styles.scene,
          {
            transform: [{ translateX: detailSceneTranslateX }],
          },
        ]}
      >
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
            contentContainerStyle={[styles.detailContent, { paddingBottom: BOTTOM_DOCK_BASE_HEIGHT }]}
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
          {draggingSong && draggingSourceTagColor
            ? <PlaylistSongDragOverlay
                song={draggingSong}
                sourceTone={draggingSourceTagColor}
                top={dragTop}
                scale={dragScale}
                opacity={dragOpacity}
                fallbackCover={detailHeroCover}
              />
            : null}
        </View>
        {selectedListId
          ? <PlaylistImportPanel
              visible={isImportDrawerVisible}
              loading={importLoading}
              submitting={importSubmitting}
              bottomInset={modalBottomInset}
              targetListName={selectedListInfo?.name}
              items={importCandidates}
              selectedMap={importSelectedMap}
              allSelected={areAllImportSongsSelected}
              cancelText={t('cancel')}
              title={t('list_import')}
              selectAllText={t('list_select_all')}
              clearSelectionText={t('list_select_cancel')}
              loadingText={t('list_loading')}
              emptyText={t('me_no_songs')}
              countText={t('me_songs_count', { num: importCandidates.length })}
              confirmText={`${t('list_add_title_first_add')}${importSelectedCount > 0 ? `(${importSelectedCount})` : ''}`}
              onClose={handleCloseImportDrawer}
              onSubmit={() => { void handleImportSelectedSongs() }}
              onToggleSelectAll={handleToggleSelectAllImportSongs}
              onToggleItem={handleToggleImportSong}
              getSourceTone={getSourceTone}
            />
          : null}
        {selectedListId
          ? <>
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
                title={t('list_remove_tip', { name: selectedListInfo?.name ?? '' })}
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
          : null}
      </Animated.View>
      <MusicMultiAddModal ref={musicMultiAddModalRef} />
    </View>
  )
}

const styles = createStyle({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scene: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 4,
    elevation: APP_LAYER_INDEX.controls + 4,
    backgroundColor: '#eef0fb',
  },
  container: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  detailContent: {
    paddingBottom: 0,
    paddingHorizontal: 18,
  },
  detailListWrap: {
    flex: 1,
    position: 'relative',
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
})
