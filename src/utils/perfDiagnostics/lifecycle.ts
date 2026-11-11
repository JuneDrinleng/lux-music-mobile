/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { AppState, Platform, Share } from 'react-native'
import { getLogs, log, flushLogs } from '@/utils/log'
import { configureDiagnostics, flushDiagnostics, perfNow, setDiagnosticsEnabled, setDiagnosticsForeground } from './index'

let installed = false
let subscription: ReturnType<typeof AppState.addEventListener> | undefined

export const applyDiagnosticsSetting = (enabled: boolean) => {
  if (!installed) {
    installed = true
    configureDiagnostics({
      now: perfNow,
      schedule: (callback, ms) => setInterval(callback, ms),
      cancel: timer => { clearInterval(timer as ReturnType<typeof setInterval>) },
      write: line => { log.info(line) },
    })
  }
  if (enabled && !subscription) {
    setDiagnosticsForeground(AppState.currentState === 'active')
    subscription = AppState.addEventListener('change', state => { setDiagnosticsForeground(state === 'active') })
  }
  setDiagnosticsEnabled(enabled, { version: process.versions.app, model: Platform.OS === 'android' ? Platform.constants.Model : 'unknown' })
  if (!enabled) {
    subscription?.remove()
    subscription = undefined
  }
}

/** Use the existing application log and the OS share/export sheet. */
export const exportDiagnosticsLog = async() => {
  flushDiagnostics()
  await flushLogs()
  await Share.share({ message: await getLogs() })
}
