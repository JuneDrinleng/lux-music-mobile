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
const latest = { version: '0.6.0', desc: 'An available update' }

const evaluateModule = (filename, require, global, currentVersion) => {
  let source = compiled.get(filename)
  if (!source) {
    source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    }).outputText
    compiled.set(filename, source)
  }
  const module = { exports: {} }
  const evaluate = new Script(`(function(require, module, exports, global, process) {\n${source}\n})`, { filename }).runInThisContext()
  evaluate(require, module, module.exports, global, { versions: { app: currentVersion } })
  return module.exports
}

// Load the real update service, storage cache, release selection and modal handlers.
// Native APIs and rendering are replaced so these regressions run without a device.
const createUpdates = ({ disk = new Map(), currentVersion = '0.5.0', channel = null, readFeed } = {}) => {
  const modules = new Map()
  const reads = []
  const writes = []
  const dismissed = []
  const toasts = []
  let shown = 0
  let requests = 0
  const global = {
    i18n: { t: key => key },
    state_event: {
      versionInfoUpdated: () => {},
      versionDownloadProgressUpdated: () => {},
    },
  }
  const jsx = (type, props) => ({ type, props })
  const dependencies = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      View: 'View',
      ScrollView: 'ScrollView',
      AppState: { currentState: 'active', addEventListener: () => {} },
    },
    'react-native-navigation': {
      Navigation: { dismissOverlay: async(id) => { dismissed.push(id) } },
    },
    '@/navigation': { showVersionModal: () => { shown += 1 } },
    '@/store/setting/state': { default: { setting: { 'common.releaseChannel': channel } } },
    '@/utils/version': {
      getVersionInfo: async() => {
        requests += 1
        return readFeed ? readFeed(requests) : latest
      },
    },
    './dataSpace': { namespacedKey: key => key, luxSpaceId: (server, user) => `lux:${server}:${user}`, setActiveSpace: async() => {} },
    '@/plugins/storage': {
      getData: async(key) => {
        reads.push(key)
        return disk.get(key)
      },
      saveData: async(key, value) => {
        writes.push([key, value])
        disk.set(key, value)
      },
      removeData: async(key) => {
        writes.push([key, null])
        disk.delete(key)
      },
    },
    './common': { throttle: () => () => {} },
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
    '@/utils/simplify-chinese-main': {},
    he: {},
    '@/components/magazine': { MagDialog: 'MagDialog', StatusChip: 'StatusChip' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/ChangelogView': { default: 'ChangelogView' },
    '@/lang': { useI18n: () => global.i18n.t },
    '@/store/version/hook': {
      useVersionInfo: () => state.versionInfo,
      useVersionDownloadProgressUpdated: () => state.progress,
    },
    '@/theme/LuxTheme': { sharedLuxStyles: () => () => ({}), useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/theme/magazineType': { magType: { h1: { size: 20 } } },
    '@/utils/tools': { toast: message => { toasts.push(message) }, createStyle: styles => styles },
    '../../../package.json': { version: currentVersion },
  }
  const sourceFiles = new Set([
    'src/config/constant.ts',
    'src/core/version.ts',
    'src/utils/data.ts',
    'src/utils/index.ts',
    'src/utils/releaseChannel.ts',
    'src/store/version/state.ts',
    'src/store/version/action.ts',
    'src/navigation/components/VersionModal.tsx',
  ].map(file => join(root, file)))
  const load = (filename) => {
    if (modules.has(filename)) return modules.get(filename)
    assert.ok(sourceFiles.has(filename), `Unexpected source module: ${filename}`)
    const require = (specifier) => {
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier]
      const next = specifier === '@/utils'
        ? join(root, 'src/utils/index.ts')
        : specifier.startsWith('@/')
          ? join(root, 'src', `${specifier.slice(2)}.ts`)
          : resolve(dirname(filename), `${specifier}.ts`)
      return load(next)
    }
    const exports = evaluateModule(filename, require, global, currentVersion)
    modules.set(filename, exports)
    return exports
  }
  const state = load(join(root, 'src/store/version/state.ts')).default
  const service = load(join(root, 'src/core/version.ts'))
  return {
    service,
    state,
    disk,
    reads,
    writes,
    dismissed,
    toasts,
    shown: () => shown,
    requests: () => requests,
    dialog: () => {
      const Modal = load(join(root, 'src/navigation/components/VersionModal.tsx')).default
      const dialog = Modal({ componentId: 'version-overlay' }).props.children
      assert.equal(dialog.type, 'MagDialog')
      return dialog.props
    },
  }
}

