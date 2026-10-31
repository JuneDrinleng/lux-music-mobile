/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const module = { exports: {} }
new Script(`(function(module,exports){${ts.transpileModule(read('src/utils/playlistImport/local.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText}\n})`).runInThisContext()(module, module.exports)
const { playlistCreationTime, sortImportPlaylists, buildLocalCandidates, filterLocalCandidates } = module.exports
const song = (id, name = '晴天', singer = 'Artist', source = 'wy') => ({ id, name, singer, source })

test('local playlist sorting uses generated ID time, ignores reorder time and keeps unknown dates last in either direction', () => {
  const lists = [{ id: 'custom', locationUpdateTime: 9999999999999 }, { id: 'userlist_1700000000000' }, { id: 'love' }, { id: 'userlist_1800000000000' }]
  const before = JSON.stringify(lists)
  assert.deepEqual(sortImportPlaylists(lists).map(l => l.id), [lists[3].id, lists[1].id, 'custom', 'love'])
  assert.deepEqual(sortImportPlaylists(lists, false).map(l => l.id), [lists[1].id, lists[3].id, 'custom', 'love'])
  assert.equal(JSON.stringify(lists), before)
  assert.equal(playlistCreationTime('userlist_1700000000000'), 1700000000000)
  for (const id of ['love', 'default', 'custom_1700000000000', 'userlist_1700000000000_extra', 'userlist_invalid']) assert.equal(playlistCreationTime(id), null)
  assert.deepEqual(sortImportPlaylists([]), [])
})

test('candidate dedupe excludes target songs and shares one song across source playlists without losing membership', () => {
  const lists = [{ id: 'a', listName: '重复名称', songs: [song('old'), song('new'), song('new')] }, { id: 'b', listName: '重复名称', songs: [song('new'), song('new', '晴天', 'Artist', 'kg')] }]
  const before = JSON.stringify(lists)
  const candidates = buildLocalCandidates([song('old')], lists)
  assert.equal(candidates.length, 2)
  assert.deepEqual(candidates[0].fromListIds, ['a', 'b'])
  assert.deepEqual(candidates[1].fromListIds, ['b'])
  assert.equal(filterLocalCandidates(candidates, { id: 'a', name: '重复名称' }, '').length, 1)
  assert.equal(filterLocalCandidates(candidates, { id: 'b', name: '重复名称' }, '').length, 2)
  assert.equal(JSON.stringify(lists), before)
  assert.deepEqual(buildLocalCandidates([], []), [])
})

test('search matches playlist names, song titles and artists, trims spaces, ignores case and stays within playlist IDs', () => {
  const a = { id: 'a', name: '旅行 MIX' }
  const b = { id: 'b', name: '旅行 MIX' }
  const candidates = buildLocalCandidates([], [{ id: a.id, listName: a.name, songs: [song('1'), song('2', '夜曲', 'Jay')] }])
  assert.equal(filterLocalCandidates(candidates, a, '  mix ').length, 2)
  assert.equal(filterLocalCandidates(candidates, a, '晴天')[0].id, 'wy_1')
  assert.equal(filterLocalCandidates(candidates, a, ' jay ')[0].id, 'wy_2')
  assert.equal(filterLocalCandidates(candidates, a, '不存在').length, 0)
  assert.equal(filterLocalCandidates(candidates, b, 'MIX').length, 0)
  assert.equal(filterLocalCandidates(candidates, a, ' ').length, 2)
})

test('import surface uses one four-tab flow with Lux first/default, shared components and keyboard avoidance', () => {
  const flow = read('src/components/playlist/PlaylistImportFlow.tsx')
  const panel = read('src/components/playlist/PlaylistImportPanel.tsx')
  assert.match(flow, /local \? 'lux' : 'text'/)
  assert.match(flow, /id: 'lux'[\s\S]*id: 'text'[\s\S]*id: 'csv'[\s\S]*id: 'platform'/)
  assert.doesNotMatch(flow + panel, /onLocalImport|import_from_local/)
  assert.match(flow, /KeyboardAvoidingView behavior=\{Platform.OS === 'ios' \? 'padding' : 'height'\}/)
  assert.match(panel, /UnderlineInput/)
  assert.match(panel, /props.onToggleSelectAll\(visibleIds\)/)
  assert.match(panel, /accessibilityRole="checkbox"/)
  assert.match(panel, /paddingHorizontal: 22/)
  assert.match(panel, /SecondaryButton compact/)
  for (const lang of ['zh-cn', 'zh-tw', 'en-us']) {
    const strings = JSON.parse(read(`src/lang/${lang}.json`))
    for (const key of ['import_tab_lux', 'import_lux_search', 'import_lux_newest', 'import_lux_oldest', 'import_lux_sort_hint', 'import_lux_done']) assert.ok(strings[key])
    assert.match(strings.import_lux_done, /(?<!\{)\{num\}(?!\})/)
  }
})

