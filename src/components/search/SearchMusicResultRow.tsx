import { TouchableOpacity, View } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useCallback, useEffect, useState } from 'react'

import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { pickMusicCover } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'
import { getSourceTone } from './sourceTone'
import { fetchAltCoverUrl } from '@/core/music/utils'

export default ({
  item,
  isLoved,
  onPress,
  onToggleLoved,
  onAdd,
}: {
  item: LX.Music.MusicInfoOnline
  isLoved: boolean
  onPress: () => void
  onToggleLoved: () => void
  onAdd: () => void
}) => {
  const sourceTone = getSourceTone(item.source)
  const [displayCoverUrl, setDisplayCoverUrl] = useState<string | null>(() => pickMusicCover(item))

  useEffect(() => {
    setDisplayCoverUrl(pickMusicCover(item))
  }, [item])

  const handleCoverError = useCallback(async(_url: string | number) => {
    const altUrl = await fetchAltCoverUrl(item)
    if (altUrl) setDisplayCoverUrl(altUrl)
  }, [item])

  return (
    <View style={styles.songItem}>
      <TouchableOpacity
        style={styles.songMain}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <Image style={styles.songPic} url={displayCoverUrl} onError={handleCoverError} />
        <View style={styles.songInfo}>
          <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.songMetaRow}>
            <Text size={10} color={sourceTone.text} style={[styles.songSource, { backgroundColor: sourceTone.background }]}>{item.source.toUpperCase()}</Text>
            <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.searchSongActions}>
        <Text size={11} color="#9ca3af" style={styles.searchSongInterval}>{item.interval ?? '--:--'}</Text>
        <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={onToggleLoved}>
          {isLoved
            ? <MaterialCommunityIcon name="heart" size={18} color="#ef4444" />
            : <Icon name="love" rawSize={17} color="#9ca3af" />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={onAdd}>
          <Text size={18} color="#9ca3af" style={styles.searchAddText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = createStyle({
  songItem: {
    minHeight: 70,
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
  songPic: {
    width: 58,
    height: 58,
    borderRadius: 16,
    shadowColor: '#747b8f',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  songInfo: {
    flex: 1,
    marginLeft: 13,
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
  searchSongInterval: {
    marginRight: 6,
    minWidth: 42,
    textAlign: 'right',
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
  searchAddText: {
    lineHeight: 19,
    fontWeight: '700',
  },
})
