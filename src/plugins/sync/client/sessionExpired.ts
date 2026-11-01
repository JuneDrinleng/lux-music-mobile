/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { SYNC_CODE } from '../constants'
import { Navigation } from 'react-native-navigation'
import { createSessionExpiredDialog, type ExpiredAccount } from '@/utils/sessionExpiredDialog'
import { getActiveSpace, luxSpaceId } from '@/utils/dataSpace'
import { findLuxAuthForHost, clearLuxAuthForServer } from '@/utils/data'
import { syncHostCompareKey } from '@/utils/syncLoginPrefill'

export const SESSION_EXPIRED_OVERLAY = 'lux.SessionExpiredDialog'
const expiredAccounts = new Map<string, ExpiredAccount>()
export const expiredAccountUsername = (host: string): string | undefined => expiredAccounts.get(syncHostCompareKey(host))?.username
const componentId = 'lux.sessionExpired'
const isActive = (account: ExpiredAccount) => getActiveSpace() === luxSpaceId(account.serverId, account.userId)
const present = createSessionExpiredDialog({
  isActive,
  disconnect: async(account) => {
    const [{ updateSetting }, { disconnectServer }] = await Promise.all([import('@/core/common'), import('@/plugins/sync')])
    if (!isActive(account)) return
    const { requestLogin } = await import('@/core/appSession')
    await requestLogin({ reason: 'reauth', source: 'session-expired', targetProvider: 'lux', initialHost: account.host, initialUsername: account.username, returnPolicy: 'none' })
    updateSetting({ 'sync.enable': false })
    await disconnectServer()
    const { setSyncStatus } = await import('@/core/sync')
    if (!isActive(account)) return
    setSyncStatus({ status: false, message: SYNC_CODE.luxSessionExpired })
  },
  show: async(account, later, login) => {
    await Navigation.showOverlay({
      component: {
        id: componentId,
        name: SESSION_EXPIRED_OVERLAY,
        passProps: { account, later, login },
        options: { layout: { componentBackgroundColor: 'transparent' }, overlay: { interceptTouchOutside: true } },
      },
    })
  },
  hide: async() => { await Navigation.dismissOverlay(componentId) },
  login: async(account) => {
    const { navigations } = await import('@/navigation')
    await navigations.pushSyncLoginScreen({ onboarding: false, initialHost: account.host, initialUsername: account.username, targetProvider: 'lux' })
  },
})

export const showSessionExpiredDialog = async(host: string, previous?: LX.Sync.LuxAuth) => {
  const key = syncHostCompareKey(host)
  const auth = previous ?? await findLuxAuthForHost(host)
  let account = expiredAccounts.get(key)
  if (auth) {
    if (!auth.serverId) return
    account = { host, username: auth.user.username, serverId: auth.serverId, userId: auth.user.id, token: auth.token }
    expiredAccounts.set(key, account)
    // The callback's credential is already cleared. Other entry points must still
    // match the current token so a stale failure cannot clear a newer login.
    const cleared = await clearLuxAuthForServer(auth)
    if (!cleared && !previous) return
  }
  if (account) await present(account)
}
