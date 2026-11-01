/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('vertical progress subscription belongs to the Dock container, below Content and keyboard visibility', () => {
  for (const file of ['index.tsx', 'Content.tsx', 'Main.tsx', 'Tabs/PlaylistTab.tsx']) {
    assert.doesNotMatch(read(`src/screens/Home/Vertical/${file}`), /\buseProgress\b/, file)
  }
  const shell = read('src/screens/Home/Vertical/index.tsx')
  assert.match(shell, /import DockContainer from '\.\/DockContainer'/)
  assert.match(shell, /<DockContainer\s+musicId={musicInfo.id}/)
  assert.ok(shell.indexOf('<Content />') < shell.indexOf('<DockContainer'))
  assert.match(shell, /const hideDock = isDockHidden\(autoHidePlayBar, keyboardShown, keepPlayBarOnKeyboard\)/)
  assert.match(shell, /{hideDock\s*\? null[\s\S]*?<DockContainer/)
  assert.match(shell, /onNavPress={handleNavPress}/)
  assert.match(shell, /onQueuePress={\(\) => { global.app_event.togglePlayQueuePanel\(\) }}/)
  assert.match(shell, /onOpen={showPlayDetail}/)
  const container = read('src/screens/Home/Vertical/DockContainer.tsx')
  assert.equal((container.match(/useProgress\(\)/g) ?? []).length, 1)
  assert.doesNotMatch(container, /\b(Content|Main|PlaylistTab)\b/)
})

test('Dock container normalizes progress and preserves player, layout and navigation props across ticks', () => {
  let progress = 0
  let subscriptions = 0
  const jsx = (type, props) => ({ type, props })
  const deps = {
    'react/jsx-runtime': { jsx },
    '@/components/magazine': { Dock: 'Dock' },
    '@/store/player/hook': { useProgress: () => { subscriptions++; return { progress } } },
  }
  const source = ts.transpileModule(read('src/screens/Home/Vertical/DockContainer.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${source}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, name)
    return deps[name]
  }, module, module.exports)
  const props = { insetBottom: 12, navItems: [], activeNavId: 'nav_love', onNavPress() {}, player: {} }
  for (const [musicId, value, expected] of [
    ['song', 0, 0], ['song', 0.4, 0.4], ['song', 0.9, 0.9],
    ['song', -1, 0], ['song', 2, 1], ['song', NaN, 0], ['song', Infinity, 0], [null, 0.5, 0],
  ]) {
    progress = value
    const tree = module.exports.default({ ...props, musicId })
    assert.equal(tree.type, 'Dock')
    assert.equal(tree.props.progress, expected)
    for (const key of Object.keys(props)) assert.equal(tree.props[key], props[key], key)
    assert.equal('musicId' in tree.props, false)
  }
  assert.equal(subscriptions, 8)
})

test('Main has no retired top bar mount; exclusive components are gone and page search entries remain', () => {
  assert.doesNotMatch(read('src/screens/Home/Vertical/Main.tsx'), /SharedTopBar|sharedTopBarVisible/)
  for (const file of ['src/screens/Home/Vertical/SharedTopBar.tsx', 'src/components/search/GlassSearchField.tsx']) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), false, file)
  }
  for (const file of ['HomeTab', 'PlaylistTab', 'SettingsTab']) {
    assert.match(read(`src/screens/Home/Vertical/Tabs/${file}.tsx`), /MagTopBar/)
  }
  const events = read('src/event/appEvent.ts')
  for (const name of ['openVerticalSearchPage', 'verticalSearchStateUpdated', 'settingsSearchStateUpdated']) {
    assert.ok(events.includes(name), name)
  }
})
