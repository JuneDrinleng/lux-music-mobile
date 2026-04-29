import { useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { useMyList, useMusicExistsList } from '@/store/list/hook'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import CreateUserList from './CreateUserList'

const CONTENT_PADDING = 16
const CONTENT_MAX_WIDTH = 328

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

const useTargetItemWidth = () => {
  const windowSize = useWindowSize()

  return useMemo(() => {
    const availableWidth = Math.min(windowSize.width - 48, CONTENT_MAX_WIDTH + CONTENT_PADDING * 2) - CONTENT_PADDING * 2
    return availableWidth
  }, [windowSize])
}

const CreatePlaylistItem = ({
  width,
  defaultName,
  onCreated,
}: {
  width: number
  defaultName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}) => {
  const [isEdit, setEdit] = useState(false)
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={{ ...styles.listItem, width }}>
      <TouchableOpacity
        style={{
          ...styles.button,
          borderColor: theme['c-primary-light-200-alpha-700'],
          borderStyle: 'dashed',
          backgroundColor: theme['c-main-background'],
          justifyContent: 'center',
        }}
        onPress={() => { setEdit(true) }}
      >
        <Text style={{ opacity: isEdit ? 0 : 1, fontWeight: '600' }} numberOfLines={1} size={14} color={theme['c-button-font']}>
          {t('list_create')}
        </Text>
      </TouchableOpacity>
      {isEdit
        ? (
            <CreateUserList
              isEdit={isEdit}
              onHide={() => { setEdit(false) }}
              defaultName={defaultName}
              onCreated={onCreated}
            />
          )
        : null}
    </View>
  )
}

const TargetPlaylistItemBase = ({
  listInfo,
  width,
  disabled = false,
  actionIcon = 'plus',
  actionColor = '#202515',
  actionBackground = '#eef4d4',
  onPress,
}: {
  listInfo: LX.List.MyListInfo
  width: number
  disabled?: boolean
  actionIcon?: string
  actionColor?: string
  actionBackground?: string
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const theme = useTheme()
  const tone = getListTone(listInfo.id)

  return (
    <View style={{ ...styles.listItem, width }}>
      <Button
        style={{
          ...styles.button,
          backgroundColor: theme['c-main-background'],
          borderColor: disabled ? theme['c-border-background'] : theme['c-primary-light-200-alpha-700'],
          opacity: disabled ? 0.58 : 1,
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
        <View style={{ ...styles.actionWrap, backgroundColor: actionBackground }}>
          <MaterialCommunityIcon name={actionIcon} size={16} color={actionColor} />
        </View>
      </Button>
    </View>
  )
}

const SingleTargetPlaylistItem = ({
  listInfo,
  musicInfo,
  width,
  onPress,
}: {
  listInfo: LX.List.MyListInfo
  musicInfo: LX.Music.MusicInfo
  width: number
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const isExists = useMusicExistsList(listInfo, musicInfo)

  const handlePress = (nextListInfo: LX.List.MyListInfo) => {
    if (isExists) {
      toast(global.i18n.t('list_add_tip_exists'))
      return
    }
    onPress(nextListInfo)
  }

  return (
    <TargetPlaylistItemBase
      listInfo={listInfo}
      width={width}
      disabled={isExists}
      actionIcon={isExists ? 'check' : 'plus'}
      actionColor={isExists ? '#7b8494' : '#202515'}
      actionBackground={isExists ? '#ecf0f4' : '#eef4d4'}
      onPress={handlePress}
    />
  )
}

const MultiTargetPlaylistItem = ({
  listInfo,
  width,
  onPress,
}: {
  listInfo: LX.List.MyListInfo
  width: number
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  return (
    <TargetPlaylistItemBase
      listInfo={listInfo}
      width={width}
      onPress={onPress}
    />
  )
}

export interface TargetPlaylistListProps {
  musicInfo?: LX.Music.MusicInfo
  excludeListId?: string
  defaultNewListName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
  onPress: (listInfo: LX.List.MyListInfo) => void
}

export default ({
  musicInfo,
  excludeListId,
  defaultNewListName,
  onCreated,
  onPress,
}: TargetPlaylistListProps) => {
  const allList = useMyList()
  const theme = useTheme()
  const t = useI18n()
  const itemWidth = useTargetItemWidth()
  const targetLists = useMemo(() => {
    if (!excludeListId) return allList
    return allList.filter(list => list.id != excludeListId)
  }, [allList, excludeListId])

  return (
    <View style={styles.section}>
      <Text size={12} color={theme['c-500']} style={styles.sectionTitle}>{t('me_playlist_list')}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={styles.list} onStartShouldSetResponder={() => true}>
          <CreatePlaylistItem width={itemWidth} defaultName={defaultNewListName} onCreated={onCreated} />
          {targetLists.map(info => musicInfo
            ? (
                <SingleTargetPlaylistItem
                  key={info.id}
                  listInfo={info}
                  musicInfo={musicInfo}
                  onPress={onPress}
                  width={itemWidth}
                />
              )
            : (
                <MultiTargetPlaylistItem
                  key={info.id}
                  listInfo={info}
                  onPress={onPress}
                  width={itemWidth}
                />
              ))}
        </View>
      </ScrollView>
    </View>
  )
}

export const styles = createStyle({
  section: {
    flex: 1,
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
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
