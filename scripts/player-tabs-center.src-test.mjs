/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const chrome = read('src/screens/PlayDetail/Vertical/PlayerChrome.tsx')
const textTabs = read('src/components/magazine/TextTabs.tsx')
const load = (source, modules) => {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in modules, name)
    return modules[name]
  }, module, module.exports)
  return module.exports
}
const jsx = (type, props) => ({ type, props })
const modules = {
  react: { memo: fn => fn, useState: value => [value, () => {}] },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', TouchableOpacity: 'Button', ScrollView: 'ScrollView', useWindowDimensions: () => ({ width: 360 }) },
  '@/components/common/MdiIcon': { MdiIcon: 'Icon' },
  '@/components/common/Text': { default: 'Text' },
  '@/components/magazine': { TextTabs: 'TextTabs' },
  '@/lang': { useI18n: () => key => key },
  '@/store/common/hook': { useStatusbarHeight: () => 24 },
  '@/theme/LuxTheme': { sharedLuxStyles: fn => () => fn({}), useLuxTheme: () => ({ colors: {} }) },
  '@/theme/magazineRoles': { magazineRoles: () => ({ ink: 'ink', quiet: 'quiet' }) },
  '@/theme/magazineType': { PAGE_GUTTER: 22, magType: { tab: { size: 15, lineHeight: 20 }, tabSm: { size: 13, lineHeight: 18 } } },
  '@/utils/pixelRatio': { setSpText: size => size },
  '@/utils/tools': { createStyle: styles => styles },
  './SleepTimerBtn': { default: 'SleepTimer' },
}

test('player chrome centers an independent full-width tab layer at the button row', () => {
  const { PlayerChrome } = load(chrome, modules)
  const changes = []; let backs = 0; let shares = 0
  const tree = PlayerChrome({ page: 'play', onPageChange: id => changes.push(id), onBack: () => backs++, onShare: () => shares++ })
  const [back, layer, actions] = tree.props.children
  assert.equal(tree.props.style[0].justifyContent, 'space-between')
  assert.equal(layer.props.pointerEvents, 'box-none')
  assert.deepEqual(layer.props.style, [{ position: 'absolute', left: 0, right: 0, height: 44, alignItems: 'center', justifyContent: 'center' }, { top: 32 }])
  assert.equal(tree.props.style[1].paddingTop, 32)
  const tabs = layer.props.children.props.children.props
  assert.equal(tabs.small, undefined)
  assert.equal(tabs.style.gap, 20)
  assert.equal(tabs.tabStyle.paddingBottom, 6)
  assert.equal(tabs.labelStyle.lineHeight, 20)
  assert.equal(tabs.value, 'play')
  tabs.onChange('lyric'); assert.deepEqual(changes, ['lyric'])
  const [timer, share] = actions.props.children
  assert.equal(timer.type, 'SleepTimer')
  for (const button of [back, share]) {
    assert.equal(button.props.style.width, 44)
    assert.equal(button.props.style.height, 44)
    assert.equal(button.props.accessibilityRole, 'button')
    assert.ok(button.props.accessibilityLabel)
    button.props.onPress()
  }
  assert.equal(backs, 1); assert.equal(shares, 1)
})

test('page typography override retains tab selection, weight, underline and shared defaults', () => {
  const { TextTabs } = load(textTabs, modules)
  for (const selected of ['comment', 'play', 'lyric']) {
    const changes = []
    const tree = TextTabs({ items: ['comment', 'play', 'lyric'].map(id => ({ id, label: id })), value: selected, onChange: id => changes.push(id), tabStyle: { paddingBottom: 6 }, labelStyle: { lineHeight: 20 } })
    for (const button of tree.props.children) {
      const on = button.props.children.props.children === selected
      assert.equal(button.props.accessibilityRole, 'tab')
      assert.deepEqual(button.props.accessibilityState, { selected: on })
      assert.equal(button.props.children.props.size, 15)
      assert.equal(button.props.children.props.style[0].fontWeight, on ? '800' : '600')
      assert.equal(button.props.children.props.style[1].lineHeight, 20)
      assert.equal(button.props.style[2]?.borderBottomWidth, on ? 3 : undefined)
      button.props.onPress()
    }
    assert.deepEqual(changes, ['comment', 'play', 'lyric'])
  }
  const shared = TextTabs({ items: [{ id: 'x', label: 'X' }], value: 'x', onChange() {}, small: true })
  const button = shared.props.children[0]
  assert.equal(button.props.style[0].paddingBottom, 10)
  assert.equal(button.props.children.props.size, 13)
  assert.equal(button.props.children.props.style[1], undefined)
})

