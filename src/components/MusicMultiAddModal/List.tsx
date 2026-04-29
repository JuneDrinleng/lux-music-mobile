import TargetPlaylistList from '../MusicAddModal/TargetPlaylistList'

export default ({ listId, onPress, defaultNewListName, onCreated }: {
  listId: string
  onPress: (listInfo: LX.List.MyListInfo) => void
  defaultNewListName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}) => {
  return (
    <TargetPlaylistList
      excludeListId={listId}
      defaultNewListName={defaultNewListName}
      onCreated={onCreated}
      onPress={onPress}
    />
  )
}
