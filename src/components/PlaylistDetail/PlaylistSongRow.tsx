import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { Animated, TouchableOpacity, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import styles from './styles'
import { type SourceTagTone } from './types'

export interface PlaylistSongRowProps {
  item: LX.Music.MusicInfo
  canEditSongs: boolean
  isDraggingRow: boolean
  shiftAnim: Animated.Value
  sourceTone: SourceTagTone
  onLayout: (event: LayoutChangeEvent) => void
  onPress: () => void
  onLongPress?: (event: GestureResponderEvent) => void
  onDelete?: () => void
}

export default ({
  item,
  canEditSongs,
  isDraggingRow,
  shiftAnim,
  sourceTone,
  onLayout,
  onPress,
  onLongPress,
  onDelete,
}: PlaylistSongRowProps) => {
  return (
    <View onLayout={onLayout} style={styles.songItemWrap}>
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
          delayLongPress={canEditSongs ? 180 : undefined}
          onLongPress={onLongPress}
          onPress={onPress}
        >
          <Image style={styles.songPic} url={item.meta.picUrl ?? null} />
          <View style={styles.songInfo}>
            <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.songMetaRow}>
              <Text size={10} color={sourceTone.text} style={[styles.songSource, { backgroundColor: sourceTone.background }]}>{item.source.toUpperCase()}</Text>
              <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.songActions}>
          <Text size={11} color="#9ca3af" style={styles.songInterval}>{item.interval ?? '--:--'}</Text>
          {canEditSongs && onDelete
            ? <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.75} onPress={onDelete}>
                <MaterialCommunityIcon name="trash-can-outline" size={16} color="#9ca3af" />
              </TouchableOpacity>
            : null}
        </View>
      </Animated.View>
    </View>
  )
}
