import { View } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { useMusicExistsList } from '@/store/list/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'

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

export default ({ listInfo, onPress, musicInfo, width }: {
  listInfo: LX.List.MyListInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  musicInfo: LX.Music.MusicInfo
  width: number
}) => {
  const theme = useTheme()
  const isExists = useMusicExistsList(listInfo, musicInfo)
  const tone = getListTone(listInfo.id)

  const handlePress = () => {
    if (isExists) {
      toast(global.i18n.t('list_add_tip_exists'))
      return
    }
    onPress(listInfo)
  }

  return (
    <View style={{ ...styles.listItem, width }}>
      <Button
        style={{
          ...styles.button,
          backgroundColor: theme['c-main-background'],
          borderColor: isExists ? theme['c-border-background'] : theme['c-primary-light-200-alpha-700'],
          opacity: isExists ? 0.58 : 1,
        }}
        onPress={handlePress}
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
        <View style={{ ...styles.actionWrap, backgroundColor: isExists ? '#ecf0f4' : '#eef4d4' }}>
          <MaterialCommunityIcon name={isExists ? 'check' : 'plus'} size={16} color={isExists ? '#7b8494' : '#202515'} />
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
  },
})
