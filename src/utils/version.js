import { httpFetch, httpGet } from '@/utils/request'
import { appendFile, downloadFile, existsFile, privateStorageDirectoryPath, stopDownload, temporaryDirectoryPath, unlink, writeFile } from '@/utils/fs'
import { getBuildInfo, getSupportedAbis, installApk } from '@/utils/nativeModules/utils'

const updateRepo = {
  owner: 'JuneDrinleng',
  name: 'lux-music-mobile',
}
const defaultBuildInfo = {
  applicationId: 'cn.lux.music.mobile',
  providerAuthority: 'cn.lux.music.mobile.provider',
  releaseAssetPrefix: 'lux-music-mobile',
  updateChannel: 'standard',
}

const abis = [
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86',
  'universal',
]
const defaultAbi = 'universal'
const downloadConnectionTimeout = 60000
const downloadReadTimeout = 600000
const chunkSize = 1024 * 1024
const chunkRetryCount = 4
const chunkRetryDelayMs = 1200

const address = [
  [`https://raw.githubusercontent.com/${updateRepo.owner}/${updateRepo.name}/master/publish/version.json`, 'direct'],
  [`https://raw.githubusercontent.com/${updateRepo.owner}/${updateRepo.name}/main/publish/version.json`, 'direct'],
  [`https://cdn.jsdelivr.net/gh/${updateRepo.owner}/${updateRepo.name}/publish/version.json`, 'direct'],
  [`https://fastly.jsdelivr.net/gh/${updateRepo.owner}/${updateRepo.name}/publish/version.json`, 'direct'],
  [`https://gcore.jsdelivr.net/gh/${updateRepo.owner}/${updateRepo.name}/publish/version.json`, 'direct'],
]


const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 3
          ? reject(err || new Error(resp.statusMessage || resp.statusCode))
          : request(url, retryNum).then(resolve).catch(reject)
      } else resolve(body)
    })
  })
}

const getDirectInfo = async(url) => {
  return request(url).then(info => {
    if (info.version == null) throw new Error('failed')
    return info
  })
}

const getNpmPkgInfo = async(url) => {
  return request(url).then(json => {
    if (!json.versionInfo) throw new Error('failed')
    const info = JSON.parse(json.versionInfo)
    if (info.version == null) throw new Error('failed')
    return info
  })
}

