import { useState } from 'react'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import CreateUserList from '@/components/MusicAddModal/CreateUserList'
import { useI18n } from '@/lang'
import styles from './styles'

export interface PlaylistPickerCreateRowProps {
  defaultNewListName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}

export default ({
  defaultNewListName,
  onCreated,
}: PlaylistPickerCreateRowProps) => {
  const [isEdit, setEdit] = useState(false)
  const t = useI18n()

  return (
    <View style={styles.createWrap}>
      <TouchableOpacity
        style={[styles.createBtn, isEdit ? styles.createBtnHidden : null]}
        activeOpacity={0.84}
        onPress={() => { setEdit(true) }}
      >
        <View style={styles.createIconWrap}>
          <MaterialCommunityIcon name="plus" size={16} color="#4b5563" />
        </View>
        <Text size={14} color="#111827" numberOfLines={1} style={styles.listItemTitle}>{t('list_create')}</Text>
      </TouchableOpacity>
      {isEdit
        ? <View style={styles.createInputOverlay}>
            <CreateUserList
              isEdit={isEdit}
              defaultName={defaultNewListName}
              onCreated={onCreated}
              onHide={() => { setEdit(false) }}
            />
          </View>
        : null}
    </View>
  )
}
