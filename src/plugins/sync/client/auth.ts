import { request, generateRsaKey } from './utils'
import { getSyncAuthKey, setSyncAuthKey } from '../data'
import { getLuxAuth, setLuxAuth } from '@/utils/data'
import log from '../log'
import { aesDecrypt, aesEncrypt, rsaDecrypt } from '../utils'
import { getDeviceName } from '@/utils/nativeModules/utils'
import { toMD5 } from '@/utils/tools'
import { SYNC_CODE } from '../constants'
import { getSyncDeviceId } from '../deviceId'
import { buildLuxKeyRequest, buildLxAuthMessage, credentialStorageKey, CredentialRejectedError, isKeyRejection, reuseOrRequestKey, selectLuxCredential, selectLxCredential } from './credentials'

export const requestJson = async<T>(url: string, body?: unknown, token?: string): Promise<T> => {
  const { text, code } = await request(url, {
    method: body == null ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const data = text ? JSON.parse(text) as { message?: unknown } : null
  if (code < 200 || code >= 300) throw new Error(typeof data?.message == 'string' ? data.message : 'Request failed')
  return data as T
}

const hello = async(urlInfo: LX.Sync.UrlInfo) => request(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/hello`)
  .then(({ text }) => {
    if (text == SYNC_CODE.helloMsg) return true
    if (text.startsWith('Hello~::^-^::')) {
      const verRxp = /v(\d+)/
      let result = verRxp.exec(text)?.[1]
      if (result != null) {
        const servVer = parseInt(result)
        const localVer = parseInt(verRxp.exec(SYNC_CODE.helloMsg)![1])
        if (servVer > localVer) throw new Error(SYNC_CODE.highServiceVersion)
        else if (servVer < localVer) throw new Error(SYNC_CODE.lowServiceVersion)
      }
    }
    return false
  })
  .catch((err: any) => {
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

const auth = async(urlInfo: LX.Sync.UrlInfo, serverId: string, authCode?: string) => {
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
    save: async(info) => setSyncAuthKey(accountKey, info),
  })
  await setSyncAuthKey(currentKey, keyInfo)
  await setSyncAuthKey(serverId, keyInfo)
  return keyInfo
}

const getLuxSyncKey = async(urlInfo: LX.Sync.UrlInfo, token: string, clientId?: string) => {
  const body = buildLuxKeyRequest(await getSyncDeviceId(), await getDeviceName(), clientId)
  return requestJson<LX.Sync.KeyInfo>(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/sync/key`, body, token)
}

export const authLux = async(urlInfo: LX.Sync.UrlInfo, username?: string, password?: string) => {
  console.log('lux connect: ', urlInfo.href, username)
  if (!await hello(urlInfo)) throw new Error(SYNC_CODE.connectServiceFailed)
  const serverId = await getServerId(urlInfo)
  if (!serverId) throw new Error(SYNC_CODE.getServiceIdFailed)

  let authInfo = await getLuxAuth(serverId)
  if (username && password) {
    authInfo = await requestJson<LX.Sync.LuxAuth>(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/api/auth/login`, { username, password })
  }
  if (!authInfo?.token) throw new Error(SYNC_CODE.missingAuthCode)
  const session = authInfo
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
    save: async(info) => setSyncAuthKey(accountKey, info),
  })
  await setSyncAuthKey(serverId, keyInfo)
  // Commit login state after obtaining the matching key, so a failed account
  // switch cannot leave a new session paired with the previous account's key.
  await setLuxAuth({ ...session, serverId, serverUrl: urlInfo.href })
  return keyInfo
}

export default async(urlInfo: LX.Sync.UrlInfo, authCode?: string) => {
  console.log('connect: ', urlInfo.href)
  console.log(`${urlInfo.httpProtocol}//${urlInfo.hostPath}/hello`)
  if (!await hello(urlInfo)) throw new Error(SYNC_CODE.connectServiceFailed)
  const serverId = await getServerId(urlInfo)
  if (!serverId) throw new Error(SYNC_CODE.getServiceIdFailed)
  return auth(urlInfo, serverId, authCode)
}