export const getVersionInfo = async(index = 0) => {
  const [url, source] = address[index]
  let promise
  switch (source) {
    case 'direct':
      promise = getDirectInfo(url)
      break
    case 'npm':
      promise = getNpmPkgInfo(url)
      break
  }

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

const getTargetAbis = async() => {
  const supportedAbis = await getSupportedAbis().catch(() => [])
  const targetAbis = []

  for (const abi of abis) {
    if (abi == defaultAbi) continue
    if (supportedAbis.includes(abi)) targetAbis.push(abi)
  }

  if (!targetAbis.length || !targetAbis.includes(defaultAbi)) targetAbis.push(defaultAbi)

  return targetAbis
}
let downloadJobId = null
const noop = (total, download) => {}
let apkSavePath
export const isVersionDownloadActive = () => downloadJobId != null
let cachedBuildInfo = null
let buildInfoPromise = null

const getUpdateApkFileName = buildInfo => {
  return buildInfo.updateChannel == 'vivo'
    ? 'lux-music-mobile-vivo-update.apk'
    : 'lux-music-mobile-update.apk'
}

const getSavePaths = buildInfo => {
  const apkFileName = getUpdateApkFileName(buildInfo)
  return [
    `${privateStorageDirectoryPath}/${apkFileName}`,
    `${temporaryDirectoryPath}/${apkFileName}`,
  ]
}

const ensureBuildInfo = async() => {
  if (cachedBuildInfo) return cachedBuildInfo
  if (!buildInfoPromise) {
    buildInfoPromise = getBuildInfo()
      .then(info => ({
        ...defaultBuildInfo,
        ...info,
      }))
      .catch(() => defaultBuildInfo)
      .then(info => {
        cachedBuildInfo = info
        return info
      })
  }

  return buildInfoPromise
}

const ensureCleanSavePath = async(savePath) => {
  try {
    if (await existsFile(savePath)) await unlink(savePath)
  } catch {}
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const getErrorMessage = (err) => {
  if (!err) return ''
  if (typeof err == 'string') return err
  if (err.message != null) return String(err.message)
  return String(err)
}

const getHeaderValue = (headers, key) => {
  if (!headers) return ''
  const value = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()]
  if (value == null) return ''
  if (Array.isArray(value)) return String(value[0] ?? '')
  return String(value)
}

const parseTotalFromContentRange = (contentRange) => {
  if (!contentRange) return 0
  const match = /bytes\s+\d+-\d+\/(\d+|\*)/i.exec(contentRange)
  if (!match || match[1] == '*') return 0
  return Number(match[1]) || 0
}

const requestChunk = async(url, start, end) => {
  const { promise } = httpFetch(url, {
    method: 'get',
    timeout: downloadReadTimeout,
    binary: true,
    headers: {
      Range: `bytes=${start}-${end}`,
      Accept: 'application/octet-stream',
    },
  })
  return promise
}

const downloadByChunks = async(url, savePath, onDownload) => {
  await writeFile(savePath, '', 'utf8')

  let downloaded = 0
  let total = 0
  let rangeSupported = true

  while (true) {
    let chunkResp = null
    let chunkError = null
    const end = downloaded + chunkSize - 1

    for (let i = 0; i < chunkRetryCount; i++) {
      try {
        chunkResp = await requestChunk(url, downloaded, end)
        chunkError = null
        break
      } catch (err) {
        chunkError = err
        if (i < chunkRetryCount - 1) await sleep(chunkRetryDelayMs)
      }
    }

    if (chunkError) throw chunkError
    if (!chunkResp || !chunkResp.body) throw new Error('empty chunk response')

    const statusCode = chunkResp.statusCode
    const contentRange = getHeaderValue(chunkResp.headers, 'content-range')
    const contentLength = Number(getHeaderValue(chunkResp.headers, 'content-length')) || 0
    const chunkBuffer = chunkResp.body
    const chunkLength = chunkBuffer.length || contentLength

    if (statusCode == 206) {
      if (!total) total = parseTotalFromContentRange(contentRange)
    } else if (statusCode == 200) {
      if (downloaded > 0) throw new Error('unexpected 200 after partial download')
      rangeSupported = false
      total = contentLength || chunkLength
    } else {
      throw new Error(`unexpected statusCode: ${statusCode}`)
    }

    if (!chunkLength) throw new Error('received empty chunk')
    const chunkBase64 = chunkBuffer.toString('base64')
    if (downloaded == 0) {
      await writeFile(savePath, chunkBase64, 'base64')
    } else {
      await appendFile(savePath, chunkBase64, 'base64')
    }

    downloaded += chunkLength
    onDownload(total || downloaded, downloaded)

    if (!rangeSupported) break
    if (total > 0 && downloaded >= total) break
  }
}

const downloadFromUrl = async(url, savePath, onDownload) => {
  let beginStatusCode = 0
  let beginContentLength = 0

  const { jobId, promise } = downloadFile(url, savePath, {
    progressInterval: 500,
    connectionTimeout: downloadConnectionTimeout,
    readTimeout: downloadReadTimeout,
    begin({ statusCode, contentLength }) {
      beginStatusCode = statusCode
      beginContentLength = contentLength || 0
      onDownload(contentLength, 0)
    },
    progress({ contentLength, bytesWritten }) {
      onDownload(contentLength, bytesWritten)
    },
  })

  downloadJobId = jobId

  return promise.then(({ statusCode, bytesWritten }) => {
    const targetStatusCode = statusCode || beginStatusCode
    if (targetStatusCode < 200 || targetStatusCode >= 300) {
      throw new Error(`unexpected statusCode: ${targetStatusCode}`)
    }
    if (beginContentLength > 0 && bytesWritten < beginContentLength) {
      throw new Error(`incomplete download: ${bytesWritten}/${beginContentLength}`)
    }
    return bytesWritten
  }).catch(async(err) => {
    if (downloadJobId == jobId) downloadJobId = null
    const directError = getErrorMessage(err)
    await ensureCleanSavePath(savePath)
    try {
      await downloadByChunks(url, savePath, onDownload)
    } catch (chunkErr) {
      const chunkError = getErrorMessage(chunkErr)
      throw new Error(`direct=${directError}; chunk=${chunkError}`)
    }
    return 0
  }).finally(() => {
    if (downloadJobId == jobId) downloadJobId = null
  })
}

export const downloadNewVersion = async(version, onDownload = noop) => {
  const buildInfo = await ensureBuildInfo()
  const targetAbis = await getTargetAbis()
  const savePaths = getSavePaths(buildInfo)
  if (downloadJobId != null) {
    stopDownload(downloadJobId)
    downloadJobId = null
  }

  let lastError = null
  for (const abi of targetAbis) {
    const url = `https://github.com/${updateRepo.owner}/${updateRepo.name}/releases/download/v${version}/${buildInfo.releaseAssetPrefix}-v${version}-${abi}.apk`

    for (const savePath of savePaths) {
      await ensureCleanSavePath(savePath)
      try {
        await downloadFromUrl(url, savePath, onDownload)
      } catch (err) {
        lastError = new Error(`[${abi}] ${getErrorMessage(err)}`)
        continue
      }

      apkSavePath = savePath
      await updateApp()
      return
    }
  }

  throw lastError || new Error('download failed')
}

export const updateApp = async() => {
  if (!apkSavePath) throw new Error('apk Save Path is null')
  const buildInfo = await ensureBuildInfo()
  await installApk(apkSavePath, buildInfo.providerAuthority)
}
