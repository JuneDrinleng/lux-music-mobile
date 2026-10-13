import { parseUrl, request } from '@/plugins/sync/client/utils'
import { getLuxAuth, setLuxAuth } from '@/utils/data'

export type AdminRole = 'admin' | 'user'
export type AdminUserStatus = 'active' | 'disabled'

export interface AdminPublicUser {
  id: string
  username: string
  displayName?: string
  role: AdminRole
  source: string
  status: AdminUserStatus
}

export interface AdminUserView extends AdminPublicUser {
  hasLoginPassword: boolean
  hasSyncCode: boolean
  createdAt?: number
  updatedAt?: number
  lastLoginAt?: number
  maxSnapshotNum?: number
  'list.addMusicLocationType'?: 'top' | 'bottom'
}

export interface AdminDevice {
  clientId: string
  deviceName?: string
  isMobile?: boolean
  lastConnectDate?: number
}

export interface AdminPlaylistItem {
  id?: string
  name: string
  source?: string
  sourceListId?: string
  locationUpdateTime?: number
  musicCount: number
}

export interface AdminPlaylistSummary {
  defaultList: AdminPlaylistItem
  loveList: AdminPlaylistItem
  userList: AdminPlaylistItem[]
}

export interface AdminServerStatus {
  status: boolean
  message?: string
  address?: string[]
  devices?: unknown[]
}

export interface AdminStatusResponse {
  status: AdminServerStatus
  users: number
  managedUsers: number
  invites: number
}

export interface AdminInvite {
  id: string
  codeHash: string
  role: AdminRole
  maxUses: number
  usedCount: number
  expiresAt?: number
  disabled: boolean
  createdBy: string
  createdAt: number
  usedBy: Array<{ userId: string, username: string, usedAt: number }>
}

export class LuxAdminRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const luxAdminRequest = async<T>(
  host: string,
  token: string,
  path: string,
  options: { method?: string, body?: unknown } = {},
): Promise<T> => {
  const urlInfo = parseUrl(host)
  const url = `${urlInfo.httpProtocol}//${urlInfo.hostPath}${path}`
  const method = options.body != null ? (options.method ?? 'POST') : (options.method ?? 'GET')
  const { text, code } = await request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body == null ? undefined : JSON.stringify(options.body),
  })
  let data: { message?: unknown } | null = null
  try {
    data = text ? JSON.parse(text) as { message?: unknown } : null
  } catch {
    data = null
  }
  if (code < 200 || code >= 300) {
    throw new LuxAdminRequestError(
      typeof data?.message === 'string' ? data.message : `HTTP ${code}`,
      code,
    )
  }
  return data as T
}

export type AdminAccessResult =
  | { ok: true, auth: LX.Sync.LuxAuth, token: string }
  | { ok: false, reason: 'denied' | 'no_auth' | 'inactive' }

export const ensureAdminAccess = async(host: string): Promise<AdminAccessResult> => {
  const auth = await getLuxAuth()
  if (!auth?.token) return { ok: false, reason: 'no_auth' }

  try {
    const { user } = await luxAdminRequest<{ user: AdminPublicUser }>(host, auth.token, '/api/auth/me')
    const mergedUser = { ...auth.user, ...user }
    const nextAuth: LX.Sync.LuxAuth = { ...auth, user: mergedUser }
    await setLuxAuth(nextAuth)
    if (mergedUser.status !== 'active') return { ok: false, reason: 'inactive' }
    if (mergedUser.role !== 'admin') return { ok: false, reason: 'denied' }
    return { ok: true, auth: nextAuth, token: nextAuth.token }
  } catch (err) {
    if (err instanceof LuxAdminRequestError && err.status === 403) return { ok: false, reason: 'denied' }
    if (err instanceof LuxAdminRequestError && err.status === 401) return { ok: false, reason: 'no_auth' }
    if (auth.user.status !== 'active') return { ok: false, reason: 'inactive' }
    if (auth.user.role !== 'admin') return { ok: false, reason: 'denied' }
    return { ok: true, auth, token: auth.token }
  }
}

export const adminApi = {
  status: async(host: string, token: string) => luxAdminRequest<AdminStatusResponse>(host, token, '/api/admin/status'),
  health: async(host: string, token: string) => luxAdminRequest<{ ok: boolean, serverName?: string }>(host, token, '/api/health'),
  users: async(host: string, token: string) => luxAdminRequest<{ users: AdminUserView[] }>(host, token, '/api/admin/users'),
  createUser: async(host: string, token: string, body: { username: string, password: string, displayName?: string, role: AdminRole }) =>
    luxAdminRequest<{ user: AdminPublicUser }>(host, token, '/api/admin/users', { body }),
  updateUser: async(host: string, token: string, id: string, body: Record<string, unknown>) =>
    luxAdminRequest<{ user: AdminPublicUser }>(host, token, `/api/admin/users/${id}`, { method: 'PATCH', body }),
  resetPassword: async(host: string, token: string, id: string, password: string) =>
    luxAdminRequest<{ user: AdminPublicUser }>(host, token, `/api/admin/users/${id}/password/reset`, { body: { password } }),
  userDevices: async(host: string, token: string, id: string) =>
    luxAdminRequest<{ devices: AdminDevice[] }>(host, token, `/api/admin/users/${id}/devices`),
  deleteUserDevice: async(host: string, token: string, userId: string, clientId: string) =>
    luxAdminRequest<{ ok: boolean }>(host, token, `/api/admin/users/${userId}/devices/${encodeURIComponent(clientId)}`, { method: 'DELETE' }),
  invites: async(host: string, token: string) => luxAdminRequest<{ invites: AdminInvite[] }>(host, token, '/api/admin/invites'),
  createInvite: async(host: string, token: string, body: { code?: string, role: AdminRole, maxUses: number, expiresAt?: number }) =>
    luxAdminRequest<{ invite: AdminInvite, code: string }>(host, token, '/api/admin/invites', { body }),
  updateInvite: async(host: string, token: string, id: string, body: Record<string, unknown>) =>
    luxAdminRequest<{ invite: AdminInvite }>(host, token, `/api/admin/invites/${id}`, { method: 'PATCH', body }),
  deleteInvite: async(host: string, token: string, id: string) =>
    luxAdminRequest<{ ok: boolean }>(host, token, `/api/admin/invites/${id}`, { method: 'DELETE' }),
  meDevices: async(host: string, token: string) => luxAdminRequest<{ devices: AdminDevice[] }>(host, token, '/api/me/devices'),
  mePlaylists: async(host: string, token: string) => luxAdminRequest<{ playlists: AdminPlaylistSummary }>(host, token, '/api/me/playlists'),
}
