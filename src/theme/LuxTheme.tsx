/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { createContext, useContext, type ReactNode } from 'react'
import { limeTheme, type LuxColors, type LuxTheme } from './luxTokens'

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

/**
 * 同一个颜色对象只生成一次结果。列表行共用这一份，不要在每次渲染里新建样式。
 * 缓存按 colors 的引用比较。默认黄绿主题的引用不变，所以样式表只建一次。
 */
export const memoLuxColors = <T,>(factory: (colors: LuxColors) => T): ((colors: LuxColors) => T) => {
  let cachedColors: LuxColors | null = null
  let cached: T | undefined
  return (colors: LuxColors) => {
    if (cachedColors !== colors) {
      cachedColors = colors
      cached = factory(colors)
    }
    return cached as T
  }
}

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
