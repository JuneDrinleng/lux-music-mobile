import { parseUrl } from '@/plugins/sync/client/utils'
import {
  findLuxAuthForHost,
  getLuxAuth,
  getSyncLoginDrafts,
  hasSavedLxSyncKeys,
  listLuxAuthSessions,
  setSyncLoginDrafts,
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

export {
  SYNC_LOGIN_SAVED_SECRET_MASK,
  syncLoginSavedSecretDisplayValue,
  syncLoginSavedSecretInputValue,
} from '@/utils/syncLoginSavedSecretField'

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

  const drafts = await getSyncLoginDrafts() ?? {}

  if (input.mode == 'lux') {
    const prev = drafts.lux
    let luxUsername = input.luxUsername?.trim()
    if (!luxUsername) luxUsername = prev?.luxUsername ?? ''
    if (!luxUsername) {
      const auth = await findLuxAuthForHost(host)
      luxUsername = auth?.user?.username?.trim() ?? ''
    }
    const luxPassword = input.luxPassword?.length
      ? input.luxPassword
      : (prev?.luxPassword ?? '')
    await setSyncLoginDrafts({
      ...drafts,
      lux: { host, luxUsername, luxPassword },
    })
    return
  }

  const prev = drafts.lx
  const lxAuthCode = input.lxAuthCode?.trim() ?? prev?.lxAuthCode ?? ''
  await setSyncLoginDrafts({
    ...drafts,
    lx: { host, lxAuthCode },
  })
}

export const loadSyncLoginFormSnapshot = async(mode: LX.Sync.Mode): Promise<SyncLoginFormSnapshot> => {
  const drafts = await getSyncLoginDrafts() ?? {}

  if (mode == 'lux') {
    const profile = drafts.lux
    let host = profile?.host?.trim() ?? ''
    let luxUsername = profile?.luxUsername?.trim() ?? ''
    let luxPassword = profile?.luxPassword ?? ''

    if (!host) {
      const activeLux = await getLuxAuth()
      if (activeLux?.serverUrl) host = activeLux.serverUrl.trim()
    }

    if (host && !luxUsername) {
      const auth = await resolveLuxAuthForHost(host)
      luxUsername = auth?.user?.username?.trim() ?? ''
    }

    const luxAuth = host ? await resolveLuxAuthForHost(host) : await getLuxAuth()
    const hasSavedLuxSession = Boolean(luxAuth?.token ?? luxPassword)

    return {
      mode: 'lux',
      host,
      luxUsername,
      luxPassword,
      lxAuthCode: '',
      hasSavedLuxSession,
      hasSavedLxKey: false,
    }
  }

  const profile = drafts.lx
  const host = profile?.host?.trim() ?? ''
  const lxAuthCode = profile?.lxAuthCode ?? ''
  const hasSavedLxKey = host ? await hasSavedLxSyncKeys() : false

  return {
    mode: 'lx',
    host,
    luxUsername: '',
    luxPassword: '',
    lxAuthCode,
    hasSavedLuxSession: false,
    hasSavedLxKey: hasSavedLxKey || Boolean(lxAuthCode),
  }
}
