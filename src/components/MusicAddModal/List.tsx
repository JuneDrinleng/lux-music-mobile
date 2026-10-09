import TargetPlaylistList from './TargetPlaylistList'

export default ({ musicInfo, onPress, onCreated }: {
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}) => {
  return (
    <TargetPlaylistList
      musicInfo={musicInfo}
      onPress={onPress}
      onCreated={onCreated}
    />
  )
}
