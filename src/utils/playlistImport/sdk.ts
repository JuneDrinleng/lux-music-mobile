/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { Buffer } from '@craftzdog/react-native-buffer'
import iconv from 'iconv-lite'
import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo } from '@/utils'
import { getListDetailAll } from '@/core/songlist'
import { detectCSVEncoding, parseCSV, parsePlatformLink, type ImportSource } from './parser'
import { abortError } from './matcher'

export const decodeCSV = (base64: string) => {
  const bytes = Buffer.from(base64, 'base64')
  const encoding = detectCSVEncoding(bytes)
  return { tracks: parseCSV(iconv.decode(bytes, encoding)), encoding }
}

export const searchImportSongs = async(query: string, source: ImportSource, signal: AbortSignal): Promise<LX.Music.MusicInfoOnline[]> => {
  if (signal.aborted) throw abortError()
  const result = await musicSdk[source].musicSearch.search(query, 1, 30) as { list: LX.Music.MusicInfoOnline[] }
  if (signal.aborted) throw abortError()
  return result.list.map(song => toNewMusicInfo(song) as LX.Music.MusicInfoOnline)
}
export const loadPlatformSongs = async(text: string) => {
  const link = parsePlatformLink(text)
  if (!link) throw new Error('IMPORT_INVALID_LINK')
  // Existing SDK handles full URLs, short redirects, cookies and provider IDs.
  return getListDetailAll(link.source, link.url, true)
}
