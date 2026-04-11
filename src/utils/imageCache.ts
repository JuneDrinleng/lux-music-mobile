/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { stringMd5 } from 'react-native-quick-md5'
import { downloadFile, existsFile, mkdir, moveFile, temporaryDirectoryPath, unlink } from '@/utils/fs'

const COVER_CACHE_DIR = `${temporaryDirectoryPath}/image-cache`
const inflightTaskMap = new Map<string, Promise<string | null>>()
const runtimeCacheMap = new Map<string, string>()
let initPromise: Promise<void> | null = null

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url)

const ensureCacheDir = async() => {
  if (initPromise) return initPromise
  initPromise = mkdir(COVER_CACHE_DIR).catch(() => {})
  return initPromise
}

const toCacheFilePath = (url: string) => `${COVER_CACHE_DIR}/${stringMd5(url)}`
const toFileUri = (path: string) => path.startsWith('file://') ? path : `file://${path}`

export const peekCachedImageUri = (uri: string): string | null => {
  return runtimeCacheMap.get(uri) ?? null
}

const downloadCoverToPath = async(url: string, filePath: string) => {
  const tempPath = `${filePath}.tmp`
  try {
    await unlink(tempPath).catch(() => {})
    const { promise } = downloadFile(url, tempPath, {
      background: false,
      cacheable: true,
      connectionTimeout: 15000,
      readTimeout: 20000,
    })
    const result = await promise
    if (result.statusCode != 200) {
      await unlink(tempPath).catch(() => {})
      return null
    }
    await unlink(filePath).catch(() => {})
    await moveFile(tempPath, filePath)
    return filePath
  } catch {
    await unlink(tempPath).catch(() => {})
    return null
  }
}

export const getCachedImageUri = async(uri: string): Promise<string | null> => {
  if (!isHttpUrl(uri)) return null
  const runtimeUri = runtimeCacheMap.get(uri)
  if (runtimeUri) return runtimeUri
  await ensureCacheDir()
  const filePath = toCacheFilePath(uri)
  if (!await existsFile(filePath)) return null
  const cachedUri = toFileUri(filePath)
  runtimeCacheMap.set(uri, cachedUri)
  return cachedUri
}

export const cacheImageUri = async(uri: string): Promise<string | null> => {
  if (!isHttpUrl(uri)) return null
  const runtimeUri = runtimeCacheMap.get(uri)
  if (runtimeUri) return runtimeUri
  await ensureCacheDir()
  const filePath = toCacheFilePath(uri)
  if (await existsFile(filePath)) {
    const cachedUri = toFileUri(filePath)
    runtimeCacheMap.set(uri, cachedUri)
    return cachedUri
  }

  const inflight = inflightTaskMap.get(uri)
  if (inflight) {
    const pendingPath = await inflight
    return pendingPath ? toFileUri(pendingPath) : null
  }
  const task = downloadCoverToPath(uri, filePath)
  inflightTaskMap.set(uri, task)
  const cachedPath = await task.finally(() => {
    inflightTaskMap.delete(uri)
  })
  if (!cachedPath) return null
  const cachedUri = toFileUri(cachedPath)
  runtimeCacheMap.set(uri, cachedUri)
  return cachedUri
}

export const resolveImageUri = async(uri: string, enableLocalCache = true): Promise<string> => {
  if (!enableLocalCache || !isHttpUrl(uri)) return uri
  return (await cacheImageUri(uri)) ?? uri
}
