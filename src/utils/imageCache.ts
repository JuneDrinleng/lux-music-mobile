/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { stringMd5 } from 'react-native-quick-md5'
import { downloadFile, existsFile, mkdir, moveFile, readDir, stat, temporaryDirectoryPath, touchFile, unlink } from '@/utils/fs'
import {
  DEFAULT_UNPINNED_IMAGE_CACHE_BYTES,
  selectUnpinnedEvictions,
  UNPINNED_IMAGE_CACHE_LIMIT,
  type ImageCacheEntry,
} from '@/utils/imageCachePolicy'

const COVER_CACHE_DIR = `${temporaryDirectoryPath}/image-cache`
const inflightTaskMap = new Map<string, Promise<string | null>>()
const runtimeCacheMap = new Map<string, string>()
const cachedFileNames = new Set<string>()
const pinnedFileNames = new Set<string>()
const fileStat = new Map<string, { size: number, accessedAt: number }>()
const accessNotedAt = new Map<string, number>()
let cacheDirReady: Promise<void> | null = null
let indexReady = false
let indexPromise: Promise<void> | null = null
let activeMaxCount = UNPINNED_IMAGE_CACHE_LIMIT
let activeMaxBytes = DEFAULT_UNPINNED_IMAGE_CACHE_BYTES
let trimTimer: ReturnType<typeof setTimeout> | null = null

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url)

const cacheFileName = (url: string) => stringMd5(url)

const entryName = (entry: unknown): string => {
  if (typeof entry == 'string') {
    const slash = Math.max(entry.lastIndexOf('/'), entry.lastIndexOf('\\'))
    return slash >= 0 ? entry.slice(slash + 1) : entry
  }
  if (entry && typeof entry == 'object') {
    const record = entry as { name?: unknown, path?: unknown, uri?: unknown }
    if (typeof record.name == 'string' && record.name) return record.name
    if (typeof record.path == 'string') return entryName(record.path)
    if (typeof record.uri == 'string') return entryName(record.uri)
  }
  return ''
}

const ensureCacheDir = async() => {
  const pending = cacheDirReady
  if (pending) {
    try {
      await pending
      return
    } catch {
      if (cacheDirReady == pending) cacheDirReady = null
    }
  }
  const created = mkdir(COVER_CACHE_DIR).then(() => undefined)
  cacheDirReady = created
  try {
    await created
  } catch {
    if (cacheDirReady == created) cacheDirReady = null
  }
}

const toCacheFilePath = (url: string) => `${COVER_CACHE_DIR}/${cacheFileName(url)}`
const toFileUri = (path: string) => path.startsWith('file://') ? path : `file://${path}`

