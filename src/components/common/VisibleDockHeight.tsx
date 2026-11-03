/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { createContext, useContext } from 'react'

// No vertical Dock outside this provider (e.g. the horizontal shell).
export const VisibleDockHeightContext = createContext<number | null>(null)
export const useVisibleDockHeight = (fallback = 0) => useContext(VisibleDockHeightContext) ?? fallback
