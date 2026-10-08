/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import bundledFile from '@/data/bundledChangelog.json'
import { getVersionInfo } from '@/utils/version'
import { isDevBuild, type ReleaseChannel } from '@/utils/releaseChannel'

export interface InstalledChangelog {
  version: string
  channel: ReleaseChannel
  date: string
  desc: string
  source: 'bundled' | 'remote'
}

const text = (value: unknown) => typeof value == 'string' ? value : ''

const recordOf = (value: unknown) => {
  if (value == null || typeof value != 'object') return null
  return value as Record<string, unknown>
}

export const readBundledChangelog = (currentVersion: string, bundled: unknown = bundledFile): InstalledChangelog | null => {
  const file = recordOf(bundled)
  if (!file || file.version != currentVersion) return null
  const desc = text(file.desc).trim()
  if (!desc) return null
  const channel: ReleaseChannel = file.channel == 'dev' || isDevBuild(currentVersion) ? 'dev' : 'stable'
  return {
    version: currentVersion,
    channel,
    date: text(file.date).trim(),
    desc,
    source: 'bundled',
  }
}

export const matchVersionFeed = (feed: unknown, currentVersion: string): InstalledChangelog | null => {
  const raw = recordOf(feed)
  if (!raw) return null
  if (raw.version == currentVersion) {
    const desc = text(raw.desc).trim()
    if (!desc) return null
    return { version: currentVersion, channel: 'stable', date: '', desc, source: 'remote' }
  }
  const dev = recordOf(raw.dev)
  if (dev && dev.version == currentVersion) {
    const desc = text(dev.desc).trim()
    if (!desc) return null
    return { version: currentVersion, channel: 'dev', date: text(dev.date).trim(), desc, source: 'remote' }
  }
  if (!Array.isArray(raw.history)) return null
  for (const item of raw.history) {
    const entry = recordOf(item)
    if (!entry || entry.version != currentVersion) continue
    const desc = text(entry.desc).trim()
    if (!desc) return null
    return {
      version: currentVersion,
      channel: isDevBuild(currentVersion) ? 'dev' : 'stable',
      date: text(entry.date).trim(),
      desc,
      source: 'remote',
    }
  }
  return null
}

export const loadInstalledChangelog = async(currentVersion: string): Promise<InstalledChangelog | null> => {
  const bundled = readBundledChangelog(currentVersion)
  if (bundled) return bundled
  try {
    return matchVersionFeed(await getVersionInfo(), currentVersion)
  } catch {
    return null
  }
}
