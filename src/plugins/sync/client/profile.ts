import { sessionGeneration, acceptsSessionGeneration } from '@/utils/sessionFence'
import { getActiveSpace } from '@/utils/dataSpace'
import { getSyncHost, getLuxAuth, getSyncMode, getUserAvatarDataUrl, getUserName, getUserSignature, getUserGender, saveUserAvatarDataUrl, saveUserName, saveUserSignature, saveUserGender } from '@/utils/data'
import { parseUrl } from './utils'
import { requestJson } from './auth'

type ProfilePatch = Partial<LX.Sync.LuxProfile>
export interface ProfileIdentity {
  generation: number
  space: string
}
export const captureProfileIdentity = (): ProfileIdentity => ({ generation: sessionGeneration(), space: getActiveSpace() })
const isCurrent = (identity: ProfileIdentity) => acceptsSessionGeneration(identity.generation) && identity.space === getActiveSpace()
const assertCurrent = (identity: ProfileIdentity) => {
  if (!isCurrent(identity)) throw new Error('Profile account changed')
}

// Pulls, explicit uploads and edits share a queue, including their local writes.
// Waiting for a rejected operation must not prevent the next edit from retrying.
let operations: Promise<unknown> = Promise.resolve()
const serial = async <T>(operation: () => Promise<T>): Promise<T> => {
  const pending = operations.then(operation)
  operations = pending.catch(() => {})
  return pending
}
const fields = (profile: LX.Sync.LuxProfile): LX.Sync.LuxProfile => ({
  displayName: profile.displayName,
  avatar: profile.avatar,
  signature: profile.signature,
  gender: profile.gender,
})
const authIdentity = (auth: LX.Sync.LuxAuth) => JSON.stringify([auth.serverUrl, auth.serverId, auth.user.id])
const remoteContext = async(identity: ProfileIdentity, host?: string) => {
  assertCurrent(identity)
  const syncHost = host ?? await getSyncHost()
  const session = await getLuxAuth()
  assertCurrent(identity)
  if (!syncHost || !session?.token || !session.serverUrl || session.serverUrl !== parseUrl(syncHost).href) return null
  // A bearer and profile must belong to the active account's data space.
  if (session.serverId && identity.space !== `lux:${encodeURIComponent(session.serverId)}:${encodeURIComponent(session.user.id)}`) return null
  const urlInfo = parseUrl(syncHost)
  return { identity, url: `${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/me/profile`, token: session.token, account: authIdentity(session) }
}
type RemoteContext = NonNullable<Awaited<ReturnType<typeof remoteContext>>>
const assertRemoteCurrent = async(context: RemoteContext) => {
  assertCurrent(context.identity)
  const session = await getLuxAuth()
  assertCurrent(context.identity)
  // Token rotation is allowed; replacing the signed-in account is not.
  if (!session?.token || authIdentity(session) !== context.account) throw new Error('Profile account changed')
  context.token = session.token
}

const applyProfile = async(profile: LX.Sync.LuxProfile, identity: ProfileIdentity) => {
  if (!isCurrent(identity)) return false
  const displayName = profile.displayName.trim()
  const signature = profile.signature.trim()
  // Each helper captures its physical storage key before awaiting. Settle every
  // write before releasing the queue, even if one fails after partial persistence.
  const results = await Promise.allSettled([
    saveUserAvatarDataUrl(profile.avatar || null),
    saveUserName(displayName || null),
    saveUserSignature(signature || null),
    saveUserGender(profile.gender || 'unknown'),
  ])
  if (!isCurrent(identity)) return false
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason
  }
  const avatar = results[0]
  global.app_event.userNameUpdated(displayName)
  global.app_event.userSignatureUpdated(signature)
  global.app_event.userGenderUpdated(profile.gender || 'unknown')
  if (avatar.status === 'fulfilled') global.app_event.userAvatarUpdated(avatar.value)
  return true
}
export const applyLuxProfile = async(profile: LX.Sync.LuxProfile) => {
  const identity = captureProfileIdentity()
  return serial(async() => { await applyProfile(profile, identity) })
}

