import {
  clearLuxAuth,
  clearSyncAuthKey,
  clearSyncLoginDraft,
  getSyncLoginDrafts,
  setSyncLoginDrafts,
} from '@/utils/data'

export const dropSyncLoginDraftForMode = (
  drafts: LX.Sync.LoginDrafts | null | undefined,
  mode: LX.Sync.Mode,
): LX.Sync.LoginDrafts | null => {
  if (!drafts) return null
  const next: LX.Sync.LoginDrafts = { ...drafts }
  if (mode == 'lux') delete next.lux
  else delete next.lx
  if (!next.lux && !next.lx) return null
  return next
}

/** Only call from the sync login screen “clear saved login info” action. */
export const clearSavedSyncLoginCredentialsForMode = async(mode: LX.Sync.Mode) => {
  const nextDrafts = dropSyncLoginDraftForMode(await getSyncLoginDrafts(), mode)
  if (nextDrafts) await setSyncLoginDrafts(nextDrafts)
  else await clearSyncLoginDraft()
  const { appSession } = await import('@/core/appSession')
  await appSession.revokeReturn()
  if (mode == 'lux') await clearLuxAuth()
  else await clearSyncAuthKey()
}
