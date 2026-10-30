import { useEffect, useState } from 'react'
import { BackHandler, ScrollView, TouchableOpacity, View } from 'react-native'
import Slider from '@react-native-community/slider'
import Text from '@/components/common/Text'
import { BackButton } from '@/components/magazine'
import { updateSetting } from '@/core/common'
import { changeNoise, stopWhiteNoise } from '@/core/player/whiteNoise'
import { noise, NOISE_SOUNDS, normalizeNoiseSettings, clampNoiseVolume } from '@/plugins/player/noise'
import { setVolume } from '@/plugins/player/utils'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

export default ({ onClose, bottomPadding }: { onClose: () => void, bottomPadding: number }) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const saved = normalizeNoiseSettings(useSettingValue('player.whiteNoise'))
  const statusBarHeight = useStatusbarHeight()
  const volume = clampNoiseVolume(useSettingValue('player.volume'))
  const [failed, setFailed] = useState(false)
  const supported = noise.supported && !failed
  const run = (action: Promise<void>) => { void action.catch(() => { setFailed(true) }) }
  useEffect(() => {
    // Opening the mixer is an explicit resume of the persisted selection.
    for (const id of NOISE_SOUNDS) void noise.set(id, saved[id]).catch(() => { setFailed(true) })
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true })
    return () => { subscription.remove() }
    // Read the saved selection only on mount; changes are sent by the controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const slider = (value: number, disabled: boolean, onChange: (value: number) => void, label: string, thumb = true, onPreview?: (value: number) => void) => (
    <MixerSlider value={value} disabled={disabled} onChange={onChange} label={label} thumb={thumb} onPreview={onPreview} />
  )
  return (
    <ScrollView style={[styles.page, { paddingTop: statusBarHeight }]} contentContainerStyle={{ paddingBottom: bottomPadding + 22 }}>
      <View style={styles.top}>
        <BackButton onPress={onClose} />
        <TouchableOpacity hitSlop={8} accessibilityRole="button" onPress={() => { run(stopWhiteNoise()) }}>
          <Text size={15} color={r.ink} style={styles.stop}>{t('noise_stop_all')}</Text>
        </TouchableOpacity>
      </View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('noise_eyebrow')}</Text>
      <Text size={32} color={r.display} style={styles.title}>{t('noise_title')}</Text>
      <Text size={12} color={r.muted} style={styles.hint}>{t('noise_hint')}</Text>
      <View style={styles.rule} />
      <View style={styles.heading}>
        <Text size={22} color={r.ink} style={styles.heavy}>{t('noise_mix')}</Text>
        <Text size={12} color={r.muted}>{supported ? t('noise_count', { num: NOISE_SOUNDS.filter(id => saved[id].enabled).length }) : t('noise_unsupported')}</Text>
      </View>
      {NOISE_SOUNDS.map(id => (
        <View key={id} style={styles.row}>
          <Text size={15} color={r.list} style={styles.sound}>{t(`noise_${id}`)}</Text>
          {slider(saved[id].enabled ? saved[id].volume : 0, !supported || !saved[id].enabled, value => { run(changeNoise(id, { volume: value })) }, t(`noise_${id}`), true, value => { run(noise.set(id, { ...saved[id], volume: value })) })}
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !supported, selected: saved[id].enabled }}
            disabled={!supported} hitSlop={8} style={[styles.play, saved[id].enabled && supported ? { backgroundColor: r.ink } : null]}
            onPress={() => { run(changeNoise(id, { enabled: !saved[id].enabled })) }}>
            <Text size={13} color={saved[id].enabled && supported ? r.onInk : r.ink} style={styles.bold}>{t(saved[id].enabled && supported ? 'noise_playing' : 'noise_play')}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.rule} />
      <Text size={22} color={r.ink} style={styles.heavy}>{t('noise_music_volume')}</Text>
      <View style={[styles.row, { borderBottomWidth: 0 }]}>
        <Text size={12} color={r.muted}>{t('noise_song')}</Text>
        {slider(volume, false, value => { run(setVolume(value)); updateSetting({ 'player.volume': value }) }, t('noise_music_volume'), false, value => { run(setVolume(value)) })}
        <Text size={12} color={r.muted}>{Math.round(volume * 100)}%</Text>
      </View>
    </ScrollView>
  )
}
const MixerSlider = ({ value, disabled, onChange, label, thumb, onPreview }: { value: number, disabled: boolean, onChange: (value: number) => void, label: string, thumb: boolean, onPreview?: (value: number) => void }) => {
  const { colors } = useLuxTheme()
  const styles = useStyles()
  const [position, setPosition] = useState(value)
  useEffect(() => { setPosition(value) }, [value])
  return (
    <View style={styles.slider}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.line.divider }]}>
        <View style={[styles.fill, { width: `${thumb ? position * 100 : 100}%`, backgroundColor: colors.ink.strong }]} />
        {thumb && position > 0 ? <View style={[styles.thumb, { left: `${position * 100}%`, backgroundColor: colors.accent.primary, borderColor: colors.ink.strong }]} /> : null}
      </View>
      <Slider style={styles.nativeSlider} minimumValue={0} maximumValue={1} value={value} disabled={disabled}
        accessibilityLabel={label} onValueChange={next => { setPosition(next); onPreview?.(next) }} onSlidingComplete={onChange} />
    </View>
  )
}
const useStyles = sharedLuxStyles(colors => createStyle({
  page: { flex: 1, backgroundColor: colors.bg.app, paddingHorizontal: 22 },
  top: { marginTop: 10, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stop: { fontWeight: '700', textDecorationLine: 'underline', minHeight: 28, lineHeight: 28 },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  title: { fontWeight: '800', lineHeight: 38 },
  hint: { marginTop: 4 },
  rule: { height: 2, backgroundColor: colors.ink.strong, marginTop: 22, marginBottom: 12 },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heavy: { fontWeight: '800' },
  bold: { fontWeight: '700' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line.divider },
  sound: { width: 64, fontWeight: '700' },
  slider: { flex: 1, height: 44, justifyContent: 'center' },
  track: { height: 4 },
  fill: { height: 4 },
  thumb: { position: 'absolute', top: -5, width: 14, height: 14, marginLeft: -7, borderWidth: 2, borderRadius: 7 },
  nativeSlider: { position: 'absolute', left: -16, right: -16, height: 44, opacity: 0 },
  play: { height: 28, borderRadius: 15, paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.ink.strong, justifyContent: 'center' },
}))
