import { Animated, View } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { APP_LAYER_INDEX } from '@/config/constant'
import { pickMusicCover } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'

interface SourceTone {
  text: string
  background: string
}

interface PlaylistSongDragOverlayProps {
  song: LX.Music.MusicInfo
  sourceTone: SourceTone
  top: Animated.Value
  scale: Animated.Value
  opacity: Animated.Value
  fallbackCover?: string | null
}

export default ({ song, sourceTone, top, scale, opacity, fallbackCover = null }: PlaylistSongDragOverlayProps) => {
  const coverUrl = pickMusicCover(song, fallbackCover)

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          transform: [{ translateY: top }, { scale }],
          opacity,
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.main}>
          <Image style={styles.cover} url={coverUrl} />
          <View style={styles.info}>
            <Text size={14} color="#111827" style={styles.name} numberOfLines={1}>{song.name}</Text>
            <View style={styles.metaRow}>
              <Text size={10} color={sourceTone.text} style={[styles.sourceBadge, { backgroundColor: sourceTone.background }]}>
                {song.source.toUpperCase()}
              </Text>
              <Text size={11} color="#6b7280" numberOfLines={1}>{song.singer}</Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <Text size={11} color="#9ca3af" style={styles.interval}>{song.interval ?? '--:--'}</Text>
          <View style={styles.actionButton}>
            <MaterialCommunityIcon name="drag-horizontal-variant" size={16} color="#6b7280" />
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = createStyle({
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: APP_LAYER_INDEX.playQueue,
    elevation: APP_LAYER_INDEX.playQueue,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
