/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface ExpiredAccount {
  host: string
  username: string
  serverId: string
  userId: string
  token: string
}

/** One presentation across concurrent API failures and secondary status listeners. */
export const createSessionExpiredDialog = (deps: {
  isActive: (account: ExpiredAccount) => boolean
  disconnect: (account: ExpiredAccount) => Promise<void>
  show: (account: ExpiredAccount, later: () => Promise<void>, login: () => Promise<void>) => Promise<void>
  hide: () => Promise<void>
  login: (account: ExpiredAccount) => Promise<void>
}) => {
  const seen = new Set<string>()
  const state = { presenting: false }
  return async(account: ExpiredAccount) => {
    const identity = JSON.stringify([account.serverId, account.userId])
    const session = JSON.stringify([identity, account.token])
    if (!deps.isActive(account) || state.presenting || seen.has(session)) return
    state.presenting = true
    seen.add(session)
    let closed = false
    const close = async(login: boolean) => {
      if (closed) return
      closed = true
      await deps.hide()
      state.presenting = false
      if (login && deps.isActive(account)) await deps.login(account)
    }
    try {
      await deps.disconnect(account)
      if (!deps.isActive(account)) { state.presenting = false; return }
      await deps.show(account, async() => close(false), async() => close(true))
    } catch (error) {
      state.presenting = false
      seen.delete(session)
      throw error
    }
  }
}
