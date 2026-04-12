export interface SourceTagTone {
  text: string
  background: string
}

export interface PlaylistImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
}

export interface PlaylistDetailPrimaryAction {
  label: string
  onPress: () => void
  disabled?: boolean
}
