/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { LuxRequestError } from '@/plugins/sync/client/userErrors'

// Server contract (lux-music-server dev: src/server/api/auth.ts, /api/server-info).
export const AUTH_CONTRACT = {
  invitePath: '/api/auth/invite/check',
  inviteMethod: 'POST',
  inviteField: 'inviteCode',
  inviterField: 'inviterName',
  registerInviteField: 'inviteCode',
  refreshField: 'refreshToken',
  accessTokenField: 'accessToken',
  adminContactField: 'adminContact',
} as const

export interface RegisterForm {
  invite: string
  username: string
  displayName: string
  password: string
  confirm: string
}
export const loginErrors = (username: string, password: string) => ({
  username: username.trim() ? undefined : 'auth_required',
  password: password ? undefined : 'auth_required',
} as const)
export const registerErrors = (form: RegisterForm) => ({
  ...loginErrors(form.username, form.password),
  invite: form.invite.trim() ? undefined : 'auth_required',
  password: !form.password ? 'auth_required' : form.password.length < 8 ? 'auth_password_hint' : undefined,
  confirm: !form.confirm ? 'auth_required' : form.password !== form.confirm ? 'auth_password_mismatch' : undefined,
} as const)
export const helpMessage = (username: string, host: string, translate: (key: 'auth_help_message', args: { username: string, host: string }) => string) =>
  translate('auth_help_message', { username: username.trim(), host })

export const createLuxAuthClient = (deps: {
  send: (url: string, options: { method: string, body?: string, headers: Record<string, string> }) => Promise<{ code: number, text: string }>
  find: (host: string) => Promise<LX.Sync.LuxAuth | null>
  rotate: (previous: LX.Sync.LuxAuth, tokens: { token: string, refreshToken: string }) => Promise<LX.Sync.LuxAuth | null>
  clear: (previous: LX.Sync.LuxAuth) => Promise<boolean>
  expired: (host: string, previous: LX.Sync.LuxAuth) => void
}) => {
  const retired = new Map<string, { host: string, userId: string }>()
  const flights = new Map<string, Promise<LX.Sync.LuxAuth>>()
  const raw = async<T>(url: string, body?: unknown, token?: string, method?: string): Promise<T> => {
    const response = await deps.send(url, {
      method: method ?? (body == null ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body == null ? undefined : JSON.stringify(body),
    })
    let value: { code?: string, message?: string } | null = null
    try { value = response.text ? JSON.parse(response.text) : null } catch {}
    if (response.code < 200 || response.code >= 300) throw new LuxRequestError(value?.message ?? `HTTP ${response.code}`, response.code, value?.code)
    return value as T
  }
  const renew = async(host: string, previous: LX.Sync.LuxAuth) => {
    const key = JSON.stringify([previous.serverId ?? host, previous.user.id, previous.refreshToken])
    let flight = flights.get(key)
    if (!flight) {
      flight = (async() => {
        try {
          if (!previous.refreshToken) throw new LuxRequestError('Session expired', 401)
          const value = await raw<Record<string, unknown>>(`${host}/api/auth/refresh`, { [AUTH_CONTRACT.refreshField]: previous.refreshToken })
          const token = value[AUTH_CONTRACT.accessTokenField]
          const refreshToken = value[AUTH_CONTRACT.refreshField]
          if (typeof token !== 'string' || !token || typeof refreshToken !== 'string' || !refreshToken) throw new LuxRequestError('Invalid refresh response', 401)
          const next = await deps.rotate(previous, { token, refreshToken })
          if (!next) throw new LuxRequestError('Session changed', 401)
          retired.set(previous.token, { host, userId: previous.user.id })
          return next
        } catch (error) {
          if (await deps.clear(previous)) deps.expired(host, previous)
          throw error
        }
      })().finally(() => { flights.delete(key) })
      flights.set(key, flight)
    }
    return flight
  }
  const request = async<T>(url: string, body?: unknown, token?: string, method?: string): Promise<T> => {
    // Preserve deployment subpaths; public auth endpoints never renew recursively.
    const host = url.split('/api/')[0]
    const publicAuth = /\/api\/auth\/(login|refresh|register|invite\/check)(?:$|\?)/.test(url)
    const saved = token && !publicAuth ? await deps.find(host) : null
    const alias = token ? retired.get(token) : undefined
    const before = saved && (saved.token === token || (alias?.host === host && alias.userId === saved.user.id)) ? saved : null
    const currentToken = before?.user && before.token ? before.token : token
    try { return await raw<T>(url, body, currentToken, method) } catch (error) {
      if (!(error instanceof LuxRequestError) || error.status !== 401 || !before || publicAuth) throw error
      const latest = await deps.find(host)
      if (!latest || latest.user.id !== before.user.id) throw error
      const next = latest.token !== before.token ? latest : await renew(host, before)
      // Exactly one retry; a second 401 is terminal for this session.
      try { return await raw<T>(url, body, next.token, method) } catch (retryError) {
        if (retryError instanceof LuxRequestError && retryError.status === 401 && await deps.clear(next)) deps.expired(host, next)
        throw retryError
      }
    }
  }
  return {
    request,
    invite: async(host: string, code: string) => {
      const value = await raw<Record<string, unknown>>(`${host}${AUTH_CONTRACT.invitePath}`, { [AUTH_CONTRACT.inviteField]: code.trim() }, undefined, AUTH_CONTRACT.inviteMethod)
      if (value.valid !== true) throw new Error('Invalid invite response')
      const inviter = value[AUTH_CONTRACT.inviterField]
      return typeof inviter === 'string' && inviter ? inviter : null
    },
    register: async(host: string, form: RegisterForm) => {
      if (Object.values(registerErrors(form)).some(Boolean)) throw new Error('Invalid registration form')
      return raw<LX.Sync.LuxAuth>(`${host}/api/auth/register`, {
        [AUTH_CONTRACT.registerInviteField]: form.invite.trim(), username: form.username.trim(), ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}), password: form.password,
      })
    },
  }
}
