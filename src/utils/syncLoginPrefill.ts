import { parseUrl } from '@/plugins/sync/client/utils'
import {
  findLuxAuthForHost,
  getLuxAuth,
  getPreferredSyncHost,
  getSyncLoginDraft,
  getSyncMode,
  hasSavedLxSyncKeys,
  listLuxAuthSessions,
  reloadSyncHostFromStorage,
  setSyncLoginDraft,
} from '@/utils/data'

export interface SyncLoginFormSnapshot {
  mode: LX.Sync.Mode
  host: string
  luxUsername: string
  luxPassword: string
  lxAuthCode: string
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

const hostsMatch = (left: string, right: string) => {
  const leftKey = syncHostCompareKey(left)
  const rightKey = syncHostCompareKey(right)
  return Boolean(leftKey && rightKey && leftKey == rightKey)
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

export const rememberSyncLoginForm = async(input: {
  host: string
  mode: LX.Sync.Mode
  luxUsername?: string
  luxPassword?: string
  lxAuthCode?: string
}) => {
  const host = input.host.trim()
  if (!host) return

  const prev = await getSyncLoginDraft()
  const sameHost = prev ? hostsMatch(prev.host, host) : false
  let luxUsername = input.luxUsername?.trim()
    || (sameHost ? prev?.luxUsername : '')
    || ''
  if (!luxUsername) {
    const auth = await findLuxAuthForHost(host)
    luxUsername = auth?.user?.username?.trim() ?? ''
  }
  const luxPassword = input.luxPassword?.length
    ? input.luxPassword
    : (sameHost ? prev?.luxPassword : '')
    || ''
  const lxAuthCode = input.lxAuthCode?.trim()
    || (sameHost ? prev?.lxAuthCode : '')
    || ''

  await setSyncLoginDraft({
    host,
    mode: input.mode,
    luxUsername,
    luxPassword,
    lxAuthCode,
  })
}

export const loadSyncLoginFormSnapshot = async(): Promise<SyncLoginFormSnapshot> => {
  await reloadSyncHostFromStorage()
  const draft = await getSyncLoginDraft()
  let mode = await getSyncMode()
  let host = await getPreferredSyncHost()

  const activeLux = await getLuxAuth()
  if (!host && draft?.host) host = draft.host
  if (!host && activeLux?.serverUrl) host = activeLux.serverUrl
  if (!host) {
    const sessions = await listLuxAuthSessions()
    const withUrl = sessions.find(session => session.serverUrl?.trim())
    if (withUrl?.serverUrl) host = withUrl.serverUrl
  }

  if (draft?.host && (!host || hostsMatch(draft.host, host))) {
    host = draft.host
    mode = draft.mode
  }

  const luxAuth = host ? await resolveLuxAuthForHost(host) : activeLux
  let luxUsername = luxAuth?.user?.username?.trim() ?? activeLux?.user?.username?.trim() ?? ''
  let luxPassword = ''
  let lxAuthCode = ''

  if (draft && host && hostsMatch(draft.host, host)) {
    luxUsername = draft.luxUsername || luxUsername
    luxPassword = draft.luxPassword
    lxAuthCode = draft.lxAuthCode
    mode = draft.mode
  }

  const hasSavedLuxSession = Boolean(luxAuth?.token ?? activeLux?.token ?? luxPassword)
  const hasSavedLxKey = host ? await hasSavedLxSyncKeys() : false

  return {
    mode,
    host,
    luxUsername,
    luxPassword,
    lxAuthCode,
    hasSavedLuxSession,
    hasSavedLxKey: hasSavedLxKey || Boolean(lxAuthCode),
  }
}
