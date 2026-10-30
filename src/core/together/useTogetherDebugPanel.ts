/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'

import {
  getTogetherDebugPanelEnabled,
  isTogetherDebugPanelBuild,
  subscribeTogetherDebugPanel,
} from './debugPanelPreference'

export const useTogetherDebugPanelEnabled = (): boolean => {
  const [enabled, setEnabled] = useState(() => getTogetherDebugPanelEnabled())
  useEffect(() => subscribeTogetherDebugPanel(setEnabled), [])
  return enabled
}

export const useShowTogetherDebugPanel = (): boolean => {
  const enabled = useTogetherDebugPanelEnabled()
  return isTogetherDebugPanelBuild() && enabled
}
