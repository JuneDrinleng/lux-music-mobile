/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { selectManagedFolder } from '@/utils/fs'

// Scoped storage starts on Android 10. Keep the legacy selector for older devices
// only when explicitly selected in settings; never fall back after a SAF error.
export const usesScopedDirectoryPicker = (apiLevel: number, useSystemSelector: boolean): boolean => apiLevel >= 29 || useSystemSelector

export const pickExportDirectory = async(isPersist = false): Promise<string | null> => {
  // The dependency resolves null when the user cancels (its TS type omits null).
  const directory = await selectManagedFolder(isPersist)
  if (!directory) return null
  if (!directory.isDirectory || !directory.path.startsWith('content://')) {
    throw new Error(global.i18n.t('storage_export_directory_invalid'))
  }
  return directory.path
}

export const fileAccessError = (error: unknown): string => {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) return error.message
  return global.i18n.t('storage_export_error_unknown')
}
