import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import styles from './styles'

export interface PlaylistPickerListItemProps {
  listInfo: LX.List.MyListInfo
  actionLabel: string
  subtitle?: string
  disabled?: boolean
  onPress: (listInfo: LX.List.MyListInfo) => void
}

export default ({
  listInfo,
  actionLabel,
  subtitle,
  disabled = false,
  onPress,
}: PlaylistPickerListItemProps) => {
  return (
    <TouchableOpacity
      style={[styles.listItem, disabled ? styles.listItemDisabled : null]}
      activeOpacity={0.82}
      disabled={disabled}
      onPress={() => { onPress(listInfo) }}
    >
      <View style={styles.listItemTextWrap}>
        <Text size={14} color="#111827" numberOfLines={1} style={styles.listItemTitle}>{listInfo.name}</Text>
        {subtitle
          ? <Text size={11} color="#6b7280" numberOfLines={1} style={styles.listItemSubtitle}>{subtitle}</Text>
          : null}
      </View>
      <View style={[styles.listItemAction, disabled ? styles.listItemActionDisabled : null]}>
        {disabled
          ? <MaterialCommunityIcon name="check" size={14} color="#6b7280" />
          : <Text size={11} color="#111827" style={styles.listItemActionText}>{actionLabel}</Text>}
      </View>
    </TouchableOpacity>
  )
}
