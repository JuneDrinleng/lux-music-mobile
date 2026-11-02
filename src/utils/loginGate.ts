/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import type { ActiveSession, LoginIntent, LoginProvider } from './loginSession'
import type { RecentLogin } from './loginRecents'

export type GatePage = 'main' | 'methods' | 'lux' | 'lx' | 'local' | 'recents' | 'manage' | 'history' | 'register' | 'forgot'
export const gateInitialPage = (intent?: LoginIntent | null): GatePage => intent?.reason === 'add' ? 'main' : intent?.targetProvider ?? 'main'
export const recentLoginAction = (recent: RecentLogin, available: boolean): 'local' | 'continue' | 'reauth' => recent.provider === 'local' ? 'local' : available ? 'continue' : 'reauth'
export const recentIdentity = (recent: RecentLogin): ActiveSession | undefined => {
  if (recent.provider === 'local') return { provider: 'local', spaceId: 'local' }
  if (!recent.server || !recent.credentialRef) return undefined
  if (recent.provider === 'lux' && recent.account && recent.spaceId.startsWith('lux:')) {
    return {
      provider: 'lux', spaceId: recent.spaceId as `lux:${string}:${string}`, server: recent.server, account: recent.account, credentialRef: recent.credentialRef,
    }
  }
  if (recent.provider === 'lx') {
    try {
      const id: unknown = JSON.parse(recent.id)
      if (Array.isArray(id) && id[0] === 'lx' && typeof id[3] === 'string') return { provider: 'lx', spaceId: 'local', server: recent.server, credentialRef: recent.credentialRef, deviceId: id[3] }
    } catch {}
  }
  return undefined
}
export const gateDraft = (provider: LoginProvider, intent: LoginIntent | null | undefined, snapshot: { host: string, luxUsername: string }) => {
  const matching = intent?.targetProvider === provider
  const host = matching && intent?.initialHost !== undefined ? intent.initialHost ?? '' : intent?.initialHost === null ? '' : snapshot.host
  return { host, username: provider === 'lux' && matching ? intent?.targetIdentity?.provider === 'lux' ? intent.targetIdentity.account.username : intent?.initialUsername ?? (host === snapshot.host ? snapshot.luxUsername : '') : '' }
}
