import { type ReactNode } from 'react'
import { View } from 'react-native'
import PlaylistSongList, { type PlaylistSongListProps } from './PlaylistSongList'

export interface PlaylistDetailSceneProps extends PlaylistSongListProps {
  children?: ReactNode
}

export default ({ children, ...props }: PlaylistDetailSceneProps) => {
  return (
    <View style={{ flex: 1 }}>
      <PlaylistSongList {...props} />
      {children}
    </View>
  )
}
