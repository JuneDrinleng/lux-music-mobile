import { parseUrl } from '@/plugins/sync/client/utils'
import {
  findLuxAuthForHost,
  getLuxAuth,
  getPreferredSyncHost,
  getSyncMode,
  hasSavedLxSyncKeys,
  listLuxAuthSessions,
  reloadSyncHostFromStorage,
} from '@/utils/data'

export interface SyncLoginFormSnapshot {
  mode: LX.Sync.Mode
  host: string
  luxUsername: string
  hasSavedLuxSession: boolean
  hasSavedLxKey: boolean
}

export const syncHostCompareKey = (host: string) => {
  const trimmed = host.trim()
  if (!trimmed) return ''
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  try {
    return parseUrl(withProtocol).href.toLowerCase()
  } catch {
    return trimmed.replace(/\/+$/, '').toLowerCase()
  }
}

const resolveLuxAuthForHost = async(host: string): Promise<LX.Sync.LuxAuth | null> => {
  const matched = await findLuxAuthForHost(host)
  if (matched) return matched

  const active = await getLuxAuth()
  if (!active) return null

  const hostKey = syncHostCompareKey(host)
  if (active.serverUrl && syncHostCompareKey(active.serverUrl) == hostKey) return active

  const storedHost = await getPreferredSyncHost()
  if (storedHost && syncHostCompareKey(storedHost) == hostKey && active.user?.username) return active

  const sessions = await listLuxAuthSessions()
  if (sessions.length == 1 && sessions[0].user?.username) {
    const session = sessions[0]
    if (!session.serverUrl || syncHostCompareKey(session.serverUrl) == hostKey) return session
  }

  return null
}

export const loadSyncLoginFormSnapshot = async(): Promise<SyncLoginFormSnapshot> => {
  await reloadSyncHostFromStorage()
  const mode = await getSyncMode()
  let host = await getPreferredSyncHost()

  const activeLux = await getLuxAuth()
  if (!host && activeLux?.serverUrl) host = activeLux.serverUrl
  if (!host) {
    const sessions = await listLuxAuthSessions()
    const withUrl = sessions.find(session => session.serverUrl?.trim())
    if (withUrl?.serverUrl) host = withUrl.serverUrl
  }

  const luxAuth = host ? await resolveLuxAuthForHost(host) : activeLux
  const luxUsername = luxAuth?.user?.username?.trim() ?? activeLux?.user?.username?.trim() ?? ''
  const hasSavedLuxSession = Boolean(luxAuth?.token ?? activeLux?.token)
  const hasSavedLxKey = host ? await hasSavedLxSyncKeys() : false

  return {
    mode,
    host,
    luxUsername,
    hasSavedLuxSession,
    hasSavedLxKey,
  }
}
