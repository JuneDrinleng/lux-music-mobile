import { useRef, useState, type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import { MagazineSheet, MagSegmented, PrimaryButton, SecondaryButton, Toggle } from '@/components/magazine'
import { updateSetting } from '@/core/common'
import { cancelTimeoutExit, startTimeoutExit, type useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { formatSleepTimer, SHOW_SLEEP_TIMER_NOISE, sleepTimerFadeSeconds, sleepTimerMinutes, SLEEP_TIMER_FADE_SECONDS, SLEEP_TIMER_MINUTES } from '@/core/player/sleepTimerOptions'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

export default ({ visible, onClose, info }: {
  visible: boolean
  onClose: () => void
  info: ReturnType<typeof useTimeoutExitTimeInfo>
}) => {
  const t = useI18n()
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const selected = sleepTimerMinutes(useSettingValue('player.timeoutExit'))
  const played = useSettingValue('player.timeoutExitPlayed')
  const fade = useSettingValue('player.timeoutExitFade')
  const fadeSeconds = sleepTimerFadeSeconds(useSettingValue('player.timeoutExitFadeDuration'))
  const [stopNoise, setStopNoise] = useState(true)
  const customRef = useRef<TimeoutExitEditModalType>(null)
  const timeInfo = useTimeInfo()
  const running = info.time >= 0 || info.isPlayedStop
  const choose = (minutes: number) => {
    updateSetting({ 'player.timeoutExit': String(minutes) })
    startTimeoutExit(minutes * 60)
  }
  const row = (title: string, subtitle: string | undefined, control: ReactNode, last = false) => (
    <View style={[styles.row, last ? { borderBottomWidth: 0 } : null]}>
      <View style={styles.rowText}>
        <Text size={15} color={r.list} style={styles.bold}>{title}</Text>
        {subtitle ? <Text size={12} color={r.muted} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {control}
    </View>
  )
  return (
    <>
      <MagazineSheet
        visible={visible}
        onClose={onClose}
        heightRatio={610 / 844}
        importLayout
        timerLayout
        eyebrow={t('sleep_timer')}
        title={t('sleep_timer_title')}
        figure={{ value: formatSleepTimer(running ? Math.max(0, info.time) : selected * 60), unit: t('sleep_timer_remaining') }}
        meta={t('sleep_timer_after')}
        headerAction={running ? { text: t('timeout_exit_btn_cancel'), onPress: cancelTimeoutExit } : undefined}
      >
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.chips}>
            {SLEEP_TIMER_MINUTES.map(minutes => {
              const Button = selected === minutes ? PrimaryButton : SecondaryButton
              return <Button key={minutes} selected={selected === minutes} compact {...(selected === minutes ? { labelStyle: { fontWeight: '700' as const } } : {})} labelSize={13} label={t('sleep_timer_minutes', { num: minutes })} style={styles.chip} onPress={() => { choose(minutes) }} />
            })}
            {SLEEP_TIMER_MINUTES.some(minutes => minutes === selected)
              ? <SecondaryButton compact label={t('sleep_timer_custom')} style={styles.chip} onPress={() => { customRef.current?.show() }} />
              : <PrimaryButton selected compact labelStyle={{ fontWeight: '700' }} labelSize={13} label={t('sleep_timer_custom')} style={styles.chip} onPress={() => { customRef.current?.show() }} />}
          </View>
          {row(t('sleep_timer_finish_song'), t('sleep_timer_finish_song_hint'),
            <Toggle compact value={played} accessibilityLabel={t('sleep_timer_finish_song')} onChange={value => { updateSetting({ 'player.timeoutExitPlayed': value }) }} />)}
          {row(t('sleep_timer_fade', { num: fadeSeconds }), t('sleep_timer_fade_hint'),
            <Toggle compact value={fade} accessibilityLabel={t('sleep_timer_fade', { num: fadeSeconds })} onChange={value => { updateSetting({ 'player.timeoutExitFade': value }) }} />)}
          {row(t('sleep_timer_fade_duration'), t('sleep_timer_fade_options'),
            <MagSegmented compact itemStyle={styles.segmentItem} style={styles.segment} items={SLEEP_TIMER_FADE_SECONDS.map(seconds => ({ id: String(seconds), label: `${seconds}s` }))} value={String(fadeSeconds)} onChange={value => { updateSetting({ 'player.timeoutExitFadeDuration': Number(value) }) }} renderItem={(item, on) => <Text size={13} color={on ? r.onInk : r.ink} style={styles.bold}>{item.label}</Text>} />, !SHOW_SLEEP_TIMER_NOISE)}
          {SHOW_SLEEP_TIMER_NOISE ? row(t('sleep_timer_stop_noise'), undefined,
            <Toggle compact value={stopNoise} accessibilityLabel={t('sleep_timer_stop_noise')} onChange={setStopNoise} />, true) : null}
        </ScrollView>
      </MagazineSheet>
      <TimeoutExitEditModal ref={customRef} timeInfo={timeInfo} customOnly />
    </>
  )
}

const useStyles = sharedLuxStyles(colors => createStyle({
  body: { paddingBottom: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.ink.strong },
  segmentItem: { paddingHorizontal: 13 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line.divider },
  rowText: { flex: 1 },
  bold: { fontWeight: '700' },
  subtitle: { marginTop: 2 },
  segment: { borderRadius: 16, borderWidth: 1.5, alignSelf: 'center' },
}))
