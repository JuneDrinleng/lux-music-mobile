/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type LuxColors } from './luxTokens'

/**
 * 同一个颜色对象只生成一次结果。切换主题时颜色引用变了就重建，
 * 缓存槽只有一个，不会按主题累加。
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
