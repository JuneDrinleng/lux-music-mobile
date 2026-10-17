import { useRef } from 'react'
import { TouchableOpacity } from 'react-native'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { createStyle } from '@/utils/tools'

export default () => {
  const modalRef = useRef<TimeoutExitEditModalType>(null)
  const timeInfo = useTimeInfo()
  const { colors } = useLuxTheme()
  const t = useI18n()
  const active = timeInfo.active || timeInfo.isPlayedStop
  return (
    <>
      <TouchableOpacity
        style={styles.button}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('sleep_timer')}
        accessibilityState={{ selected: active }}
        onPress={() => { modalRef.current?.show() }}
      >
        <MdiIcon name={active ? 'timer' : 'timer-outline'} size={22} color={colors.ink.strong} />
      </TouchableOpacity>
      <TimeoutExitEditModal ref={modalRef} timeInfo={timeInfo} />
    </>
  )
}

const styles = createStyle({
  button: {
    width: 28,
    height: 28,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
