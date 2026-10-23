/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Animated, NativeModules, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { DOCK_BASE_HEIGHT, MagTopBar, OptionRow, Rule, Toggle } from '@/components/magazine'
import { APP_LAYER_INDEX } from '@/config/constant'
import commonState from '@/store/common/state'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { isHomeScreenActive } from '@/utils/homeBackHandler'
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

/** Main-level overlay below the Dock; mounted only while open. */
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
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const writing = useRef(false)
  const scroll = useRef<ScrollView>(null)
  const back = useCallback(() => { if (detail) { setDetail(false); scroll.current?.scrollTo({ y: 0, animated: false }) } else onBack() }, [detail, onBack])
  useBackHandler(useCallback(() => {
    if (!isHomeScreenActive(commonState.componentIds)) return false
    back()
    return true
  }, [back]))
  const openDetail = () => { setDetail(true); scroll.current?.scrollTo({ y: 0, animated: false }) }
  const commit = async(effect: AudioEffect, patch: Partial<AudioEffectSettings>) => {
    if (writing.current || !capabilities[effect]) return Promise.resolve(false)
    writing.current = true
    setBusy(true)
    setFailed(false)
    return commitAudioEffect(effect, { ...normalizeAudioEffects(settingState.setting), ...patch }, bridge, updateSetting)
      .catch(() => { setFailed(true); return false })
      .finally(() => { writing.current = false; setBusy(false) })
  }
  const supportNote = (effect: AudioEffect) => audioEffectStateKey(capabilities[effect]) ? t(`audio_effects_${effect}_unsupported`) : undefined
  const row = (label: string, effect: AudioEffect, key: keyof AudioEffectSettings, description?: string, link = false, last = false, short = false) => <View style={[styles.row, short ? styles.shortRow : null, { borderBottomColor: r.hairline, borderBottomWidth: last ? 0 : 1 }]}>
    <TouchableOpacity disabled={!link} activeOpacity={0.7} onPress={openDetail} accessibilityRole={link ? 'button' : undefined} accessibilityHint={link ? t('audio_effects_detail_hint') : undefined} style={styles.body}>
      <Text size={15} color={r.list} style={styles.bold}>{label}</Text>
      {description ? <Text size={12} color={r.muted} style={styles.subtitle}>{description}</Text> : null}
      {supportNote(effect) ? <Text size={12} color={r.muted} style={styles.subtitle}>{t('audio_effects_unsupported')}{' · '}{supportNote(effect)}</Text> : null}
    </TouchableOpacity>
    <Toggle compact accessibilityLabel={label} value={capabilities[effect] && setting[key] === true} disabled={!capabilities[effect] || busy} onChange={value => { void commit(effect, { [key]: value }) }} />
  </View>
  const section = (label: string) => <><Rule gapTop={22} style={{ height: 2, opacity: 1 }} /><Text size={22} color={r.ink} style={styles.section}>{label}</Text></>
  const gains = JSON.parse(setting['player.audio.equalizer.gains']) as number[]
  const eqDisabled = !capabilities.equalizer || !setting['player.audio.equalizer.enabled'] || busy
  return <View style={[styles.root, { backgroundColor: r.paper }]}>
    <StatusBar />
    <ScrollView ref={scroll} scrollEnabled={!dragging} style={{ backgroundColor: r.paper }} contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: DOCK_BASE_HEIGHT + bottom + 28 }]}>
      <MagTopBar onBack={back} />
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t(detail ? 'audio_effects_detail_eyebrow' : 'audio_effects_eyebrow')}</Text>
      <Text size={32} color={r.display} style={styles.title}>{t(detail ? 'audio_effects_loudness' : 'audio_effects_title')}</Text>
      {detail ? <>
        {row(t('audio_effects_enable'), 'loudness', 'player.audio.loudness.enabled')}
        <Text size={15} color={r.list} style={[styles.bold, styles.target]}>{t('audio_effects_target')}</Text>
        {LOUDNESS_TARGETS.map((target, index) => <OptionRow key={target} leading label={t((['audio_effects_target_0', 'audio_effects_target_1', 'audio_effects_target_2'] as const)[index], { value: formatLoudness(target) })} selected={setting['player.audio.loudness.target'] === target} disabled={!capabilities.loudness || busy || !setting['player.audio.loudness.enabled']} onPress={() => { void commit('loudness', { 'player.audio.loudness.target': target }) }} />)}
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
            return <TouchableOpacity key={preset} disabled={eqDisabled} activeOpacity={0.7} hitSlop={{ top: 7, bottom: 7 }} accessibilityRole="radio" accessibilityState={{ selected, disabled: eqDisabled }} onPress={() => { void commit('equalizer', { 'player.audio.equalizer.preset': preset, 'player.audio.equalizer.gains': JSON.stringify(preset === 'custom' ? gains : PRESET_GAINS[preset]) }) }} style={[styles.preset, { borderColor: r.ink, backgroundColor: selected ? r.ink : 'transparent', opacity: eqDisabled ? 0.4 : 1 }]}>
              <Text size={13} color={selected ? r.onInk : r.ink} style={styles.bold}>{t(`audio_effects_preset_${preset}`)}</Text>
            </TouchableOpacity>
          })}
        </ScrollView>
        <View style={[styles.eq, { borderColor: r.hairline, opacity: eqDisabled ? 0.4 : 1 }]}>
          <View pointerEvents="none" style={[styles.midline, { backgroundColor: r.hairline }]} />
          {EQ_FREQUENCIES.map((frequency, index) => <EqBand key={frequency} frequency={frequency} value={gains[index]} disabled={eqDisabled} onDraggingChange={setDragging} onChange={async value => {
            const next = [...gains]; next[index] = value
            return commit('equalizer', { 'player.audio.equalizer.preset': 'custom', 'player.audio.equalizer.gains': JSON.stringify(next) })
          }} />)}
        </View>
        <View style={styles.frequencies}>{EQ_FREQUENCIES.map(frequency => <Text key={frequency} size={12} color={r.muted}>{frequency}</Text>)}</View>
        {section(t('audio_effects_volume_transition'))}
        {row(t('audio_effects_loudness'), 'loudness', 'player.audio.loudness.enabled', t('audio_effects_loudness_description', { value: formatLoudness(setting['player.audio.loudness.target']) }), true)}
        {row(t('audio_effects_gapless'), 'gapless', 'player.audio.gapless.enabled', t('audio_effects_gapless_description'), true, true)}
      </>}
      {failed ? <Text size={12} color={r.muted} accessibilityLiveRegion="polite">{t('audio_effects_failed')}</Text> : null}
    </ScrollView>
  </View>
}

