/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export class CredentialRejectedError extends Error {}

export const isKeyRejection = (code: number, text: string, authFailed: string, blockedIp: string): boolean => {
  if (text == blockedIp || code == 429 || code >= 500) return false
  return text == authFailed || code == 401 || code == 403
}

interface CredentialOptions<T> {
  saved: T | null
  verify: (key: T) => Promise<void>
  request: (previousClientId?: string) => Promise<T>
  save: (key: T) => Promise<void>
}

export const reuseOrRequestKey = async<T extends { clientId: string }>({ saved, verify, request, save }: CredentialOptions<T>): Promise<T> => {
  if (saved) {
    try {
      await verify(saved)
      return saved
    } catch (error) {
      // Timeouts, offline servers, rate limits and storage failures cannot revoke a key.
      if (!(error instanceof CredentialRejectedError)) throw error
    }
  }
  const key = await request(saved?.clientId)
  await save(key)
  return key
}

export const credentialStorageKey = (serverId: string, mode: 'lx' | 'lux', accountId: string): string => JSON.stringify([serverId, mode, accountId])

interface OwnedCredential {
  clientId: string
  luxUserId?: string
  lxAuthCodeHash?: string
}

export const selectLuxCredential = <T extends OwnedCredential>(scoped: T | null, legacy: T | null, userId: string) => ({
  saved: scoped ?? (legacy?.luxUserId == userId ? legacy : null),
  // The authenticated server resolves an unowned legacy ID within the current
  // account; never forward an ID known to belong to a different account/mode.
  previousClientId: !legacy?.luxUserId && !legacy?.lxAuthCodeHash ? legacy?.clientId : undefined,
})

export const selectLxCredential = <T extends OwnedCredential>(scoped: T | null, legacy: T | null, codeHash: string): T | null => {
  if (scoped) return scoped
  if (legacy?.luxUserId) return null
  // An explicit, different connection code selects another account. A legacy
  // key without a code binding can only be reused for automatic connections.
  return !codeHash || legacy?.lxAuthCodeHash == codeHash ? legacy : null
}

export const buildLuxKeyRequest = (deviceId: string, deviceName: string, clientId?: string) => ({
  deviceId,
  deviceName,
  platform: 'lux_music_mobile',
  ...(clientId ? { clientId } : {}),
})

export const buildLxAuthMessage = (authMsg: string, publicKey: string, deviceName: string, deviceId: string): string => {
  // Upstream LX reads only indexes 1..3 after splitting on newlines; it ignores line 5.
  return [authMsg, publicKey, deviceName.replace(/[\r\n]/g, ' '), 'lx_music_mobile', deviceId].join('\n')
}

interface CredentialStorage<T> {
  read: () => Promise<Record<string, T> | null>
  write: (keys: Record<string, T>) => Promise<void>
  remove: () => Promise<void>
}

/** Serialize read/modify/write operations so parallel server logins cannot lose keys. */
export const createCredentialStore = <T>({ read, write, remove }: CredentialStorage<T>) => {
  let pending = Promise.resolve()
  const enqueue = async(operation: () => Promise<void>) => {
    const result = pending.then(operation)
    pending = result.catch(() => {})
    return result
  }
  return {
    async get(id: string): Promise<T | null> {
      await pending
      const keys = await read()
      return keys && Object.prototype.hasOwnProperty.call(keys, id) ? keys[id] : null
    },
    async set(id: string, value: T): Promise<void> {
      return enqueue(async() => {
        const keys = await read() ?? {}
        await write({ ...keys, [id]: value })
      })
    },
    async clear(): Promise<void> {
      return enqueue(remove)
    },
  }
}
