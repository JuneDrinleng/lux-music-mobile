/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { isPlayRecord, mergePlayRecords } from './merge'
import { type PlayRecord } from './types'

export const LUX_BACKUP_TYPE = 'luxDataBackup'
export const LUX_BACKUP_VERSION = 1

export interface BackupPlaylists {
  defaultList: unknown[]
  loveList: unknown[]
  userList: unknown[]
}

export interface LuxBackupDocument {
  type: typeof LUX_BACKUP_TYPE
  version: typeof LUX_BACKUP_VERSION
  exportedAt: number
  playHistory: PlayRecord[]
  playlists: BackupPlaylists
  settings: Record<string, unknown>
}

const isStringRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value == 'object' && !Array.isArray(value)
}

export const isBackupPlaylists = (value: unknown): value is BackupPlaylists => {
  if (!isStringRecord(value)) return false
  return Array.isArray(value.defaultList) && Array.isArray(value.loveList) && Array.isArray(value.userList)
}

export const buildLuxBackup = (input: {
  records: readonly PlayRecord[]
  playlists: BackupPlaylists
  settings: Record<string, unknown>
  exportedAt: number
}): LuxBackupDocument => ({
  type: LUX_BACKUP_TYPE,
  version: LUX_BACKUP_VERSION,
  exportedAt: input.exportedAt,
  playHistory: mergePlayRecords(input.records),
  playlists: {
    defaultList: input.playlists.defaultList,
    loveList: input.playlists.loveList,
    userList: input.playlists.userList,
  },
  settings: { ...input.settings },
})

export const parseLuxBackup = (value: unknown): LuxBackupDocument | null => {
  if (!isStringRecord(value)) return null
  if (value.type != LUX_BACKUP_TYPE || value.version != LUX_BACKUP_VERSION) return null
  if (typeof value.exportedAt != 'number' || !Number.isFinite(value.exportedAt)) return null
  if (!Array.isArray(value.playHistory) || !value.playHistory.every(isPlayRecord)) return null
  if (!isBackupPlaylists(value.playlists) || !isStringRecord(value.settings)) return null
  return {
    type: LUX_BACKUP_TYPE,
    version: LUX_BACKUP_VERSION,
    exportedAt: value.exportedAt,
    playHistory: mergePlayRecords(value.playHistory),
    playlists: value.playlists,
    settings: value.settings,
  }
}

/** Records merge by id. Playlists and settings stay on the document for a separate overwrite confirm. */
export const importPlayHistory = (local: readonly PlayRecord[], backup: LuxBackupDocument): PlayRecord[] => {
  return mergePlayRecords(local, backup.playHistory)
}
