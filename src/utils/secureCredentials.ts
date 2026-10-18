/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface SecureCredentialBackend {
  set: (service: string, token: string) => Promise<unknown>
  get: (service: string) => Promise<string | null>
  clear: (service: string) => Promise<unknown>
}

// Load lazily: missing/unavailable native storage follows the same safe expiry path.
interface KeychainModule {
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: string }
  SECURITY_LEVEL: { SECURE_SOFTWARE: string }
  STORAGE_TYPE: { AES_GCM_NO_AUTH: string }
  setGenericPassword: (username: string, password: string, options: { service: string, accessible: string, securityLevel: string, storage: string }) => Promise<unknown>
  getGenericPassword: (options: { service: string }) => Promise<false | { password: string }>
  resetGenericPassword: (options: { service: string }) => Promise<unknown>
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const keychain = (): KeychainModule => require('react-native-keychain') as KeychainModule
const nativeBackend: SecureCredentialBackend = {
  set: async(service, token) => {
    const kc = keychain()
    return kc.setGenericPassword('refresh', token, {
      service,
      accessible: kc.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      securityLevel: kc.SECURITY_LEVEL.SECURE_SOFTWARE,
      storage: kc.STORAGE_TYPE.AES_GCM_NO_AUTH,
      // No accessControl: background refresh must never prompt for user presence.
    })
  },
  get: async(service) => {
    const value = await keychain().getGenericPassword({ service })
    return value ? value.password : null
  },
  clear: async(service) => keychain().resetGenericPassword({ service }),
}

export const refreshTokenServerKey = (auth: { serverId?: string, serverUrl?: string, user?: { id: string } }) => auth.user?.id ? JSON.stringify([auth.serverId ?? auth.serverUrl ?? 'legacy', auth.user.id]) : auth.serverId ?? auth.serverUrl ?? 'legacy'

export const createSecureCredentials = (backend: SecureCredentialBackend = nativeBackend) => {
  const service = (serverKey: string) => `lux.refresh.${encodeURIComponent(serverKey)}`
  const clear = async(serverKey: string): Promise<void> => {
    try { await backend.clear(service(serverKey)) } catch {}
  }
  return {
    clear,
    async setRefreshToken(serverKey: string, token: string): Promise<boolean> {
      try {
        if (await backend.set(service(serverKey), token) === false) throw new Error('Secure storage rejected write')
        if (await backend.get(service(serverKey)) !== token) throw new Error('Secure storage verification failed')
        return true
      } catch {
        await clear(serverKey)
        return false
      }
    },
    async getRefreshToken(serverKey: string): Promise<string | null> {
      try { return await backend.get(service(serverKey)) } catch {
        await clear(serverKey)
        return null
      }
    },
  }
}
const secureCredentials = createSecureCredentials()
export const setRefreshToken = async(serverKey: string, token: string) => secureCredentials.setRefreshToken(serverKey, token)
export const getRefreshToken = async(serverKey: string) => secureCredentials.getRefreshToken(serverKey)
export const clear = async(serverKey: string) => secureCredentials.clear(serverKey)
export default secureCredentials
