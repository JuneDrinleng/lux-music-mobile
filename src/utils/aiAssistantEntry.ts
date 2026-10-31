/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Mode comes from the same LX.Sync.Mode used by the sync format options.
// A blank host is local mode, even when the saved format is still Lux.
export const isAiAssistantAvailable = (mode: LX.Sync.Mode | null | undefined, host: string | null | undefined): boolean => (
  mode === 'lux' && !!host?.trim()
)
