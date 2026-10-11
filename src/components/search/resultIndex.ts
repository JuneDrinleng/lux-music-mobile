/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export const formatSearchResultIndex = (index: unknown): string => {
  const safeIndex = typeof index == 'number' && Number.isSafeInteger(index) && index >= 0 && index < Number.MAX_SAFE_INTEGER
    ? index
    : 0
  return String(safeIndex + 1).padStart(2, '0')
}
