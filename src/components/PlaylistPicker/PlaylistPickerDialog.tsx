import { View } from 'react-native'
import PlaylistPickerHeader from './PlaylistPickerHeader'
import PlaylistPickerList from './PlaylistPickerList'
import styles from './styles'

export interface PlaylistPickerDialogProps {
  summaryTitle: string
  summarySubtitle?: string
  summaryNote?: string
  coverUrl?: string | null
  count?: number
  listId?: string
  actionLabel: string
  musicInfo?: LX.Music.MusicInfo | null
  defaultNewListName?: string
  itemSubtitle?: string
  onSelect: (listInfo: LX.List.MyListInfo) => void
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}

export default ({
  summaryTitle,
  summarySubtitle,
  summaryNote,
  coverUrl,
  count,
  listId,
  actionLabel,
  musicInfo,
  defaultNewListName,
  itemSubtitle,
  onSelect,
  onCreated,
}: PlaylistPickerDialogProps) => {
  return (
    <View style={styles.dialogContent}>
      <PlaylistPickerHeader
        title={summaryTitle}
        subtitle={summarySubtitle}
        note={summaryNote}
        coverUrl={coverUrl}
        count={count}
      />
      <PlaylistPickerList
        listId={listId}
        actionLabel={actionLabel}
        musicInfo={musicInfo}
        subtitle={itemSubtitle}
        defaultNewListName={defaultNewListName}
        onPress={onSelect}
        onCreated={onCreated}
      />
    </View>
  )
}
