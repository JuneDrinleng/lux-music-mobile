import { memo, useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Animated, Easing, TouchableOpacity, View, type GestureResponderEvent } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { MdiIcon } from '@/components/common/MdiIcon'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { type useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'

const PLAYLIST_LABEL_FADE_MS = 140

export interface PlaylistCardShiftAnims {
  x: Animated.Value
  y: Animated.Value
  scale: Animated.Value
}

export interface PlaylistDragController {
  onGrant: (item: LX.List.UserListInfo, index: number, event: GestureResponderEvent) => boolean
  onMove: (event: GestureResponderEvent) => void
  onRelease: (item: LX.List.UserListInfo) => boolean
  onTerminate: () => void
  isPanOwning: () => boolean
}

interface PlaylistLibraryCardProps {
  styles: Record<string, any>
  t: ReturnType<typeof useI18n>
  item: LX.List.UserListInfo
  index: number
  isListMode: boolean
  isLast: boolean
  tone: { surface: string, accent: string, ink: string }
  count: number
  pic: string | null
  isCurrent: boolean
  isPlay: boolean
  isDragging: boolean
  dragActive: boolean
  shiftAnims: PlaylistCardShiftAnims
  dragControllerRef: MutableRefObject<PlaylistDragController>
  onOpenList: (listInfo: LX.List.MyListInfo) => void
  onPlayPress: (event: GestureResponderEvent) => void
  onCardLayout: (itemId: string, layout: { x: number, y: number, width: number, height: number }) => void
}

const PlaylistLibraryCard = ({
  styles,
  t,
  item,
  index,
  isListMode,
  isLast,
  tone,
  count,
  pic,
  isCurrent,
  isPlay,
  isDragging,
  dragActive,
  shiftAnims,
  dragControllerRef,
  onOpenList,
  onPlayPress,
  onCardLayout,
}: PlaylistLibraryCardProps) => {
  const { colors } = useLuxTheme()

  const propsRef = useRef({ item, index, onOpenList, onPlayPress, onCardLayout })
  propsRef.current = { item, index, onOpenList, onPlayPress, onCardLayout }
  const acceptedRef = useRef(false)
  const labelOpacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (isListMode) {
      labelOpacity.setValue(1)
      return
    }
    // Opacity only. Hiding the label with height/unmount would reflow the grid mid-drag.
    Animated.timing(labelOpacity, {
      toValue: isDragging ? 0 : 1,
      duration: PLAYLIST_LABEL_FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [isDragging, isListMode, labelOpacity])
  const animatedStyle = useMemo(() => ({
    transform: [
      { translateX: shiftAnims.x },
      { translateY: shiftAnims.y },
      { scale: shiftAnims.scale },
    ],
  }), [shiftAnims.scale, shiftAnims.x, shiftAnims.y])
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    acceptedRef.current = dragControllerRef.current.onGrant(propsRef.current.item, propsRef.current.index, event)
  }, [dragControllerRef])
  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    if (!acceptedRef.current) return
    dragControllerRef.current.onMove(event)
  }, [dragControllerRef])
  const handleTouchEnd = useCallback(() => {
    if (!acceptedRef.current) return
    acceptedRef.current = false
    const shouldOpen = dragControllerRef.current.onRelease(propsRef.current.item)
    if (shouldOpen) propsRef.current.onOpenList(propsRef.current.item)
  }, [dragControllerRef])
  const handleTouchCancel = useCallback(() => {
    if (!acceptedRef.current) return
    if (dragControllerRef.current.isPanOwning()) return
    acceptedRef.current = false
    dragControllerRef.current.onTerminate()
  }, [dragControllerRef])
  const touchHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  }
  const cover = pic
    ? <Image style={isListMode ? styles.listRowCover : styles.listPic} url={pic} />
    : isListMode
      ? <View style={[styles.listRowCover, styles.listPicFallback, { backgroundColor: tone.surface }]}>
          <MaterialCommunityIcon name="music-note-eighth" size={20} color={tone.accent} />
        </View>
      : <View style={[styles.listPic, styles.listPicFallback]}>
          <MaterialCommunityIcon name="music-note-eighth" size={24} color={tone.accent} />
        </View>

  return (
    <Animated.View
      collapsable={false}
      style={[
        isListMode ? styles.listRowItem : styles.listItem,
        isListMode && !isLast ? styles.listRowSpacing : null,
        isDragging && isListMode ? styles.playlistDragLiftedList : null,
        dragActive ? animatedStyle : null,
      ]}
      onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout
        propsRef.current.onCardLayout(propsRef.current.item.id, { x, y, width, height })
      }}
    >
      {isListMode
        ? <>
            <View style={styles.playlistDragHit} {...touchHandlers}>
              <View style={styles.listRowCoverWrap}>
                {cover}
              </View>
              <View style={styles.listRowInfo}>
                <Text size={15} color={colors.ink.rowTitle} style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
                <Text size={12} color={colors.ink.rowMeta} style={styles.listRowSubtitle} numberOfLines={1}>{t('home_daily_tracks', { count })}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.listRowPlayButton}
              activeOpacity={0.82}
              onPress={onPlayPress}
            >
              {isCurrent && isPlay
                ? <MdiIcon name="pause" rawSize={13} color={colors.ink.miniPlay} />
                : <MdiIcon name="play" rawSize={13} color={colors.ink.miniPlay} />}
            </TouchableOpacity>
          </>
        : <View style={styles.playlistDragHitGrid} {...touchHandlers}>
            <View style={[
              styles.listPicWrap,
              { backgroundColor: tone.surface },
              isDragging ? styles.playlistDragLiftedCover : null,
            ]}>
              <View style={styles.listPicClip}>
                {cover}
              </View>
            </View>
            <Animated.View style={[styles.listInfo, { opacity: labelOpacity }]}>
              <Text size={13} color={colors.ink.cardTitle} style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
              <Text size={12} color={colors.ink.songCount}>{t('me_songs_count', { num: count })}</Text>
            </Animated.View>
          </View>}
    </Animated.View>
  )
}

export default memo(PlaylistLibraryCard)