export function EqBand({ frequency, value, disabled, onChange, onDraggingChange }: { frequency: string, value: number, disabled: boolean, onChange: (value: number) => Promise<boolean>, onDraggingChange: (dragging: boolean) => void }) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const [draft, setDraft] = useState<number | null>(null)
  const [height, setHeight] = useState(130)
  const pending = useRef(value)
  const dragging = useRef(false)
  // Band top in page coordinates, fixed at grant. Android move events can report locationY relative to a
  // different view than the band, so moves use pageY minus this origin instead.
  const originPageY = useRef(0)
  const thumbY = useRef(new Animated.Value(0)).current
  const live = draft ?? value
  // A transform updates the native thumb directly, without percentage Yoga relayout.
  useLayoutEffect(() => { thumbY.setValue((12 - live) / 24 * height) }, [live, height, thumbY])
  useLayoutEffect(() => {
    if (!dragging.current && draft === value) setDraft(null)
  }, [draft, value])
  const move = (y: number) => {
    pending.current = clampEqGain(12 - y / height * 24)
    setDraft(pending.current)
  }
  return <View style={styles.band} hitSlop={{ left: 15, right: 15 }} onLayout={event => { if (event.nativeEvent.layout.height > 0) setHeight(event.nativeEvent.layout.height) }} accessibilityRole="adjustable" accessibilityLabel={`${frequency} Hz`} accessibilityState={{ disabled }} accessibilityValue={{ min: -12, max: 12, now: live, text: formatEqGain(live) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => { if (!disabled) void onChange(clampEqGain(value + (event.nativeEvent.actionName === 'increment' ? 1 : -1))) }}
    onStartShouldSetResponder={() => !disabled}
    onMoveShouldSetResponder={() => !disabled}
    onResponderTerminationRequest={() => false}
    onResponderGrant={event => {
      dragging.current = true
      onDraggingChange(true)
      originPageY.current = event.nativeEvent.pageY - event.nativeEvent.locationY
      move(event.nativeEvent.locationY)
    }}
    onResponderMove={event => { if (dragging.current) move(event.nativeEvent.pageY - originPageY.current) }}
    onResponderRelease={() => {
      if (!dragging.current) return
      dragging.current = false
      onDraggingChange(false)
      if (pending.current === value) setDraft(null)
      // Keep the final draft until the setting acknowledges it; never expose the old value in flight.
      void onChange(pending.current).then(applied => { if (!applied) setDraft(null) }, () => { setDraft(null) })
    }}
    onResponderTerminate={() => { dragging.current = false; setDraft(null); onDraggingChange(false) }}>
    <View pointerEvents="none" style={[styles.rail, { backgroundColor: r.hairline }]} />
    <Animated.View pointerEvents="none" style={[styles.thumb, { top: 0, transform: [{ translateY: thumbY }], backgroundColor: r.accent, borderColor: r.ink }]} />
  </View>
}

const useStyles = sharedLuxStyles(() => createStyle({
  root: { ...StyleSheet.absoluteFillObject, zIndex: APP_LAYER_INDEX.controls - 1 },
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
