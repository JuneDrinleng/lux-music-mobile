import { sessionGeneration, sessionWritesFrozen } from '@/utils/sessionFence'
import { parseServerInfo, versionAtLeast } from '@/utils/serverCheck'
import { request, generateRsaKey } from './utils'
import { LuxRequestError } from './userErrors'
import { createLuxAuthClient } from '@/utils/luxAuthApi'
import { getSyncAuthKey, setSyncAuthKey } from '../data'
import { getLuxAuth, listLuxAuthSessions, getLuxRefreshToken, commitLuxAuth, findLuxAuthForHost, rotateLuxAuth, clearLuxAuthForServer, recordSuccessfulLogin } from '@/utils/data'
import log from '../log'
import { luxCredentialRef, syncCredentialRef } from '@/utils/loginCredentialRepository'
import { luxSpaceId } from '@/utils/dataSpace'
import type { ActiveSession } from '@/utils/loginSession'
import type { SessionCandidate } from '@/core/appSession/coordinator'
import { aesDecrypt, aesEncrypt, rsaDecrypt } from '../utils'
import { getDeviceName } from '@/utils/nativeModules/utils'
import { toMD5 } from '@/utils/tools'
import { SYNC_CODE } from '../constants'
import { getSyncDeviceId } from '../deviceId'
import { buildLuxKeyRequest, buildLxAuthMessage, credentialStorageKey, CredentialRejectedError, isKeyRejection, reuseOrRequestKey, selectLuxCredential, selectLxCredential, canReuseLuxSession } from './credentials'

// Carry only identity metadata across the legacy auth/connect boundary.
// Failed or superseded connections never publish a recent; weak keys need no cleanup journal.
const authenticatedLogins = new WeakMap<LX.Sync.KeyInfo, ActiveSession>()
export const recordAuthenticatedLogin = async(keyInfo: LX.Sync.KeyInfo): Promise<void> => {
  const session = authenticatedLogins.get(keyInfo)
  authenticatedLogins.delete(keyInfo)
  if (session) await recordSuccessfulLogin(session)
}

export const luxAuthApi = createLuxAuthClient({
  send: request,
  generation: sessionGeneration,
  getRefreshToken: getLuxRefreshToken,
  find: findLuxAuthForHost,
  rotate: rotateLuxAuth,
  clear: clearLuxAuthForServer,
  expired: (host, previous) => {
    if (sessionWritesFrozen()) return
    const generation = sessionGeneration()
    void import('./sessionExpired').then(async({ showSessionExpiredDialog }) => { if (generation === sessionGeneration()) await showSessionExpiredDialog(host, previous) })
  },
})
export const requestJson = luxAuthApi.request

const hello = async(urlInfo: LX.Sync.UrlInfo) => request(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/hello`)
  .then(({ text }) => {
    if (text == SYNC_CODE.helloMsg) return true
    if (text.startsWith('Hello~::^-^::')) {
      const verRxp = /v(\d+)/
      let result = verRxp.exec(text)?.[1]
      if (result != null) {
        const servVer = parseInt(result)
        const localVer = parseInt(verRxp.exec(SYNC_CODE.helloMsg)![1])
        if (servVer !== localVer) throw Object.assign(new Error(servVer > localVer ? SYNC_CODE.highServiceVersion : SYNC_CODE.lowServiceVersion), { serverVersion: `v${servVer}`, requiredVersion: `v${localVer}` })
      }
    }
    return false
  })
  .catch((err: any) => {
    if (err.message === SYNC_CODE.highServiceVersion || err.message === SYNC_CODE.lowServiceVersion) throw err
    log.error('[auth] hello', err.message)
    console.log(err)
    return false
  })

const getServerId = async(urlInfo: LX.Sync.UrlInfo) => request(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/id`)
  .then(({ text }) => {
    if (!text.startsWith(SYNC_CODE.idPrefix)) return ''
    return text.replace(SYNC_CODE.idPrefix, '')
  })
  .catch((err: any) => {
    log.error('[auth] getServerId', err.message)
    console.log(err)
    throw err
  })