test('the update dialog offers only cancel and update buttons', async() => {
  const app = createUpdates()
  await app.service.checkUpdate()
  const dialog = app.dialog()
  assert.equal(dialog.cancelLabel, 'cancel')
  assert.equal(dialog.confirmLabel, 'version_btn_new')
  assert.equal(typeof dialog.onCancel, 'function')
  assert.equal(typeof dialog.onConfirm, 'function')
  assert.equal(Object.hasOwn(dialog, 'extraLabel'), false)
  assert.equal(Object.hasOwn(dialog, 'onExtra'), false)
})

test('cancel and close only dismiss the update and allow the next automatic check to prompt again', async() => {
  for (const action of ['onCancel', 'onClose']) {
    const app = createUpdates()
    await app.service.checkUpdate()
    assert.equal(app.shown(), 1)
    const dialog = app.dialog()
    assert.equal(dialog.cancelLabel, 'cancel')
    dialog[action]()
    assert.equal(app.state.showModal, false)
    assert.deepEqual(app.dismissed, ['version-overlay'])
    assert.deepEqual(app.writes, [])
    await app.service.checkUpdate()
    assert.equal(app.shown(), 2)
    const restarted = createUpdates({ disk: app.disk })
    await restarted.service.checkUpdate()
    assert.equal(restarted.shown(), 1)
  }
})

test('automatic and manual checks prompt for every available update without accessing storage', async() => {
  for (const options of [{}, { manual: true }]) {
    const app = createUpdates()
    for (let check = 1; check <= 3; check += 1) {
      await app.service.checkUpdate(options)
      assert.equal(app.shown(), check)
      assert.equal(app.state.showModal, true)
      app.dialog().onCancel()
    }
    assert.equal(app.requests(), 3)
    assert.deepEqual(app.reads, [])
    assert.deepEqual(app.writes, [])
  }
})

test('manual update checks are not lost while an automatic request is running', async() => {
  let finishAutomatic
  let finishManual
  const pendingAutomatic = new Promise(resolve => { finishAutomatic = resolve })
  const pendingManual = new Promise(resolve => { finishManual = resolve })
  const app = createUpdates({ readFeed: request => request === 1 ? pendingAutomatic : pendingManual })
  const automatic = app.service.checkUpdate()
  const manual = app.service.checkUpdate({ manual: true })
  assert.equal(app.requests(), 1)
  finishAutomatic(latest)
  await automatic
  assert.equal(app.requests(), 2)
  assert.equal(app.shown(), 1)
  app.dialog().onCancel()
  finishManual(latest)
  await manual
  assert.equal(app.shown(), 2)
})

test('manual checks bypass throttling and display an active download without restarting it', async() => {
  const app = createUpdates()
  await app.service.checkUpdate()
  assert.equal(app.shown(), 1)
  app.dialog().onCancel()
  await app.service.checkUpdate({ throttleMs: 60_000 })
  assert.equal(app.requests(), 1)
  assert.equal(app.shown(), 1)
  assert.equal(app.state.showModal, false)
  await app.service.checkUpdate({ manual: true, throttleMs: 60_000 })
  assert.equal(app.requests(), 2)
  assert.equal(app.shown(), 2)

  app.service.hideModal('version-overlay')
  app.state.versionInfo.status = 'downloading'
  await app.service.checkUpdate()
  assert.equal(app.requests(), 2)
  await app.service.checkUpdate({ manual: true })
  assert.equal(app.requests(), 2)
  assert.equal(app.shown(), 3)
  assert.equal(app.state.versionInfo.status, 'downloading')
})

test('manual checks do not offer latest, waiting-for-stable or unknown releases', async() => {
  for (const scenario of [
    { currentVersion: latest.version, expected: 'isLatest' },
    { currentVersion: '0.7.0-dev.1', channel: 'stable', expected: 'waitStable' },
    { readFeed: async() => null, expected: 'isUnknown' },
    { readFeed: async() => { throw new Error('offline') }, expected: 'isUnknown' },
  ]) {
    const app = createUpdates(scenario)
    await app.service.checkUpdate({ manual: true })
    assert.equal(app.state.versionInfo[scenario.expected], true)
    assert.equal(app.shown(), 0)
    if (scenario.expected === 'isUnknown') assert.deepEqual(app.toasts, ['version_tip_unknown'])
  }
})
