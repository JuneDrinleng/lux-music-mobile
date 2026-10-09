import { memoLuxColors } from '@/theme/LuxTheme'
import { limeColors, type LuxColors } from '@/theme/luxTokens'
export interface SourceTone {
  text: string
  background: string
}

const readSourceTagColorMap = memoLuxColors((colors: LuxColors) => ({
  tx: { text: colors.source.tx.text, background: colors.source.tx.background },
  wy: { text: colors.source.wy.text, background: colors.source.wy.background },
  kg: { text: colors.source.kg.text, background: colors.source.kg.background },
  kw: { text: colors.source.kw.text, background: colors.source.kw.background },
  mg: { text: colors.source.mg.text, background: colors.source.mg.background },
}))

export const getSourceTone = (source: string, colors: LuxColors = limeColors): SourceTone => {
  return readSourceTagColorMap(colors)[source.toLowerCase()] ?? { text: colors.source.unknown.text, background: colors.source.unknown.background }
}
