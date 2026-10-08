import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apkVersionCode, compareVersions, computeBaseVersionCode, parseVersion } from './version-code.mjs'

test('versionCode 与方案中的对照表一致', () => {
  const cases = [
    ['0.3.1', 30199, { universal: 301990, 'arm64-v8a': 301993 }],
    ['0.4.0-dev.1', 40001, { universal: 400010, 'armeabi-v7a': 400011, x86: 400012, 'arm64-v8a': 400013, x86_64: 400014 }],
    ['0.4.0-dev.98', 40098, { universal: 400980, x86_64: 400984 }],
    ['0.4.0', 40099, { universal: 400990, 'arm64-v8a': 400993 }],
    ['0.4.1', 40199, { universal: 401990, x86_64: 401994 }],
    ['0.5.0-dev.1', 50001, { universal: 500010, 'arm64-v8a': 500013 }],
    ['1.0.0', 1000099, { universal: 10000990, 'arm64-v8a': 10000993 }],
  ]
  for (const [version, base, apks] of cases) {
    assert.equal(computeBaseVersionCode(version), base, version)
    for (const [abi, code] of Object.entries(apks)) {
      assert.equal(apkVersionCode(version, abi), code, `${version} ${abi}`)
    }
  }
})

test('任意 ABI 都随版本单调递增，且首个新包大于旧公式最大值 112004', () => {
  const versions = ['0.3.1', '0.4.0-dev.1', '0.4.0-dev.2', '0.4.0-dev.98', '0.4.0', '0.4.1', '0.5.0-dev.1', '1.0.0']
  const abis = ['universal', 'armeabi-v7a', 'x86', 'arm64-v8a', 'x86_64']
  const codes = versions.flatMap(version => abis.map(abi => apkVersionCode(version, abi)))
  for (let i = 1; i < codes.length; i++) assert.ok(codes[i] > codes[i - 1])
  assert.ok(Math.min(...codes) > 112004)
  assert.ok(apkVersionCode('209.99.99', 'x86_64') <= 2100000000)
})

test('拒绝无法编码或不合 SemVer 预发布格式的版本', () => {
  for (const version of ['0.4.0-dev.0', '0.4.0-dev.99', '0.4.0-beta', '1.2', 'v0.4.0', '01.0.0', '0.100.0', '210.0.0', '0.4.0-dev.01']) {
    assert.throws(() => computeBaseVersionCode(version), undefined, version)
  }
})

test('开发版低于同号稳定版，hotfix 低于下一个 minor 的 dev', () => {
  assert.ok(compareVersions('0.4.0-dev.1', '0.4.0-dev.2') < 0)
  assert.ok(compareVersions('0.4.0-dev.2', '0.4.0') < 0)
  assert.ok(compareVersions('0.4.0', '0.4.1') < 0)
  assert.ok(compareVersions('0.4.1', '0.5.0-dev.1') < 0)
  assert.equal(parseVersion('v0.2.9-beta'), null)
  assert.equal(parseVersion('v0.4.0-dev.3')?.version, '0.4.0-dev.3')
})
