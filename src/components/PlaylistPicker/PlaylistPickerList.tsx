import { useEffect, useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import { getListMusics } from '@/core/list'
import { useMyList } from '@/store/list/hook'
import PlaylistPickerCreateRow from './PlaylistPickerCreateRow'
import PlaylistPickerListItem from './PlaylistPickerListItem'
import styles from './styles'

export interface PlaylistPickerListProps {
  listId?: string
  actionLabel: string
  musicInfo?: LX.Music.MusicInfo | null
  subtitle?: string
  defaultNewListName?: string
  onPress: (listInfo: LX.List.MyListInfo) => void
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}

export default ({
  listId = '',
  actionLabel,
  musicInfo,
  subtitle,
  defaultNewListName,
  onPress,
  onCreated,
}: PlaylistPickerListProps) => {
  const allList = useMyList().filter(list => list.id != listId)
  const [existsMap, setExistsMap] = useState<Record<string, true>>({})

  const targetSongKey = useMemo(() => {
    if (!musicInfo) return ''
    return `${musicInfo.source}_${musicInfo.id}`
  }, [musicInfo])

  useEffect(() => {
    let cancelled = false

    if (!musicInfo || !allList.length) {
      setExistsMap({})
      return
    }

    void Promise.all(allList.map(async(list) => {
      const musics = await getListMusics(list.id)
      const exists = musics.some(song => `${song.source}_${song.id}` === targetSongKey)
      return exists ? list.id : null
    })).then((results) => {
      if (cancelled) return
      const nextMap: Record<string, true> = {}
      for (const id of results) {
        if (!id) continue
        nextMap[id] = true
      }
      setExistsMap(nextMap)
    })

    return () => {
      cancelled = true
    }
  }, [allList, musicInfo, targetSongKey])

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="always">
      <PlaylistPickerCreateRow defaultNewListName={defaultNewListName} onCreated={onCreated} />
      {allList.map(listInfo => (
        <PlaylistPickerListItem
          key={listInfo.id}
          listInfo={listInfo}
          actionLabel={actionLabel}
          subtitle={subtitle}
          disabled={Boolean(musicInfo && existsMap[listInfo.id])}
          onPress={onPress}
        />
      ))}
    </ScrollView>
  )
}
