import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ScrollView,
  type View,
} from 'react-native'

import { updateUserListPosition } from '@/core/list'
import { updateSetting } from '@/core/common'
import {
  clampNumber,
  fallbackPlaylistLayout,
  findNearestSlotIndex,
  type PlaylistDragLayoutBox,
  shiftBetweenSlots,
} from '@/components/playlist/playlistDragMath'
import { type PlaylistCardShiftAnims, type PlaylistDragController } from '@/components/playlist/PlaylistLibraryCard'

const LONG_PRESS_MS = 300
const MOVE_SLOP = 8
const EDGE_PX = 72
const MIN_SCROLL_SPEED = 0.28
const MAX_SCROLL_SPEED = 1.05
const SHIFT_MS = 160
const SETTLE_MS = 180
const LIFT_SCALE = 1.045

interface UsePlaylistCardDragParams {
  displayPlaylists: LX.List.UserListInfo[]
  playlistDisplayMode: 'grid' | 'list'
  playlistSortMode: string
  autoScrollTopInset: number
  autoScrollBottomInset: number
  setPendingPlaylistOrder: (order: string[] | null) => void
}

const readPagePoint = (event: GestureResponderEvent) => {
  const nativeEvent = event.nativeEvent
  if (Number.isFinite(nativeEvent.pageX) && Number.isFinite(nativeEvent.pageY)) {
    return { pageX: nativeEvent.pageX, pageY: nativeEvent.pageY }
  }
  const touch = (nativeEvent as { touches?: Array<{ pageX: number, pageY: number }> }).touches?.[0]
  return {
    pageX: touch?.pageX ?? 0,
    pageY: touch?.pageY ?? 0,
  }
}

const moveArrayItem = <T,>(list: T[], from: number, to: number) => {
  if (from === to) return list
  const next = [...list]
  const [target] = next.splice(from, 1)
  next.splice(to, 0, target)
  return next
}

