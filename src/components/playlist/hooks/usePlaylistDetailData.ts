import { useCallback, useEffect, useRef, useState } from 'react'
import { InteractionManager } from 'react-native'

import { getListMusics } from '@/core/list'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { getListDetail as getLeaderboardListDetail, getListDetailAll as getLeaderboardListDetailAll } from '@/core/leaderboard'
import { type LeaderboardDetailPayload, type OnlinePlaylistDetailPayload, type PlaylistDetailPayload } from '@/event/appEvent'
import { useI18n } from '@/lang'
import { applyMusicCoverFallback, pickMusicCover } from '@/utils/musicCover'
import { getListMusicSync } from '@/utils/listManage'
import { getSourceTone } from '@/components/search/sourceTone'

const playlistSnapshotCache = new Map<string, {
  songs: LX.Music.MusicInfo[]
  count: number
  pic: string | null
}>()

export const getOnlinePlaylistDetailKey = (detail: OnlinePlaylistDetailPayload) =>
  `online_songlist__${detail.source}__${detail.id}`

export const getLbCacheKey = (detail: LeaderboardDetailPayload) =>
  `leaderboard__${detail.source}__${detail.boardId}`

const pickCover = (list: LX.Music.MusicInfo[]) => {
  for (const song of list) {
    const cover = pickMusicCover(song)
    if (cover) return cover
  }
  return null
}

export const cachePlaylistSnapshot = (
  id: string,
  list: LX.Music.MusicInfo[],
  picOverride?: string | null,
) => {
  const songs = [...list]
  const pic = picOverride ?? pickCover(songs)
  const cached = { songs, count: songs.length, pic }
  playlistSnapshotCache.set(id, cached)
  return cached
}

const isUserListInfo = (listInfo: LX.List.MyListInfo | null): listInfo is LX.List.UserListInfo => {
  return Boolean(listInfo && 'locationUpdateTime' in listInfo)
}

export type UsePlaylistDetailDataResult = ReturnType<typeof usePlaylistDetailData>

