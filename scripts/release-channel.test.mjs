import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'

const loadCompareVer = () => {
  const source = fs.readFileSync(new URL('../src/utils/index.ts', import.meta.url), 'utf8')
  const match = source.match(/export function compareVer\([\s\S]*?\n}\n/)
  if (!match) throw new Error('找不到 compareVer')
  const body = match[0]
    .replace('export function', 'function')
    .replace(/: Array<[^>]+>/g, '')
    .replace(/: -1 \| 0 \| 1/g, '')
    .replace(/: string/g, '')
  return new Function(`${body}\nreturn compareVer;`)()
}

const loadReleaseChannel = compareVer => {
  let code = fs.readFileSync(new URL('../src/utils/releaseChannel.ts', import.meta.url), 'utf8')
  code = code
    .replace(/^import .*$/gm, '')
    .replace(/^export type .*$/gm, '')
    .replace(/^export interface [\s\S]*?^}\n/gm, '')
    .replace(/^export const /gm, 'const ')
    .replace(/\): ReleaseChannel =>/g, ') =>')
    .replace(/: ReleaseChannel \| null \| undefined/g, '')
    .replace(/: VersionFeed/g, '')
    .replace(/: ReleaseChannel/g, '')
    .replace(/: string/g, '')
  return new Function('compareVer', `${code}\nreturn { isDevBuild, resolveChannel, pickUpdateTarget, upcomingStableVersion };`)(compareVer)
}

const compareVer = loadCompareVer()
const { isDevBuild, resolveChannel, pickUpdateTarget, upcomingStableVersion } = loadReleaseChannel(compareVer)

const feed = {
  version: '0.4.0',
  desc: '稳定版说明',
  history: [{ version: '0.3.1', desc: '旧' }],
  dev: { version: '0.5.0-dev.2', desc: '开发版说明', date: '2026-10-20' },
}

test('compareVer 能把开发版排在同号稳定版之前，也能高于旧稳定版', () => {
  assert.equal(compareVer('0.4.0-dev.1', '0.4.0-dev.2'), -1)
  assert.equal(compareVer('0.4.0-dev.2', '0.4.0'), -1)
  assert.equal(compareVer('0.4.0-dev.1', '0.3.1'), 1)
  assert.equal(compareVer('0.4.1', '0.5.0-dev.1'), -1)
})

test('默认通道跟随安装包', () => {
  assert.equal(resolveChannel(null, '0.4.0'), 'stable')
  assert.equal(resolveChannel(undefined, '0.5.0-dev.1'), 'dev')
  assert.equal(resolveChannel('stable', '0.5.0-dev.1'), 'stable')
  assert.equal(isDevBuild('0.4.0-dev.1'), true)
  assert.equal(isDevBuild('0.4.0'), false)
  assert.equal(upcomingStableVersion('0.5.0-dev.2'), '0.5.0')
})

test('方案里的 7 种更新选择', () => {
  const stableFromOld = pickUpdateTarget(feed, '0.3.1', 'stable')
  assert.equal(stableFromOld.target.version, '0.4.0')
  assert.equal(stableFromOld.isLatest, false)
  assert.equal(stableFromOld.waitStable, false)

  const devFromOld = pickUpdateTarget(feed, '0.3.1', 'dev')
  assert.equal(devFromOld.target.version, '0.5.0-dev.2')
  assert.equal(devFromOld.isLatest, false)
  assert.equal(devFromOld.waitStable, false)

  const devDefault = pickUpdateTarget(feed, '0.5.0-dev.1', resolveChannel(null, '0.5.0-dev.1'))
  assert.equal(devDefault.target.version, '0.5.0-dev.2')
  assert.equal(devDefault.isLatest, false)

  const devOnStableChannel = pickUpdateTarget(feed, '0.5.0-dev.1', 'stable')
  assert.equal(devOnStableChannel.target.version, '0.4.0')
  assert.equal(devOnStableChannel.isLatest, true)
  assert.equal(devOnStableChannel.waitStable, true)

  const promoted = pickUpdateTarget({
    version: '0.4.0',
    desc: '已转正',
    dev: { version: '0.4.0-dev.8', desc: '旧开发版' },
  }, '0.4.0-dev.9', 'dev')
  assert.equal(promoted.target.version, '0.4.0')
  assert.equal(promoted.isLatest, false)
  assert.equal(promoted.waitStable, false)

  const stableUserOnDevChannel = pickUpdateTarget(feed, '0.4.0', 'dev')
  assert.equal(stableUserOnDevChannel.target.version, '0.5.0-dev.2')

  const devOlderThanStable = pickUpdateTarget({
    version: '0.4.0',
    desc: '稳定',
    dev: { version: '0.4.0-dev.2', desc: '更旧' },
  }, '0.4.0', 'dev')
  assert.equal(devOlderThanStable.target.version, '0.4.0')
  assert.equal(devOlderThanStable.isLatest, true)
  assert.equal(devOlderThanStable.waitStable, false)

  const { dev, ...withoutDev } = feed
  const noDevField = pickUpdateTarget(withoutDev, '0.3.1', 'dev')
  assert.equal(noDevField.target.version, '0.4.0')
  assert.equal(dev.version, '0.5.0-dev.2')
})

test('开发版比 hotfix 新时，切回稳定通道只提示等待，不把目标降成 hotfix', () => {
  const picked = pickUpdateTarget({
    version: '0.4.1',
    desc: 'hotfix',
    dev: { version: '0.5.0-dev.3', desc: '更新的开发版' },
  }, '0.5.0-dev.2', 'stable')
  assert.equal(picked.target.version, '0.4.1')
  assert.equal(picked.isLatest, true)
  assert.equal(picked.waitStable, true)
  assert.equal(upcomingStableVersion('0.5.0-dev.2'), '0.5.0')
})
