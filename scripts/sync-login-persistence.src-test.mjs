/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const evaluateTsModule = (filename, require) => {
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const evaluate = new Script(`(function(require, module, exports) {\n${source}\n})`, { filename }).runInThisContext()
  evaluate(require, module, module.exports)
  return module.exports
}

const loadPersistence = (dataMock = {}) => evaluateTsModule(
  join(root, 'src/utils/syncLoginCredentialPersistence.ts'),
  (specifier) => {
    assert.equal(specifier, '@/utils/data')
    return dataMock
  },
)

test('dropSyncLoginDraftForMode keeps the other sync format profile intact', () => {
  const { dropSyncLoginDraftForMode } = loadPersistence()
  const both = {
    lux: { host: 'https://lux.example', luxUsername: 'alice', luxPassword: 'secret' },
    lx: { host: 'https://lx.example', lxAuthCode: 'code-123' },
  }
  assert.deepEqual(dropSyncLoginDraftForMode(both, 'lux'), { lx: both.lx })
  assert.deepEqual(dropSyncLoginDraftForMode(both, 'lx'), { lux: both.lux })
  assert.equal(dropSyncLoginDraftForMode(both, 'lux')?.lux, undefined)
  assert.equal(dropSyncLoginDraftForMode({ lux: both.lux }, 'lux'), null)
  assert.equal(dropSyncLoginDraftForMode(null, 'lx'), null)
})

test('clearSavedSyncLoginCredentialsForMode is the only path that wipes stored secrets', async() => {
  let drafts = {
    lux: { host: 'https://lux.example', luxUsername: 'alice', luxPassword: 'secret' },
    lx: { host: 'https://lx.example', lxAuthCode: 'code-123' },
  }
  const events = []
  const persistence = loadPersistence({
    getSyncLoginDrafts: async() => drafts,
    setSyncLoginDrafts: async(next) => { drafts = next; events.push('setDrafts') },
    clearSyncLoginDraft: async() => { drafts = null; events.push('clearDrafts') },
    clearLuxAuth: async() => { events.push('clearLuxAuth') },
    clearSyncAuthKey: async() => { events.push('clearSyncAuthKey') },
  })

  await persistence.clearSavedSyncLoginCredentialsForMode('lux')
  assert.deepEqual(drafts, { lx: { host: 'https://lx.example', lxAuthCode: 'code-123' } })
  assert.deepEqual(events, ['setDrafts', 'clearLuxAuth'])

  events.length = 0
  await persistence.clearSavedSyncLoginCredentialsForMode('lx')
  assert.equal(drafts, null)
  assert.deepEqual(events, ['clearDrafts', 'clearSyncAuthKey'])
})

test('skip sync preserves credentials; account logout clears its Lux session', () => {
  const syncLogout = readFileSync(join(root, 'src/utils/syncLogout.ts'), 'utf8')
  assert.match(syncLogout, /clearLuxAuthForServer\(session\)/)

  const syncLogin = readFileSync(join(root, 'src/screens/SyncLogin/index.tsx'), 'utf8')
  const skipStart = syncLogin.indexOf('const handleUseWithoutSync')
  const skipEnd = syncLogin.indexOf('const lxAuthCodeDisplay')
  assert.ok(skipStart >= 0 && skipEnd > skipStart)
  const skipHandler = syncLogin.slice(skipStart, skipEnd)
  assert.doesNotMatch(skipHandler, /clearLuxAuth|clearSyncAuthKey|clearSyncLoginDraft/)
})
