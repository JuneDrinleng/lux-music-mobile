/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import AsyncStorage from '@react-native-async-storage/async-storage'

import { DEFAULT_LUX_THEME_ID, LUX_THEME_IDS, type LuxThemeId } from './luxTokens'

/** 本机主题。不写入上游设置，也不进入同步。 */
const STORAGE_KEY = 'lux.theme.id'

export const isLuxThemeId = (value: string | null | undefined): value is LuxThemeId => {
  return LUX_THEME_IDS.some(id => id === value)
}

export const readLuxThemeId = async(): Promise<LuxThemeId> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (isLuxThemeId(stored)) return stored
  } catch {
    // 读不到就用默认黄绿。
  }
  return DEFAULT_LUX_THEME_ID
}

export const writeLuxThemeId = async(id: LuxThemeId): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id)
  } catch {
    // 选择仍然立即生效，只是这次没能落盘。
  }
}
