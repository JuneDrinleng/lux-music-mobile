/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { normalizeLoginServer, recentLoginId, type ActiveSession, type CredentialRef, type LoginProvider } from './loginSession'

export const LOGIN_RECENTS_KEY = 'loginRecents:v1'
export interface RecentLogin {
  id: string
  provider: LoginProvider
  server?: { url: string, serverId: string }
  account?: { userId: string, username: string, displayName?: string }
  avatar: { initial: string }
  spaceId: string
  credentialRef?: CredentialRef
  lastLoginAt: number
  lastUsedAt: number
  authHint: 'saved' | 'needsAuth' | 'none'
}
export interface LoginRecentsSchema {
  version: 1
  recents: RecentLogin[]
  /** Address history and spaces without success evidence never appear in recents. */
  history: Array<{ provider?: 'lx' | 'lux', url: string }>
  knownAccounts: Array<{ spaceId: string, serverId?: string, userId?: string, username?: string, url?: string }>
}
interface LegacyInputs {
  history: Array<{ provider?: 'lx' | 'lux', url: string }>
  accounts: LoginRecentsSchema['knownAccounts']
}
interface RecentsStorage {
  read: () => Promise<LoginRecentsSchema | null>
  write: (schema: LoginRecentsSchema) => Promise<void>
  legacy: () => Promise<LegacyInputs>
}

/** Build a fresh allowlist object, never spread auth objects into global metadata. */
export const successfulRecent = (session: ActiveSession, at: number): RecentLogin => {
  if (!Number.isFinite(at) || at <= 0) throw new Error('Missing successful login time')
  const base: RecentLogin = {
    id: recentLoginId(session),
    provider: session.provider,
    spaceId: session.spaceId,
    avatar: { initial: session.provider === 'lux' ? session.account.username.trim().slice(0, 1).toUpperCase() : session.provider === 'lx' ? 'L' : '' },
    lastLoginAt: at,
    lastUsedAt: at,
    authHint: session.provider === 'local' ? 'none' : 'saved',
  }
  if (session.provider !== 'lux' && session.spaceId !== 'local') throw new Error('Local space mismatch')
  if (session.provider === 'lx' && (!session.deviceId || session.credentialRef.kind !== 'syncKey' || session.credentialRef.id !== JSON.stringify([session.server.serverId, 'lx', '']))) throw new Error('LX credential identity mismatch')
  if (session.provider === 'lux' && (session.credentialRef.kind !== 'luxRefresh' || session.credentialRef.id !== JSON.stringify([session.server.serverId, session.account.userId]))) throw new Error('Lux credential identity mismatch')
  if (session.provider !== 'local') {
    if (!session.server.serverId) throw new Error('Missing server identity')
    base.server = { url: normalizeLoginServer(session.server.url), serverId: session.server.serverId }
    base.credentialRef = { kind: session.credentialRef.kind, id: session.credentialRef.id }
  }
  if (session.provider === 'lux') {
    if (!session.account.userId || session.spaceId !== `lux:${encodeURIComponent(session.server.serverId)}:${encodeURIComponent(session.account.userId)}`) throw new Error('Account space mismatch')
    base.account = { userId: session.account.userId, username: session.account.username, ...(session.account.displayName ? { displayName: session.account.displayName } : {}) }
  }
  return base
}

export const createLoginRecents = (storage: RecentsStorage) => {
  let pending: Promise<unknown> = Promise.resolve()
  const enqueue = async<T>(work: () => Promise<T>): Promise<T> => {
    const result = pending.then(work)
    pending = result.catch(() => {})
    return result
  }
  const read = async(): Promise<LoginRecentsSchema> => {
    const saved = await storage.read()
    if (saved) {
      if (saved.version !== 1) throw new Error('Unsupported login recents schema')
      return saved
    }
    const legacy = await storage.legacy()
    const history: LoginRecentsSchema['history'] = []
    for (const item of legacy.history) {
      try {
        const url = normalizeLoginServer(item.url)
        if (!history.some(row => row.provider === item.provider && row.url === url)) history.push({ provider: item.provider, url })
      } catch { /* Invalid/credential-bearing old URLs are not copied. */ }
    }
    const knownAccounts: LoginRecentsSchema['knownAccounts'] = []
    for (const item of legacy.accounts) {
      if (knownAccounts.some(row => row.spaceId === item.spaceId)) continue
      let url: string | undefined
      try { if (item.url) url = normalizeLoginServer(item.url) } catch {}
      knownAccounts.push({ spaceId: item.spaceId, serverId: item.serverId, userId: item.userId, username: item.username, url })
    }
    const schema: LoginRecentsSchema = { version: 1, recents: [], history, knownAccounts }
    // One atomic replacement, no separate marker; interrupted writes can simply replay.
    await storage.write(schema)
    return schema
  }
  return {
    list: async(): Promise<LoginRecentsSchema> => enqueue(read),
    recordSuccess: async(session: ActiveSession, at: number): Promise<void> => enqueue(async() => {
      const recent = successfulRecent(session, at)
      const schema = await read()
      schema.recents = [recent, ...schema.recents.filter(item => item.id !== recent.id)].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      await storage.write(schema)
    }),
    remove: async(id: string): Promise<void> => enqueue(async() => {
      const schema = await read()
      schema.recents = schema.recents.filter(item => item.id !== id)
      await storage.write(schema)
    }),
  }
}
