import { connectLuxServer, connectServer, pullLuxProfileFromServer } from '@/plugins/sync'
import { updateSetting } from '@/core/common'
import { getSyncHost } from '@/plugins/sync/data'
import { getSyncMode } from '@/utils/data'
import { getSyncDeviceId } from '@/plugins/sync/deviceId'


export default async(setting: LX.AppSetting) => {
  // Initialize once on first launch, independently of login or the selected server.
  void getSyncDeviceId().catch(error => { console.warn('Sync device identity initialization failed', error) })
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