const hookHarness = () => {
  let cursor = 0
  const states = []
  const refs = []
  let refCursor = 0
  const messages = []
  const writes = []
  const refreshes = []
  const existing = []
  let fail = false
  let release
  const writeGate = new Promise(resolve => { release = resolve })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial } },
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useEffect: () => {},
  }
  const dependencies = {
    react,
    '@/utils/playlistImport/local': module.exports,
    '@/config/constant': { LIST_IDS: { DEFAULT: 'default' } },
    '@/core/list': {
      getListMusics: async id => id === 'target' ? existing : [song('1'), song('2')],
      addListMusics: async(...args) => { writes.push(args); await writeGate; if (fail) throw Error('failed') },
    },
    '@/lang': { useI18n: () => (key, values) => ({ key, values }) },
    '@/utils/tools': { toast: message => messages.push(message) },
    '@/store/setting/state': { default: { setting: { 'list.addMusicLocationType': 'top' } } },
  }
  const hookModule = { exports: {} }
  const js = ts.transpileModule(read('src/components/playlist/hooks/usePlaylistImport.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => { assert.ok(dependencies[name], name); return dependencies[name] }, hookModule, hookModule.exports)
  const render = () => {
    cursor = 0; refCursor = 0
    return hookModule.exports.usePlaylistImport({ selectedListId: 'target', playlists: [{ id: 'target' }, { id: 'default' }, { id: 'a', name: 'A' }], loadLocalDetailSongs: async id => { refreshes.push(id) } })
  }
  return { render, messages, writes, refreshes, existing, release, setFail: () => { fail = true } }
}

test('local import keeps hidden selections, rechecks target songs, uses configured add location and blocks duplicate submit/close', async() => {
  const h = hookHarness()
  let view = h.render()
  view.setImportCandidates(buildLocalCandidates([], [{ id: 'a', listName: 'A', songs: [song('1'), song('2')] }]))
  view.handleToggleImportSong('wy_1')
  view = h.render()
  view.handleToggleSelectAllImportSongs(['wy_2'])
  view = h.render()
  assert.equal(view.importSelectedCount, 2)
  view.handleToggleSelectAllImportSongs(['wy_2'])
  view = h.render()
  assert.deepEqual(view.importSelectedMap, { wy_1: true })
  view.handleToggleImportSong('wy_2')
  view.setImportDrawerVisible(true)
  h.existing.push(song('1'))
  view = h.render()
  const saving = view.handleImportSelectedSongs()
  await view.handleImportSelectedSongs()
  view.handleCloseImportDrawer()
  assert.equal(h.render().isImportDrawerVisible, true)
  assert.equal(h.render().importSubmitting, true)
  h.release()
  await saving
  assert.equal(h.writes.length, 1)
  assert.deepEqual(h.writes[0], ['target', [song('2')], 'top'])
  assert.deepEqual(h.messages, [{ key: 'import_lux_done', values: { num: 1 } }])
  assert.deepEqual(h.refreshes, ['target'])
  assert.equal(h.render().isImportDrawerVisible, false)
  assert.equal(h.render().importSelectedCount, 0)
})

test('failed local import preserves selections and reports error for retry', async() => {
  const h = hookHarness()
  let view = h.render()
  view.setImportCandidates(buildLocalCandidates([], [{ id: 'a', listName: 'A', songs: [song('1')] }]))
  view.handleToggleImportSong('wy_1')
  view.setImportDrawerVisible(true)
  h.setFail(); h.release()
  view = h.render()
  await view.handleImportSelectedSongs()
  assert.equal(h.render().isImportDrawerVisible, true)
  assert.equal(h.render().importSelectedCount, 1)
  assert.equal(h.render().importSubmitting, false)
  assert.equal(h.messages[0].key, 'import_error')
})
