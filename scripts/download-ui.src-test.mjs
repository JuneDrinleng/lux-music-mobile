/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const load = (path, deps = {}) => {
  const module = { exports: {} }
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText
  new Script(`(function(require,module,exports,React){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`)
    return deps[name]
  }, module, module.exports, deps.react)
  return module.exports
}
const model = load('src/core/download/model.ts')
const presentation = load('src/core/download/presentation.ts', { './model': model })
const song = { source: 'kw', id: 's1', name: 'Song', interval: '04:00', meta: { _qualitys: {} } }
const item = (patch = {}) => ({ musicInfo: song, quality: '320k', wifiOnly: true, estimatedSize: 9600000, key: model.downloadKey(song, '320k'), space: 'local', state: 'done', bytes: 100, playlists: { p1: 'Night' }, ...patch })

test('10A estimates all three quality tiers from metadata or duration, deduplicates and skips downloaded quality', () => {
  assert.deepEqual(presentation.DOWNLOAD_QUALITIES, ['128k', '320k', 'flac'])
  assert.deepEqual(presentation.DOWNLOAD_QUALITIES.map(q => presentation.estimateDownloadSize(song, q)), [3840000, 9600000, 30000000])
  for (const [size, bytes] of [['3.5M', 3.5 * 1024 ** 2], ['1 GB', 1024 ** 3], ['500K', 500 * 1024]]) {
    assert.equal(presentation.estimateDownloadSize({ ...song, meta: { _qualitys: { flac: { size } } } }, 'flac'), bytes)
  }
  const songs = [song, song, { ...song, id: 's2' }, { ...song, source: 'local' }]
  const plan = presentation.downloadSheetPlan(songs, [item()], '320k', false, 100 * 1024 ** 2)
  assert.equal(plan.count, 2)
  assert.equal(plan.skipped, 1)
  assert.equal(plan.pending, 1)
  assert.equal(plan.estimate, 9600000)
  assert.deepEqual(plan.requests.map(r => r.wifiOnly), [false, false])
  assert.equal(presentation.downloadSheetPlan(songs, [item()], '128k', true, null).skipped, 0)
  assert.equal(presentation.downloadSheetPlan(songs, [], '128k', true, null).enough, false)
  const required = 9600000 - 100
  assert.equal(presentation.downloadSheetPlan([song], [item({ state: 'paused' })], '320k', true, required + 8 * 1024 ** 2).enough, true)
  assert.equal(presentation.downloadSheetPlan([song], [item({ state: 'paused' })], '320k', true, required + 8 * 1024 ** 2 - 1).enough, false)
})

test('10C usage counts unique completed and partial bytes separately from playback cache; shared playlist totals do not inflate usage', () => {
  const items = [item({ bytes: 160, playlists: { p1: 'Night', p2: 'Favorites' } }), item({ key: 'other', bytes: 40, state: 'running' })]
  assert.deepEqual(presentation.downloadUsage(items, 80, 400), { downloads: 200, cache: 80, total: 280, downloadFraction: 0.5, cacheFraction: 0.2 })
  const full = presentation.downloadUsage(items, 80, 100)
  assert.equal(full.downloadFraction + full.cacheFraction, 1)
  assert.deepEqual(presentation.downloadedPlaylists(items), [{ id: 'p1', name: 'Night', count: 1, bytes: 160 }, { id: 'p2', name: 'Favorites', count: 1, bytes: 160 }])
  assert.equal(presentation.downloadedPlaylists([item({ playlists: undefined })])[0].id, '')
})

