/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { updateSetting } from '@/core/common'
import { getLocalListData, setLocalListData } from '@/plugins/sync/listEvent'
import settingState from '@/store/setting/state'
import { dateFormat } from '@/utils/common'
import { writeFile } from '@/utils/fs'
import { confirmDialog, handleReadFile } from '@/utils/tools'

import { buildLuxBackup, parseLuxBackup } from './backup'
import { mergePlayRecords } from './merge'
import { getPlayRecords, replacePlayRecords } from './store'

const settingsSnapshot = (): Record<string, unknown> => {
  const settings: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settingState.setting)) settings[key] = value
  return settings
}

export const exportLuxBackupFile = async(directory: string): Promise<string> => {
  const document = buildLuxBackup({
    records: getPlayRecords(),
    playlists: await getLocalListData(),
    settings: settingsSnapshot(),
    exportedAt: Date.now(),
  })
  const stamp = dateFormat(Date.now(), 'YMD_hms').replace(/[^\d]/g, '')
  const path = `${directory.replace(/\/$/, '')}/lux-data-backup-${stamp || Date.now()}.json`
  await writeFile(path, JSON.stringify(document), 'utf8')
  return path
}

/**
 * Play records merge by id immediately.
 * Playlists and settings each ask before they replace what is already on the device.
 */
export const importLuxBackupFile = async(path: string): Promise<'ok' | 'invalid'> => {
  const document = parseLuxBackup(await handleReadFile<unknown>(path))
  if (!document) return 'invalid'
  await replacePlayRecords(mergePlayRecords(getPlayRecords(), document.playHistory))
  const overwritePlaylists = await confirmDialog({
    message: global.i18n.t('setting_import_overwrite_playlists'),
    bgClose: false,
  })
  if (overwritePlaylists) await setLocalListData(document.playlists as LX.Sync.List.ListData)
  const overwriteSettings = await confirmDialog({
    message: global.i18n.t('setting_import_overwrite_settings'),
    bgClose: false,
  })
  if (overwriteSettings) updateSetting(document.settings as Partial<LX.AppSetting>)
  return 'ok'
}
