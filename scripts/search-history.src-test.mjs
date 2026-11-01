/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const compiled = new Map()

const evaluateModule = (filename, require, module = { exports: {} }) => {
  let source = compiled.get(filename)
  if (!source) {
    source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: filename,
    }).outputText
    compiled.set(filename, source)
  }
  const evaluate = new Script(`(function(require, module, exports) {\n${source}\n})`, { filename }).runInThisContext()
  evaluate(require, module, module.exports)
  return module.exports
}

// Exercise the real search service/actions without loading React Native storage.
const createSearchHistory = ({ initial = [], read } = {}) => {
  const modules = new Map()
  const writes = []
  let disk = [...initial]
  let reads = 0
  const storage = {
    getSearchHistory: async() => {
      reads += 1
      return read ? read() : [...disk]
    },
    saveSearchHistory: async(list) => {
      disk = [...list]
      writes.push([...list])
    },
  }

  const load = (filename) => {
    if (modules.has(filename)) return modules.get(filename).exports
    const module = { exports: {} }
    modules.set(filename, module)
    const require = (specifier) => {
      if (specifier === '@/utils/data') return storage
      const next = specifier.startsWith('@/')
        ? join(root, 'src', `${specifier.slice(2)}.ts`)
        : resolve(dirname(filename), `${specifier}.ts`)
      assert.ok(next.startsWith(join(root, 'src/store/search/')), `Unexpected dependency: ${specifier}`)
      return load(next)
    }
    return evaluateModule(filename, require, module)
  }

  return {
    service: load(join(root, 'src/core/search/search.ts')),
    writes,
    readCount: () => reads,
  }
}

const deferred = () => {
  let release
  const promise = new Promise((resolve) => { release = resolve })
  return { promise, resolve: release }
}

test('loads persisted recent searches once, including an empty history', async() => {
  for (const initial of [[], ['如愿', '王菲']]) {
    const { service, readCount } = createSearchHistory({ initial })
    assert.deepEqual(await service.getSearchHistory(), initial)
    assert.deepEqual(await service.getSearchHistory(), initial)
    assert.equal(readCount(), 1)
  }
})

test('history snapshots stay stable after adding or removing another search', async() => {
  const { service } = createSearchHistory({ initial: ['旧搜索'] })
  const before = await service.getSearchHistory()
  await service.addHistoryWord('新搜索')
  const after = await service.getSearchHistory()
  assert.notEqual(before, after)
  assert.deepEqual(before, ['旧搜索'])
  assert.deepEqual(after, ['新搜索', '旧搜索'])

  service.removeHistoryWord(0)
  assert.deepEqual(after, ['新搜索', '旧搜索'])
  after.push('仅修改页面快照')
  assert.deepEqual(await service.getSearchHistory(), ['旧搜索'])
})

test('submissions save recent-first history, deduplicate and keep the existing 15-item limit', async() => {
  const initial = Array.from({ length: 15 }, (_, index) => `搜索 ${index}`)
  const { service, writes } = createSearchHistory({ initial })
  await service.addHistoryWord('最新搜索')
  assert.deepEqual(await service.getSearchHistory(), ['最新搜索', ...initial.slice(0, 14)])
  assert.deepEqual(writes.at(-1), ['最新搜索', ...initial.slice(0, 14)])

  await service.addHistoryWord('搜索 3')
  await service.addHistoryWord('搜索 3')
  const expected = ['搜索 3', '最新搜索', ...initial.slice(0, 14).filter(word => word !== '搜索 3')]
  assert.deepEqual(await service.getSearchHistory(), expected)
  assert.deepEqual(writes.at(-1), expected)

  service.removeHistoryWord(0)
  assert.deepEqual(await service.getSearchHistory(), expected.slice(1))
  assert.deepEqual(writes.at(-1), expected.slice(1))
})

test('first load is shared by simultaneous display and search submissions', async() => {
  const pending = deferred()
  const { service, readCount, writes } = createSearchHistory({ read: () => pending.promise })
  const display = service.getSearchHistory()
  const first = service.addHistoryWord('第一次')
  const second = service.addHistoryWord('第二次')
  assert.equal(readCount(), 1)
  pending.resolve(['以前搜索'])
  await Promise.all([display, first, second])
  assert.deepEqual(await service.getSearchHistory(), ['第二次', '第一次', '以前搜索'])
  assert.deepEqual(writes.at(-1), ['第二次', '第一次', '以前搜索'])
  assert.equal(readCount(), 1)
})

