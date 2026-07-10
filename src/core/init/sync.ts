import { connectLuxServer, connectServer, pullLuxProfileFromServer } from '@/plugins/sync'
import { updateSetting } from '@/core/common'
import { getSyncHost } from '@/plugins/sync/data'
import { getSyncMode } from '@/utils/data'


export default async(setting: LX.AppSetting) => {
  if (!setting['sync.enable']) return

  const host = await getSyncHost()
  // console.log(host)
  if (!host) {
    updateSetting({ 'sync.enable': false })
    return
  }
  const mode = await getSyncMode()
  if (mode == 'lux') {
    void connectLuxServer(host).then(async() => pullLuxProfileFromServer(host)).catch(() => null)
  } else void connectServer(host)
}
