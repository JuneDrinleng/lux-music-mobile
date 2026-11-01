/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useEffect } from 'react'
import { useSettingsTransition } from '@/components/common/SettingsPage'

/** Compatibility adapter: cache identity may change without unmounting the detail. */
export const useDetailSceneTransition = (restartKey?: string | null) => {
  const transition = useSettingsTransition(false)
  const { requestOpen } = transition
  useEffect(() => { requestOpen() }, [requestOpen, restartKey])
  return transition
}
