import TargetPlaylistList from './TargetPlaylistList'

export default ({ musicInfo, onPress }: {
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  return (
    <TargetPlaylistList
      musicInfo={musicInfo}
      onPress={onPress}
    />
  )
}