const pullProfile = async(identity: ProfileIdentity, host?: string) => {
  if (!isCurrent(identity)) return null
  const context = await remoteContext(identity, host)
  if (!context) return null
  const { profile } = await requestJson<{ profile: LX.Sync.LuxProfile }>(context.url, null, context.token)
  if (!isCurrent(identity)) return null
  await assertRemoteCurrent(context)
  return await applyProfile(profile, identity) ? profile : null
}
export const pullLuxProfileFromServer = async(host?: string) => {
  const identity = captureProfileIdentity()
  return serial(async() => pullProfile(identity, host))
}
export const syncLuxProfileOnLogin = async(host?: string) => {
  const identity = captureProfileIdentity()
  // Login only pulls. Local profile upload requires an explicit import or edit.
  return serial(async() => pullProfile(identity, host))
}
const settledValue = <T>(result: PromiseSettledResult<T>): T => {
  if (result.status === 'rejected') throw result.reason
  return result.value
}
const localProfile = async(identity: ProfileIdentity): Promise<LX.Sync.LuxProfile> => {
  assertCurrent(identity)
  // Avatar reads can migrate or remove an old local file. Even a failed sibling
  // read must wait for that work before the next queued operation may write.
  const [displayName, avatar, signature, gender] = await Promise.allSettled([getUserName(), getUserAvatarDataUrl(), getUserSignature(), getUserGender()])
  assertCurrent(identity)
  return { displayName: settledValue(displayName) ?? '', avatar: settledValue(avatar), signature: settledValue(signature) ?? '', gender: settledValue(gender) }
}
export const pushLuxProfileToServer = async(profilePatch?: ProfilePatch) => {
  const identity = captureProfileIdentity()
  return serial(async() => {
    if (!isCurrent(identity) || await getSyncMode() !== 'lux') return null
    const context = await remoteContext(identity)
    if (!context) return null
    const profile = profilePatch ?? await localProfile(identity)
    await assertRemoteCurrent(context)
    const result = await requestJson<{ profile: LX.Sync.LuxProfile }>(context.url, profile, context.token)
    await assertRemoteCurrent(context)
    return result
  })
}

const saveProfile = async(profile: LX.Sync.LuxProfile, server: boolean, identity: ProfileIdentity, context?: RemoteContext) => {
  assertCurrent(identity)
  let saved = profile
  if (server) {
    const remote = context ?? await remoteContext(identity)
    if (!remote) throw new Error('Profile session unavailable')
    await assertRemoteCurrent(remote)
    const result = await requestJson<{ profile: LX.Sync.LuxProfile }>(remote.url, fields(profile), remote.token, 'PATCH')
    await assertRemoteCurrent(remote)
    saved = result.profile
  }
  // The draft stays with the editor on failure. Never turn a failed PATCH into a local save.
  if (!await applyProfile(saved, identity)) throw new Error('Profile account changed')
  return saved
}
// Compatibility for callers intentionally replacing the complete profile.
export const saveEditedProfile = async(profile: LX.Sync.LuxProfile, server: boolean) => {
  const identity = captureProfileIdentity()
  return serial(async() => { await saveProfile(profile, server, identity) })
}

export const saveEditedProfileField = async <K extends keyof LX.Sync.LuxProfile>(field: K, value: LX.Sync.LuxProfile[K], server: boolean, identity = captureProfileIdentity()): Promise<LX.Sync.LuxProfile> => serial(async() => {
  assertCurrent(identity)
  if (!server) {
    const latest = await localProfile(identity)
    return saveProfile({ ...latest, [field]: value }, false, identity)
  }
  if (await getSyncMode() !== 'lux') throw new Error('Profile session unavailable')
  const context = await remoteContext(identity)
  if (!context) throw new Error('Profile session unavailable')
  // Always re-read the remote after acquiring the queue. This also recovers from
  // a timeout or successful PATCH followed by incomplete local persistence.
  const { profile } = await requestJson<{ profile: LX.Sync.LuxProfile }>(context.url, null, context.token)
  await assertRemoteCurrent(context)
  return saveProfile({ ...fields(profile), [field]: value }, true, identity, context)
})