const rememberCachedFile = (url: string, fileUri: string) => {
  runtimeCacheMap.set(url, fileUri)
  const name = cacheFileName(url)
  cachedFileNames.add(name)
  noteImageAccess(name, fileUri.replace(/^file:\/\//, ''))
}

const readEntryMeta = (entry: unknown): { name: string, size: number, accessedAt: number } | null => {
  const name = entryName(entry)
  if (!name || name.endsWith('.tmp')) return null
  let size = 0
  let accessedAt = 0
  if (entry && typeof entry == 'object') {
    const record = entry as { size?: unknown, lastModified?: unknown, mtime?: unknown }
    if (typeof record.size == 'number' && Number.isFinite(record.size)) size = record.size
    const raw = record.lastModified ?? record.mtime
    if (typeof raw == 'number' && Number.isFinite(raw)) accessedAt = raw
    else if (raw instanceof Date) accessedAt = raw.getTime()
    else if (typeof raw == 'string') {
      const parsed = Date.parse(raw)
      if (!Number.isNaN(parsed)) accessedAt = parsed
    }
  }
  return { name, size, accessedAt }
}

const noteImageAccess = (name: string, path: string) => {
  const now = Date.now()
  const meta = fileStat.get(name) ?? { size: 0, accessedAt: 0 }
  meta.accessedAt = now
  fileStat.set(name, meta)
  const last = accessNotedAt.get(name) ?? 0
  if (now - last < 60_000) return
  accessNotedAt.set(name, now)
  void touchFile(path, new Date(now)).catch(() => {})
}

const scanImageCacheIndex = async() => {
  await ensureCacheDir()
  let entries: unknown[] = []
  try {
    const listed = await readDir(COVER_CACHE_DIR)
    entries = Array.isArray(listed) ? listed : []
  } catch {
    entries = []
  }
  cachedFileNames.clear()
  fileStat.clear()
  for (const entry of entries) {
    const meta = readEntryMeta(entry)
    if (!meta) continue
    cachedFileNames.add(meta.name)
    const boosted = accessNotedAt.get(meta.name) ?? 0
    fileStat.set(meta.name, {
      size: meta.size,
      accessedAt: Math.max(meta.accessedAt, boosted),
    })
  }
  indexReady = true
}

/** Read image-cache filenames once so peekCachedImageUri can answer synchronously. */
export const primeImageCacheIndex = async() => {
  if (indexReady) return
  if (!indexPromise) {
    const pending = scanImageCacheIndex().finally(() => {
      if (indexPromise == pending) indexPromise = null
    })
    indexPromise = pending
  }
  await indexPromise
}

export const peekCachedImageUri = (uri: string): string | null => {
  if (!uri) return null
  const runtimeUri = runtimeCacheMap.get(uri)
  if (runtimeUri) return runtimeUri
  if (!isHttpUrl(uri) || !indexReady) return null
  const fileName = cacheFileName(uri)
  if (!cachedFileNames.has(fileName)) return null
  const cachedUri = toFileUri(toCacheFilePath(uri))
  rememberCachedFile(uri, cachedUri)
  return cachedUri
}

export const pinImageUrl = (uri: string) => {
  if (!isHttpUrl(uri)) return
  pinnedFileNames.add(cacheFileName(uri))
}

export const unpinImageUrl = (uri: string) => {
  if (!isHttpUrl(uri)) return
  pinnedFileNames.delete(cacheFileName(uri))
}

export const forgetCachedImageUri = (uri: string) => {
  if (!uri) return
  runtimeCacheMap.delete(uri)
  if (!isHttpUrl(uri)) return
  const fileName = cacheFileName(uri)
  cachedFileNames.delete(fileName)
  pinnedFileNames.delete(fileName)
  fileStat.delete(fileName)
  accessNotedAt.delete(fileName)
  void unlink(toCacheFilePath(uri)).catch(() => {})
}

/** Count and byte caps for images that are not playlist covers. */
export const setImageCacheLimits = (maxCount: number, maxBytes = DEFAULT_UNPINNED_IMAGE_CACHE_BYTES) => {
  const count = Number.isFinite(maxCount) ? Math.max(0, Math.floor(maxCount)) : UNPINNED_IMAGE_CACHE_LIMIT
  activeMaxCount = count
  activeMaxBytes = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_UNPINNED_IMAGE_CACHE_BYTES
}

/** Drop in-memory pointers and recreate the directory after the native cache wipe. */
export const resetImageCache = async() => {
  runtimeCacheMap.clear()
  cachedFileNames.clear()
  pinnedFileNames.clear()
  fileStat.clear()
  accessNotedAt.clear()
  inflightTaskMap.clear()
  cacheDirReady = null
  indexReady = false
  const previousIndex = indexPromise
  indexPromise = null
  if (previousIndex) await previousIndex.catch(() => {})
  indexReady = false
  cachedFileNames.clear()
  pinnedFileNames.clear()
  runtimeCacheMap.clear()
  await ensureCacheDir()
  await primeImageCacheIndex()
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

const downloadIntoCache = async(uri: string, filePath: string, allowRetry: boolean): Promise<string | null> => {
  await ensureCacheDir()
  const cachedPath = await downloadCoverToPath(uri, filePath)
  if (cachedPath != null) return cachedPath
  if (!allowRetry) return null
  cacheDirReady = null
  return downloadIntoCache(uri, filePath, false)
}

export const getCachedImageUri = async(uri: string): Promise<string | null> => {
  if (!isHttpUrl(uri)) return null
  const peeked = peekCachedImageUri(uri)
  if (peeked) return peeked
  await ensureCacheDir()
  const filePath = toCacheFilePath(uri)
  if (!await existsFile(filePath)) return null
  const cachedUri = toFileUri(filePath)
  rememberCachedFile(uri, cachedUri)
  return cachedUri
}

export const cacheImageUri = async(uri: string, options?: { pin?: boolean }): Promise<string | null> => {
  if (!isHttpUrl(uri)) return null
  if (options?.pin) pinImageUrl(uri)
  const peeked = peekCachedImageUri(uri)
  if (peeked) return peeked
  await ensureCacheDir()
  const filePath = toCacheFilePath(uri)
  if (await existsFile(filePath)) {
    const cachedUri = toFileUri(filePath)
    rememberCachedFile(uri, cachedUri)
    return cachedUri
  }

  const inflight = inflightTaskMap.get(uri)
  if (inflight) {
    const pendingPath = await inflight
    return pendingPath ? toFileUri(pendingPath) : null
  }
  const task = downloadIntoCache(uri, filePath, true)
  inflightTaskMap.set(uri, task)
  const cachedPath = await task.finally(() => {
    inflightTaskMap.delete(uri)
  })
  if (!cachedPath) return null
  const cachedUri = toFileUri(cachedPath)
  rememberCachedFile(uri, cachedUri)
  const name = cacheFileName(uri)
  if (!fileStat.has(name) || fileStat.get(name)?.size == 0) {
    const info = await stat(cachedPath).catch(() => null) as { size?: number } | null
    const size = info && typeof info.size == 'number' ? info.size : 0
    fileStat.set(name, { size, accessedAt: Date.now() })
  }
  scheduleImageCacheTrim()
  return cachedUri
}

/** Drop ordinary cached images past the count and byte caps. Pinned playlist thumbs are kept. */
export const trimUnpinnedImageCache = async(
  maxUnpinned = activeMaxCount,
  maxBytes = activeMaxBytes,
) => {
  await primeImageCacheIndex()
  const entries: ImageCacheEntry[] = []
  for (const name of cachedFileNames) {
    const meta = fileStat.get(name)
    entries.push({
      name,
      size: meta?.size ?? 0,
      accessedAt: meta?.accessedAt ?? 0,
    })
  }
  const extras = selectUnpinnedEvictions(entries, pinnedFileNames, maxUnpinned, maxBytes)
  for (const name of extras) {
    cachedFileNames.delete(name)
    fileStat.delete(name)
    accessNotedAt.delete(name)
    for (const [url, fileUri] of runtimeCacheMap) {
      if (fileUri.endsWith(`/${name}`)) runtimeCacheMap.delete(url)
    }
    await unlink(`${COVER_CACHE_DIR}/${name}`).catch(() => {})
  }
}

export const scheduleImageCacheTrim = () => {
  if (trimTimer) return
  trimTimer = setTimeout(() => {
    trimTimer = null
    void trimUnpinnedImageCache().catch(() => {})
  }, 800)
}

export const getImageCacheSize = async() => {
  await primeImageCacheIndex()
  let total = 0
  let missing = 0
  for (const name of cachedFileNames) {
    const size = fileStat.get(name)?.size ?? 0
    if (size > 0) total += size
    else missing += 1
  }
  if (missing == 0) return total
  for (const name of cachedFileNames) {
    if ((fileStat.get(name)?.size ?? 0) > 0) continue
    const info = await stat(`${COVER_CACHE_DIR}/${name}`).catch(() => null) as { size?: number } | null
    const size = info && typeof info.size == 'number' ? info.size : 0
    const accessedAt = fileStat.get(name)?.accessedAt ?? 0
    fileStat.set(name, { size, accessedAt })
    total += size
  }
  return total
}

/** Delete image-cache files only. Callers re-pin playlist covers afterward. */
export const clearImageCacheFiles = async() => {
  await primeImageCacheIndex()
  const names = [...cachedFileNames]
  for (const name of names) {
    await unlink(`${COVER_CACHE_DIR}/${name}`).catch(() => {})
  }
  await resetImageCache()
}

export const resolveImageUri = async(uri: string, enableLocalCache = true): Promise<string> => {
  if (!enableLocalCache || !isHttpUrl(uri)) return uri
  return (await cacheImageUri(uri)) ?? uri
}