const codeAuth = async(urlInfo: LX.Sync.UrlInfo, authCode: string) => {
  let key = toMD5(authCode).substring(0, 16)
  // const iv = Buffer.from(key.split('').reverse().join('')).toString('base64')
  key = Buffer.from(key).toString('base64')
  let { publicKey, privateKey } = await generateRsaKey()
  publicKey = publicKey.replace(/\n/g, '')
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
  const msg = aesEncrypt(buildLxAuthMessage(SYNC_CODE.authMsg, publicKey, await getDeviceName(), await getSyncDeviceId()), key)
  // Do not send header i here: old LX servers route it to key-auth, not code-auth.
  // console.log(msg, key)
  return request(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/ah`, { headers: { m: msg } }).then(async({ text, code }) => {
    // console.log(text)
    switch (text) {
      case SYNC_CODE.msgBlockedIp:
        throw new Error(SYNC_CODE.msgBlockedIp)
      case SYNC_CODE.authFailed:
        throw new Error(SYNC_CODE.authFailed)
      default:
        if (code != 200) throw new Error(SYNC_CODE.authFailed)
    }
    let msg
    try {
      msg = rsaDecrypt(Buffer.from(text, 'base64'), privateKey).toString()
    } catch (err: any) {
      log.error('[auth] codeAuth decryptMsg error', err.message)
      throw new Error(SYNC_CODE.authFailed)
    }
    // console.log(msg)
    if (!msg) return Promise.reject(new Error(SYNC_CODE.authFailed))
    return JSON.parse(msg) as LX.Sync.KeyInfo
  })
}

const keyAuth = async(urlInfo: LX.Sync.UrlInfo, keyInfo: LX.Sync.KeyInfo) => {
  const msg = aesEncrypt(SYNC_CODE.authMsg + await getDeviceName(), keyInfo.key)
  return request(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/ah`, { headers: { i: keyInfo.clientId, m: msg } }).then(async({ text, code }) => {
    if (text == SYNC_CODE.msgBlockedIp) throw new Error(SYNC_CODE.msgBlockedIp)
    if (isKeyRejection(code, text, SYNC_CODE.authFailed, SYNC_CODE.msgBlockedIp)) throw new CredentialRejectedError(SYNC_CODE.authFailed)
    if (code != 200) throw new Error(SYNC_CODE.connectServiceFailed)

    let msg
    try {
      msg = aesDecrypt(text, keyInfo.key)
    } catch (err: any) {
      log.error('[auth] keyAuth decryptMsg error', err.message)
      throw new Error(SYNC_CODE.authFailed)
    }
    if (msg != SYNC_CODE.helloMsg) return Promise.reject(new Error(SYNC_CODE.authFailed))
  })
}

const auth = async(urlInfo: LX.Sync.UrlInfo, serverId: string, authCode?: string, candidateOnly = false) => {
  const currentKey = credentialStorageKey(serverId, 'lx', '')
  const legacy = await getSyncAuthKey(serverId)
  const codeHash = authCode ? toMD5(`${await getSyncDeviceId()}\n${authCode}`) : ''
  const accountKey = codeHash ? credentialStorageKey(serverId, 'lx', codeHash) : currentKey
  const saved = selectLxCredential(await getSyncAuthKey(accountKey), legacy, codeHash)
  const keyInfo = await reuseOrRequestKey({
    saved,
    verify: async(info) => keyAuth(urlInfo, info),
    request: async() => {
      if (!authCode) throw new Error(SYNC_CODE.missingAuthCode)
      return { ...await codeAuth(urlInfo, authCode), lxAuthCodeHash: codeHash }
    },
    save: async(info) => { if (!candidateOnly) await setSyncAuthKey(accountKey, info) },
  })
  if (candidateOnly) return { keyInfo, currentKey, accountKey, serverId }
  await setSyncAuthKey(currentKey, keyInfo)
  await setSyncAuthKey(serverId, keyInfo)
  try {
    authenticatedLogins.set(keyInfo, { provider: 'lx', spaceId: 'local', server: { serverId, url: urlInfo.href }, deviceId: await getSyncDeviceId(), credentialRef: syncCredentialRef(currentKey) })
  } catch { /* Optional metadata/device-ID failure must not fail the old login. */ }
  return { keyInfo, currentKey, accountKey, serverId }
}