test('clear persists an empty history and a late initial read cannot restore old chips', async() => {
  const pending = deferred()
  const { service, readCount, writes } = createSearchHistory({ read: () => pending.promise })
  const display = service.getSearchHistory()
  service.clearHistoryList()
  pending.resolve(['不应恢复的旧搜索'])
  assert.deepEqual(await display, [])
  assert.deepEqual(await service.getSearchHistory(), [])
  assert.deepEqual(writes, [[]])
  assert.equal(readCount(), 1)

  await service.addHistoryWord('清空后的搜索')
  assert.deepEqual(await service.getSearchHistory(), ['清空后的搜索'])
  assert.deepEqual(writes.at(-1), ['清空后的搜索'])
})

test('clearing before initial display does not reload stale persisted history', async() => {
  const { service, readCount, writes } = createSearchHistory({ initial: ['旧搜索'] })
  service.clearHistoryList()
  assert.deepEqual(await service.getSearchHistory(), [])
  assert.equal(readCount(), 0)
  assert.deepEqual(writes, [[]])
})

test('clear wins over an earlier submission still waiting for the first disk read', async() => {
  const pending = deferred()
  const { service, writes } = createSearchHistory({ read: () => pending.promise })
  const submitted = service.addHistoryWord('清空前已提交的搜索')
  service.clearHistoryList()
  pending.resolve(['磁盘旧搜索'])
  await submitted
  assert.deepEqual(await service.getSearchHistory(), [])
  assert.deepEqual(writes, [[]])

  await service.addHistoryWord('清空后新提交的搜索')
  assert.deepEqual(await service.getSearchHistory(), ['清空后新提交的搜索'])
  assert.deepEqual(writes.at(-1), ['清空后新提交的搜索'])
})

test('blank submissions do not load history and saved keywords discard surrounding whitespace', async() => {
  const { service, writes, readCount } = createSearchHistory()
  await service.addHistoryWord(' \t\n ')
  assert.equal(readCount(), 0)
  assert.deepEqual(writes, [])
  await service.addHistoryWord('  如愿 \n')
  await service.addHistoryWord('如愿')
  assert.deepEqual(await service.getSearchHistory(), ['如愿'])
  assert.deepEqual(writes, [['如愿']])
})

test('storage cache keeps a clear made during disk loading, including the deferred disk save', async() => {
  const pending = deferred()
  const writes = []
  const scheduled = new Set()
  const historyKey = 'test:search-history'
  let reads = 0
  const dependencies = {
    './dataSpace': { namespacedKey: key => key, luxSpaceId: (server, user) => `lux:${server}:${user}`, setActiveSpace: async() => {} },
    '@/plugins/storage': {
      getData: async(key) => {
        assert.equal(key, historyKey)
        reads += 1
        return pending.promise
      },
      saveData: async(key, list) => {
        assert.equal(key, historyKey)
        writes.push([...list])
      },
    },
    '@/config/constant': { storageDataPrefix: { searchHistoryList: historyKey } },
    './common': { throttle: callback => () => { scheduled.add(callback) } },
    './fs': { privateStorageDirectoryPath: '/test-storage' },
    './log': {},
    './musicUrlCache': {},
    '../../assets/img/DefaultAvatar.png': { default: 0 },
    '@react-native-async-storage/async-storage': { default: {} },
    './secureCredentials': {},
    './loginCredentialRepository': { createLoginCredentialRepository: () => ({}) },
    './loginRecents': { createLoginRecents: () => ({}) },
    './secureCredentialMigration': {},
    '@/plugins/sync/client/credentials': { createCredentialStore: () => ({}) },
  }
  const storage = evaluateModule(join(root, 'src/utils/data.ts'), (specifier) => {
    if (specifier === '@/utils/sessionFence') return { isSessionCoordinatorEnabled: () => true }
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected dependency: ${specifier}`)
    return dependencies[specifier]
  })

  const loading = storage.getSearchHistory()
  await storage.saveSearchHistory([])
  pending.resolve(['应被清除的磁盘旧搜索'])
  assert.deepEqual(await loading, [])
  assert.deepEqual(await storage.getSearchHistory(), [])
  assert.equal(reads, 1)

  // The real data module reads its cache when the throttled write finally fires.
  assert.equal(scheduled.size, 1)
  for (const callback of scheduled) callback()
  assert.deepEqual(writes, [[]])
})
