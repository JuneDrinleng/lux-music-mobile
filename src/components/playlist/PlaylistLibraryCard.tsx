/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Animated, Easing, TouchableOpacity, View, type GestureResponderEvent } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { MdiIcon } from '@/components/common/MdiIcon'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Hairline } from '@/components/magazine'
import { type useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'

const PLAYLIST_LABEL_FADE_MS = 140
const LIST_COVER = 56

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
  t: ReturnType<typeof useI18n>
  item: LX.List.UserListInfo
  index: number
  isListMode: boolean
  isLast: boolean
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
  t,
  item,
  index,
  isListMode,
  isLast,
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
  const r = magazineRoles(colors)

  const propsRef = useRef({ item, index, onOpenList, onPlayPress, onCardLayout })
  propsRef.current = { item, index, onOpenList, onPlayPress, onCardLayout }
  const acceptedRef = useRef(false)
  const labelOpacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (isListMode) {
      labelOpacity.setValue(1)
      return
    }
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

  const coverFallback = (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: r.placeholder,
    }}>
      <MaterialCommunityIcon name="music-note-eighth" size={isListMode ? 20 : 24} color={r.quiet} />
    </View>
  )

  if (isListMode) {
    return (
      <Animated.View
        collapsable={false}
        style={[
          {
            width: '100%',
            minHeight: 70,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
          },
          isDragging ? { backgroundColor: r.paperRaised, elevation: 4 } : null,
          dragActive ? animatedStyle : null,
        ]}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout
          propsRef.current.onCardLayout(propsRef.current.item.id, { x, y, width, height })
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} {...touchHandlers}>
          <View style={{
            width: LIST_COVER,
            height: LIST_COVER,
            borderRadius: 6,
            overflow: 'hidden',
            backgroundColor: r.placeholder,
          }}>
            {pic ? <Image style={{ width: '100%', height: '100%' }} url={pic} /> : coverFallback}
          </View>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 12, marginRight: 10 }}>
            <Text size={magType.rowTitle.size} color={r.ink} style={{ fontWeight: '700' }} numberOfLines={1}>{item.name}</Text>
            <Text size={magType.meta.size} color={r.muted} style={{ marginTop: 3 }} numberOfLines={1}>
              {t('me_tracks_count', { num: count })}
            </Text>
          </View>
        </View>
        {isCurrent && isPlay
          ? (
            <TouchableOpacity activeOpacity={0.82} onPress={onPlayPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MdiIcon name="equalizer" size={16} color={r.accentInk} />
              <Text size={12} color={r.accentInk} style={{ fontWeight: '700' }}>{t('library_playing')}</Text>
            </TouchableOpacity>
            )
          : (
            <View {...touchHandlers} hitSlop={8}>
              <MdiIcon name="drag-horizontal-variant" size={18} color={r.quiet} />
            </View>
            )}
        {!isLast ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><Hairline /></View> : null}
      </Animated.View>
    )
  }

  return (
    <Animated.View
      collapsable={false}
      style={[
        { width: '48.4%', marginBottom: 18 },
        dragActive ? animatedStyle : null,
      ]}
      onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout
        propsRef.current.onCardLayout(propsRef.current.item.id, { x, y, width, height })
      }}
    >
      <View style={{ width: '100%' }} {...touchHandlers}>
        <View style={[
          {
            aspectRatio: 1,
            borderRadius: 6,
            overflow: 'hidden',
            backgroundColor: r.placeholder,
          },
          isDragging ? { elevation: 4, backgroundColor: r.paperRaised } : null,
        ]}>
          {pic
            ? <Image style={{ width: '100%', height: '100%', borderRadius: 6 }} url={pic} />
            : coverFallback}
        </View>
        <Animated.View style={{ paddingTop: 8, opacity: labelOpacity }}>
          <Text size={magType.rowTitle.size} color={r.ink} style={{ fontWeight: '700' }} numberOfLines={1}>{item.name}</Text>
          <Text size={magType.meta.size} color={r.muted} style={{ marginTop: 2 }}>{t('me_tracks_count', { num: count })}</Text>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

export default memo(PlaylistLibraryCard)
