import { View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const getSourceTone = (source: string) => {
  switch (source) {
    case 'tx':
      return { text: '#31c27c', background: '#ecfdf3' }
    case 'wy':
      return { text: '#d81e06', background: '#fef2f2' }
    case 'kg':
      return { text: '#2f88ff', background: '#eff6ff' }
    case 'kw':
      return { text: '#f59e0b', background: '#fffbeb' }
    case 'mg':
      return { text: '#e11d8d', background: '#fdf2f8' }
    default:
      return { text: '#4b5563', background: '#eef2f7' }
  }
}

export default ({ musicInfo, isMove }: {
  musicInfo: LX.Music.MusicInfo
  isMove: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  const sourceTone = getSourceTone(musicInfo.source)
  const secondaryLine = [musicInfo.singer, musicInfo.meta.albumName].filter(Boolean).join(' / ')

  return (
    <View style={styles.wrap}>
      <View style={{ ...styles.card, borderColor: theme['c-border-background'], backgroundColor: theme['c-main-background'] }}>
        <Image style={styles.cover} url={musicInfo.meta.picUrl ?? null} />
        <View style={styles.info}>
          <Text size={15} color={theme['c-font']} style={styles.name} numberOfLines={2}>{musicInfo.name}</Text>
          <Text size={12} color={theme['c-500']} numberOfLines={1}>
            {secondaryLine || musicInfo.source.toUpperCase()}
          </Text>
          <View style={styles.metaRow}>
            <Text size={10} color={sourceTone.text} style={{ ...styles.sourceBadge, backgroundColor: sourceTone.background }}>
              {musicInfo.source.toUpperCase()}
            </Text>
            <Text size={11} color={theme['c-500']} numberOfLines={1}>
              {`${t(isMove ? 'list_add_title_first_move' : 'list_add_title_first_add')} · ${t('me_playlist_list')}`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = createStyle({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  sourceBadge: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: '600',
    marginRight: 8,
  },
})
