/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { nativeCredentialBackend, type SecureCredentialBackend } from './secureCredentials'
import type { CredentialRef } from './loginSession'

interface KeyInfo { key: string, clientId: string, serverName: string, luxUserId?: string, lxAuthCodeHash?: string }
interface SavedReference { credentialRef: CredentialRef, luxUserId?: string }
type Index = Record<string, KeyInfo | SavedReference>
interface IndexStorage { read: () => Promise<Index | null>, write: (index: Index) => Promise<void>, remove: () => Promise<void> }
const service = (id: string) => `lux.sync.${encodeURIComponent(id)}`
export const syncCredentialRef = (id: string): CredentialRef => ({ kind: 'syncKey', id })
export const luxCredentialRef = (serverId: string, userId: string): CredentialRef => ({ kind: 'luxRefresh', id: JSON.stringify([serverId, userId]) })

/** The old public API remains the adapter. The index contains references, never keys.
 * Copy -> verify -> replace index. Interrupted publication is replayable; no plaintext fallback.
 * Storage failure retains the original migration source for a later retry, but never returns it.
 */
export const createLoginCredentialRepository = (storage: IndexStorage, secure: SecureCredentialBackend = nativeCredentialBackend) => {
  let pending: Promise<unknown> = Promise.resolve()
  const enqueue = async<T>(work: () => Promise<T>): Promise<T> => {
    const result = pending.then(work)
    pending = result.catch(() => {})
    return result
  }
  const save = async(id: string, info: KeyInfo): Promise<SavedReference> => {
    const value = JSON.stringify({ key: info.key, clientId: info.clientId, serverName: info.serverName, luxUserId: info.luxUserId, lxAuthCodeHash: info.lxAuthCodeHash })
    if (await secure.set(service(id), value) === false || await secure.get(service(id)) !== value) throw new Error('Secure credential write failed')
    return { credentialRef: syncCredentialRef(id), ...(info.luxUserId ? { luxUserId: info.luxUserId } : {}) }
  }
  const migrate = async(): Promise<Index> => {
    const index = await storage.read() ?? {}
    for (const [id, entry] of Object.entries(index)) {
      if ('key' in entry) {
        index[id] = await save(id, entry)
        // Publish each verified entry. Restart can resume after any individual write.
        await storage.write(index)
      }
    }
    return index
  }
  return {
    /** Values stay in the credential layer; callers must never persist the result in recents. */
    readRefresh: async(ref: CredentialRef): Promise<string | null> => {
      if (ref.kind !== 'luxRefresh') throw new Error('Wrong credential kind')
      const identity: unknown = JSON.parse(ref.id)
      if (!Array.isArray(identity) || identity.length !== 2 || identity.some(item => typeof item !== 'string' || !item)) throw new Error('Invalid account reference')
      return secure.get(`lux.refresh.${encodeURIComponent(ref.id)}`)
    },
    get: async(id: string): Promise<KeyInfo | null> => enqueue(async() => {
      const index = await migrate()
      if (!Object.prototype.hasOwnProperty.call(index, id)) return null
      const entry = index[id]
      if (!('credentialRef' in entry) || entry.credentialRef.kind !== 'syncKey' || entry.credentialRef.id !== id) throw new Error('Credential reference mismatch')
      const value = await secure.get(service(id))
      if (!value) return null
      const info: KeyInfo = JSON.parse(value)
      if (typeof info.key !== 'string' || typeof info.clientId !== 'string') throw new Error('Invalid secure credential')
      return info
    }),
    set: async(id: string, info: KeyInfo): Promise<void> => enqueue(async() => {
      const index = await migrate()
      if (!Object.prototype.hasOwnProperty.call(index, id)) {
        // Reserve a discoverable reference before writing a new secure entry.
        // Even a crash between native write and index publication can be cleared.
        index[id] = { credentialRef: syncCredentialRef(id), ...(info.luxUserId ? { luxUserId: info.luxUserId } : {}) }
        await storage.write(index)
      }
      const ref = await save(id, info)
      await storage.write({ ...index, [id]: ref })
    }),
    clear: async(): Promise<void> => enqueue(async() => {
      const index = await storage.read() ?? {}
      // Clear secure entries before removing their discoverable index. Retry on failure.
      for (const id of Object.keys(index)) {
        if (await secure.clear(service(id)) === false) throw new Error('Secure credential removal failed')
      }
      await storage.remove()
    }),
  }
}
