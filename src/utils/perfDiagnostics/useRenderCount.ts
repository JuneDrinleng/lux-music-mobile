/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect } from 'react'
import { countRender, perfEnabled } from './index'

export const useRenderCount = (name: string) => {
  // Always register the hook; conditional hooks would break when the setting changes.
  useEffect(() => {
    if (!perfEnabled) return
    countRender(name)
  })
}
