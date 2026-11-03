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
  for (const open of [true, false]) {
    for (const supported of [true, false]) {
      for (const roomId of ['room', null]) {
        assert.equal(ui.shouldMountRequestSheet(open, supported, roomId), Boolean(open && supported && roomId))
      }
    }
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
const renderRoom = (layout, capabilities, overrides = {}, actions = {}) => {
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
    '@/store/together/roomFeed': { togetherRoomFeed: actions },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: () => () => ({}) },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': {},
  }).default
  return flatten(component({ feed: { entries: [], capabilities, members: [], pendingRequests: [], hasMore: false, roomId: 'room', ...overrides }, selfId: 'self', hostId: 'self', header: () => null, members: null, topInset: 24, bottomInset: 122, onRequests() {} }))
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

const sharedImports = {
  'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
  react: { memo: component => component, useEffect() {}, useMemo: factory => factory(), useRef: value => ({ current: value }), useState: value => [value, () => {}] },
  'react-native': {
    Animated: { Value: class { interpolate() { return 0 } }, View: 'Animated.View' },
    Easing: { out: value => value, cubic: 'cubic' },
    Keyboard: {},
    Modal: 'Modal',
    Platform: { OS: 'android' },
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
    useWindowDimensions: () => ({ height: 844 }),
  },
  '@/components/common/Text': { default: 'Text' },
  '@/components/common/MdiIcon': { MdiIcon: 'MdiIcon' },
  '@/lang': { useI18n: () => key => key },
  '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: factory => () => factory({}) },
  '@/theme/magazineRoles': { magazineRoles: () => ({}) },
  '@/theme/magazineType': load('src/theme/magazineType.ts'),
  '@/utils/tools': { createStyle: value => value },
}
const renderSheet = props => load('src/components/magazine/MagazineSheet.tsx', {
  ...sharedImports,
  './EmptyState': { EmptyState: 'EmptyState' },
  './Hairline': { Hairline: 'Hairline' },
  './PrimaryButton': { PrimaryButton: 'PrimaryButton' },
  './TextButton': { TextButton: 'TextButton' },
}).MagazineSheet({ visible: true, title: 'Queue', onClose() {}, ...props })
const styleOf = node => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean))

test('MagazineSheet keeps existing Modal geometry and dismissal unless inline inset is explicitly supplied', () => {
  let closed = 0
  const modal = renderSheet({ onClose: () => { closed++ } })
  assert.equal(modal.type, 'Modal')
  assert.equal(modal.props.transparent, true)
  assert.equal(modal.props.animationType, 'none')
  modal.props.onRequestClose()
  assert.equal(closed, 1)
  const panel = flatten(modal).find(node => node.type == 'Animated.View' && styleOf(node).height)
  assert.equal(styleOf(panel).height, Math.floor(844 * 0.78))
  assert.equal(styleOf(panel).maxHeight, undefined)
  assert.equal(styleOf(modal.props.children).position, undefined)
  for (const inset of [0, 122, 156]) {
    const inline = renderSheet({ inlineBottomInset: inset })
    assert.equal(flatten(inline).some(node => node.type == 'Modal'), false)
    assert.equal(styleOf(inline).bottom, inset)
    assert.equal(styleOf(inline).position, 'absolute')
    const inlinePanel = flatten(inline).find(node => node.type == 'Animated.View' && styleOf(node).height)
    assert.equal(styleOf(inlinePanel).maxHeight, '100%')
  }
  assert.equal(renderSheet({ visible: false }), null)
})

test('shared buttons default accessibilityLabel to visible label and allow explicit icon labels', () => {
  for (const name of ['PrimaryButton', 'TextButton']) {
    const Button = load(`src/components/magazine/${name}.tsx`, sharedImports)[name]
    assert.equal(Button({ label: 'Send' }).props.accessibilityLabel, 'Send')
    assert.equal(Button({ label: '×', accessibilityLabel: 'Remove request' }).props.accessibilityLabel, 'Remove request')
  }
})