test('horizontal player does not import vertical chrome; pager keeps click/swipe mapping', () => {
  const horizontal = read('src/screens/PlayDetail/Horizontal/index.tsx')
  assert.doesNotMatch(horizontal, /PlayerChrome/)
  const vertical = read('src/screens/PlayDetail/Vertical/index.tsx')
  assert.match(vertical, /onPageChange=\{handlePageChange\}/)
  assert.match(vertical, /onPageSelected=\{onPageSelected\}/)
  assert.doesNotMatch(chrome, /\bsmall\b|tabSm/)
})

const layout = load(read('src/screens/PlayDetail/Vertical/playerChromeLayout.ts'), {})
const budget = { tabsWidth: 130, fullPillWidth: layout.estimateTimerLabelWidth('☾ 23:41', 13) + 23, shareWidth: 44, gutter: 22, minGap: 8, active: true }

test('timer uses full capsule budget at every width, including the exact boundary', () => {
  for (const windowWidth of [360, 411, 430]) {
    assert.equal(layout.shouldCompactSleepTimer({ ...budget, windowWidth }), windowWidth === 360)
    assert.equal(layout.shouldCompactSleepTimer({ ...budget, windowWidth, active: false }), false)
    // The left back button (44 plus gutter) also clears the centered tabs.
    assert.ok(windowWidth / 2 - budget.tabsWidth / 2 >= 44 + 22 + 8)
  }
  const boundary = budget.tabsWidth + 2 * (budget.fullPillWidth + 44 + 22 + 8)
  assert.equal(layout.shouldCompactSleepTimer({ ...budget, windowWidth: boundary }), false)
  assert.equal(layout.shouldCompactSleepTimer({ ...budget, windowWidth: boundary - 1 }), true)
  assert.equal(layout.shouldCompactSleepTimer({ ...budget, windowWidth: 430, tabsWidth: 200 }), true)
  assert.ok(layout.estimateTimerLabelWidth('☾ 1440:00', 13) > layout.estimateTimerLabelWidth('☾ 23:41', 13))
})

test('compact timer keeps countdown accessibility, idle hit area and timer panel access', () => {
  const info = { time: 1421, isPlayedStop: false }
  const visibility = []
  const timerModules = {
    ...modules,
    react: { useState: value => [value, value => visibility.push(value)] },
    '@/core/player/timeoutExit': { useTimeoutExitTimeInfo: () => info },
    '@/core/player/sleepTimerOptions': load(read('src/core/player/sleepTimerOptions.ts'), {}),
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: { ink: { strong: 'ink' } } }) },
    './playerChromeLayout': layout,
    './SleepTimerSheet': { default: 'TimerSheet' },
  }
  const Timer = load(read('src/screens/PlayDetail/Vertical/SleepTimerBtn.tsx'), timerModules).default
  for (const windowWidth of [360, 411, 430, 360]) {
    const tree = Timer({ layout: { ...budget, windowWidth } })
    const [button, sheet] = tree.props.children
    const compact = windowWidth === 360
    assert.equal(button.props.children.type, compact ? 'Icon' : 'Text')
    assert.match(button.props.accessibilityLabel, /23:41/)
    assert.deepEqual(button.props.accessibilityState, { selected: true })
    if (compact) {
      assert.equal(button.props.style[1].width, 28)
      assert.deepEqual(button.props.hitSlop, { top: 8, bottom: 8, left: 8, right: 8 })
    } else assert.equal(button.props.style[1].borderWidth, 1.5)
    button.props.onPress()
    assert.equal(visibility.at(-1), true)
    assert.equal(sheet.props.info, info)
    sheet.props.onClose()
    assert.equal(visibility.at(-1), false)
  }
  info.time = -1
  const idle = Timer({ layout: { ...budget, windowWidth: 360 } }).props.children[0]
  assert.equal(idle.props.style[1].width, 28)
  assert.deepEqual(idle.props.accessibilityState, { selected: false })
  assert.equal(idle.props.accessibilityLabel, 'sleep_timer')
  assert.match(read('src/screens/PlayDetail/Vertical/SleepTimerSheet.tsx'), /figure=\{\{ value: formatSleepTimer/)
})
