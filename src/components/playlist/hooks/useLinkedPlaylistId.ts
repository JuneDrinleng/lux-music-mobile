import { useEffect, useState } from 'react'

import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'
import { isPlayQueueMetaId } from '@/core/player/player'
import { usePlayMusicInfo } from '@/store/player/hook'
import listState from '@/store/list/state'

const getQueueSourceListId = (queueMetaId: string | null | undefined) => {
  if (!isPlayQueueMetaId(queueMetaId)) return null
  const queueBody = (queueMetaId ?? '').slice('play_queue__'.length)
  const timestampSeparatorIndex = queueBody.lastIndexOf('_')
  if (timestampSeparatorIndex < 0) return queueBody
  return queueBody.slice(0, timestampSeparatorIndex)
}

export default function useLinkedPlaylistId() {
  const playMusicInfo = usePlayMusicInfo()
  const currentQueueMetaId = playMusicInfo.listId === LIST_IDS.TEMP ? listState.tempListMeta.id : null
  const [linkedPlaylistId, setLinkedPlaylistId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const syncLinkedPlaylist = async() => {
      const currentListId = playMusicInfo.listId
      if (!currentListId || !playMusicInfo.musicInfo) {
        if (!cancelled) setLinkedPlaylistId(null)
        return
      }

      if (currentListId !== LIST_IDS.TEMP) {
        if (!cancelled) setLinkedPlaylistId(currentListId)
        return
      }

      const sourceListId = getQueueSourceListId(currentQueueMetaId)
      if (!sourceListId) {
        if (!cancelled) setLinkedPlaylistId(null)
        return
      }

      const [tempList, sourceList] = await Promise.all([
        getListMusics(LIST_IDS.TEMP),
        getListMusics(sourceListId),
      ])
      const isSameList = tempList.length === sourceList.length && tempList.every((music, index) => {
        const sourceMusic = sourceList[index]
        return sourceMusic != null && sourceMusic.id === music.id && sourceMusic.source === music.source
      })

      if (!cancelled) setLinkedPlaylistId(isSameList ? sourceListId : null)
    }

    const handleListUpdate = (ids: string[]) => {
      if (!playMusicInfo.listId) return
      if (playMusicInfo.listId !== LIST_IDS.TEMP) return

      const sourceListId = getQueueSourceListId(currentQueueMetaId)
      if (!ids.includes(LIST_IDS.TEMP) && (!sourceListId || !ids.includes(sourceListId))) return
      void syncLinkedPlaylist()
    }

    void syncLinkedPlaylist()
    global.app_event.on('myListMusicUpdate', handleListUpdate)

    return () => {
      cancelled = true
      global.app_event.off('myListMusicUpdate', handleListUpdate)
    }
  }, [currentQueueMetaId, playMusicInfo.listId, playMusicInfo.musicInfo])

  return linkedPlaylistId
}
