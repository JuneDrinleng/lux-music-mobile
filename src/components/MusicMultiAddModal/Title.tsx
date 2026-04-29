import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export default ({ selectedList, isMove }: {
  selectedList: LX.Music.MusicInfo[]
  isMove: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  const previewNames = selectedList.slice(0, 2).map(item => item.name).filter(Boolean).join(' / ')
  const remainCount = selectedList.length - 2

  return (
    <View style={styles.wrap}>
      <View style={{ ...styles.card, borderColor: theme['c-border-background'], backgroundColor: theme['c-main-background'] }}>
        <View style={{ ...styles.countBadge, backgroundColor: theme['c-button-background'], borderColor: theme['c-border-background'] }}>
          <Text size={18} color={theme['c-button-font']} style={styles.countText}>{selectedList.length}</Text>
        </View>
        <View style={styles.info}>
          <Text size={15} color={theme['c-font']} style={styles.name} numberOfLines={1}>
            {t(isMove ? 'list_multi_add_title_first_move' : 'list_multi_add_title_first_add')} {selectedList.length} {t('list_multi_add_title_last')}
          </Text>
          <Text size={12} color={theme['c-500']} numberOfLines={1}>
            {previewNames}{remainCount > 0 ? ` ... +${remainCount}` : ''}
          </Text>
          <Text size={11} color={theme['c-500']} style={styles.caption} numberOfLines={1}>
            {t('me_playlist_list')}
          </Text>
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
  countBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontWeight: '700',
    marginBottom: 4,
  },
  caption: {
    marginTop: 8,
  },
})