test('playlist enqueue skips completed URL resolution, attaches membership, deletes only chosen playlist and publishes native result', async() => {
  let disk = [item()]
  const calls = []
  const bridge = {
    snapshot: async() => JSON.stringify(disk),
    attachPlaylist: async(space, keys, id, name) => {
      calls.push(['attach', space, JSON.parse(keys), id, name])
      for (const row of disk) row.playlists[id] = name
      return JSON.stringify(disk)
    },
    removePlaylist: async(space, id) => {
      calls.push(['remove', space, id])
      disk = disk.filter(row => { delete row.playlists[id]; return Object.keys(row.playlists).length })
      return JSON.stringify(disk)
    },
    availableBytes: async() => 100 * 1024 ** 2,
    command: async(space, key, action) => { calls.push(['command', space, key, action]); return JSON.stringify(disk) },
  }
  const queue = model.createDownloadQueue({ bridge, space: () => 'local', resolveUrl: async() => { throw new Error('Completed download must not resolve online URL') } })
  let changed = 0
  const unsubscribe = queue.subscribe(() => changed++)
  await queue.sync()
  await queue.enqueuePlaylist([item()], 'p2', 'Favorites')
  assert.deepEqual(calls[0], ['attach', 'local', [item().key], 'p2', 'Favorites'])
  await queue.removePlaylist('p1')
  assert.equal(queue.getSnapshot().length, 1)
  assert.deepEqual(queue.getSnapshot()[0].playlists, { p2: 'Favorites' })
  for (const [state, action] of [['running', 'pause'], ['queued', 'pause'], ['paused', 'resume'], ['failed', 'retry'], ['done', null]]) {
    disk[0].state = state
    await queue.sync()
    assert.equal(presentation.downloadQueueAction(state), action)
    if (action) {
      await queue.command(item().key, action)
      assert.deepEqual(calls.at(-1), ['command', 'local', item().key, action])
    }
  }
  await queue.removePlaylist('p2')
  assert.deepEqual(queue.getSnapshot(), [])
  assert.ok(changed > 0)
  unsubscribe()
  const before = changed
  await queue.sync()
  assert.equal(changed, before)
  const native = read('android/app/src/main/java/cn/lux/music/mobile/download/DownloadModule.java')
  assert.match(native, /playlists\.remove\(playlistId\)/)
  assert.match(native, /if \(playlists\.length\(\) > 0\) \{ DownloadStore.write/)
  assert.match(native, /cancelUniqueWork/)
  assert.match(native, /synchronized \(DownloadStore.lock\(id\)\)/)
})

// Minimal hook renderer exercises callbacks without mounting a native Android Modal.
const harness = () => {
  let cursor = 0
  const states = []
  const effects = []
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next == 'function' ? next(states[i]) : next }] },
    useEffect: fn => { effects.push(fn) },
    useRef: initial => react.useState({ current: initial })[0],
  }
  return { react, reset: () => { states.length = 0 }, render: fn => { cursor = 0; effects.length = 0; return fn() }, effects }
}
const descendants = element => Array.isArray(element) ? element.flatMap(descendants) : element && typeof element == 'object' ? [element, ...Object.values(element.props ?? {}).flatMap(value => Array.isArray(value) ? value.flatMap(descendants) : value && typeof value == 'object' ? descendants(value) : [])] : []
test('10A rendered controls update quality/Wi-Fi, storage gates start, cancel closes, and effect cleanup ignores late free-space results', async() => {
  const h = harness()
  let resolveFree
  let closed = 0
  const calls = []
  const queue = { availableBytes: async() => new Promise(resolve => { resolveFree = resolve }), enqueuePlaylist: async(...args) => calls.push(args) }
  const Sheet = load('src/components/download/PlaylistDownloadSheet.tsx', {
    react: h.react,
    'react-native': { ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', View: 'View' },
    '@/components/common/Text': { default: 'Text', __esModule: true },
    '@/components/magazine': { MagazineSheet: 'MagazineSheet', MagSegmented: 'MagSegmented', TextButton: 'TextButton', Toggle: 'Toggle' },
    '@/core/download': { downloadQueue: queue },
    '@/core/download/presentation': presentation,
    '@/lang': { useI18n: () => (key, params) => params ? `${key}:${JSON.stringify(params)}` : key },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils': { sizeFormate: String },
    '@/utils/tools': { createStyle: x => x, toast: () => {} },
    './DownloadRow': { DownloadRow: 'DownloadRow' },
    './hooks': { useDownloads: () => [], useDownloadPreferences: () => ({ quality: '320k', wifiOnly: true }) },
  }).PlaylistDownloadSheet
  const render = () => h.render(() => Sheet({ songs: [song], playlistId: 'p1', name: 'Night', onClose: () => closed++ }))
  let tree = render()
  const cleanups = h.effects.map(fn => fn()).filter(fn => typeof fn == 'function')
  const primary = () => descendants(tree).find(node => node.type == 'TouchableOpacity')
  assert.equal(primary().props.disabled, true)
  resolveFree(100 * 1024 ** 2)
  await new Promise(resolve => setImmediate(resolve))
  tree = render()
  assert.equal(primary().props.disabled, false)
  descendants(tree).find(node => node.type == 'MagSegmented').props.onChange('flac')
  descendants(tree).find(node => node.type == 'Toggle').props.onChange(false)
  tree = render()
  primary().props.onPress()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls[0][0][0].quality, 'flac')
  assert.equal(calls[0][0][0].wifiOnly, false)
  assert.equal(closed, 1)
  tree.props.onClose()
  assert.equal(closed, 2)
  cleanups.forEach(fn => fn())
  h.reset()
  tree = render()
  const unmount = h.effects.map(fn => fn()).filter(fn => typeof fn == 'function')
  unmount.forEach(fn => fn())
  resolveFree(100 * 1024 ** 2)
  await new Promise(resolve => setImmediate(resolve))
  // eslint-disable-next-line require-atomic-updates -- single-threaded test harness re-render
  tree = render()
  assert.equal(primary().props.disabled, true, 'an unmounted sheet cannot accept a late storage result')
  const parent = read('src/components/playlist/PlaylistDetailView.tsx')
  assert.match(parent, /\{downloadOpen \? <PlaylistDownloadSheet[\s\S]*?onClose=\{\(\) => \{ setDownloadOpen\(false\) \}\} \/> : null\}/)
  assert.match(read('src/components/magazine/MagazineSheet.tsx'), /if \(!mounted\) return null/)
  assert.match(read('src/components/download/hooks.ts'), /useSyncExternalStore\(subscribe, snapshot\)/)
})

