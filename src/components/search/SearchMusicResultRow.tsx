import { Image, TouchableOpacity, View } from 'react-native'

import addToPlaylist from '../../../assets/img/add-to-playlist.png'
import emptyHeart from '../../../assets/img/empty-heart-grey.png'
import fillInHeart from '../../../assets/img/fill-in-heart.png'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import HighlightText from './HighlightText'
import { getSourceTone } from './sourceTone'

export default ({
  item,
  index,
  keyword,
  isLoved,
  onPress,
  onToggleLoved,
  onAdd,
}: {
  item: LX.Music.MusicInfoOnline
  index: number
  keyword: string
  isLoved: boolean
  onPress: () => void
  onToggleLoved: () => void
  onAdd: () => void
}) => {
  const sourceTone = getSourceTone(item.source)

  return (
    <View style={styles.songItem}>
      <TouchableOpacity
        style={styles.songMain}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <Text size={14} color="#8a8f9d" style={styles.rankNum}>{index + 1}</Text>
        <View style={styles.songInfo}>
          <HighlightText text={item.name} keyword={keyword} size={14} color="#111827" style={styles.listTitle} numberOfLines={1} />
          <View style={styles.songMetaRow}>
            <Text size={10} color={sourceTone.text} style={[styles.songSource, { backgroundColor: sourceTone.background }]}>{item.source.toUpperCase()}</Text>
            <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
            <Text size={11} color="#9ca3af" style={styles.interval}>{item.interval ?? '--:--'}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.searchSongActions}>
        <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={onToggleLoved}>
          <Image source={isLoved ? fillInHeart : emptyHeart} style={styles.actionIcon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={onAdd}>
          <Image source={addToPlaylist} style={styles.actionIcon} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = createStyle({
  songItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 1,
  },
  songMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankNum: {
    width: 26,
    textAlign: 'center',
    marginRight: 10,
    fontWeight: '600',
  },
  songInfo: {
    flex: 1,
    marginRight: 12,
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
  listTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  searchSongActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 0,
  },
  interval: {
    marginLeft: 8,
  },
  actionIcon: {
    width: 20,
    height: 20,
  },
  songActionBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
