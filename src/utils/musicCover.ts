const normalizeCoverUrl = (cover?: string | null) => {
  if (typeof cover != 'string') return null
  const normalizedCover = cover.trim()
  return normalizedCover.length ? normalizedCover : null
}

export const pickMusicCover = (song: LX.Music.MusicInfo, fallbackCover?: string | null) => {
  return normalizeCoverUrl(song.meta.picUrl) ??
    normalizeCoverUrl(song.meta.toggleMusicInfo?.meta.picUrl) ??
    normalizeCoverUrl(fallbackCover)
}

export const applyMusicCoverFallback = <T extends LX.Music.MusicInfo>(list: T[], fallbackCover?: string | null): T[] => {
  return list.map((song) => {
    const cover = pickMusicCover(song, fallbackCover)
    if (!cover || normalizeCoverUrl(song.meta.picUrl) == cover) return song

    const nextSong = {
      ...song,
      meta: {
        ...song.meta,
      },
    }
    nextSong.meta.picUrl = cover
    return nextSong
  })
}
