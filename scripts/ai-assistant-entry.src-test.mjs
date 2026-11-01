/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const module = { exports: {} }
const js = ts.transpileModule(read('src/utils/aiAssistantEntry.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Script(`(function(exports){${js}\n})`).runInThisContext()(module.exports)
const { isAiAssistantAvailable } = module.exports
const settings = read('src/screens/Home/Vertical/Tabs/SettingsTab.tsx')
const ast = ts.createSourceFile('SettingsTab.tsx', settings, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const effects = []
const visit = node => {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effects.push(node.arguments[0].getText(ast))
  ts.forEachChild(node, visit)
}
visit(ast)
const loadEffect = ts.transpileModule(`(${effects.find(text => text.includes('getSyncMode()'))})()`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const closeEffect = effects.find(text => text.includes('if (!showAiAssistantEntry)'))
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const flush = async() => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
const mount = () => {
  const modeRead = deferred(); const hostRead = deferred()
  const state = { mode: 'lx', host: '', loaded: false }
  const listeners = new Map()
  const app_event = { on: (event, handler) => listeners.set(event, handler), off: event => listeners.delete(event) }
  const cleanup = new Script(loadEffect).runInNewContext({
    global: { app_event }, getSyncMode: () => modeRead.promise, getSyncHost: () => hostRead.promise,
    setSyncModeLocal: mode => { state.mode = mode }, setSyncHostLocal: host => { state.host = host },
    setSyncServerLoaded: loaded => { state.loaded = loaded },
  })
  return { state, listeners, cleanup, modeRead, hostRead, available: () => isAiAssistantAvailable(state.loaded ? state.mode : null, state.host) }
}

test('AI entry uses typed sync format plus configured host; loading, local and LX stay hidden', () => {
  for (const mode of [null, undefined, 'lx', 'lux']) {
    for (const host of [undefined, null, '', '  ', 'https://music.example/base']) {
      assert.equal(isAiAssistantAvailable(mode, host), mode === 'lux' && !!host?.trim())
    }
  }
  // Host names do not determine protocol, and connectivity/session is not a prerequisite.
  assert.equal(isAiAssistantAvailable('lx', 'https://lux.music'), false)
  assert.equal(isAiAssistantAvailable('lux', 'https://lx.music'), true)
})

test('storage loads without flashing, server events refresh eligibility and cleanup removes listeners', async() => {
  const page = mount()
  assert.equal(page.available(), false)
  page.modeRead.resolve('lux'); await flush()
  assert.equal(page.available(), false)
  page.hostRead.resolve('https://music.example'); await flush()
  assert.equal(page.available(), true)
  page.listeners.get('syncModeUpdated')('lx')
  assert.equal(page.available(), false)
  page.listeners.get('syncModeUpdated')('lux')
  assert.equal(page.available(), true)
  page.listeners.get('syncHostUpdated')('')
  assert.equal(page.available(), false)
  page.listeners.get('syncHostUpdated')('https://other.example')
  assert.equal(page.available(), true)
  page.cleanup()
  assert.equal(page.listeners.size, 0)
})

test('new server events win over delayed initial reads and unmount ignores storage results', async() => {
  const page = mount()
  page.listeners.get('syncModeUpdated')('lx')
  page.listeners.get('syncHostUpdated')('')
  page.modeRead.resolve('lux'); page.hostRead.resolve('https://old.example'); await flush()
  assert.equal(page.state.mode, 'lx')
  assert.equal(page.state.host, '')
  assert.equal(page.available(), false)
  const unmounted = mount()
  unmounted.cleanup()
  unmounted.modeRead.resolve('lux'); unmounted.hostRead.resolve('https://old.example'); await flush()
  assert.equal(unmounted.state.loaded, false)
})

test('losing eligibility resets the open page and retains the shared animated SettingsPage host', () => {
  for (const showAiAssistantEntry of [true, false]) {
    let visible = true
    new Script(`(${closeEffect})()`).runInNewContext({ showAiAssistantEntry, setAiTokensVisible: value => { visible = value } })
    assert.equal(visible, showAiAssistantEntry)
  }
  assert.match(settings, /<SettingsPage visible=\{aiTokensVisible && showAiAssistantEntry\}/)
  assert.match(settings, /\{showAiAssistantEntry\s*\? \(\s*<SettingRow[^>]*title=\{t\('ai_tokens_title'\)\}/)
  assert.match(settings, /showAiAssistantEntry \? t\('ai_tokens_entry_subtitle'\) : null/)
  assert.match(read('src/utils/data.ts'), /await saveData\(syncHostPrefix, syncHostInfo\)\s*global\.app_event\?\.syncHostUpdated\(host\)/)
})

const initializer = name => {
  let expression
  const find = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.getText(ast)
    ts.forEachChild(node, find)
  }
  find(ast)
  assert.ok(expression, name)
  return expression
}
const diagnosticGate = initializer('showTogetherDebugSection')
const diagnosticsAvailable = (page, build = true) => new Script(diagnosticGate).runInNewContext({
  showAiAssistantEntry: page.available(), isTogetherDebugPanelBuild: () => build,
})

test('diagnostic rows reuse AI eligibility, wait for configuration and react to server changes', async() => {
  assert.equal(diagnosticGate, 'showAiAssistantEntry && isTogetherDebugPanelBuild()')
  const page = mount()
  assert.equal(diagnosticsAvailable(page), false)
  page.hostRead.resolve('https://music.example'); await flush()
  assert.equal(diagnosticsAvailable(page), false)
  page.modeRead.resolve('lux'); await flush()
  assert.equal(diagnosticsAvailable(page), true)
  assert.equal(diagnosticsAvailable(page, false), false)
  for (const [event, value, expected] of [
    ['syncModeUpdated', 'lx', false], ['syncModeUpdated', 'lux', true],
    ['syncHostUpdated', '', false], ['syncHostUpdated', '   ', false],
    ['syncHostUpdated', 'https://other.example', true],
  ]) {
    page.listeners.get(event)(value)
    assert.equal(diagnosticsAvailable(page), expected)
  }
  page.cleanup()
})

test('diagnostic searches exclude both groups when hidden and include copy in the debug group', () => {
  const search = (name, visible, query) => new Script(initializer(name)).runInNewContext({
    showTogetherDebugSection: visible, showAiAssistantEntry: false,
    t: key => key, activeSyncStatusLabel: '', resourceCacheSizeLabel: '',
    matchesSettingsSearch: (...values) => values.some(value => value?.includes(query)),
  })
  for (const query of ['together_debug_panel_toggle', 'together_debug_panel_toggle_desc', 'together_readiness_copy_settings', 'setting_debug_section']) {
    for (const group of ['showDataSection', 'showTogetherDebugSettingsSection']) {
      assert.equal(search(group, false, query), false, `${group}: hidden ${query}`)
      assert.equal(search(group, true, query), true, `${group}: visible ${query}`)
    }
  }
  assert.equal(search('showDataSection', false, 'setting_cache_management'), true)
})

const groupExpressions = new Map()
const findGroups = node => {
  if (ts.isConditionalExpression(node) && ['showDataSection', 'showTogetherDebugSettingsSection'].includes(node.condition.getText(ast))) {
    groupExpressions.set(node.condition.getText(ast), node.getText(ast))
  }
  ts.forEachChild(node, findGroups)
}
findGroups(ast)
const renderGroup = (name, visible) => {
  const expression = groupExpressions.get(name)
  assert.ok(expression, name)
  const context = {
    React: { createElement: (type, props, ...children) => ({ type, props, children }), Fragment: 'Fragment' },
    View: 'View', SectionHeader: 'SectionHeader', SettingRow: 'SettingRow',
    styles: {}, r: { iconWrap: {} }, t: key => key,
    SETTINGS_SECTION_GAP: 22, SETTINGS_SECTION_HEAD_GAP: 6,
    showDataSection: true, showTogetherDebugSettingsSection: visible,
    showAiAssistantEntry: false, showAdminConsoleEntry: false, showTogetherDebugSection: visible,
    syncHost: '', syncMode: 'lx', togetherDebugPanelEnabled: true, resourceCacheSizeLabel: '',
  }
  for (const handler of expression.matchAll(/\bhandle\w+/g)) context[handler[0]] = () => {}
  const js = ts.transpileModule(`(${expression})`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText
  return new Script(js).runInNewContext(context)
}
const rows = node => !node || typeof node !== 'object' ? [] : [
  ...(node.type === 'SettingRow' ? [node.props] : []), ...node.children.flatMap(rows),
]

test('both diagnostic row copies unmount together without empty rows; remaining data rows keep their last marker', () => {
  const hidden = rows(renderGroup('showDataSection', false))
  assert.deepEqual(hidden.map(row => row.title), [
    'sync_state_address_format', 'setting_sync_clear_conflict_mode', 'setting_cache_management', 'setting_export_data', 'setting_import_data',
  ])
  assert.equal(hidden.at(-1).last, true)
  assert.equal(hidden.slice(0, -1).every(row => !row.last), true)
  const shown = rows(renderGroup('showDataSection', true))
  assert.equal(shown.length, hidden.length + 2)
  assert.equal(shown.find(row => row.title === 'together_debug_panel_toggle').value, 'together_debug_on')
  assert.equal(renderGroup('showTogetherDebugSettingsSection', false), null)
  const debug = rows(renderGroup('showTogetherDebugSettingsSection', true))
  assert.deepEqual(debug.map(row => row.title), ['together_debug_panel_toggle', 'together_readiness_copy_settings'])
  assert.equal(debug.at(-1).last, true)
})
