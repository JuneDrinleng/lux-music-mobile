import { Animated, TouchableOpacity, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useCallback, useEffect, useState } from 'react'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { pickMusicCover } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'
import { fetchAltCoverUrl } from '@/core/music/utils'
import { recordCoverFailure, clearCoverFailure } from '@/utils/coverFailureRegistry'
import { updateListMusics } from '@/core/list'

interface SourceTone {
  text: string
  background: string
}

interface PlaylistDetailSongItemProps {
  song: LX.Music.MusicInfo
  sourceTone: SourceTone
  shiftAnim: Animated.Value
  fallbackCover?: string | null
  listId?: string | null
  isGhost?: boolean
  canEdit?: boolean
  onLayout: (event: LayoutChangeEvent) => void
  onPress: () => void
  onLongPress?: (event: GestureResponderEvent) => void
  onRemove?: () => void
}

export default ({
  song,
  sourceTone,
  shiftAnim,
  fallbackCover = null,
  listId = null,
  isGhost = false,
  canEdit = false,
  onLayout,
  onPress,
  onLongPress,
  onRemove,
}: PlaylistDetailSongItemProps) => {
  const [displayCoverUrl, setDisplayCoverUrl] = useState<string | null>(() => pickMusicCover(song, fallbackCover))

  useEffect(() => {
    setDisplayCoverUrl(pickMusicCover(song, fallbackCover))
  }, [song, fallbackCover])

  const handleCoverError = useCallback(async(_url: string | number) => {
    if (song.source === 'local') return
    const onlineSong = song as LX.Music.MusicInfoOnline
    const altUrl = await fetchAltCoverUrl(onlineSong)
    if (altUrl) {
      onlineSong.meta.picUrl = altUrl
      setDisplayCoverUrl(altUrl)
      void clearCoverFailure(onlineSong)
      if (listId) void updateListMusics([{ id: listId, musicInfo: onlineSong }])
    } else {
      void recordCoverFailure(onlineSong)
    }
  }, [song, listId])

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      <Animated.View
        style={[
          styles.card,
          isGhost ? styles.ghostCard : null,
          { transform: [{ translateY: shiftAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.main}
          activeOpacity={0.8}
          delayLongPress={canEdit ? 180 : undefined}
          onLongPress={canEdit ? onLongPress : undefined}
          onPress={onPress}
        >
          <Image style={styles.cover} url={displayCoverUrl} onError={handleCoverError} />
          <View style={styles.info}>
            <Text size={14} color="#111827" style={styles.name} numberOfLines={1}>{song.name}</Text>
            <View style={styles.metaRow}>
              <Text size={10} color={sourceTone.text} style={[styles.sourceBadge, { backgroundColor: sourceTone.background }]}>
                {song.source.toUpperCase()}
              </Text>
              <Text size={11} color="#6b7280" numberOfLines={1}>{song.singer}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.actions}>
          <Text size={11} color="#9ca3af" style={styles.interval}>{song.interval ?? '--:--'}</Text>
          {canEdit
            ? (
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.75} onPress={onRemove}>
                  <MaterialCommunityIcon name="trash-can-outline" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )
            : null}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = createStyle({
  wrap: {
    position: 'relative',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#ffffff',
    shadowColor: '#76809b',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ghostCard: {
    opacity: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  name: {
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceBadge: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: '600',
    marginRight: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  interval: {
    marginRight: 4,
    minWidth: 40,
    textAlign: 'right',
  },
  actionButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
