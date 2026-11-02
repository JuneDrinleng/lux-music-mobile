import { useState } from 'react'
import { TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { sleepTimerPill } from '@/core/player/sleepTimerOptions'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { setSpText } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { estimateTimerLabelWidth, shouldCompactSleepTimer } from './playerChromeLayout'
import SleepTimerSheet from './SleepTimerSheet'

export default ({ layout }: { layout?: { windowWidth: number, tabsWidth: number, shareWidth: number, gutter: number } } = {}) => {
  const [visible, setVisible] = useState(false)
  const info = useTimeoutExitTimeInfo()
  const { colors } = useLuxTheme()
  const t = useI18n()
  const pill = sleepTimerPill(info.time, info.isPlayedStop)
  const compact = layout ? shouldCompactSleepTimer({
    ...layout,
    active: !!pill,
    fullPillWidth: estimateTimerLabelWidth(pill, setSpText(13)) + 20 + 3,
    minGap: 8,
  }) : false
  const showPill = !!pill && !compact
  return (
    <>
      <TouchableOpacity
        style={[styles.button, showPill ? { borderWidth: 1.5, borderColor: colors.ink.strong, paddingHorizontal: 10 } : { width: 28 }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={pill ? `${t('sleep_timer')} ${pill}` : t('sleep_timer')}
        accessibilityState={{ selected: !!pill }}
        onPress={() => { setVisible(true) }}
      >
        {showPill
          ? <Text size={13} color={colors.ink.strong} style={styles.label}>{pill}</Text>
          : <MdiIcon name="weather-night" size={22} color={colors.ink.strong} />}
      </TouchableOpacity>
      <SleepTimerSheet visible={visible} onClose={() => { setVisible(false) }} info={info} />
    </>
  )
}

const styles = createStyle({
  button: { height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', fontVariant: ['tabular-nums'] },
})
