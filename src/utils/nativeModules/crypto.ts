/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { NativeModules } from 'react-native'

const { CryptoModule } = NativeModules

const utf8ToBytes = (text: string) => {
  return Array.from(unescape(encodeURIComponent(text))).map(char => char.charCodeAt(0))
}

const rotateLeft = (value: number, bits: number) => {
  return (value << bits) | (value >>> (32 - bits))
}

const sha1Fallback = (text: string) => {
  const bytes = utf8ToBytes(text)
  const bitLength = bytes.length * 8
  bytes.push(0x80)

  while ((bytes.length % 64) !== 56) bytes.push(0)

  for (let i = 7; i >= 0; i--) bytes.push((bitLength >>> (i * 8)) & 0xff)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0
  const words = new Array<number>(80)

  for (let blockStart = 0; blockStart < bytes.length; blockStart += 64) {
    for (let i = 0; i < 16; i++) {
      const offset = blockStart + i * 4
      words[i] = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    }

    for (let i = 16; i < 80; i++) {
      words[i] = rotateLeft(words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16], 1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const temp = (rotateLeft(a, 5) + f + e + k + words[i]) >>> 0
      e = d
      d = c
      c = rotateLeft(b, 30) >>> 0
      b = a
      a = temp
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  return [h0, h1, h2, h3, h4].map(value => value.toString(16).padStart(8, '0')).join('')
}

// export const testRsa = (text: string, key: string) => {
//   // console.log(sourceFilePath, targetFilePath)
//   return CryptoModule.testRsa()
// }

enum KEY_PREFIX {
  publicKeyStart = '-----BEGIN PUBLIC KEY-----',
  publicKeyEnd = '-----END PUBLIC KEY-----',
  privateKeyStart = '-----BEGIN PRIVATE KEY-----',
  privateKeyEnd = '-----END PRIVATE KEY-----',
}

export enum RSA_PADDING {
  OAEPWithSHA1AndMGF1Padding = 'RSA/ECB/OAEPWithSHA1AndMGF1Padding',
  NoPadding = 'RSA/ECB/NoPadding',
}

export enum AES_MODE {
  CBC_128_PKCS7Padding = 'AES/CBC/PKCS7Padding',
  ECB_128_NoPadding = 'AES',
}

export const generateRsaKey = async() => {
  // console.log(sourceFilePath, targetFilePath)
  const key = await CryptoModule.generateRsaKey() as { publicKey: string, privateKey: string }
  return {
    publicKey: `${KEY_PREFIX.publicKeyStart}\n${key.publicKey}${KEY_PREFIX.publicKeyEnd}`,
    privateKey: `${KEY_PREFIX.privateKeyStart}\n${key.privateKey}${KEY_PREFIX.privateKeyEnd}`,
  }
}

export const rsaEncrypt = async(text: string, key: string, padding: RSA_PADDING): Promise<string> => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.rsaEncrypt(text, key
    .replace(KEY_PREFIX.publicKeyStart, '')
    .replace(KEY_PREFIX.publicKeyEnd, ''),
  padding)
}

export const rsaDecrypt = async(text: string, key: string, padding: RSA_PADDING): Promise<string> => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.rsaDecrypt(text, key
    .replace(KEY_PREFIX.privateKeyStart, '')
    .replace(KEY_PREFIX.privateKeyEnd, ''),
  padding)
}

export const rsaEncryptSync = (text: string, key: string, padding: RSA_PADDING): string => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.rsaEncryptSync(text, key
    .replace(KEY_PREFIX.publicKeyStart, '')
    .replace(KEY_PREFIX.publicKeyEnd, ''),
  padding)
}

export const rsaDecryptSync = (text: string, key: string, padding: RSA_PADDING): string => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.rsaDecryptSync(text, key
    .replace(KEY_PREFIX.privateKeyStart, '')
    .replace(KEY_PREFIX.privateKeyEnd, ''),
  padding)
}


export const aesEncrypt = async(text: string, key: string, vi: string, mode: AES_MODE): Promise<string> => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.aesEncrypt(text, key, vi, mode)
}

export const aesDecrypt = async(text: string, key: string, vi: string, mode: AES_MODE): Promise<string> => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.aesDecrypt(text, key, vi, mode)
}

export const aesEncryptSync = (text: string, key: string, vi: string, mode: AES_MODE): string => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.aesEncryptSync(text, key, vi, mode)
}

export const aesDecryptSync = (text: string, key: string, vi: string, mode: AES_MODE): string => {
  // console.log(sourceFilePath, targetFilePath)
  return CryptoModule.aesDecryptSync(text, key, vi, mode)
}

export const hashSHA1 = async(text: string): Promise<string> => {
  try {
    if (typeof CryptoModule?.sha1 != 'function') return sha1Fallback(text)
    return await CryptoModule.sha1(text)
  } catch (error) {
    console.error('生成SHA1出现问题:', error)
    return sha1Fallback(text)
  }
}
