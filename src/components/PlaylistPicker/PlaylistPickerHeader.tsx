import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { View } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import styles from './styles'

export interface PlaylistPickerHeaderProps {
  title: string
  subtitle?: string
  note?: string
  coverUrl?: string | null
  count?: number
}

export default ({
  title,
  subtitle,
  note,
  coverUrl,
  count,
}: PlaylistPickerHeaderProps) => {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryMedia}>
        {coverUrl
          ? <Image style={styles.summaryMediaImage} url={coverUrl} />
          : count != null
            ? <Text size={18} color="#111827" style={styles.summaryCountText}>{count}</Text>
            : <MaterialCommunityIcon name="music-note-eighth-outline" size={22} color="#5f6776" />}
      </View>
      <View style={styles.summaryInfo}>
        <Text size={15} color="#111827" numberOfLines={1} style={styles.summaryTitle}>{title}</Text>
        {subtitle
          ? <Text size={12} color="#4b5563" numberOfLines={2} style={styles.summarySubtitle}>{subtitle}</Text>
          : null}
        {note
          ? <Text size={11} color="#6b7280" numberOfLines={2} style={styles.summaryNote}>{note}</Text>
          : null}
      </View>
    </View>
  )
}
