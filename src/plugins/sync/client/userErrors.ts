/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export class LuxRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
}

export const profileSyncErrorMessage = (error: unknown): string => {
  const t = global.i18n.t.bind(global.i18n)
  if (error instanceof LuxRequestError && (error.code == 'AVATAR_TOO_LARGE' || error.status == 413)) return t('sync_profile_avatar_too_large')
  const message = error instanceof Error ? error.message : String(error ?? '')
  return `${t('sync_profile_failed')}${message ? `: ${message}` : ''}`
}

export const luxSessionExpiredMessage = (): string => `${global.i18n.t('sync_lux_session_expired_title')}\n${global.i18n.t('sync_lux_session_expired_body')}`