export const usePlaylistCardDrag = ({
  displayPlaylists,
  playlistDisplayMode,
  playlistSortMode,
  autoScrollTopInset,
  autoScrollBottomInset,
  setPendingPlaylistOrder,
}: UsePlaylistCardDragParams) => {
  const playlistScrollRef = useRef<ScrollView>(null)
  const playlistSectionRef = useRef<View>(null)
  const playlistSectionWidthRef = useRef(0)
  const playlistScrollOffsetRef = useRef(0)
  const playlistContentHeightRef = useRef(0)
  const viewportHeightRef = useRef(0)
  const viewportPageYRef = useRef(0)
  const layoutMapRef = useRef(new Map<string, PlaylistDragLayoutBox>())
  const shiftAnimMapRef = useRef(new Map<string, PlaylistCardShiftAnims>())
  const shiftTargetRef = useRef(new Map<string, { x: number, y: number }>())
  const displayPlaylistsRef = useRef(displayPlaylists)
  const playlistDisplayModeRef = useRef(playlistDisplayMode)
  const playlistSortModeRef = useRef(playlistSortMode)
  const autoScrollTopInsetRef = useRef(autoScrollTopInset)
  const autoScrollBottomInsetRef = useRef(autoScrollBottomInset)
  const setPendingPlaylistOrderRef = useRef(setPendingPlaylistOrder)
  displayPlaylistsRef.current = displayPlaylists
  playlistDisplayModeRef.current = playlistDisplayMode
  playlistSortModeRef.current = playlistSortMode
  autoScrollTopInsetRef.current = autoScrollTopInset
  autoScrollBottomInsetRef.current = autoScrollBottomInset
  setPendingPlaylistOrderRef.current = setPendingPlaylistOrder
  const gestureTokenRef = useRef(0)
  const [isPlaylistDragActive, setPlaylistDragActive] = useState(false)
  const [draggingPlaylistId, setDraggingPlaylistId] = useState<string | null>(null)
  const dragRef = useRef({
    active: false,
    settling: false,
    pressLive: false,
    moved: false,
    fromIndex: -1,
    toIndex: -1,
    playlistId: null as string | null,
    pressPlaylistId: null as string | null,
    snapshotKey: '',
    startPageX: 0,
    startPageY: 0,
    startScrollOffset: 0,
    pressScrollOffset: 0,
    pointerPageX: 0,
    pointerPageY: 0,
    translateX: 0,
    translateY: 0,
    layouts: [] as PlaylistDragLayoutBox[],
    autoScrollDir: 0,
    autoScrollSpeed: 0,
    lastTs: 0,
    raf: 0,
    pressTimer: null as ReturnType<typeof setTimeout> | null,
    safetyTimer: null as ReturnType<typeof setTimeout> | null,
  })

  const getShiftAnims = useCallback((playlistId: string) => {
    let anims = shiftAnimMapRef.current.get(playlistId)
    if (!anims) {
      anims = {
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        scale: new Animated.Value(1),
      }
      shiftAnimMapRef.current.set(playlistId, anims)
      shiftTargetRef.current.set(playlistId, { x: 0, y: 0 })
    }
    return anims
  }, [])

  for (const list of displayPlaylists) getShiftAnims(list.id)

  const clearPressTimer = useCallback(() => {
    if (!dragRef.current.pressTimer) return
    clearTimeout(dragRef.current.pressTimer)
    dragRef.current.pressTimer = null
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (dragRef.current.raf) cancelAnimationFrame(dragRef.current.raf)
    dragRef.current.raf = 0
    dragRef.current.autoScrollDir = 0
    dragRef.current.autoScrollSpeed = 0
    dragRef.current.lastTs = 0
  }, [])

  const setScrollEnabled = useCallback((enabled: boolean) => {
    playlistScrollRef.current?.setNativeProps({ scrollEnabled: enabled })
  }, [])

  const measureScrollViewport = useCallback(() => {
    const node = playlistScrollRef.current as unknown as {
      measure?: (
        callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void,
      ) => void
    } | null
    node?.measure?.((_x, _y, _width, height, _pageX, pageY) => {
      if (height > 0) viewportHeightRef.current = height
      viewportPageYRef.current = pageY
    })
  }, [])

  const zeroShiftAnims = useCallback(() => {
    for (const [playlistId, anims] of shiftAnimMapRef.current) {
      anims.x.stopAnimation()
      anims.y.stopAnimation()
      anims.scale.stopAnimation()
      anims.x.setValue(0)
      anims.y.setValue(0)
      anims.scale.setValue(1)
      shiftTargetRef.current.set(playlistId, { x: 0, y: 0 })
    }
  }, [])

  const applyFingerTransform = useCallback(() => {
    const state = dragRef.current
    if (!state.playlistId) return
    const scrollDelta = playlistScrollOffsetRef.current - state.startScrollOffset
    state.translateX = state.pointerPageX - state.startPageX
    state.translateY = (state.pointerPageY - state.startPageY) + scrollDelta
    const anims = getShiftAnims(state.playlistId)
    anims.x.setValue(state.translateX)
    anims.y.setValue(state.translateY)
  }, [getShiftAnims])

  const animateShift = useCallback((playlistId: string, x: number, y: number) => {
    const previous = shiftTargetRef.current.get(playlistId)
    if (previous && previous.x === x && previous.y === y) return
    shiftTargetRef.current.set(playlistId, { x, y })
    const anims = getShiftAnims(playlistId)
    const animation = {
      duration: SHIFT_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }
    Animated.timing(anims.x, { ...animation, toValue: x }).start()
    Animated.timing(anims.y, { ...animation, toValue: y }).start()
  }, [getShiftAnims])

  const applyShifts = useCallback((sourceIndex: number, targetIndex: number) => {
    const state = dragRef.current
    const lists = displayPlaylistsRef.current
    lists.forEach((list, index) => {
      if (list.id === state.playlistId) return
      const shift = shiftBetweenSlots(state.layouts, index, sourceIndex, targetIndex)
      animateShift(list.id, shift.x, shift.y)
    })
  }, [animateShift])

  const updateTargetFromFinger = useCallback(() => {
    const state = dragRef.current
    const origin = state.layouts[state.fromIndex]
    if (!origin) return
    const centerX = origin.x + state.translateX + origin.width / 2
    const centerY = origin.y + state.translateY + origin.height / 2
    const nextIndex = findNearestSlotIndex(state.layouts, centerX, centerY, state.toIndex)
    const maxIndex = Math.max(displayPlaylistsRef.current.length - 1, 0)
    const targetIndex = clampNumber(nextIndex, 0, maxIndex)
    if (targetIndex === state.toIndex) return
    state.toIndex = targetIndex
    applyShifts(state.fromIndex, targetIndex)
  }, [applyShifts])

  const updateAutoScrollIntent = useCallback(() => {
    const state = dragRef.current
    const height = viewportHeightRef.current
    if (height <= 0) {
      state.autoScrollDir = 0
      state.autoScrollSpeed = 0
      return
    }
    const localY = state.pointerPageY - viewportPageYRef.current
    const visibleTop = autoScrollTopInsetRef.current
    const visibleBottom = height - autoScrollBottomInsetRef.current
    let depth = 0
    if (visibleBottom - visibleTop <= EDGE_PX * 2) {
      state.autoScrollDir = 0
      state.autoScrollSpeed = 0
      state.lastTs = 0
      return
    }
    if (localY < visibleTop + EDGE_PX) {
      state.autoScrollDir = -1
      depth = clampNumber((visibleTop + EDGE_PX - localY) / EDGE_PX, 0, 1)
    } else if (localY > visibleBottom - EDGE_PX) {
      state.autoScrollDir = 1
      depth = clampNumber((localY - (visibleBottom - EDGE_PX)) / EDGE_PX, 0, 1)
    } else {
      state.autoScrollDir = 0
      state.autoScrollSpeed = 0
      state.lastTs = 0
      return
    }
    state.autoScrollSpeed = MIN_SCROLL_SPEED + (MAX_SCROLL_SPEED - MIN_SCROLL_SPEED) * depth
  }, [])

  const autoScrollTick = useCallback((timestamp: number) => {
    const state = dragRef.current
    if (!state.active) return
    if (state.autoScrollDir !== 0 && state.autoScrollSpeed > 0) {
      const dt = state.lastTs ? Math.min(34, timestamp - state.lastTs) : 16
      state.lastTs = timestamp
      const maxScroll = Math.max(0, playlistContentHeightRef.current - viewportHeightRef.current)
      const current = playlistScrollOffsetRef.current
      const next = clampNumber(current + state.autoScrollDir * state.autoScrollSpeed * dt, 0, maxScroll)
      if (next !== current) {
        playlistScrollOffsetRef.current = next
        playlistScrollRef.current?.scrollTo({ y: next, animated: false })
        applyFingerTransform()
        updateTargetFromFinger()
      }
    } else {
      state.lastTs = 0
    }
    state.raf = requestAnimationFrame(autoScrollTick)
  }, [applyFingerTransform, updateTargetFromFinger])

  const startAutoScroll = useCallback(() => {
    if (dragRef.current.raf) return
    dragRef.current.raf = requestAnimationFrame(autoScrollTick)
  }, [autoScrollTick])

  const releaseDragVisuals = useCallback(() => {
    setPlaylistDragActive(false)
    setDraggingPlaylistId(null)
    setScrollEnabled(true)
  }, [setScrollEnabled])

  const finishDrag = useCallback(() => {
    const state = dragRef.current
    if (!state.active || state.settling) return
    const token = ++gestureTokenRef.current
    const fromIndex = state.fromIndex
    const toIndex = state.toIndex
    const playlistId = state.playlistId
    const layouts = state.layouts
    state.active = false
    state.settling = true
    state.pressLive = false
    stopAutoScroll()
    clearPressTimer()
    const anims = playlistId ? getShiftAnims(playlistId) : null
    const target = anims && fromIndex >= 0
      ? shiftBetweenSlots(layouts, fromIndex, fromIndex, toIndex)
      : { x: 0, y: 0 }
    let pendingAxes = anims ? 2 : 0
    let committed = false
    const commit = () => {
      if (committed || token !== gestureTokenRef.current) return
      committed = true
      if (state.safetyTimer) {
        clearTimeout(state.safetyTimer)
        state.safetyTimer = null
      }
      state.settling = false
      const lists = displayPlaylistsRef.current
      if (fromIndex !== toIndex && lists[fromIndex] && lists[fromIndex].id === playlistId) {
        const reordered = moveArrayItem(lists, fromIndex, toIndex)
        if (reordered !== lists) {
          const newOrder = reordered.map(list => list.id)
          setPendingPlaylistOrderRef.current(newOrder)
          const movedId = lists[fromIndex].id
          void updateUserListPosition(toIndex, [movedId]).then(() => {
            updateSetting({ 'list.playlistCustomOrder': JSON.stringify(newOrder) })
          }).catch(() => {
            updateSetting({ 'list.playlistCustomOrder': JSON.stringify(newOrder) })
          })
        }
      }
      // Drop the animated transforms in the same commit as the new order.
      // Values are zeroed after paint, once nothing is bound to them.
      releaseDragVisuals()
    }
    const axisDone = () => {
      pendingAxes -= 1
      if (pendingAxes <= 0) commit()
    }
    if (!anims) {
      commit()
      return
    }
    const settle = {
      duration: SETTLE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }
    shiftTargetRef.current.set(playlistId!, { x: target.x, y: target.y })
    Animated.timing(anims.x, { ...settle, toValue: target.x }).start(({ finished }) => {
      if (finished) axisDone()
    })
    Animated.timing(anims.y, { ...settle, toValue: target.y }).start(({ finished }) => {
      if (finished) axisDone()
    })
    Animated.timing(anims.scale, { ...settle, toValue: 1 }).start()
    state.safetyTimer = setTimeout(commit, SETTLE_MS + 90)
  }, [clearPressTimer, getShiftAnims, releaseDragVisuals, stopAutoScroll])

  const abortDrag = useCallback(() => {
    const state = dragRef.current
    gestureTokenRef.current += 1
    state.active = false
    state.settling = false
    state.pressLive = false
    state.moved = true
    stopAutoScroll()
    clearPressTimer()
    if (state.safetyTimer) {
      clearTimeout(state.safetyTimer)
      state.safetyTimer = null
    }
    zeroShiftAnims()
    releaseDragVisuals()
  }, [clearPressTimer, releaseDragVisuals, stopAutoScroll, zeroShiftAnims])

  const beginDrag = useCallback((item: LX.List.UserListInfo, index: number) => {
    const state = dragRef.current
    if (!state.pressLive || state.active || state.settling) return
    const lists = displayPlaylistsRef.current
    if (lists.length < 2) return
    const resolvedIndex = lists[index]?.id === item.id ? index : lists.findIndex(list => list.id === item.id)
    if (resolvedIndex < 0) return
    const isListMode = playlistDisplayModeRef.current === 'list'
    const sectionWidth = playlistSectionWidthRef.current || Dimensions.get('window').width - 36
    const layouts = lists.map((list, layoutIndex) => {
      return layoutMapRef.current.get(list.id) ?? fallbackPlaylistLayout(layoutIndex, isListMode, sectionWidth)
    })
    if (layouts.some(layout => layout.width <= 0 || layout.height <= 0)) return
    if (playlistSortModeRef.current !== 'custom') {
      updateSetting({
        'list.playlistSortMode': 'custom',
        'list.playlistCustomOrder': JSON.stringify(lists.map(list => list.id)),
      })
    }
    const anims = getShiftAnims(item.id)
    anims.x.stopAnimation()
    anims.y.stopAnimation()
    anims.scale.stopAnimation()
    anims.x.setValue(0)
    anims.y.setValue(0)
    anims.scale.setValue(1)
    state.active = true
    state.fromIndex = resolvedIndex
    state.toIndex = resolvedIndex
    state.playlistId = item.id
    state.snapshotKey = lists.map(list => list.id).join('|')
    state.startScrollOffset = playlistScrollOffsetRef.current
    state.layouts = layouts
    state.translateX = 0
    state.translateY = 0
    state.autoScrollDir = 0
    state.lastTs = 0
    setDraggingPlaylistId(item.id)
    setPlaylistDragActive(true)
    setScrollEnabled(false)
    playlistScrollRef.current?.scrollTo({ y: playlistScrollOffsetRef.current, animated: false })
    measureScrollViewport()
    startAutoScroll()
  }, [getShiftAnims, measureScrollViewport, setScrollEnabled, startAutoScroll])

  const onGrant = useCallback((item: LX.List.UserListInfo, index: number, event: GestureResponderEvent) => {
    const state = dragRef.current
    if (state.active || state.settling || displayPlaylistsRef.current.length < 2) return false
    if (state.pressLive && state.pressPlaylistId !== item.id) return false
    clearPressTimer()
    const point = readPagePoint(event)
    state.pressLive = true
    state.moved = false
    state.pressPlaylistId = item.id
    state.startPageX = point.pageX
    state.startPageY = point.pageY
    state.pointerPageX = point.pageX
    state.pointerPageY = point.pageY
    state.pressScrollOffset = playlistScrollOffsetRef.current
    state.pressTimer = setTimeout(() => {
      state.pressTimer = null
      state.moved = true
      beginDrag(item, index)
    }, LONG_PRESS_MS)
    return true
  }, [beginDrag, clearPressTimer])

  const onMove = useCallback((event: GestureResponderEvent) => {
    const state = dragRef.current
    const point = readPagePoint(event)
    const pageX = point.pageX
    const pageY = point.pageY
    if (!state.active) {
      if (!state.pressLive) return
      const dx = pageX - state.startPageX
      const dy = pageY - state.startPageY
      if (dx * dx + dy * dy > MOVE_SLOP * MOVE_SLOP) {
        state.moved = true
        state.pressLive = false
        clearPressTimer()
      }
      return
    }
    state.pointerPageX = pageX
    state.pointerPageY = pageY
    updateAutoScrollIntent()
    applyFingerTransform()
    updateTargetFromFinger()
  }, [applyFingerTransform, clearPressTimer, updateAutoScrollIntent, updateTargetFromFinger])

  const onRelease = useCallback((item: LX.List.UserListInfo) => {
    const state = dragRef.current
    if (!state.active && state.pressPlaylistId !== item.id) return false
    const wasActive = state.active
    const moved = state.moved
    clearPressTimer()
    state.pressLive = false
    state.pressPlaylistId = null
    if (wasActive) {
      finishDrag()
      return false
    }
    return !moved && !state.settling
  }, [clearPressTimer, finishDrag])

  const onTerminate = useCallback(() => {
    const state = dragRef.current
    const wasActive = state.active
    state.moved = true
    state.pressLive = false
    state.pressPlaylistId = null
    clearPressTimer()
    if (wasActive) finishDrag()
  }, [clearPressTimer, finishDrag])

  const dragControllerRef = useRef<PlaylistDragController>({
    onGrant,
    onMove,
    onRelease,
    onTerminate,
  })
  dragControllerRef.current = {
    onGrant,
    onMove,
    onRelease,
    onTerminate,
  }

  useEffect(() => {
    if (!isPlaylistDragActive || !draggingPlaylistId) return
    const anims = shiftAnimMapRef.current.get(draggingPlaylistId)
    if (!anims) return
    Animated.timing(anims.scale, {
      toValue: LIFT_SCALE,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [draggingPlaylistId, isPlaylistDragActive])

  useEffect(() => {
    if (isPlaylistDragActive) return
    zeroShiftAnims()
  }, [isPlaylistDragActive, zeroShiftAnims])

  useLayoutEffect(() => {
    const state = dragRef.current
    if (!state.active) return
    const snapshotKey = displayPlaylists.map(list => list.id).join('|')
    if (snapshotKey === state.snapshotKey) return
    abortDrag()
  }, [abortDrag, displayPlaylists])

  useEffect(() => {
    if (!dragRef.current.active && !dragRef.current.settling) return
    abortDrag()
  }, [abortDrag, playlistDisplayMode])

  useEffect(() => () => {
    gestureTokenRef.current += 1
    clearPressTimer()
    stopAutoScroll()
    if (dragRef.current.safetyTimer) clearTimeout(dragRef.current.safetyTimer)
  }, [clearPressTimer, stopAutoScroll])

  const handlePlaylistCardLayout = useCallback((itemId: string, layout: PlaylistDragLayoutBox) => {
    if (dragRef.current.active || dragRef.current.settling) return
    layoutMapRef.current.set(itemId, layout)
  }, [])

  const handlePlaylistSectionLayout = useCallback((event: LayoutChangeEvent) => {
    playlistSectionWidthRef.current = event.nativeEvent.layout.width
  }, [])

  const handlePlaylistScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y
    const state = dragRef.current
    if (state.active) return
    if (state.pressLive && Math.abs(y - state.pressScrollOffset) > 2) {
      state.moved = true
      state.pressLive = false
      state.pressPlaylistId = null
      clearPressTimer()
    }
    playlistScrollOffsetRef.current = y
  }, [clearPressTimer])

  const handlePlaylistScrollBeginDrag = useCallback(() => {
    const state = dragRef.current
    if (state.active) return
    state.moved = true
    state.pressLive = false
    state.pressPlaylistId = null
    clearPressTimer()
  }, [clearPressTimer])

  const handleActiveTouchMove = useCallback((event: GestureResponderEvent) => {
    if (!dragRef.current.active) return
    onMove(event)
  }, [onMove])

  const handleActiveTouchEnd = useCallback(() => {
    if (!dragRef.current.active) return
    finishDrag()
  }, [finishDrag])

  const handlePlaylistScrollLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height
    measureScrollViewport()
  }, [measureScrollViewport])

  const handlePlaylistContentSizeChange = useCallback((_width: number, height: number) => {
    playlistContentHeightRef.current = height
  }, [])

  return {
    playlistScrollRef,
    playlistSectionRef,
    isPlaylistDragActive,
    draggingPlaylistId,
    playlistShiftAnimMap: shiftAnimMapRef.current,
    dragControllerRef,
    handlePlaylistCardLayout,
    handlePlaylistSectionLayout,
    handlePlaylistScroll,
    handlePlaylistScrollBeginDrag,
    handlePlaylistScrollLayout,
    handlePlaylistContentSizeChange,
    handleActiveTouchMove,
    handleActiveTouchEnd,
  }
}
