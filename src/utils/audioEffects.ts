/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export const EQ_FREQUENCIES = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'] as const
export const EQ_PRESETS = ['custom', 'pop', 'rock', 'vocal', 'bass', 'classical'] as const
export type EqPreset = typeof EQ_PRESETS[number]
export type AudioEffect = 'equalizer' | 'loudness' | 'gapless'
export const LOUDNESS_TARGETS = [-18, -14, -11] as const
export const PRESET_GAINS: Record<EqPreset, readonly number[]> = {
  custom: [5, 8, 3, -2, -3, 0, 3, 6, 8, 5],
  pop: [-1, 2, 4, 5, 3, 0, -1, -1, 2, 3],
  rock: [5, 4, 2, 0, -2, -1, 2, 4, 5, 5],
  vocal: [-3, -2, -1, 1, 4, 5, 4, 2, 0, -2],
  bass: [8, 7, 5, 3, 1, 0, 0, 0, 0, 0],
  classical: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
}
export const AUDIO_EFFECT_DEFAULTS = {
  'player.audio.equalizer.enabled': false,
  'player.audio.equalizer.preset': 'custom' as EqPreset,
  // Settings only persist primitives. Keep the ten gains in a JSON string.
  'player.audio.equalizer.gains': JSON.stringify(PRESET_GAINS.custom),
  'player.audio.loudness.enabled': false,
  'player.audio.loudness.target': -14,
  'player.audio.loudness.preventClipping': true,
  'player.audio.gapless.enabled': false,
}
export type AudioEffectSettings = typeof AUDIO_EFFECT_DEFAULTS
export const clampEqGain = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(-12, Math.min(12, value))) : 0
export const formatEqGain = (value: number): string => `${clampEqGain(value) > 0 ? '+' : ''}${clampEqGain(value)} dB`
export const formatLoudness = (value: number): string => `${value < 0 ? '−' : ''}${Math.abs(value)} LUFS`
export const normalizeAudioEffects = (settings: Partial<AudioEffectSettings>): AudioEffectSettings => {
  let gains: unknown
  try { gains = JSON.parse(settings['player.audio.equalizer.gains'] ?? AUDIO_EFFECT_DEFAULTS['player.audio.equalizer.gains']) } catch { gains = null }
  const target = settings['player.audio.loudness.target']
  return {
    'player.audio.equalizer.enabled': settings['player.audio.equalizer.enabled'] === true,
    'player.audio.equalizer.preset': EQ_PRESETS.includes(settings['player.audio.equalizer.preset']!) ? settings['player.audio.equalizer.preset']! : 'custom',
    'player.audio.equalizer.gains': JSON.stringify(Array.isArray(gains) && gains.length === 10 ? gains.map(clampEqGain) : PRESET_GAINS.custom),
    'player.audio.loudness.enabled': settings['player.audio.loudness.enabled'] === true,
    'player.audio.loudness.target': LOUDNESS_TARGETS.includes(target as typeof LOUDNESS_TARGETS[number]) ? target! : -14,
    'player.audio.loudness.preventClipping': settings['player.audio.loudness.preventClipping'] !== false,
    'player.audio.gapless.enabled': settings['player.audio.gapless.enabled'] === true,
  }
}

/** JS adapter contract for phase 7; absence of a callable bridge always disables the control.
 * No inference from platform, setVolume, setRate, or generic queue support.
 * Each bridge accepts the complete effect configuration and resolves after applying it.
 */
export interface AudioEffectsBridge {
  setEqualizer?: (config: { enabled: boolean, preset: EqPreset, gains: number[] }) => Promise<void>
  setLoudnessNormalization?: (config: { enabled: boolean, target: number, preventClipping: boolean }) => Promise<void>
  setGaplessPlayback?: (enabled: boolean) => Promise<void>
}
export const audioEffectCapabilities = (bridge?: AudioEffectsBridge | null): Record<AudioEffect, boolean> => ({
  equalizer: typeof bridge?.setEqualizer === 'function',
  loudness: typeof bridge?.setLoudnessNormalization === 'function',
  gapless: typeof bridge?.setGaplessPlayback === 'function',
})
export const audioEffectStateKey = (supported: boolean) => supported ? null : 'audio_effects_unsupported' as const

/** Apply before persisting; failed/absent bridges must never record a successful change. */
export const commitAudioEffect = async(effect: AudioEffect, settings: AudioEffectSettings, bridge: AudioEffectsBridge | null | undefined, persist: (settings: AudioEffectSettings) => void): Promise<boolean> => {
  if (!audioEffectCapabilities(bridge)[effect]) return false
  const safe = normalizeAudioEffects(settings)
  switch (effect) {
    case 'equalizer': await bridge!.setEqualizer!({ enabled: safe['player.audio.equalizer.enabled'], preset: safe['player.audio.equalizer.preset'], gains: JSON.parse(safe['player.audio.equalizer.gains']) as number[] }); break
    case 'loudness': await bridge!.setLoudnessNormalization!({ enabled: safe['player.audio.loudness.enabled'], target: safe['player.audio.loudness.target'], preventClipping: safe['player.audio.loudness.preventClipping'] }); break
    case 'gapless': await bridge!.setGaplessPlayback!(safe['player.audio.gapless.enabled']); break
  }
  persist(safe)
  return true
}