const getLuxSyncKey = async(urlInfo: LX.Sync.UrlInfo, token: string, clientId?: string) => {
  const body = buildLuxKeyRequest(await getSyncDeviceId(), await getDeviceName(), clientId)
  return requestJson<LX.Sync.KeyInfo>(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/sync/key`, body, token)
}

export const authenticateLuxCandidate = async(urlInfo: LX.Sync.UrlInfo, username?: string, password?: string, expected?: Extract<ActiveSession, { provider: 'lux' }>): Promise<SessionCandidate & { keyInfo: LX.Sync.KeyInfo }> => {
  const generation = sessionGeneration()
  const assertCurrent = () => { if (generation !== sessionGeneration()) throw new Error('Session changed') }
  username = username?.trim()
  console.log('lux connect: ', urlInfo.href, username)
  if (!await hello(urlInfo)) throw new Error(SYNC_CODE.connectServiceFailed)
  const serverId = await getServerId(urlInfo)
  if (!serverId) throw new Error(SYNC_CODE.getServiceIdFailed)

  if (expected && expected.server.serverId !== serverId) throw new Error('Login identity mismatch')
  let authInfo = await getLuxAuth(serverId)
  if (username && (!authInfo || authInfo.user.username !== username)) {
    authInfo = (await listLuxAuthSessions()).find(session => session.serverId === serverId && session.user.username === username) ?? null
  }
  if (username != null && !password && !canReuseLuxSession(authInfo, username)) {
    throw new Error(global.i18n.t('setting_sync_lux_login_missing_tip'))
  }
  const info = await request(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/server-info`).then(({ code, text }) => code === 200 ? parseServerInfo(JSON.parse(text)) : null).catch(() => null)
  if (info?.minClientVersion && !versionAtLeast(process.versions.app, info.minClientVersion)) {
    throw Object.assign(new Error(SYNC_CODE.highServiceVersion), { serverVersion: info.version, requiredVersion: info.minClientVersion })
  }
  if (username && password) {
    const loggedIn = await requestJson<LX.Sync.LuxAuth & { accessToken?: string }>(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/auth/login`, { username, password })
    // Prefer the session-bound access token so per-session server actions (e.g. keeping other devices on password change) work.
    const { accessToken, ...rest } = loggedIn
    authInfo = { ...rest, token: accessToken ?? loggedIn.token }
  }
  if (!authInfo?.token) throw new Error(SYNC_CODE.luxSessionExpired)
  const session = authInfo
  if (expected && session.user.id !== expected.account.userId) throw new Error('Login identity mismatch')
  // A reusable socket key does not prove that its bearer session is still valid.
  if (!password) {
    await requestJson(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/auth/me`, undefined, session.token).catch((error: unknown) => {
      if (error instanceof LuxRequestError && (error.status == 401 || (error.status == 403 && !error.code))) throw new Error(SYNC_CODE.luxSessionExpired)
      throw error
    })
  }
  const accountKey = credentialStorageKey(serverId, 'lux', session.user.id)
  const legacy = await getSyncAuthKey(serverId)
  const { saved, previousClientId: legacyClientId } = selectLuxCredential(await getSyncAuthKey(accountKey), legacy, session.user.id)
  // Old keys have no account owner. Reconcile once using the authenticated API;
  // /ah alone cannot prove that an old key belongs to the newly logged-in user.
  const keyInfo = await reuseOrRequestKey({
    saved,
    verify: async(info) => keyAuth(urlInfo, info),
    request: async(previousClientId) => ({
      ...await getLuxSyncKey(urlInfo, session.token, previousClientId ?? legacyClientId),
      luxUserId: session.user.id,
    }),
    save: async() => {},
  }).catch((error: unknown) => {
    if (error instanceof LuxRequestError && error.status == 401) throw new Error(SYNC_CODE.luxSessionExpired)
    throw error
  })
  const latestSession = !password ? await getLuxAuth(serverId) : null
  const committedSession = latestSession?.user.id === session.user.id ? latestSession : session
  if (keyInfo.luxUserId !== session.user.id || committedSession.user.id !== session.user.id) throw new Error('Login identity mismatch')
  const identity: ActiveSession = {
    provider: 'lux',
    spaceId: luxSpaceId(serverId, session.user.id) as `lux:${string}:${string}`,
    server: { serverId, url: urlInfo.href },
    account: { userId: session.user.id, username: session.user.username, displayName: session.user.displayName },
    credentialRef: luxCredentialRef(serverId, session.user.id),
  }
  return {
    keyInfo,
    identity,
    prepare: async() => {
      assertCurrent()
      await setSyncAuthKey(accountKey, keyInfo)
      await setSyncAuthKey(serverId, keyInfo)
      assertCurrent()
      await commitLuxAuth({ ...committedSession, serverId, serverUrl: urlInfo.href })
      assertCurrent()
      const { offerLocalImport } = await import('@/utils/accountDataDialogs')
      const importedProfile = await offerLocalImport({ ...committedSession, serverId, serverUrl: urlInfo.href }, requestJson)
      if (importedProfile) {
        const { pushLuxProfileToServer } = await import('./profile')
        await pushLuxProfileToServer()
      }
    },
    activate: async() => {},
  }
}

