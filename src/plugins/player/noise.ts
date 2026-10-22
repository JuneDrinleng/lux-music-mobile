import { NativeModules } from 'react-native'

export const NOISE_SOUNDS = ['rain', 'fire', 'ocean', 'cafe', 'fan'] as const
export type NoiseSound = typeof NOISE_SOUNDS[number]
export interface NoiseSelection { enabled: boolean, volume: number }
export type NoiseSettings = Record<NoiseSound, NoiseSelection>
export const clampNoiseVolume = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5
export const normalizeNoiseSettings = (value: unknown): NoiseSettings => {
  const saved = value && typeof value === 'object' ? value as Partial<NoiseSettings> : {}
  return Object.fromEntries(NOISE_SOUNDS.map(id => [id, { enabled: saved[id]?.enabled === true, volume: clampNoiseVolume(saved[id]?.volume) }])) as NoiseSettings
}
interface NoiseBridge {
  CAPABILITY_WHITE_NOISE?: boolean
  setNoise?: (id: NoiseSound, enabled: boolean, volume: number) => Promise<void>
  stopNoise?: () => Promise<void>
  setNoiseTimer?: (stop: boolean, gain: number) => Promise<void>
}
export const createNoiseController = (bridge?: NoiseBridge) => {
  const supported = bridge?.CAPABILITY_WHITE_NOISE === true && typeof bridge.setNoise === 'function' && typeof bridge.stopNoise === 'function' && typeof bridge.setNoiseTimer === 'function'
  return {
    supported,
    async set(id: NoiseSound, selection: NoiseSelection) {
      if (supported) await bridge.setNoise!(id, selection.enabled, clampNoiseVolume(selection.volume))
    },
    async stop() { if (supported) await bridge.stopNoise!() },
    async timer(stop: boolean, gain = 1) { if (supported) await bridge.setNoiseTimer!(stop, clampNoiseVolume(gain)) },
  }
}
export const noise = createNoiseController(NativeModules.TrackPlayerModule as NoiseBridge | undefined)