test('10C queue controls wire chosen key/action; battery hint uses bridge; original cache controls remain', () => {
  const view = read('src/components/download/DownloadStorageSection.tsx')
  assert.match(view, /downloadQueue\?\.command\(item.key, action\)/)
  assert.match(view, /downloadQueue\?\.removePlaylist\(id\)/)
  assert.match(view, /battery === false/)
  assert.match(view, /openDownloadBatterySettings\(\)/)
  const cache = read('src/screens/Home/Vertical/Tabs/ResourceCacheSection.tsx')
  for (const callback of ['onClean', 'onCleanAudio', 'onCleanImage', 'handleSelectAudioLimit', 'handleSelectImageLimit']) assert.ok(cache.includes(callback))
  for (const language of ['zh-cn', 'zh-tw', 'en-us']) {
    const entries = JSON.parse(read(`src/lang/${language}.json`))
    for (const quality of presentation.DOWNLOAD_QUALITIES) assert.equal(typeof entries[`download_quality_${quality}`], 'string')
    for (const state of ['queued', 'running', 'paused', 'failed', 'done']) assert.equal(typeof entries[`download_state_${state}`], 'string')
  }
})


// Buttons in this view are passed through row `trailing` props, not children.
const buttonIn = (tree, label) => descendants(tree).flatMap(node => [node, node.props?.trailing]).find(node => node?.type == 'SecondaryButton' && node.props.label == label)

test('10C rendered queue expands, invokes pause/resume/retry for each key, deletes a playlist, and opens battery settings', async() => {
  const h = harness()
  const calls = []
  const items = ['running', 'paused', 'failed', 'done'].map((state, i) => item({ state, key: String(i), musicInfo: { ...song, name: state } }))
  const Component = load('src/components/download/DownloadStorageSection.tsx', {
    react: h.react,
    'react-native': { View: 'View', AppState: { addEventListener: () => ({ remove() { calls.push(['unmount']) } }) } },
    '@/components/common/Text': { default: 'Text', __esModule: true },
    '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
    '@/components/magazine': { MagSegmented: 'MagSegmented', SecondaryButton: 'SecondaryButton', SectionHeader: 'SectionHeader', SettingRow: 'SettingRow', Toggle: 'Toggle' },
    '@/core/download': { downloadQueue: { command: async(...args) => calls.push(['command', ...args]), removePlaylist: async id => calls.push(['delete', id]) }, isIgnoringDownloadBatteryOptimizations: async() => false, openDownloadBatterySettings: async() => { calls.push(['battery']); return true } },
    '@/core/download/presentation': presentation,
    '@/lang': { useI18n: () => key => key },
    '@/plugins/player/utils': { getCacheSize: async() => 1024 },
    '@/store/setting/hook': { useSettingValue: () => '1024' },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }) },
    '@/theme/magazineRoles': { magazineRoles: () => ({ iconWrap: {} }) },
    '@/utils': { sizeFormate: String },
    '@/utils/tools': { createStyle: x => x, toast() {}, confirmDialog: async() => true },
    './DownloadRow': { DownloadRow: 'DownloadRow' },
    './hooks': { useDownloads: () => items, useDownloadPreferences: () => ({ quality: '320k', wifiOnly: true }), setDownloadPreferences: patch => calls.push(['preferences', patch]) },
  }).DownloadStorageSection
  const render = () => h.render(() => Component({ refreshToken: '' }))
  let tree = render()
  const cleanups = h.effects.map(fn => fn()).filter(fn => typeof fn == 'function')
  await new Promise(resolve => setImmediate(resolve))
  descendants(tree).find(node => node.type == 'DownloadRow' && node.props.title == 'download_queue').props.onPress()
  tree = render()
  for (const action of ['pause', 'resume', 'retry']) {
    buttonIn(tree, `download_action_${action}`).props.onPress()
    await new Promise(resolve => setImmediate(resolve))
    tree = render()
  }
  assert.deepEqual(calls.filter(call => call[0] == 'command'), [['command', '0', 'pause'], ['command', '1', 'resume'], ['command', '2', 'retry']])
  buttonIn(tree, 'download_delete').props.onPress()
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(calls.some(call => call[0] == 'delete' && call[1] == 'p1'))
  tree = render()
  const batteryRow = descendants(tree).find(node => node.type == 'SettingRow' && node.props.title == 'download_battery_hint')
  assert.equal(batteryRow.props.trailing.props.label, 'download_battery_settings')
  batteryRow.props.trailing.props.onPress()
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(calls.some(call => call[0] == 'battery'))
  descendants(tree).find(node => node.type == 'Toggle').props.onChange(false)
  assert.deepEqual(calls.at(-1), ['preferences', { wifiOnly: false }])
  cleanups.forEach(fn => fn())
  assert.ok(calls.some(call => call[0] == 'unmount'))
})
