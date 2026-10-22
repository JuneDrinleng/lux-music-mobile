/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useRef, useState } from 'react'
import { Modal, NativeModules, ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { MagTopBar, OptionRow, Rule, Toggle } from '@/components/magazine'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSetting } from '@/store/setting/hook'
import settingState from '@/store/setting/state'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { createStyle } from '@/utils/tools'
import { audioEffectCapabilities, audioEffectStateKey, clampEqGain, commitAudioEffect, EQ_FREQUENCIES, EQ_PRESETS, formatEqGain, formatLoudness, LOUDNESS_TARGETS, normalizeAudioEffects, PRESET_GAINS, type AudioEffect, type AudioEffectSettings, type AudioEffectsBridge } from '@/utils/audioEffects'

/** Full-screen and conditionally mounted by Settings; no retained hidden layer. */
export default function AudioEffectsPage({ onBack }: { onBack: () => void }) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const top = useStatusbarHeight()
  const bottom = useSystemGestureInsetBottom()
  const setting = normalizeAudioEffects(useSetting())
  const bridge = NativeModules.TrackPlayerModule as AudioEffectsBridge | undefined
  const capabilities = audioEffectCapabilities(bridge)
  const [detail, setDetail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const writing = useRef(false)
  const scroll = useRef<ScrollView>(null)
  const back = () => { if (detail) { setDetail(false); scroll.current?.scrollTo({ y: 0, animated: false }) } else onBack() }
  const openDetail = () => { setDetail(true); scroll.current?.scrollTo({ y: 0, animated: false }) }
  const commit = (effect: AudioEffect, patch: Partial<AudioEffectSettings>) => {
    if (writing.current || !capabilities[effect]) return
    writing.current = true
    setBusy(true)
    setFailed(false)
    void commitAudioEffect(effect, { ...normalizeAudioEffects(settingState.setting), ...patch }, bridge, updateSetting)
      .catch(() => { setFailed(true) })
      .finally(() => { writing.current = false; setBusy(false) })
  }
  const supportNote = (effect: AudioEffect) => audioEffectStateKey(capabilities[effect]) ? t(`audio_effects_${effect}_unsupported`) : undefined
  const row = (label: string, effect: AudioEffect, key: keyof AudioEffectSettings, description?: string, link = false, last = false, short = false) => <View style={[styles.row, short ? styles.shortRow : null, { borderBottomColor: r.hairline, borderBottomWidth: last ? 0 : 1 }]}>
    <TouchableOpacity disabled={!link} activeOpacity={0.7} onPress={openDetail} accessibilityRole={link ? 'button' : undefined} accessibilityHint={link ? t('audio_effects_detail_hint') : undefined} style={styles.body}>
      <Text size={15} color={r.list} style={styles.bold}>{label}</Text>
      {description ? <Text size={12} color={r.muted} style={styles.subtitle}>{description}</Text> : null}
      {supportNote(effect) ? <Text size={12} color={r.muted} style={styles.subtitle}>{t('audio_effects_unsupported')}{' · '}{supportNote(effect)}</Text> : null}
    </TouchableOpacity>
    <Toggle compact accessibilityLabel={label} value={capabilities[effect] && setting[key] === true} disabled={!capabilities[effect] || busy} onChange={value => { commit(effect, { [key]: value }) }} />
  </View>
  const section = (label: string) => <><Rule gapTop={22} style={{ height: 2, opacity: 1 }} /><Text size={22} color={r.ink} style={styles.section}>{label}</Text></>
  const gains = JSON.parse(setting['player.audio.equalizer.gains']) as number[]
  const eqDisabled = !capabilities.equalizer || !setting['player.audio.equalizer.enabled'] || busy
  return <Modal visible animationType="slide" onRequestClose={back} statusBarTranslucent>
    <StatusBar />
    <ScrollView ref={scroll} style={{ backgroundColor: r.paper }} contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom + 28 }]}>
      <MagTopBar onBack={back} />
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t(detail ? 'audio_effects_detail_eyebrow' : 'audio_effects_eyebrow')}</Text>
      <Text size={32} color={r.display} style={styles.title}>{t(detail ? 'audio_effects_loudness' : 'audio_effects_title')}</Text>
      {detail ? <>
        {row(t('audio_effects_enable'), 'loudness', 'player.audio.loudness.enabled')}
        <Text size={15} color={r.list} style={[styles.bold, styles.target]}>{t('audio_effects_target')}</Text>
        {LOUDNESS_TARGETS.map((target, index) => <OptionRow key={target} leading label={t((['audio_effects_target_0', 'audio_effects_target_1', 'audio_effects_target_2'] as const)[index], { value: formatLoudness(target) })} selected={setting['player.audio.loudness.target'] === target} disabled={!capabilities.loudness || busy || !setting['player.audio.loudness.enabled']} onPress={() => { commit('loudness', { 'player.audio.loudness.target': target }) }} />)}
        {row(t('audio_effects_clipping'), 'loudness', 'player.audio.loudness.preventClipping', t('audio_effects_clipping_description'))}
        {section(t('audio_effects_gapless'))}
        {row(t('audio_effects_gapless_enable'), 'gapless', 'player.audio.gapless.enabled', t('audio_effects_gapless_detail'))}
        <Text size={12} color={r.muted} style={styles.gaplessNote}>{t('audio_effects_gapless_note')}</Text>
      </> : <>
        {section(t('audio_effects_equalizer'))}
        {row(t('audio_effects_equalizer_enable'), 'equalizer', 'player.audio.equalizer.enabled', undefined, false, false, true)}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
          {EQ_PRESETS.map(preset => {
            const selected = setting['player.audio.equalizer.preset'] === preset
            return <TouchableOpacity key={preset} disabled={eqDisabled} activeOpacity={0.7} hitSlop={{ top: 7, bottom: 7 }} accessibilityRole="radio" accessibilityState={{ selected, disabled: eqDisabled }} onPress={() => { commit('equalizer', { 'player.audio.equalizer.preset': preset, 'player.audio.equalizer.gains': JSON.stringify(preset === 'custom' ? gains : PRESET_GAINS[preset]) }) }} style={[styles.preset, { borderColor: r.ink, backgroundColor: selected ? r.ink : 'transparent', opacity: eqDisabled ? 0.4 : 1 }]}>
              <Text size={13} color={selected ? r.onInk : r.ink} style={styles.bold}>{t(`audio_effects_preset_${preset}`)}</Text>
            </TouchableOpacity>
          })}
        </ScrollView>
        <View style={[styles.eq, { borderColor: r.hairline, opacity: eqDisabled ? 0.4 : 1 }]}>
          <View pointerEvents="none" style={[styles.midline, { backgroundColor: r.hairline }]} />
          {EQ_FREQUENCIES.map((frequency, index) => <EqBand key={frequency} frequency={frequency} value={gains[index]} disabled={eqDisabled} onChange={value => {
            const next = [...gains]; next[index] = value
            commit('equalizer', { 'player.audio.equalizer.preset': 'custom', 'player.audio.equalizer.gains': JSON.stringify(next) })
          }} />)}
        </View>
        <View style={styles.frequencies}>{EQ_FREQUENCIES.map(frequency => <Text key={frequency} size={12} color={r.muted}>{frequency}</Text>)}</View>
        {section(t('audio_effects_volume_transition'))}
        {row(t('audio_effects_loudness'), 'loudness', 'player.audio.loudness.enabled', t('audio_effects_loudness_description', { value: formatLoudness(setting['player.audio.loudness.target']) }), true)}
        {row(t('audio_effects_gapless'), 'gapless', 'player.audio.gapless.enabled', t('audio_effects_gapless_description'), true, true)}
      </>}
      {failed ? <Text size={12} color={r.muted} accessibilityLiveRegion="polite">{t('audio_effects_failed')}</Text> : null}
    </ScrollView>
  </Modal>
}

