/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { SYNC_CODE, SYNC_CLOSE_CODE } from '../plugins/sync/constants'
import { type ServerCheckState } from './serverCheck'

export type SyncStatusKind = 'synced' | 'unreachable' | 'incompatible' | 'expired'
export interface SyncFailure { message?: string, code?: string, status?: number, serverVersion?: string, requiredVersion?: string }
/** Ordered mapping: session/version failures take precedence over transport failures.
 * HTTP 403 alone is not proof of expiry (blocked IP / permissions also use it).
 * LX auth failures retain the existing authorization-code flow.
 */
export const SYNC_ERROR_MAPPING = [
  { kind: 'expired', messages: [SYNC_CODE.luxSessionExpired], codes: ['UNAUTHENTICATED', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'TOKEN_EXPIRED', 'INVALID_TOKEN'], statuses: [401], closes: [4001, 4401] },
  { kind: 'incompatible', messages: [SYNC_CODE.lowServiceVersion, SYNC_CODE.highServiceVersion], codes: ['VERSION_INCOMPATIBLE', 'CLIENT_VERSION_TOO_OLD'], statuses: [426], closes: [] },
  { kind: 'unreachable', messages: [SYNC_CODE.connectServiceFailed, SYNC_CODE.getServiceIdFailed, SYNC_CODE.unknownServiceAddress, SYNC_CODE.msgBlockedIp, SYNC_CODE.authFailed, SYNC_CODE.missingAuthCode], codes: [], statuses: [], closes: [1006, 1011, 1012, 1013, SYNC_CLOSE_CODE.failed] },
] as const

export const retryDelayMs = (failedNum: number): number => Math.min(2000 + Math.floor(failedNum / 2) * 3000, 30000)
export const retrySeconds = (retryAt: number | undefined, now: number): number | null => retryAt == null ? null : Math.max(0, Math.ceil((retryAt - now) / 1000))
export const syncStatusRoute = (kind: SyncStatusKind): 'sync' | 'unreachable' | 'incompatible' | 'expired' => kind === 'synced' ? 'sync' : kind
export const syncHostname = (host: string): string => host.replace(/^https?:\/\//i, '').split('/')[0]

export const mapSyncStatus = ({ enabled, local = false, mode, status, check, now = Date.now() }: {
  enabled: boolean
  local?: boolean
  mode: 'lx' | 'lux'
  status: { status: boolean, message: string, error?: SyncFailure, closeCode?: number, attempts?: number, retryAt?: number, lastSyncedAt?: number }
  check?: ServerCheckState
  now?: number
}) => {
  const error = status.error ?? { message: status.message }
  let kind: SyncStatusKind | null = null
  if (local) return null
  if (error.message === SYNC_CODE.luxSessionExpired || (mode === 'lux' && [SYNC_CODE.authFailed, SYNC_CODE.missingAuthCode].some(message => message === error.message))) kind = 'expired'
  for (const row of SYNC_ERROR_MAPPING) {
    if (kind) break
    if ((row.messages as readonly string[]).includes(error.message ?? '') || (row.codes as readonly string[]).includes(error.code ?? '') ||
      (row.statuses as readonly number[]).includes(error.status ?? 0) || (row.closes as readonly number[]).includes(status.closeCode ?? 0)) kind = row.kind
  }
  if (check?.compatible === false) kind = 'incompatible'
  // Expiry is retained when the existing expired-session flow disables sync.
  if (!enabled && kind !== 'expired') return null
  if (!kind && status.status) kind = 'synced'
  if (!kind && ([error.message, error.code, error.status, status.message].some(Boolean) || status.retryAt != null || check?.reachable === false)) kind = 'unreachable'
  // Explicit disconnect / no configured session has no row.
  if (!kind) return null
  return {
    kind,
    route: syncStatusRoute(kind),
    titleKey: `sync_state_${kind}` as const,
    seconds: retrySeconds(status.retryAt, now),
    attempts: status.attempts ?? 0,
    lastSyncedAt: status.lastSyncedAt,
    serverVersion: error.serverVersion ?? check?.info?.version,
    requiredVersion: error.requiredVersion ?? check?.info?.minClientVersion ?? undefined,
  }
}
export type SyncStatusModel = NonNullable<ReturnType<typeof mapSyncStatus>>

export const syncStatusText = (model: SyncStatusModel, { name, host, relative, unknown }: { name: string, host: string, relative: string, unknown: string }) => ({
  symbol: model.kind === 'synced' ? '✓' : model.kind === 'expired' ? '⌛' : '✕',
  detailKey: model.kind === 'unreachable' ? model.seconds == null ? 'sync_state_retry_manual' : 'sync_state_retry_after' : model.kind === 'expired' ? 'sync_state_relogin_hint' : 'sync_state_versions',
  syncedDetail: `${name} • ${syncHostname(host)} • ${relative}`,
  version: model.serverVersion ?? unknown,
  minimum: model.requiredVersion ?? unknown,
} as const)
