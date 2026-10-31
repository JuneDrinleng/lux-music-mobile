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
