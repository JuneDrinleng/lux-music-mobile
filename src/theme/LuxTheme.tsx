/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { memoLuxColors } from './luxStyleCache'
import { readLuxThemeId, writeLuxThemeId } from './luxThemePreference'
import { limeTheme, luxThemeRegistry, type LuxColors, type LuxTheme, type LuxThemeId } from './luxTokens'

export { memoLuxColors }

export interface LuxThemeControls extends LuxTheme {
  setLuxTheme: (id: LuxThemeId) => void
}

/**
 * 竖屏新页面的主题。
 *
 * 与上游 `src/store/theme` 的 `ThemeContext` / `useTheme()` 不是同一个上下文。
 * 上游继续服务横屏、旧 Views、评论页。这里的 id 只存在本机 `lux.theme.id`，
 * 不读写上游设置项，也不参与同步。
 */
const LuxThemeContext = createContext<LuxThemeControls>({
  ...limeTheme,
  setLuxTheme: () => {},
})

let bootedTheme: LuxTheme | null = null
let bootedThemePromise: Promise<LuxTheme> | null = null

/** Read the saved theme before the first home paint so 墨夜 does not open on the lime theme. */
export const primeLuxThemeForBoot = async(): Promise<LuxTheme> => {
  if (bootedTheme) return bootedTheme
  if (!bootedThemePromise) {
    bootedThemePromise = readLuxThemeId().then(id => {
      const theme = luxThemeRegistry[id]
      bootedTheme = theme
      return theme
    }).catch((err: unknown) => {
      bootedThemePromise = null
      throw err
    })
  }
  return bootedThemePromise
}

export const peekBootedLuxTheme = (): LuxTheme => bootedTheme ?? limeTheme

export const LuxThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<LuxTheme>(() => peekBootedLuxTheme())

  useEffect(() => {
    let cancelled = false
    void readLuxThemeId().then(id => {
      if (!cancelled) setTheme(luxThemeRegistry[id])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setLuxTheme = useCallback((id: LuxThemeId) => {
    setTheme(luxThemeRegistry[id])
    void writeLuxThemeId(id)
  }, [])

  const value = useMemo<LuxThemeControls>(() => ({
    ...theme,
    setLuxTheme,
  }), [theme, setLuxTheme])

  return (
    <LuxThemeContext.Provider value={value}>
      {children}
    </LuxThemeContext.Provider>
  )
}

export const useLuxTheme = (): LuxThemeControls => useContext(LuxThemeContext)

/**
 * 模块顶层调用，得到一个钩子。组件里写成 `const useLocalStyles = sharedLuxStyles(...)`，
 * 再 `const styles = useLocalStyles()`。工厂只在颜色对象变化时执行。
 */
export const sharedLuxStyles = <T,>(factory: (colors: LuxColors) => T): (() => T) => {
  const read = memoLuxColors(factory)
  return function useSharedLuxStyles(): T {
    const { colors } = useLuxTheme()
    return read(colors)
  }
}