test('SearchPage selection routes to request picking only when supplied; normal song play stays unchanged', async() => {
  const source = ts.createSourceFile('SearchPage.tsx', readFileSync(join(root, 'src/screens/Home/Vertical/SearchPage.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let initializer
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) == 'handlePlaySearchSong') initializer = node.initializer.getText(source)
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(initializer)
  // Execute the production callback, keeping React and unrelated screen dependencies out of this unit test.
  const callbackSource = ts.transpileModule(`(function(useCallback, onSelectSong, addMusicToQueueAndPlay, handleClose = () => {}) { return ${initializer} })`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  const callback = new Script(callbackSource).runInThisContext()
  const song = { id: 'song' }
  const played = []
  const picked = []
  const useCallback = fn => fn
  await callback(useCallback, undefined, async item => { played.push(item) })(song)
  await callback(useCallback, async item => { picked.push(item) }, async item => { played.push(item) })(song)
  assert.deepEqual(played, [song])
  assert.deepEqual(picked, [song])
  let closed = 0
  await callback(useCallback, async() => false, async item => { played.push(item) }, () => { closed++ })(song)
  assert.equal(closed, 0, 'failed selection retains the search page')
  await callback(useCallback, async() => true, async item => { played.push(item) }, () => { closed++ })(song)
  assert.equal(closed, 1, 'successful selection uses animated handleClose')
  await assert.rejects(callback(useCallback, async() => { throw new Error('request failed') }, async item => { played.push(item) })(song), /request failed/)
  assert.deepEqual(played, [song])
})


const request = (id, memberId = 'self') => ({ id, song: { name: id, singer: 'Artist', meta: {} }, requestedBy: { memberId, displayName: memberId } })

test('6B renders requests once in the timeline and pins with raw request IDs', () => {
  const first = request('first')
  const second = request('second')
  const calls = []
  const nodes = renderRoom('6B', { requests: true }, {
    pendingRequests: [first, second],
    entries: [first, second].map(item => ({ id: `request:${item.id}`, kind: 'request', request: item, status: 'pending' })),
  }, { reorderRequests: async ids => { calls.push(ids); return true } })
  assert.equal(nodes.filter(node => node.type == 'Text' && node.props.children == 'together_requested_song').length, 2)
  const pins = nodes.filter(node => node.type == 'SecondaryButton' && node.props.label == 'together_request_top')
  assert.equal(pins.length, 2)
  pins[1].props.onPress()
  assert.deepEqual(calls, [['second', 'first']])
})

const renderRequests = (selfId, requests) => {
  const component = load('src/screens/Home/Vertical/ListenTogether/RequestSheet.tsx', {
    ...sharedImports,
    'react-native': { ...sharedImports['react-native'], ScrollView: 'ScrollView' },
    '@/components/common/Image': { default: 'Image' },
    '@/components/magazine': { MagazineSheet: 'MagazineSheet', SecondaryButton: 'SecondaryButton', TextButton: 'TextButton' },
    '@/core/together/roomFeed': feedModel,
    '@/core/together/roomUi': ui,
    '@/store/together/roomFeed': { togetherRoomFeed: {} },
    '@/utils/hooks/useBackHandler': { useBackHandler() {} },
    './RoomFeedView': { performRoomAction: async action => action() },
  }).default
  return flatten(component({ feed: { capabilities: { requests: true }, pendingRequests: requests, entries: [], playbackQueue: [] }, selfId, hostId: 'host', bottomInset: 156, onClose() {}, onPickSong() {} }))
}

test('6C keeps Dock inset, queue figures, host controls, ownership and protocol limits', () => {
  const requests = [request('one', 'host'), request('two', 'member')]
  const host = renderRequests('host', requests)
  const sheet = host.find(node => node.type == 'MagazineSheet')
  assert.equal(sheet.props.inlineBottomInset, 156)
  assert.equal(sheet.props.figure.value, '2')
  assert.equal(host.filter(node => node.type == 'TextButton').length, 2)
  assert.equal(host.filter(node => typeof node.type == 'function' && node.type.name == 'DragHandle').length, 2)
  assert.equal(host.filter(node => node.type == 'SecondaryButton').length, 1)
  const member = renderRequests('member', requests)
  assert.equal(member.filter(node => node.type == 'TextButton').length, 1)
  assert.equal(member.some(node => typeof node.type == 'function' && node.type.name == 'DragHandle'), false)
  assert.equal(member.some(node => node.type == 'SecondaryButton'), false)
  const capped = renderRequests('member', [request('one', 'member'), request('two', 'member'), request('three', 'member')])
  assert.equal(capped.find(node => node.type == 'MagazineSheet').props.headerAction.disabled, true)
})
