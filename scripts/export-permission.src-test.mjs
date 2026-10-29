/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const load = (path, deps, globals = {}) => {
  const module = { exports: {} }
  const js = ts.transpileModule(source(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText
  new Script(`(function(require,module,exports){${js}\n})`).runInNewContext({
    global: { i18n: { t: key => key } }, React: { createElement: () => null }, ...globals,
  })(id => deps[id] ?? {}, module, module.exports)
  return module.exports
}

const access = picker => load('src/utils/exportAccess.ts', { '@/utils/fs': { selectManagedFolder: picker } })

for (const api of [29, 30, 31, 32, 33, 34, 35]) {
  for (const enabled of [true, false]) {
    test(`API ${api}, system selector ${enabled}: export selects SAF without checking/requesting storage`, async() => {
      const calls = []
      const chosen = []
      let exposed
      const helper = access(async persist => { calls.push(['tree', persist]); return { isDirectory: true, path: 'content://provider/tree/primary%3ABackup' } })
      const component = load('src/components/common/ChoosePath/index.tsx', {
        react: {
          useState: () => [false, () => {}],
          useRef: value => ({ current: value }),
          forwardRef: fn => fn,
          useImperativeHandle: (_, fn) => { exposed = fn() },
        },
        'react-native': { Platform: { Version: api } },
        '@/utils/exportAccess': helper,
        '@/utils/hooks': { useUnmounted: () => ({ current: false }) },
        '@/lang': { useI18n: () => key => key },
        '@/store/setting/state': { setting: { 'common.useSystemFileSelector': enabled } },
        '@/utils/tools': {
          checkStoragePermissions: () => { throw new Error('legacy permission check') },
          requestStoragePermission: () => { throw new Error('legacy permission request') },
        },
      }).default
      component({ onConfirm: path => chosen.push(path) }, {})
      exposed.show({ title: 'export', dirOnly: true, forExport: true, isPersist: true })
      await new Promise(resolve => setImmediate(resolve))
      assert.deepEqual(calls, [['tree', true]])
      assert.deepEqual(chosen, ['content://provider/tree/primary%3ABackup'])
    })
  }
}

test('legacy directory picker remains available only before scoped storage when opted out', () => {
  const helper = access()
  assert.equal(helper.usesScopedDirectoryPicker(28, false), false)
  assert.equal(helper.usesScopedDirectoryPicker(28, true), true)
})

test('SAF cancel, invalid response and native errors retain their distinct meaning', async() => {
  assert.equal(await access(async() => null).pickExportDirectory(), null)
  await assert.rejects(access(async() => ({ isDirectory: false, path: '/sdcard' })).pickExportDirectory(), /storage_export_directory_invalid/)
  const error = new Error('Permission denied by document provider')
  const helper = access(async() => { throw error })
  await assert.rejects(helper.pickExportDirectory(), e => e === error)
  assert.equal(helper.fileAccessError(error), error.message)
  assert.equal(helper.fileAccessError({ message: 'ENOSPC: storage full' }), 'ENOSPC: storage full')
  assert.equal(helper.fileAccessError('Provider unavailable'), 'Provider unavailable')
  assert.equal(helper.fileAccessError(null), 'storage_export_error_unknown')
})

test('JSON backup writes the unchanged document to the granted tree, and write failures propagate', async() => {
  const writes = []
  const document = { type: 'lux', version: 1, playlists: [], playHistory: [] }
  const io = writeFile => load('src/utils/playHistory/backupIO.ts', {
    '@/store/setting/state': { setting: {} },
    '@/plugins/sync/listEvent': { getLocalListData: async() => [] },
    '@/utils/common': { dateFormat: () => '2026-10-29_123456' },
    '@/utils/fs': { writeFile },
    './store': { getPlayRecords: () => [] },
    './backup': { buildLuxBackup: () => document },
  })
  const directory = 'content://provider/tree/primary%3ABackup/document/primary%3ABackup'
  const path = await io(async(...args) => { writes.push(args) }).exportLuxBackupFile(directory)
  assert.equal(path, directory + '/lux-data-backup-20261029123456.json')
  assert.deepEqual(writes, [[path, JSON.stringify(document), 'utf8']])
  await assert.rejects(io(async() => { throw new Error('ENOSPC') }).exportLuxBackupFile(directory), /ENOSPC/)
})

test('UI reports picker and write reasons; legacy export cannot swallow write errors', () => {
  const picker = source('src/components/common/ChoosePath/index.tsx')
  assert.match(picker, /storage_export_directory_failed.*reason: fileAccessError\(err\)/)
  const settings = source('src/screens/Home/Vertical/Tabs/SettingsTab.tsx')
  assert.match(settings, /setting_export_data_fail_reason.*reason: fileAccessError\(err\)/)
  for (const path of ['src/screens/Home/Views/Setting/settings/Backup/actions.ts', 'src/screens/Home/Views/Mylist/MyList/listAction.ts']) {
    assert.match(source(path), /await handleSaveFile[\s\S]*?catch \(error: any\) \{\s*log.error\(error.stack\)\s*throw error/)
  }
  for (const lang of ['zh-cn', 'zh-tw', 'en-us']) {
    const strings = JSON.parse(source(`src/lang/${lang}.json`))
    assert.match(strings.storage_export_directory_failed, /\{reason\}/)
    assert.match(strings.setting_export_data_fail_reason, /\{reason\}/)
    assert.ok(strings.storage_export_error_unknown)
  }
})

for (const outcome of ['cancel', 'error', 'unmount']) {
  test(`directory picker ${outcome}: no export, no legacy fallback, accurate error`, async() => {
    let exposed
    const chosen = []
    const toasts = []
    const unmounted = { current: false }
    let resolvePicker
    let rejectPicker
    const pending = new Promise((resolve, reject) => { resolvePicker = resolve; rejectPicker = reject })
    const helper = access(() => pending)
    const component = load('src/components/common/ChoosePath/index.tsx', {
      react: {
        useState: () => [false, () => {}],
        useRef: value => ({ current: value }),
        forwardRef: fn => fn,
        useImperativeHandle: (_, fn) => { exposed = fn() },
      },
      'react-native': { Platform: { Version: 35 } },
      '@/utils/exportAccess': helper,
      '@/utils/hooks': { useUnmounted: () => unmounted },
      '@/lang': { useI18n: () => (key, args) => `${key}:${args?.reason}` },
      '@/store/setting/state': { setting: { 'common.useSystemFileSelector': false } },
      '@/utils/log': { log: { warn: () => {} } },
      '@/utils/tools': {
        toast: message => toasts.push(message),
        checkStoragePermissions: () => { throw new Error('legacy permission check') },
        requestStoragePermission: () => { throw new Error('legacy permission request') },
      },
    }).default
    component({ onConfirm: path => chosen.push(path) }, {})
    exposed.show({ title: 'export', dirOnly: true, forExport: true })
    if (outcome === 'error') rejectPicker(new Error('Provider unavailable'))
    else if (outcome === 'cancel') resolvePicker(null)
    else {
      unmounted.current = true
      resolvePicker({ isDirectory: true, path: 'content://provider/tree/backup' })
    }
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(chosen, [])
    assert.deepEqual(toasts, outcome === 'error' ? ['storage_export_directory_failed:Provider unavailable'] : [])
  })
}

for (const single of [false, true]) {
  test(`${single ? 'single' : 'all'} playlist export surfaces writer failure without a success toast`, async() => {
    const toasts = []
    const actions = load(single ? 'src/screens/Home/Views/Mylist/MyList/listAction.ts' : 'src/screens/Home/Views/Setting/settings/Backup/actions.ts', {
      '@/utils/tools': { handleSaveFile: async() => { throw new Error('ENOSPC') }, toast: text => toasts.push(text) },
      '@/utils/log': { log: { error: () => {} } },
      '@/utils': { filterFileName: name => name },
      '@/core/list': { getListMusics: async() => [] },
      '@/store/list/state': { defaultList: { id: 'default' }, loveList: { id: 'love' }, userList: [] },
    })
    if (single) actions.handleExport({ id: 'a', name: 'a' }, 'content://provider/tree/backup')
    else actions.handleExportList('content://provider/tree/backup')
    await new Promise(resolve => setImmediate(resolve))
    assert.ok(toasts.some(text => text.endsWith(': ENOSPC')))
    assert.ok(!toasts.includes('setting_backup_part_export_list_tip_success'))
  })
}
