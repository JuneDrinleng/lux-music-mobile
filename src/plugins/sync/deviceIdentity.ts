/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Format 128 bits of securely generated entropy as an RFC 4122 version 4 UUID. */
export const uuidV4FromBytes = (bytes: ArrayLike<number>): string => {
  if (bytes.length != 16) throw new Error('A device UUID requires 16 random bytes')
  const value = Array.from(bytes)
  if (value.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new Error('Invalid device UUID entropy')
  }
  value[6] = (value[6] & 0x0f) | 0x40
  value[8] = (value[8] & 0x3f) | 0x80
  const hex = value.map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

interface DeviceIdStorage {
  read: () => Promise<string | null>
  write: (deviceId: string) => Promise<void>
  create: () => Promise<string>
}

const isDeviceId = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

/** Never expose a new identity to a server before its local write succeeds. */
export const createPersistedDeviceIdGetter = ({ read, write, create }: DeviceIdStorage): (() => Promise<string>) => {
  const identity: { saved?: string, created?: string } = {}
  let pending: Promise<string> | undefined

  return async() => {
    if (identity.saved) return identity.saved
    if (pending) return pending
    pending = (async() => {
      const existing = await read()
      if (existing != null) {
        // A read error or corrupt value must not silently replace an existing installation.
        if (!isDeviceId(existing)) throw new Error('Invalid saved sync device ID')
        identity.saved = existing
        return existing
      }
      const deviceId = identity.created ?? await create()
      if (!isDeviceId(deviceId)) throw new Error('Invalid generated sync device ID')
      identity.created = deviceId
      await write(deviceId)
      identity.saved = deviceId
      return deviceId
    })().finally(() => {
      pending = undefined
    })
    return pending
  }
}
