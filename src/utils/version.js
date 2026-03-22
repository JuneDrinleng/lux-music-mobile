import { httpGet } from '@/utils/request'
import { downloadFile, existsFile, privateStorageDirectoryPath, stopDownload, temporaryDirectoryPath, unlink } from '@/utils/fs'
import { getSupportedAbis, installApk } from '@/utils/nativeModules/utils'
import { APP_PROVIDER_NAME } from '@/config/constant'

const updateRepo = {
  owner: 'JuneDrinleng',
  name: 'lux-music-mobile',
}
const releaseAssetNamePrefix = 'lux-music-mobile'

const abis = [
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86',
  'universal',
]
const defaultAbi = 'universal'
const apkFileName = 'lux-music-mobile-update.apk'
const downloadConnectionTimeout = 60000
const downloadReadTimeout = 600000

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

const savePaths = [
  `${privateStorageDirectoryPath}/${apkFileName}`,
  `${temporaryDirectoryPath}/${apkFileName}`,
]

const ensureCleanSavePath = async(savePath) => {
  try {
    if (await existsFile(savePath)) await unlink(savePath)
  } catch {}
}

const getErrorMessage = (err) => {
  if (!err) return ''
  if (typeof err == 'string') return err
  if (err.message != null) return String(err.message)
  return String(err)
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
  }).finally(() => {
    if (downloadJobId == jobId) downloadJobId = null
  })
}

export const downloadNewVersion = async(version, onDownload = noop) => {
  const targetAbis = await getTargetAbis()
  if (downloadJobId != null) {
    stopDownload(downloadJobId)
    downloadJobId = null
  }

  let lastError = null
  for (const abi of targetAbis) {
    const url = `https://github.com/${updateRepo.owner}/${updateRepo.name}/releases/download/v${version}/${releaseAssetNamePrefix}-v${version}-${abi}.apk`

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
  await installApk(apkSavePath, APP_PROVIDER_NAME)
}
