/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import AsyncStorage from '@react-native-async-storage/async-storage'

import { generateRsaKey, hashSHA1 } from '@/utils/nativeModules/crypto'
import { createPersistedDeviceIdGetter, uuidV4FromBytes } from './deviceIdentity'

// Separate from server credentials and login state so logout cannot rotate the ID.
const STORAGE_KEY = '@sync_device_id'

const createDeviceId = async(): Promise<string> => {
  // The existing native RSA generator uses Android's SecureRandom-backed provider.
  // Hash its fresh public key to obtain uniformly distributed bytes without adding
  // a native dependency. This runs only once per installation; no private key is kept.
  const { publicKey } = await generateRsaKey()
  const entropy = await hashSHA1(publicKey)
  if (!/^[0-9a-f]{40}$/i.test(entropy)) throw new Error('Invalid sync device entropy')
  const bytes = Array.from({ length: 16 }, (_, index) => parseInt(entropy.slice(index * 2, index * 2 + 2), 16))
  return uuidV4FromBytes(bytes)
}

export const getSyncDeviceId = createPersistedDeviceIdGetter({
  // Use AsyncStorage directly: the generic data helpers swallow storage errors.
  read: async() => AsyncStorage.getItem(STORAGE_KEY),
  write: async(deviceId) => AsyncStorage.setItem(STORAGE_KEY, deviceId),
  create: createDeviceId,
})
