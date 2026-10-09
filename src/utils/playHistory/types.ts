/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Shared play-record contract with lux-music-server. Field set stays exact. */
export interface PlayHistorySong {
  source: string
  songmid: string
  name: string
  singer: string
  albumName?: string
  interval?: string
  img?: string
}

export interface PlayRecord {
  /** `${deviceId}:${startedAt}` */
  id: string
  deviceId: string
  /** Epoch milliseconds when this playback session started. */
  startedAt: number
  endedAt: number
  /** Audio actually heard. Pauses and seeks are not included. */
  listenedMs: number
  song: PlayHistorySong
}

/** Pull cursor for one Lux server and user. `ackedIds` are records that server already stored. */
export interface PlayHistoryCursor {
  serverKey: string
  userId: string
  cursor: number
  ackedIds: string[]
}
