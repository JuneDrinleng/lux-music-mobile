/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface AccountSession {
  id: string
  deviceId: string
  deviceName: string
  platform: string
  createdAt: string
  lastActiveAt: string
  current: boolean
}
export const mapSessions = (value: { sessions: AccountSession[] }): AccountSession[] => {
  if (!Array.isArray(value.sessions) || value.sessions.some(item => !item || typeof item.id !== 'string' || typeof item.current !== 'boolean')) throw new Error('Invalid sessions response')
  return value.sessions.map(item => ({ ...item, deviceName: item.deviceName || item.deviceId, platform: item.platform || '' }))
}
export const relativeActivity = (value: string, now = Date.now()) => {
  const elapsed = now - Date.parse(value)
  if (!Number.isFinite(elapsed)) return { key: 'account_activity_unknown' as const, args: undefined }
  const minutes = Math.max(0, Math.floor(elapsed / 60000))
  if (minutes < 1) return { key: 'account_activity_now' as const, args: undefined }
  if (minutes < 60) return { key: 'account_activity_minutes' as const, args: { count: minutes } }
  if (minutes < 1440) return { key: 'account_activity_hours' as const, args: { count: Math.floor(minutes / 60) } }
  return { key: 'account_activity_days' as const, args: { count: Math.floor(minutes / 1440) } }
}
export const accountRows = (server: boolean) => server ? ['nickname', 'avatar', 'devices', 'password', 'switch', 'logout'] : ['nickname', 'avatar', 'switch']

export const createSessionService = (request: <T>(url: string, body?: unknown, token?: string, method?: string) => Promise<T>, host: string, token: string) => {
  const url = `${host.replace(/\/+$/, '')}/api/me/sessions`
  const list = async() => mapSessions(await request<{ sessions: AccountSession[] }>(url, undefined, token))
  return {
    list,
    remove: async(id: string) => {
      await request(`${url}/${encodeURIComponent(id)}`, undefined, token, 'DELETE')
      return list()
    },
    revokeOthers: async() => {
      await request(`${url}/revoke-others`, {}, token, 'POST')
      return list()
    },
  }
}
