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
  const avatar = await saveUserAvatarDataUrl(profile.avatar || null)
  await Promise.all([
    saveUserName(displayName || null),
    saveUserSignature(signature || null),
    saveUserGender(profile.gender || 'unknown'),
  ])
  global.app_event.userNameUpdated(displayName)
  global.app_event.userSignatureUpdated(signature)
  global.app_event.userGenderUpdated(profile.gender || 'unknown')
  global.app_event.userAvatarUpdated(avatar)
}

export const pullLuxProfileFromServer = async(host?: string) => {
  const [url, token] = await Promise.all([getProfileUrl(host), getToken(host)])
  if (!url || !token) return null
  const { profile } = await requestJson<{ profile: LX.Sync.LuxProfile }>(url, null, token)
  await applyLuxProfile(profile)
  return profile
}

export const syncLuxProfileOnLogin = async(host?: string) => {
  const [url, token] = await Promise.all([getProfileUrl(host), getToken(host)])
  if (!url || !token) return null
  const { profile } = await requestJson<{ profile: LX.Sync.LuxProfile }>(url, null, token)
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
  return requestJson<{ profile: LX.Sync.LuxProfile }>(url, localProfile, token).then(({ profile }) => profile)
}

export const pushLuxProfileToServer = async(profilePatch?: ProfilePatch) => {
  if (await getSyncMode() != 'lux') return null
  const [url, token] = await Promise.all([getProfileUrl(), getToken()])
  if (!url || !token) return null
  const profile: ProfilePatch = profilePatch ?? {
    displayName: (await getUserName()) ?? '',
    avatar: await getUserAvatarDataUrl(),
    gender: await getUserGender(),
    signature: (await getUserSignature()) ?? '',
  }
  return requestJson<{ profile: LX.Sync.LuxProfile }>(url, profile, token)
}
