import { useCallback, useMemo, useRef, useState } from 'react'

import { LIST_IDS } from '@/config/constant'
import { addListMusics, getListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

export interface ImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
}

interface UsePlaylistImportParams {
  selectedListId: string | null
  playlists: LX.List.MyListInfo[]
  loadLocalDetailSongs: (id: string, showLoading?: boolean) => Promise<void>
}

export type UsePlaylistImportResult = ReturnType<typeof usePlaylistImport>

export const usePlaylistImport = ({
  selectedListId,
  playlists,
  loadLocalDetailSongs,
}: UsePlaylistImportParams) => {
  const importRequestIdRef = useRef(0)
  const [isImportDrawerVisible, setImportDrawerVisible] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([])
  const [importSelectedMap, setImportSelectedMap] = useState<Record<string, true>>({})

  const importSelectedCount = useMemo(() => Object.keys(importSelectedMap).length, [importSelectedMap])
  const areAllImportSongsSelected = useMemo(() => {
    return importCandidates.length > 0 && importCandidates.every(candidate => importSelectedMap[candidate.id])
  }, [importCandidates, importSelectedMap])

  const loadImportCandidates = useCallback(async(targetListId: string) => {
    const requestId = ++importRequestIdRef.current
    setImportLoading(true)
    try {
      const currentSongs = await getListMusics(targetListId)
      const existingSongIds = new Set(currentSongs.map(song => `${song.source}_${song.id}`))
      const otherLists = playlists.filter(list => list.id !== targetListId && list.id !== LIST_IDS.DEFAULT)
      const listSongs = await Promise.all(otherLists.map(async(list) => {
        const songs = await getListMusics(list.id)
        return { listName: list.name, songs }
      }))
      const dedupeMap = new Set<string>()
      const candidates: ImportCandidate[] = []
      for (const { listName, songs } of listSongs) {
        for (const song of songs) {
          const songKey = `${song.source}_${song.id}`
          if (existingSongIds.has(songKey) || dedupeMap.has(songKey)) continue
          dedupeMap.add(songKey)
          candidates.push({
            id: songKey,
            musicInfo: song,
            fromListName: listName,
          })
        }
      }
      if (requestId !== importRequestIdRef.current) return
      setImportCandidates(candidates)
    } finally {
      if (requestId === importRequestIdRef.current) setImportLoading(false)
    }
  }, [playlists])

  const handleOpenImportDrawer = useCallback(() => {
    if (!selectedListId) return
    setImportDrawerVisible(true)
    setImportCandidates([])
    setImportSelectedMap({})
    void loadImportCandidates(selectedListId)
  }, [loadImportCandidates, selectedListId])

  const handleCloseImportDrawer = useCallback(() => {
    if (importSubmitting) return
    setImportDrawerVisible(false)
  }, [importSubmitting])

  const handleToggleImportSong = useCallback((songId: string) => {
    setImportSelectedMap((prev) => {
      const next = { ...prev }
      if (next[songId]) delete next[songId]
      else next[songId] = true
      return next
    })
  }, [])

  const handleToggleSelectAllImportSongs = useCallback(() => {
    if (!importCandidates.length) return
    setImportSelectedMap(() => {
      if (areAllImportSongsSelected) return {}
      const next: Record<string, true> = {}
      for (const candidate of importCandidates) next[candidate.id] = true
      return next
    })
  }, [areAllImportSongsSelected, importCandidates])

  const handleImportSelectedSongs = useCallback(async() => {
    if (!selectedListId || importSubmitting) return
    const selectedSongs = importCandidates
      .filter(candidate => importSelectedMap[candidate.id])
      .map(candidate => candidate.musicInfo)
    if (!selectedSongs.length) return
    setImportSubmitting(true)
    try {
      await addListMusics(selectedListId, selectedSongs, settingState.setting['list.addMusicLocationType'])
      setImportDrawerVisible(false)
      setImportSelectedMap({})
      setImportCandidates([])
      void loadLocalDetailSongs(selectedListId)
    } finally {
      setImportSubmitting(false)
    }
  }, [importCandidates, importSelectedMap, importSubmitting, loadLocalDetailSongs, selectedListId])

  return {
    isImportDrawerVisible,
    setImportDrawerVisible,
    importLoading,
    setImportLoading,
    importSubmitting,
    setImportSubmitting,
    importCandidates,
    setImportCandidates,
    importSelectedMap,
    setImportSelectedMap,
    importSelectedCount,
    areAllImportSongsSelected,
    handleOpenImportDrawer,
    handleCloseImportDrawer,
    handleToggleImportSong,
    handleToggleSelectAllImportSongs,
    handleImportSelectedSongs,
  }
}