export const usePlaylistDetailData = (
  detail: PlaylistDetailPayload,
  playlists: LX.List.MyListInfo[],
) => {
  const t = useI18n()
  const detailRequestIdRef = useRef(0)
  const detailSongsRef = useRef<LX.Music.MusicInfo[]>([])
  const [detailSongs, setDetailSongs] = useState<LX.Music.MusicInfo[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const selectedListId = detail.type == 'local' ? detail.listId : null
  const selectedOnlineDetail = detail.type == 'onlineSonglist' ? detail : null
  const selectedLeaderboardDetail = detail.type == 'leaderboard' ? detail : null
  const selectedOnlineOrLeaderboard = selectedOnlineDetail ?? selectedLeaderboardDetail
  const selectedDetailCacheKey = selectedListId ??
    (selectedOnlineDetail ? getOnlinePlaylistDetailKey(selectedOnlineDetail) : null) ??
    (selectedLeaderboardDetail ? getLbCacheKey(selectedLeaderboardDetail) : null)
  const selectedListInfo = selectedListId ? playlists.find(list => list.id === selectedListId) ?? null : null
  const selectedDetailSnapshot = selectedDetailCacheKey ? playlistSnapshotCache.get(selectedDetailCacheKey) ?? null : null
  const selectedListMeta = selectedListInfo ? selectedDetailSnapshot : null
  const canRenameSelectedList = isUserListInfo(selectedListInfo)
  const detailHeroName = selectedOnlineOrLeaderboard?.name ?? selectedListInfo?.name ?? ''
  const detailHeroCover = selectedOnlineDetail?.img ?? selectedListMeta?.pic ?? selectedDetailSnapshot?.pic ?? null
  const detailHeroSongCount = selectedOnlineOrLeaderboard
    ? selectedDetailSnapshot?.count ?? detailSongs.length
    : selectedListMeta?.count ?? selectedDetailSnapshot?.count ?? detailSongs.length
  const detailHeroMetaText = selectedOnlineOrLeaderboard
    ? [selectedOnlineDetail?.author, selectedOnlineDetail?.play_count, t('me_songs_count', { num: detailHeroSongCount })].filter(Boolean).join(' · ')
    : t('me_songs_count', { num: detailHeroSongCount })
  const detailHeroSourceTone = selectedOnlineOrLeaderboard ? getSourceTone(selectedOnlineOrLeaderboard.source) : null
  const detailHeroSourceLabel = selectedOnlineOrLeaderboard ? t(`source_real_${selectedOnlineOrLeaderboard.source}`) : ''

  const loadLocalDetailSongs = useCallback(async(id: string, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    const list = await getListMusics(id)
    if (requestId !== detailRequestIdRef.current) return
    cachePlaylistSnapshot(id, list)
    setDetailSongs([...list])
    if (showLoading) setDetailLoading(false)
  }, [])

  const loadOnlineDetailSongs = useCallback(async(onlineDetail: OnlinePlaylistDetailPayload, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    try {
      if (!showLoading) {
        const list = applyMusicCoverFallback(
          await getListDetailAll(onlineDetail.source, onlineDetail.id),
          onlineDetail.img ?? null,
        )
        if (requestId !== detailRequestIdRef.current) return
        cachePlaylistSnapshot(getOnlinePlaylistDetailKey(onlineDetail), list, onlineDetail.img ?? null)
        setDetailSongs([...list])
        return
      }
      const firstPage = await getListDetail(onlineDetail.id, onlineDetail.source, 1)
      if (requestId !== detailRequestIdRef.current) return
      const firstPageList = applyMusicCoverFallback(firstPage.list ?? [], onlineDetail.img ?? null)
      if (firstPage.total <= firstPage.limit) {
        cachePlaylistSnapshot(getOnlinePlaylistDetailKey(onlineDetail), firstPageList, onlineDetail.img ?? null)
        setDetailSongs(firstPageList)
        setDetailLoading(false)
        return
      }
      setDetailSongs(firstPageList)
      setDetailLoading(false)
      const fullList = applyMusicCoverFallback(
        await getListDetailAll(onlineDetail.source, onlineDetail.id),
        onlineDetail.img ?? null,
      )
      if (requestId !== detailRequestIdRef.current) return
      cachePlaylistSnapshot(getOnlinePlaylistDetailKey(onlineDetail), fullList, onlineDetail.img ?? null)
      setDetailSongs([...fullList])
    } catch {
      if (requestId !== detailRequestIdRef.current) return
      if (showLoading) setDetailLoading(false)
    }
  }, [])

  const loadLeaderboardSongs = useCallback(async(lbDetail: LeaderboardDetailPayload, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    try {
      if (!showLoading) {
        const list = applyMusicCoverFallback(await getLeaderboardListDetailAll(lbDetail.boardId), null)
        if (requestId !== detailRequestIdRef.current) return
        cachePlaylistSnapshot(getLbCacheKey(lbDetail), list, null)
        setDetailSongs([...list])
        return
      }
      const firstPage = await getLeaderboardListDetail(lbDetail.boardId, 1)
      if (requestId !== detailRequestIdRef.current) return
      const firstPageList = applyMusicCoverFallback(firstPage.list ?? [], null)
      if (firstPage.total <= firstPage.limit) {
        cachePlaylistSnapshot(getLbCacheKey(lbDetail), firstPageList, null)
        setDetailSongs(firstPageList)
        setDetailLoading(false)
        return
      }
      setDetailSongs(firstPageList)
      setDetailLoading(false)
      const fullList = applyMusicCoverFallback(await getLeaderboardListDetailAll(lbDetail.boardId), null)
      if (requestId !== detailRequestIdRef.current) return
      cachePlaylistSnapshot(getLbCacheKey(lbDetail), fullList, null)
      setDetailSongs([...fullList])
    } catch {
      if (requestId !== detailRequestIdRef.current) return
      if (showLoading) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    detailSongsRef.current = detailSongs
  }, [detailSongs])

  useEffect(() => {
    if (selectedListId) {
      const cached = playlistSnapshotCache.get(selectedListId)
      if (cached) {
        setDetailSongs([...cached.songs])
        setDetailLoading(false)
        const handle = InteractionManager.runAfterInteractions(() => {
          void loadLocalDetailSongs(selectedListId, false)
        })
        return () => { handle.cancel() }
      }
      const memorySongs = getListMusicSync(selectedListId)
      if (memorySongs.length) {
        setDetailSongs([...memorySongs])
        setDetailLoading(false)
        const handle = InteractionManager.runAfterInteractions(() => {
          void loadLocalDetailSongs(selectedListId, false)
        })
        return () => { handle.cancel() }
      }
      setDetailLoading(true)
      void loadLocalDetailSongs(selectedListId, true)
    }
    if (selectedOnlineDetail) {
      const cached = playlistSnapshotCache.get(getOnlinePlaylistDetailKey(selectedOnlineDetail))
      setDetailSongs(cached ? [...cached.songs] : [])
      setDetailLoading(!cached)
      const handle = InteractionManager.runAfterInteractions(() => {
        void loadOnlineDetailSongs(selectedOnlineDetail, !cached)
      })
      return () => { handle.cancel() }
    }
  }, [loadLocalDetailSongs, loadOnlineDetailSongs, selectedListId, selectedOnlineDetail])

  useEffect(() => {
    if (!selectedLeaderboardDetail) return
    const key = getLbCacheKey(selectedLeaderboardDetail)
    const cached = playlistSnapshotCache.get(key)
    setDetailSongs(cached ? [...cached.songs] : [])
    setDetailLoading(!cached)
    const handle = InteractionManager.runAfterInteractions(() => {
      void loadLeaderboardSongs(selectedLeaderboardDetail, !cached)
    })
    return () => { handle.cancel() }
  }, [loadLeaderboardSongs, selectedLeaderboardDetail])

  useEffect(() => {
    const handleMusicUpdate = (ids: string[]) => {
      if (!selectedListId || !ids.includes(selectedListId)) return
      void loadLocalDetailSongs(selectedListId)
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [loadLocalDetailSongs, selectedListId])

  return {
    detailRequestIdRef,
    detailSongsRef,
    detailSongs,
    detailLoading,
    setDetailSongs,
    setDetailLoading,
    selectedListId,
    selectedOnlineDetail,
    selectedLeaderboardDetail,
    selectedOnlineOrLeaderboard,
    selectedDetailCacheKey,
    selectedListInfo,
    selectedDetailSnapshot,
    selectedListMeta,
    canRenameSelectedList,
    detailHeroName,
    detailHeroCover,
    detailHeroSongCount,
    detailHeroMetaText,
    detailHeroSourceTone,
    detailHeroSourceLabel,
    loadLocalDetailSongs,
    loadOnlineDetailSongs,
    loadLeaderboardSongs,
  }
}
