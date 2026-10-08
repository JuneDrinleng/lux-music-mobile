/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { createContext, useContext, type ReactNode } from 'react'
import { limeTheme, type LuxTheme } from './luxTokens'

/**
 * 竖屏新页面的主题。
 *
 * 与上游 `src/store/theme` 的 `ThemeContext` / `useTheme()` 不是同一个上下文。
 * 上游继续服务横屏、旧 Views 和设置里仍读取 `c-primary-background` 的输入框。
 * 这里固定提供黄绿，不读取设置项，也没有切换函数。
 */
const LuxThemeContext = createContext<LuxTheme>(limeTheme)

export const LuxThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <LuxThemeContext.Provider value={limeTheme}>
      {children}
    </LuxThemeContext.Provider>
  )
}

export const useLuxTheme = (): LuxTheme => useContext(LuxThemeContext)
