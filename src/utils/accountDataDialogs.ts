/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { Navigation } from 'react-native-navigation'
import { type AccountDataDialogProps } from '@/navigation/components/AccountDataDialog'
import { copyLocalData, persistImportDecision, prepareLocalImport } from '@/utils/dataSpace/operations'
import { getActiveSpace, reloadActiveSpace } from '@/utils/dataSpace'
import { type AdminPlaylistSummary } from '@/core/admin/api'

export const ACCOUNT_DATA_OVERLAY = 'lux.AccountDataDialog'
const present = async(props: Omit<AccountDataDialogProps, 'finish'>, apply: AccountDataDialogProps['finish']): Promise<void> => new Promise((resolve, reject) => {
  const id = 'lux.accountData'
  const finish: AccountDataDialogProps['finish'] = async(choice) => {
    await apply(choice)
    await Navigation.dismissOverlay(id)
    resolve()
  }
  void Navigation.showOverlay({ component: { id, name: ACCOUNT_DATA_OVERLAY, passProps: { ...props, finish }, options: { layout: { componentBackgroundColor: 'transparent' }, overlay: { interceptTouchOutside: true } } } }).catch(reject)
})

export const remoteAccountEmpty = (playlists: AdminPlaylistSummary): boolean => {
  if (!playlists || !Array.isArray(playlists.userList) || !Number.isFinite(playlists.defaultList?.musicCount) || !Number.isFinite(playlists.loveList?.musicCount)) throw new Error('Invalid server playlist summary')
  return playlists.userList.length === 0 && playlists.defaultList.musicCount === 0 && playlists.loveList.musicCount === 0
}
export const offerLocalImport = async(auth: LX.Sync.LuxAuth, request: <T>(url: string, data?: unknown, token?: string) => Promise<T>): Promise<boolean> => {
  const space = getActiveSpace()
  const contents = await prepareLocalImport(space, async() => {
    const result = await request<{ playlists: AdminPlaylistSummary }>(`${auth.serverUrl!.replace(/\/+$/, '')}/api/me/playlists`, undefined, auth.token)
    return remoteAccountEmpty(result.playlists)
  })
  if (!contents) return false
  let profile = false
  await present({ kind: 'import', username: auth.user.username, host: auth.serverUrl ?? '', contents }, async(choice) => {
    if (space !== getActiveSpace()) throw new Error('Import account changed')
    if (choice && typeof choice === 'object') {
      await copyLocalData(space, choice)
      await reloadActiveSpace()
      profile = !!choice.all
    }
    await persistImportDecision(space)
  })
  return profile
}
export const showLogoutOptions = async(username: string, host: string, logout: (remove: boolean) => Promise<void>): Promise<void> => present({ kind: 'logout', username, host }, async(choice) => {
  if (choice !== null) await logout(choice === true)
})
