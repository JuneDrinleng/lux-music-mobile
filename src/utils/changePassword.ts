/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { LuxRequestError } from '@/plugins/sync/client/userErrors'

export interface PasswordForm { oldPassword: string, password: string, confirm: string }
export const passwordErrors = (form: PasswordForm) => ({
  oldPassword: form.oldPassword ? undefined : 'auth_required',
  password: !form.password ? 'auth_required' : form.password.length < 8 ? 'auth_password_hint' : undefined,
  confirm: !form.confirm ? 'auth_required' : form.password !== form.confirm ? 'auth_password_mismatch' : undefined,
} as const)

export const passwordErrorKey = (error: unknown) => {
  if (error instanceof LuxRequestError) {
    if (error.code === 'INVALID_CURRENT_PASSWORD') return 'password_current_invalid'
    if (error.status === 429 || error.code === 'RATE_LIMITED') return 'password_rate_limited'
    if (error.code === 'SESSION_REQUIRED') return 'password_session_required'
    if (error.status === 401) return 'password_session_expired'
    if (error.code === 'MISSING_FIELDS' || error.code === 'INVALID_REQUEST') return 'password_invalid_request'
  }
  return 'password_failed'
}

// A count is only trustworthy if the response identifies the current session.
export const otherSessionCount = (value: unknown, sessionId?: string): number | null => {
  if (!value || typeof value !== 'object') return null
  const raw = (value as { sessions?: unknown }).sessions
  if (!Array.isArray(raw) || raw.some(item => !item || typeof item !== 'object')) return null
  const sessions = raw as Array<{ id?: unknown, sessionId?: unknown, current?: unknown, isCurrent?: unknown }>
  const currentId = (value as { currentSessionId?: unknown }).currentSessionId ?? sessionId
  const isCurrent = (item: { id?: unknown, sessionId?: unknown, current?: unknown, isCurrent?: unknown }) =>
    item.current === true || item.isCurrent === true || (typeof currentId === 'string' && (item.id === currentId || item.sessionId === currentId))
  if (!sessions.some(isCurrent)) return null
  return sessions.filter(item => !isCurrent(item)).length
}

export const sessionCountMessage = (count: number | null) => count === null
  ? { key: 'password_other_devices_unknown' as const, args: undefined }
  : { key: 'password_other_devices_count' as const, args: { count } }

interface PasswordSession { ok: boolean, accessToken?: string, token?: string, refreshToken: string, sessionId: string, accessTokenExpiresAt: string, user: LX.Sync.LuxAuth['user'] }
export const createPasswordService = (deps: {
  request: <T>(url: string, body?: unknown, token?: string, method?: string) => Promise<T>
  find: (host: string) => Promise<LX.Sync.LuxAuth | null>
  rotate: (previous: LX.Sync.LuxAuth, next: { token: string, refreshToken: string } & Pick<LX.Sync.LuxAuth, 'sessionId' | 'accessTokenExpiresAt' | 'user'>) => Promise<LX.Sync.LuxAuth | null>
}) => ({
  count: async(host: string, session: LX.Sync.LuxAuth) => otherSessionCount(await deps.request(`${host}/api/me/sessions`, undefined, session.token), session.sessionId),
  change: async(host: string, session: LX.Sync.LuxAuth, form: PasswordForm, revokeOtherDevices: boolean) => {
    if (Object.values(passwordErrors(form)).some(Boolean)) throw new LuxRequestError('Invalid form', 400, 'INVALID_REQUEST')
    const value = await deps.request<PasswordSession>(`${host}/api/me/password`, { oldPassword: form.oldPassword, password: form.password, revokeOtherDevices }, session.token, 'POST')
    const token = value.accessToken ?? value.token
    if (!value.ok || typeof token !== 'string' || !token || typeof value.refreshToken !== 'string' || !value.refreshToken || value.user?.id !== session.user.id) throw new Error('Invalid password response')
    // request() may have refreshed the bearer. Re-read before the compare-and-swap,
    // and never resurrect a logged-out account or replace another account.
    const current = await deps.find(host)
    if (!current || current.user.id !== session.user.id || current.serverId !== session.serverId) throw new LuxRequestError('Session changed', 401)
    const saved = await deps.rotate(current, { token, refreshToken: value.refreshToken, sessionId: value.sessionId, accessTokenExpiresAt: value.accessTokenExpiresAt, user: value.user })
    if (!saved) throw new LuxRequestError('Session changed', 401)
    return saved
  },
})
