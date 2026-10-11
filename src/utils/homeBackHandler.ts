/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export const isHomeScreenActive = (componentIds: Readonly<Record<string, string | undefined>>): boolean => {
  // Closing the embedded player retains its key with an empty component ID.
  // Only a non-empty ID represents a screen above Home that owns the back press.
  return Boolean(componentIds.home) && Object.entries(componentIds).every(([name, id]) => name === 'home' || !id)
}
