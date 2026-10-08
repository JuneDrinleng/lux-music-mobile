import { compareVer } from '@/utils'

export type ReleaseChannel = 'stable' | 'dev'

export interface ReleaseEntry {
  version: string
  desc: string
}

export interface VersionFeed extends ReleaseEntry {
  history?: ReleaseEntry[]
  dev?: ReleaseEntry & { date?: string }
}

export const isDevBuild = (version: string) => /-dev\.\d+$/.test(version)

export const resolveChannel = (setting: ReleaseChannel | null | undefined, current: string): ReleaseChannel =>
  setting ?? (isDevBuild(current) ? 'dev' : 'stable')

export const upcomingStableVersion = (current: string) => {
  const matched = /^(\d+\.\d+\.\d+)-dev\.\d+$/.exec(current)
  return matched?.[1] ?? current
}

export const pickUpdateTarget = (feed: VersionFeed, current: string, channel: ReleaseChannel) => {
  const stable = { version: feed.version, desc: feed.desc, history: feed.history ?? [] }
  const devEntry = feed.dev
  const useDev = channel == 'dev' && !!devEntry?.version && compareVer(devEntry.version, feed.version) > 0
  const target = useDev && devEntry
    ? { version: devEntry.version, desc: devEntry.desc, history: [] }
    : stable
  return {
    channel,
    target,
    isLatest: compareVer(current, target.version) != -1,
    waitStable: channel == 'stable' && isDevBuild(current) && compareVer(current, feed.version) > 0,
  }
}
