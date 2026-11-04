/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useState } from 'react'
import playerState from '@/store/player/state'
import { usePlayerMusicInfo } from '@/store/player/hook'

const getMusicInfo = (musicInfo: LX.Player.PlayMusic | null) => {
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}

const isSameSong = (a: LX.Music.MusicInfo | null, b: LX.Music.MusicInfo | null) => (
  a?.source === b?.source && a?.id === b?.id
)

// Only borrow a resolved player cover while it still belongs to this song.
const getPic = (musicInfo: LX.Music.MusicInfo | null) => {
  if (musicInfo?.meta.picUrl) return musicInfo.meta.picUrl
  const playing = playerState.playMusicInfo.musicInfo
  return musicInfo && isSameSong(musicInfo, getMusicInfo(playing)) && playerState.musicInfo.id === playing?.id
    ? playerState.musicInfo.pic ?? null
    : null
}

const createSnapshot = (musicInfo: LX.Music.MusicInfo | null) => ({
  musicInfo,
  pic: getPic(musicInfo),
  total: { hot: 0, new: 0 },
})

export default function useCommentMusicInfo({ embedded = false, active = true, refreshKey = 0 }: {
  embedded?: boolean
  active?: boolean
  refreshKey?: number
}) {
  const playerMusicInfo = usePlayerMusicInfo()
  const [snapshot, setSnapshot] = useState(() => createSnapshot(getMusicInfo(playerState.playMusicInfo.musicInfo)))
  const [wasActive, setWasActive] = useState(active)
  const [internalRefreshKey, setInternalRefreshKey] = useState(0)

  // Adjust our own state before children commit: an entry's silent refresh must
  // never start for the old song, or render its total with the new song identity.
  let nextSnapshot = snapshot
  if (active !== wasActive) {
    setWasActive(active)
    if (embedded && active) {
      const current = getMusicInfo(playerState.playMusicInfo.musicInfo)
      if (current && !isSameSong(snapshot.musicInfo, current)) nextSnapshot = createSnapshot(current)
    }
  }

  const pic = embedded ? getPic(nextSnapshot.musicInfo) : null
  if (pic && pic !== nextSnapshot.pic) nextSnapshot = { ...nextSnapshot, pic }
  if (nextSnapshot !== snapshot) setSnapshot(nextSnapshot)

  const refreshComment = useCallback(() => {
    const current = getMusicInfo(playerState.playMusicInfo.musicInfo)
    if (!current) return
    if (!isSameSong(snapshot.musicInfo, current)) setSnapshot(createSnapshot(current))
    else setInternalRefreshKey(k => k + 1)
  }, [snapshot.musicInfo])

  const setHotTotal = useCallback((next: number) => {
    setSnapshot(info => isSameSong(info.musicInfo, snapshot.musicInfo) ? { ...info, total: { ...info.total, hot: next } } : info)
  }, [snapshot.musicInfo])
  const setNewTotal = useCallback((next: number) => {
    setSnapshot(info => isSameSong(info.musicInfo, snapshot.musicInfo) ? { ...info, total: { ...info.total, new: next } } : info)
  }, [snapshot.musicInfo])

  return {
    musicInfo: snapshot.musicInfo,
    pic: embedded ? snapshot.pic : playerMusicInfo.pic,
    total: snapshot.total,
    setHotTotal,
    setNewTotal,
    refreshComment,
    combinedRefreshKey: refreshKey + internalRefreshKey,
  }
}
