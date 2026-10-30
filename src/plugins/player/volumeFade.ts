/** Temporary output gain; user volume is kept separately and is never persisted here. */
export const fadeGain = (remainingSeconds: number, durationSeconds: number) => {
  if (!Number.isFinite(remainingSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 1
  return Math.max(0, Math.min(1, remainingSeconds / durationSeconds))
}

export const songRemainingSeconds = (position: number, duration: number, rate: number) => {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0 || !Number.isFinite(rate) || rate <= 0) return Infinity
  return Math.max(0, duration - position) / rate
}

export const createVolumeFade = (write: (volume: number) => Promise<void>) => {
  let volume = 1
  let gain = 1
  let pending = Promise.resolve()
  const apply = async() => {
    const output = volume * gain
    // Serialize native writes so cancellation wins over an in-flight fade write.
    pending = pending.catch(() => {}).then(async() => write(output))
    return pending
  }
  return {
    setVolume: async(value: number) => {
      volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
      return apply()
    },
    setGain: async(value: number) => {
      gain = fadeGain(value, 1)
      return apply()
    },
    restore: async() => {
      gain = 1
      return apply()
    },
  }
}
