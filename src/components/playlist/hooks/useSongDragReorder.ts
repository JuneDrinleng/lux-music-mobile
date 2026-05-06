import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  type FlatList,
  LayoutAnimation,
  PanResponder,
  Platform,
  UIManager,
  type View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'

import { updateListMusicPosition } from '@/core/list'
import { cachePlaylistSnapshot } from './usePlaylistDetailData'

export const SONG_DRAG_ROW_GAP = 2
export const SONG_DRAG_ROW_FALLBACK_HEIGHT = 64
export const SONG_DRAG_AUTO_SCROLL_EDGE = 96
export const SONG_DRAG_AUTO_SCROLL_SPEED = 16
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

interface UseSongDragReorderParams {
  detailSongsRef: React.MutableRefObject<LX.Music.MusicInfo[]>
  setDetailSongs: React.Dispatch<React.SetStateAction<LX.Music.MusicInfo[]>>
  selectedListId: string | null
  loadLocalDetailSongs: (id: string, showLoading?: boolean) => Promise<void>
}

export type UseSongDragReorderResult = ReturnType<typeof useSongDragReorder>

export const useSongDragReorder = ({
  detailSongsRef,
  setDetailSongs,
  selectedListId,
  loadLocalDetailSongs,
}: UseSongDragReorderParams) => {
  const detailListRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const detailListWrapRef = useRef<View>(null)
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
  const [isSongDragActive, setSongDragActive] = useState(false)
  const [draggingSong, setDraggingSong] = useState<LX.Music.MusicInfo | null>(null)
  const [draggingSongKey, setDraggingSongKey] = useState<string | null>(null)

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
    Animated.spring(anim, {
      toValue: value,
      useNativeDriver: true,
      speed: 22,
      bounciness: 8,
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
    if (sourceIndex < 0) return
    const maxIndex = detailSongsRef.current.length - 1
    if (maxIndex < 0) return
    const rangeFrom = Math.max(0, Math.min(sourceIndex, previousTarget, nextTarget))
    const rangeTo = Math.min(maxIndex, Math.max(sourceIndex, previousTarget, nextTarget))
    for (let i = rangeFrom; i <= rangeTo; i++) {
      const song = detailSongsRef.current[i]
      if (!song) continue
      const songKey = getSongRowKey(song, i)
      const shift = getDragShiftForIndex(i, sourceIndex, nextTarget, rowOffset)
      setSongShiftTarget(songKey, shift)
    }
  }, [getDragShiftForIndex, getSongRowKey, setSongShiftTarget, detailSongsRef])

  const resetDragRowShifts = useCallback((immediate = false) => {
    for (const [songKey, value] of songShiftTargetMapRef.current) {
      if (!value) continue
      setSongShiftTarget(songKey, 0, immediate)
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

  const handleFinishSongDrag = useCallback(async() => {
    if (!dragStateRef.current.active) return
    const { listId, song, fromIndex, toIndex } = dragStateRef.current
    dragStateRef.current.active = false
    setSongDragActive(false)
    resetDragRowShifts(true)
    if (fromIndex !== toIndex && detailSongsRef.current.length <= SONG_DRAG_LAYOUT_ANIMATION_MAX_ITEMS) {
      LayoutAnimation.configureNext({
        duration: 120,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      })
    }
    if (fromIndex !== toIndex) {
      const previousSongs = detailSongsRef.current
      const nextSongs = moveArrayItem(previousSongs, fromIndex, toIndex)
      detailSongsRef.current = nextSongs
      setDetailSongs(nextSongs)
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
    if (!listId || !song || fromIndex === toIndex) return
    try {
      await updateListMusicPosition(listId, toIndex, [song.id])
      cachePlaylistSnapshot(listId, detailSongsRef.current)
    } catch {
      void loadLocalDetailSongs(listId)
    }
  }, [clearDragPressGuard, dragOpacity, dragScale, loadLocalDetailSongs, resetDragRowShifts, setDetailSongs, detailSongsRef])

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
  }, [dragOpacity, dragScale, dragTop, getSongRowKey, resetDragRowShifts, selectedListId, detailSongsRef])

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
        if (nextOffset !== detailScrollOffsetRef.current) {
          detailScrollOffsetRef.current = nextOffset
          detailListRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
        }
      } else if (pointerY > detailListHeightRef.current - SONG_DRAG_AUTO_SCROLL_EDGE) {
        const nextOffset = Math.min(maxScrollOffset, detailScrollOffsetRef.current + SONG_DRAG_AUTO_SCROLL_SPEED)
        if (nextOffset !== detailScrollOffsetRef.current) {
          detailScrollOffsetRef.current = nextOffset
          detailListRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
        }
      }
      const contentDelta =
        (visibleTop - dragStateRef.current.startVisualTop) +
        (detailScrollOffsetRef.current - dragStateRef.current.startScrollOffset)
      const roughIndex = dragStateRef.current.fromIndex + Math.round(contentDelta / dragStateRef.current.rowStep)
      const targetIndex = clampIndex(roughIndex, Math.max(detailSongsRef.current.length - 1, 0))
      if (targetIndex === dragStateRef.current.toIndex) return
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
    songRowLayoutRef.current.set(getSongRowKey(song, index), event.nativeEvent.layout.height)
  }, [getSongRowKey])

  useEffect(() => {
    if (Platform.OS != 'android') return
    if (!UIManager.setLayoutAnimationEnabledExperimental) return
    UIManager.setLayoutAnimationEnabledExperimental(true)
  }, [])

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

  return {
    detailListRef,
    detailListWrapRef,
    isSongDragActive,
    draggingSong,
    draggingSongKey,
    dragTop,
    dragScale,
    dragOpacity,
    dragStateRef,
    skipNextSongPressRef,
    detailListPanResponder,
    getSongRowKey,
    getSongShiftAnim,
    clearDragPressGuard,
    resetSongDragState,
    handleFinishSongDrag,
    handleStartSongDrag,
    handleSongRowLayout,
    handleDetailWrapLayout,
    handleDetailListScroll,
    handleDetailListContentSizeChange,
    measureDetailListWrap,
  }
}
