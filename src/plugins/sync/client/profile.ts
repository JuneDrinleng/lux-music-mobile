import { getActiveSpace } from '@/utils/dataSpace'
import { getSyncHost, getLuxAuth, getSyncMode, getUserAvatarDataUrl, getUserName, getUserSignature, getUserGender, saveUserAvatarDataUrl, saveUserName, saveUserSignature, saveUserGender } from '@/utils/data'
import { parseUrl } from './utils'
import { requestJson } from './auth'

type ProfilePatch = Partial<LX.Sync.LuxProfile>

const getProfileUrl = async(host?: string) => {
  const syncHost = host ?? await getSyncHost()
  if (!syncHost) return null
  const urlInfo = parseUrl(syncHost)
  return `${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/me/profile`
}

const getToken = async(host?: string) => {
  const syncHost = host ?? await getSyncHost()
  if (!syncHost) return ''
  const session = await getLuxAuth()
  // A global active profile must never send another server's bearer token.
  if (!session?.serverUrl || session.serverUrl != parseUrl(syncHost).href) return ''
  return session.token
}

export const applyLuxProfile = async(profile: LX.Sync.LuxProfile) => {
  const displayName = profile.displayName.trim()
  const signature = profile.signature.trim()
  const space = getActiveSpace()
  const [avatar] = await Promise.all([
    saveUserAvatarDataUrl(profile.avatar || null),
    saveUserName(displayName || null),
    saveUserSignature(signature || null),
    saveUserGender(profile.gender || 'unknown'),
  ])
  if (space != getActiveSpace()) return
  global.app_event.userNameUpdated(displayName)
  global.app_event.userSignatureUpdated(signature)
  global.app_event.userGenderUpdated(profile.gender || 'unknown')
  global.app_event.userAvatarUpdated(avatar)
}

export const pullLuxProfileFromServer = async(host?: string) => {
  const space = getActiveSpace()
  const [url, token] = await Promise.all([getProfileUrl(host), getToken(host)])
  if (!url || !token) return null
  const { profile } = await requestJson<{ profile: LX.Sync.LuxProfile }>(url, null, token)
  if (space != getActiveSpace()) return null
  await applyLuxProfile(profile)
  return profile
}

export const syncLuxProfileOnLogin = async(host?: string) => {
  const space = getActiveSpace()
  const [url, token] = await Promise.all([getProfileUrl(host), getToken(host)])
  if (!url || !token) return null
  const { profile } = await requestJson<{ profile: LX.Sync.LuxProfile }>(url, null, token)
  if (space != getActiveSpace()) return null
  const hasRemoteProfile = !!(profile.displayName || profile.avatar || profile.signature || profile.gender != 'unknown')
  if (hasRemoteProfile) {
    await applyLuxProfile(profile)
    return profile
  }
  const localProfile: LX.Sync.LuxProfile = {
    displayName: (await getUserName()) ?? '',
    avatar: await getUserAvatarDataUrl(),
    gender: await getUserGender(),
    signature: (await getUserSignature()) ?? '',
  }
  if (space != getActiveSpace()) return null
  return requestJson<{ profile: LX.Sync.LuxProfile }>(url, localProfile, token).then(({ profile }) => profile)
}

export const pushLuxProfileToServer = async(profilePatch?: ProfilePatch) => {
  const space = getActiveSpace()
  if (await getSyncMode() != 'lux') return null
  const [url, token] = await Promise.all([getProfileUrl(), getToken()])
  if (!url || !token) return null
  const profile: ProfilePatch = profilePatch ?? {
    displayName: (await getUserName()) ?? '',
    avatar: await getUserAvatarDataUrl(),
    gender: await getUserGender(),
    signature: (await getUserSignature()) ?? '',
  }
  if (space != getActiveSpace()) return null
  return requestJson<{ profile: LX.Sync.LuxProfile }>(url, profile, token)
}

// The editor keeps its draft in memory. Never write local profile fields before PATCH succeeds.
export const saveEditedProfile = async(profile: LX.Sync.LuxProfile, server: boolean) => {
  const space = getActiveSpace()
  if (!server) {
    await applyLuxProfile(profile)
    return
  }
  const [url, token] = await Promise.all([getProfileUrl(), getToken()])
  if (!url || !token || space != getActiveSpace()) throw new Error('Profile session unavailable')
  const result = await requestJson<{ profile: LX.Sync.LuxProfile }>(url, { displayName: profile.displayName, avatar: profile.avatar, signature: profile.signature, gender: profile.gender }, token, 'PATCH')
  if (space != getActiveSpace()) throw new Error('Profile account changed')
  await applyLuxProfile(result.profile)
}