function EqBand({ frequency, value, disabled, onChange }: { frequency: string, value: number, disabled: boolean, onChange: (value: number) => void }) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const [draft, setDraft] = useState<number | null>(null)
  const height = useRef(130)
  const pending = useRef(value)
  return <View style={styles.band} hitSlop={{ left: 15, right: 15 }} onLayout={event => { height.current = event.nativeEvent.layout.height }} accessibilityRole="adjustable" accessibilityLabel={`${frequency} Hz`} accessibilityState={{ disabled }} accessibilityValue={{ min: -12, max: 12, now: draft ?? value, text: formatEqGain(draft ?? value) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => { if (!disabled) onChange(clampEqGain(value + (event.nativeEvent.actionName === 'increment' ? 1 : -1))) }}
    onStartShouldSetResponder={() => !disabled}
    onMoveShouldSetResponder={() => !disabled}
    onResponderGrant={event => { pending.current = clampEqGain(12 - event.nativeEvent.locationY / height.current * 24); setDraft(pending.current) }}
    onResponderMove={event => { pending.current = clampEqGain(12 - event.nativeEvent.locationY / height.current * 24); setDraft(pending.current) }}
    onResponderRelease={() => { setDraft(null); onChange(pending.current) }}
    onResponderTerminate={() => { setDraft(null) }}>
    <View pointerEvents="none" style={[styles.rail, { backgroundColor: r.hairline }]} />
    <View pointerEvents="none" style={[styles.thumb, { top: `${(12 - (draft ?? value)) / 24 * 100}%`, backgroundColor: r.accent, borderColor: r.ink }]} />
  </View>
}

const useStyles = sharedLuxStyles(() => createStyle({
  content: { paddingHorizontal: 22, flexGrow: 1 },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  title: { fontWeight: '800', lineHeight: 38 },
  section: { fontWeight: '800', marginTop: 12 },
  bold: { fontWeight: '700' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  shortRow: { minHeight: 50, paddingVertical: 0 },
  body: { flex: 1, justifyContent: 'center', minHeight: 44 },
  subtitle: { marginTop: 2 },
  target: { marginTop: 14 },
  gaplessNote: { marginTop: 6 },
  presets: { gap: 8, paddingTop: 8, paddingBottom: 7 },
  preset: { height: 30, borderWidth: 1.5, borderRadius: 15, paddingHorizontal: 14, justifyContent: 'center' },
  eq: { height: 130, marginTop: 5, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
  midline: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1 },
  band: { width: 14, height: '100%' },
  rail: { position: 'absolute', left: 6, top: 0, bottom: 0, width: 2 },
  thumb: { position: 'absolute', left: 0, width: 14, height: 14, marginTop: -7, borderRadius: 7, borderWidth: 2 },
  frequencies: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
}))
