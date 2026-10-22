/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (path, imports = {}) => {
  const source = ts.transpileModule(readFileSync(join(root, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports) {${source}\n})`, { filename: path }).runInThisContext()(name => {
    assert.ok(name in imports, `unexpected import ${name}`)
    return imports[name]
  }, module, module.exports)
  return module.exports
}
const feedModel = load('src/core/together/roomFeed.ts')
const ui = load('src/core/together/roomUi.ts')

test('room layout defaults to 6A for missing, corrupt and legacy settings', () => {
  const defaults = load('src/config/defaultSetting.ts')
  // Resolver is also used at the settings selector and room render boundary.
  for (const value of [undefined, null, '', '6a', 'stream', 0, {}]) assert.equal(feedModel.resolveTogetherLayout(value), '6A')
  assert.equal(feedModel.resolveTogetherLayout('6A'), '6A')
  assert.equal(feedModel.resolveTogetherLayout('6B'), '6B')
  assert.equal(defaults.default['together.roomLayout'], '6A')
})

test('floating reactions are bounded, deduplicated and expire using local receipt time', () => {
  const entries = Array.from({ length: 100 }, (_, index) => ({ id: String(index), reaction: { emoji: '👍', at: 99999999999 } }))
  const queue = ui.appendFloatingReactions([], entries, 100)
  assert.equal(queue.length, ui.FLOATING_REACTION_LIMIT)
  assert.equal(queue[0].id, '88')
  assert.deepEqual(ui.appendFloatingReactions(queue, entries.slice(-12), 200), queue)
  assert.equal(ui.expireFloatingReactions(queue, 100 + ui.FLOATING_REACTION_TTL - 1).length, 12)
  assert.deepEqual(ui.expireFloatingReactions(queue, 100 + ui.FLOATING_REACTION_TTL), [])
})

test('closed, unsupported and departed room request sheets never mount', () => {
  for (const open of [true, false]) for (const supported of [true, false]) for (const roomId of ['room', null]) {
    assert.equal(ui.shouldMountRequestSheet(open, supported, roomId), Boolean(open && supported && roomId))
  }
})

test('capability negotiation removes unsupported room tabs', () => {
  assert.deepEqual(ui.roomUiTabs({ capabilities: {} }), ['members'])
  assert.deepEqual(ui.roomUiTabs({ capabilities: { chat: true } }), ['chat', 'members'])
  assert.deepEqual(ui.roomUiTabs({ capabilities: { requests: true } }), ['requests', 'members'])
  assert.deepEqual(ui.roomUiTabs({ capabilities: { reactions: true, requests: true } }), ['chat', 'requests', 'members'])
})

test('request reordering preserves every ID and handles invalid drag positions', () => {
  const ids = ['a', 'b', 'c']
  assert.deepEqual(ui.reorderRequestIds(ids, 2, 0), ['c', 'a', 'b'])
  assert.deepEqual(ui.reorderRequestIds(ids, 0, 2), ['b', 'c', 'a'])
  assert.equal(ui.reorderRequestIds(ids, -1, 2), ids)
  assert.equal(ui.reorderRequestIds(ids, 0, 3), ids)
  assert.deepEqual(ids, ['a', 'b', 'c'])
})

const element = (type, props) => ({ type, props })
const flatten = tree => !tree || typeof tree != 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(flatten)]
const renderRoom = (layout, capabilities) => {
  const component = load('src/screens/Home/Vertical/ListenTogether/RoomFeedView.tsx', {
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [typeof value == 'function' ? value() : value, () => {}] },
    'react-native': { Animated: { Value: class {} }, Easing: {}, ScrollView: 'ScrollView', View: 'View' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/Image': { default: 'Image' },
    '@/components/magazine': Object.fromEntries(['PrimaryButton', 'SecondaryButton', 'SectionHeader', 'TextButton', 'TextTabs', 'UnderlineInput'].map(name => [name, name])),
    '@/core/together/roomFeed': feedModel,
    '@/core/together/roomUi': ui,
    '@/lang': { useI18n: () => key => key },
    '@/store/setting/hook': { useSettingValue: () => layout },
    '@/store/together/roomFeed': { togetherRoomFeed: {} },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: () => () => ({}) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': {},
  }).default
  return flatten(component({ feed: { entries: [], capabilities, members: [], pendingRequests: [], hasMore: false, roomId: 'room' }, selfId: 'self', hostId: 'self', header: () => null, members: null, topInset: 24, bottomInset: 122, onRequests() {} }))
}

test('6A renders only negotiated tabs; 6B hides unsupported composer and reactions', () => {
  const unsupported = renderRoom('6A', {})
  assert.deepEqual(unsupported.find(node => node.type == 'TextTabs').props.items.map(item => item.id), ['members'])
  for (const layout of ['6A', '6B']) {
    const nodes = renderRoom(layout, {})
    assert.equal(nodes.some(node => node.type == 'UnderlineInput'), false)
    assert.equal(nodes.some(node => node.type == 'SecondaryButton'), false)
  }
  const supported = renderRoom('6A', { chat: true, reactions: true, requests: true })
  assert.deepEqual(supported.find(node => node.type == 'TextTabs').props.items.map(item => item.id), ['chat', 'requests', 'members'])
  assert.equal(supported.filter(node => node.type == 'SecondaryButton').length, 4)
  const stream = renderRoom('6B', { chat: true, reactions: true, requests: true })
  assert.equal(stream.some(node => node.type == 'TextTabs'), false)
  assert.equal(stream.some(node => node.type == 'UnderlineInput'), true)
  const floating = stream.find(node => node.props.pointerEvents == 'none' && node.props.style?.height == 180)
  assert.ok(floating)
  assert.equal(floating.props.style.overflow, 'hidden')
  assert.ok(floating.props.style.bottom >= 122)
})