export default async(urlInfo: LX.Sync.UrlInfo, authCode?: string) => {
  console.log('connect: ', urlInfo.href)
  console.log(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/hello`)
  if (!await hello(urlInfo)) throw new Error(SYNC_CODE.connectServiceFailed)
  const serverId = await getServerId(urlInfo)
  if (!serverId) throw new Error(SYNC_CODE.getServiceIdFailed)
  return (await auth(urlInfo, serverId, authCode)).keyInfo
}

export const authLux = async(urlInfo: LX.Sync.UrlInfo, username?: string, password?: string) => {
  const generation = sessionGeneration()
  const candidate = await authenticateLuxCandidate(urlInfo, username, password)
  if (sessionWritesFrozen() || generation !== sessionGeneration()) throw new Error('Session changed')
  await candidate.prepare()
  authenticatedLogins.set(candidate.keyInfo, candidate.identity)
  return candidate.keyInfo
}

export const authenticateLxCandidate = async(urlInfo: LX.Sync.UrlInfo, authCode?: string): Promise<SessionCandidate & { keyInfo: LX.Sync.KeyInfo }> => {
  const generation = sessionGeneration()
  const assertCurrent = () => { if (generation !== sessionGeneration()) throw new Error('Session changed') }
  if (!await hello(urlInfo)) throw new Error(SYNC_CODE.connectServiceFailed)
  const serverId = await getServerId(urlInfo)
  if (!serverId) throw new Error(SYNC_CODE.getServiceIdFailed)
  const { keyInfo, currentKey, accountKey } = await auth(urlInfo, serverId, authCode, true)
  return {
    keyInfo,
    identity: { provider: 'lx', spaceId: 'local', server: { serverId, url: urlInfo.href }, deviceId: await getSyncDeviceId(), credentialRef: syncCredentialRef(currentKey) },
    prepare: async() => {
      assertCurrent()
      await setSyncAuthKey(accountKey, keyInfo)
      await setSyncAuthKey(currentKey, keyInfo)
      await setSyncAuthKey(serverId, keyInfo)
    },
    activate: async() => {},
  }
}
