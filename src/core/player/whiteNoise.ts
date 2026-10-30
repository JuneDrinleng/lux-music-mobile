import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { noise, normalizeNoiseSettings, type NoiseSound, type NoiseSelection } from '@/plugins/player/noise'

let pending: Promise<void> = Promise.resolve()
const enqueue = async(action: () => Promise<void>) => {
  const result = pending.then(action)
  pending = result.catch(() => {})
  return result
}

// Explicit user actions only. Saved selections do not autoplay on process startup.
export const changeNoise = async(id: NoiseSound, change: Partial<NoiseSelection>) => enqueue(async() => {
  if (!noise.supported) return
  const saved = normalizeNoiseSettings(settingState.setting['player.whiteNoise'])
  const next = normalizeNoiseSettings({ ...saved, [id]: { ...saved[id], ...change } })
  await noise.set(id, next[id])
  updateSetting({ 'player.whiteNoise': next })
})
export const stopWhiteNoise = async() => enqueue(async() => {
  await noise.stop()
  const saved = normalizeNoiseSettings(settingState.setting['player.whiteNoise'])
  for (const id of Object.keys(saved) as NoiseSound[]) saved[id].enabled = false
  updateSetting({ 'player.whiteNoise': saved })
})
