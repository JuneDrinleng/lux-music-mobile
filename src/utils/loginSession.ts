/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { normalizeServerUrl } from './serverCheck'

/** Product identities are distinct from the lx/lux wire protocol and socket session. */
export type LoginProvider = 'local' | 'lx' | 'lux'
export type SessionConnectivity = 'online' | 'connecting' | 'offline' | 'expired' | 'incompatible' | 'disabled'
export type CredentialRef = { kind: 'syncKey', id: string } | { kind: 'luxRefresh', id: string }
export interface ServerIdentity { url: string, serverId: string }
export interface AccountIdentity { userId: string, username: string, displayName?: string }
export type ActiveSession =
  | { provider: 'local', spaceId: 'local' }
  | { provider: 'lx', spaceId: 'local', server: ServerIdentity, deviceId: string, credentialRef: CredentialRef }
  | { provider: 'lux', spaceId: `lux:${string}:${string}`, server: ServerIdentity, account: AccountIdentity, credentialRef: CredentialRef }

export interface LoginIntent {
  reason: 'boot' | 'switch' | 'add' | 'changeServer' | 'reauth' | 'logout' | 'capability'
  source: string
  targetProvider?: LoginProvider
  targetRecentId?: string
  targetIdentity?: ActiveSession
  /** null: new server, no prefill; undefined: history suggestions allowed. */
  initialHost?: string | null
  returnPolicy: 'none' | 'restorePrevious'
  resumeTask?: {
    task: 'together' | 'ai' | 'admin'
    requiredCapability: string
    transitionId: string
    expiresAt: number
    expectedServerId?: string
    roomId?: string
  }
}

/** Never lowercase deployment paths or collapse different deployments. */
export const normalizeLoginServer = (host: string): string => {
  if (!/^https?:\/\//i.test(host.trim())) throw new Error('Invalid login server')
  // Reuse the RN-safe parser; the platform URL getters are not fully implemented.
  const normalized = normalizeServerUrl(host)
  if (!normalized) throw new Error('Invalid login server')
  return normalized.replace(/^(https:\/\/[^/]+):443(?=\/|$)/, '$1').replace(/^(http:\/\/[^/]+):80(?=\/|$)/, '$1')
}
export const recentLoginId = (session: ActiveSession): string => {
  switch (session.provider) {
    case 'local': return 'local'
    case 'lx': return JSON.stringify(['lx', session.server.serverId, normalizeLoginServer(session.server.url), session.deviceId])
    case 'lux': return JSON.stringify(['lux', session.server.serverId, session.account.userId])
  }
}
