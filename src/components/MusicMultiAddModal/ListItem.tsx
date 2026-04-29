import { View } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const getListTone = (listId: string) => {
  switch (listId) {
    case LIST_IDS.LOVE:
      return { icon: 'heart', iconColor: '#cf385b', iconBg: '#fce7ef' }
    case LIST_IDS.DEFAULT:
      return { icon: 'play-circle', iconColor: '#556b96', iconBg: '#e8eefb' }
    default:
      return { icon: 'music-note-eighth', iconColor: '#8a6745', iconBg: '#f5eee3' }
  }
}

export default ({ listInfo, onPress, width }: {
  listInfo: LX.List.MyListInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  width: number
}) => {
  const theme = useTheme()
  const tone = getListTone(listInfo.id)

  return (
    <View style={{ ...styles.listItem, width }}>
      <Button
        style={{
          ...styles.button,
          backgroundColor: theme['c-main-background'],
          borderColor: theme['c-primary-light-200-alpha-700'],
        }}
        onPress={() => { onPress(listInfo) }}
      >
        <View style={{ ...styles.iconWrap, backgroundColor: tone.iconBg }}>
          <MaterialCommunityIcon name={tone.icon} size={18} color={tone.iconColor} />
        </View>
        <View style={styles.content}>
          <Text numberOfLines={1} size={14} color={theme['c-font']} style={styles.title}>{listInfo.name}</Text>
          <Text numberOfLines={1} size={11} color={theme['c-500']}>
            {listInfo.id === LIST_IDS.LOVE
              ? global.i18n.t('list_name_love')
              : listInfo.id === LIST_IDS.DEFAULT
                ? global.i18n.t('list_name_default')
                : global.i18n.t('me_playlist_list')}
          </Text>
        </View>
        <View style={styles.actionWrap}>
          <MaterialCommunityIcon name="plus" size={16} color="#202515" />
        </View>
      </Button>
    </View>
  )
}

export const styles = createStyle({
  listItem: {
    paddingRight: 10,
    marginBottom: 10,
  },
  button: {
    minHeight: 66,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  title: {
    fontWeight: '700',
    marginBottom: 3,
  },
  actionWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4d4',
  },
})
