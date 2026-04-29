import { TouchableOpacity, View } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem as SearchSonglistItem } from '@/store/songlist/state'
import { getSourceTone } from './sourceTone'

export default ({
  item,
  onPress,
}: {
  item: SearchSonglistItem
  onPress: () => void
}) => {
  const sourceTone = getSourceTone(item.source)
  const primaryMetaText = [item.author?.trim(), item.play_count?.trim()].filter(Boolean).join(' / ')
  const fallbackMetaText = item.desc?.trim()
  const metaText = primaryMetaText.length ? primaryMetaText : (fallbackMetaText?.length ? fallbackMetaText : '--')

  return (
    <View style={styles.songlistItem}>
      <TouchableOpacity
        style={styles.songMain}
        activeOpacity={0.82}
        onPress={onPress}
      >
        <Image style={styles.songlistPic} url={item.img ?? null} />
        <View style={styles.songlistInfo}>
          <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.songMetaRow}>
            <Text size={10} color={sourceTone.text} style={[styles.songSource, { backgroundColor: sourceTone.background }]}>{item.source.toUpperCase()}</Text>
            <Text size={11} color="#6b7280" numberOfLines={1} style={styles.songlistMetaText}>{metaText}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.songActionBtn}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <MaterialCommunityIcon name="chevron-right" size={18} color="#9ca3af" />
      </TouchableOpacity>
    </View>
  )
}

const styles = createStyle({
  songlistItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 1,
  },
  songMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songlistPic: {
    width: 58,
    height: 58,
    borderRadius: 16,
    shadowColor: '#747b8f',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  songlistInfo: {
    flex: 1,
    marginLeft: 13,
    marginRight: 12,
  },
  songMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  songlistMetaText: {
    flex: 1,
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
  songActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(230,234,243,0.92)',
  },
})
