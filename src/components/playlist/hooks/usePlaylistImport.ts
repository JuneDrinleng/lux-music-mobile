import { type ImportCandidate, buildLocalCandidates } from '@/utils/playlistImport/local'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { LIST_IDS } from '@/config/constant'
import { addListMusics, getListMusics } from '@/core/list'
import { useI18n } from '@/lang'
import { toast } from '@/utils/tools'
import settingState from '@/store/setting/state'

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
  const t = useI18n()
  const submittingRef = useRef(false)
  const importRequestIdRef = useRef(0)
  const [isImportDrawerVisible, setImportDrawerVisible] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([])
  const [importSelectedMap, setImportSelectedMap] = useState<Record<string, true>>({})

  useEffect(() => () => { importRequestIdRef.current += 1 }, [selectedListId])

  const importSelectedCount = useMemo(() => Object.keys(importSelectedMap).length, [importSelectedMap])
  const areAllImportSongsSelected = useMemo(() => {
    return importCandidates.length > 0 && importCandidates.every(candidate => importSelectedMap[candidate.id])
  }, [importCandidates, importSelectedMap])

  const loadImportCandidates = useCallback(async(targetListId: string) => {
    const requestId = ++importRequestIdRef.current
    setImportLoading(true)
    try {
      const currentSongs = await getListMusics(targetListId)
      const otherLists = playlists.filter(list => list.id !== targetListId && list.id !== LIST_IDS.DEFAULT)
      const listSongs = await Promise.all(otherLists.map(async(list) => {
        const songs = await getListMusics(list.id)
        return { id: list.id, listName: list.name, songs }
      }))
      const candidates = buildLocalCandidates(currentSongs, listSongs)
      if (requestId !== importRequestIdRef.current) return
      setImportCandidates(candidates)
    } catch {
      if (requestId === importRequestIdRef.current) toast(t('import_error'))
    } finally {
      if (requestId === importRequestIdRef.current) setImportLoading(false)
    }
  }, [playlists, t])

  const handleOpenImportDrawer = useCallback(() => {
    if (!selectedListId) return
    setImportDrawerVisible(true)
    setImportCandidates([])
    setImportSelectedMap({})
    void loadImportCandidates(selectedListId)
  }, [loadImportCandidates, selectedListId])

  const handleCloseImportDrawer = useCallback(() => {
    if (submittingRef.current) return
    importRequestIdRef.current += 1
    setImportDrawerVisible(false)
  }, [])

  const handleToggleImportSong = useCallback((songId: string) => {
    setImportSelectedMap((prev) => {
      const next = { ...prev }
      if (next[songId]) delete next[songId]
      else next[songId] = true
      return next
    })
  }, [])

  const handleToggleSelectAllImportSongs = useCallback((visibleIds?: string[]) => {
    const targets = visibleIds?.length
      ? visibleIds
      : importCandidates.map(candidate => candidate.id)
    if (!targets.length) return
    setImportSelectedMap((prev) => {
      const allVisibleSelected = targets.every(id => prev[id])
      const next = { ...prev }
      if (allVisibleSelected) {
        for (const id of targets) delete next[id]
      } else {
        for (const id of targets) next[id] = true
      }
      return next
    })
  }, [importCandidates])

  const handleImportSelectedSongs = useCallback(async() => {
    if (!selectedListId || submittingRef.current) return
    const selectedSongs = importCandidates
      .filter(candidate => importSelectedMap[candidate.id])
      .map(candidate => candidate.musicInfo)
    if (!selectedSongs.length) return
    submittingRef.current = true
    setImportSubmitting(true)
    try {
      const current = await getListMusics(selectedListId)
      const existing = new Set(current.map(song => `${song.source}_${song.id}`))
      const songs = selectedSongs.filter(song => !existing.has(`${song.source}_${song.id}`))
      await addListMusics(selectedListId, songs, settingState.setting['list.addMusicLocationType'])
      toast(t('import_lux_done', { num: songs.length }))
      setImportDrawerVisible(false)
      setImportSelectedMap({})
      setImportCandidates([])
      void loadLocalDetailSongs(selectedListId)
    } catch {
      toast(t('import_error'))
    } finally {
      submittingRef.current = false
      setImportSubmitting(false)
    }
  }, [importCandidates, importSelectedMap, loadLocalDetailSongs, selectedListId, t])

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
