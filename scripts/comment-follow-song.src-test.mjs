/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Script } from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const flush = () => new Promise(resolve => setImmediate(resolve))
const load = (file, modules, globals = {}, source = read(file)) => {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  const names = Object.keys(globals)
  new Script(`(function(require,module,exports,${names.join(',')}){${js}\n})`).runInThisContext()(
    name => { assert.ok(name in modules, name); return modules[name] }, module, module.exports, ...Object.values(globals),
  )
  return module.exports
}

// Run the production hooks, retaining refs/state and committing effects only after
// render-phase state updates have settled, as React does before painting children.
function hookRuntime() {
  let current
  const effects = { layout: [], passive: [] }
  const instance = () => ({ slots: [], cursor: 0, dirty: false })
  const effect = kind => (fn, deps) => {
    const owner = current
    const index = owner.cursor++
    const previous = owner.slots[index]
    if (previous && deps?.length === previous.deps?.length && deps.every((value, i) => Object.is(value, previous.deps[i]))) return
    owner.pending[kind].push(() => {
      previous?.cleanup?.()
      owner.slots[index] = { deps, cleanup: fn() }
    })
  }
  const react = {
    memo: fn => fn,
    useState(initial) {
      const owner = current
      const index = owner.cursor++
      owner.slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [owner.slots[index].value, next => {
        const value = typeof next === 'function' ? next(owner.slots[index].value) : next
        if (Object.is(value, owner.slots[index].value)) return
        owner.slots[index].value = value
        owner.dirty = true
      }]
    },
    useRef(value) { const index = current.cursor++; return current.slots[index] ??= { current: value } },
    useMemo(fn, deps) {
      const index = current.cursor++
      const previous = current.slots[index]
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) current.slots[index] = { deps, value: fn() }
      return current.slots[index].value
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps) },
    useLayoutEffect: effect('layout'),
    useEffect: effect('passive'),
  }
  return {
    react, instance,
    render(owner, fn) {
      for (let attempt = 0; attempt < 25; attempt++) {
        current = owner
        owner.cursor = 0
        owner.dirty = false
        owner.pending = { layout: [], passive: [] }
        const result = fn()
        if (owner.dirty) continue
        effects.layout.push(...owner.pending.layout)
        effects.passive.push(...owner.pending.passive)
        return result
      }
      assert.fail('render-phase updates did not settle')
    },
    commit() {
      for (const kind of ['layout', 'passive']) {
        const pending = effects[kind].splice(0)
        for (const run of pending) run()
      }
    },
    unmount(owner) { for (const slot of owner.slots) slot?.cleanup?.() },
  }
}

const song = (id, source = 'wy') => ({
  source, id, name: `song ${id}`, singer: `singer ${id}`,
  meta: { picUrl: `cover ${source}:${id}` },
})
const response = (id, total = 45) => ({ comments: [{ id }], total, maxPage: 3 })

function fixture() {
  const runtime = hookRuntime()
  const owner = runtime.instance()
  const playerState = { playMusicInfo: { musicInfo: song('one') }, musicInfo: { id: 'one', pic: 'cover wy:one' } }
  let playerMusicInfo = playerState.musicInfo
  const requests = []; const snapshots = []; const timers = new Map(); const children = new Map()
  let timerId = 0; let result; let activeId = 'hot'; let options = { embedded: true, active: true, refreshKey: 0 }
  const modules = {
    react: runtime.react,
    '@/store/player/state': { default: playerState, __esModule: true },
    '@/store/player/hook': {
      usePlayerMusicInfo: () => playerMusicInfo,
      usePlayMusicInfo: () => playerState.playMusicInfo,
    },
    '@/utils/musicSdk': { default: { wy: { comment: {} }, kw: { comment: {} } }, __esModule: true },
    './utils': { filterList: items => [...new Map(items.map(item => [item.id, item])).values()] },
  }
  // Evaluate the real lazy wrappers without loading the unrelated visual shell.
  const component = ts.createSourceFile('index.tsx', read('src/screens/Comment/index.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const printer = ts.createPrinter()
  const wrappers = component.statements.filter(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => ['HotCommentPage', 'NewCommentPage'].includes(declaration.name.getText(component))))
  assert.equal(wrappers.length, 2)
  const wrapperSource = `import { memo, useRef } from 'react'\nimport CommentHot from './CommentHot'\nimport CommentNew from './CommentNew'\n${wrappers.map(statement => printer.printNode(ts.EmitHint.Unspecified, statement, component)).join('\n')}\nexport { HotCommentPage, NewCommentPage }`
  const wrapperModules = {
    react: runtime.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    './CommentHot': { default: 'hot', __esModule: true },
    './CommentNew': { default: 'new', __esModule: true },
  }
  const pages = load('src/screens/Comment/index.tsx', wrapperModules, {}, wrapperSource)
  const wrappersByKind = { hot: runtime.instance(), new: runtime.instance() }
  const useSong = load('src/screens/Comment/useCommentMusicInfo.ts', modules).default
  const useLoad = load('src/screens/Comment/useCommentLoad.ts', modules, {
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id },
    clearTimeout(id) { timers.delete(id) },
  }).default
  const getChild = kind => {
    if (!children.has(kind)) {
      const child = { owner: runtime.instance(), list: [], status: undefined, writes: [] }
      child.api = {
        setList(value) { child.list = value; child.writes.push(value) },
        getList: () => child.list,
        setStatus(value) { child.status = value },
      }
      child.fetch = (musicInfo, page, limit) => new Promise((resolve, reject) => {
        requests.push({ musicInfo, kind, page, limit, resolve, reject })
      })
      children.set(kind, child)
    }
    return children.get(kind)
  }
  const render = next => {
    options = { ...options, ...next }
    for (let commit = 0; commit < 25; commit++) {
      result = runtime.render(owner, () => useSong(options))
      if (result.musicInfo?.source === 'local' || !result.musicInfo) {
        for (const child of children.values()) runtime.unmount(child.owner)
        children.clear()
      } else {
        for (const kind of ['hot', 'new']) {
          const Wrapper = kind === 'hot' ? pages.HotCommentPage : pages.NewCommentPage
          const props = {
            active: !options.embedded || options.active,
            activeId,
            musicInfo: result.musicInfo,
            onUpdateTotal: kind === 'hot' ? result.setHotTotal : result.setNewTotal,
            refreshKey: result.combinedRefreshKey,
          }
          const childElement = runtime.render(wrappersByKind[kind], () => Wrapper(props))
          if (!childElement) continue
          const child = getChild(kind)
          child.result = runtime.render(child.owner, () => useLoad(childElement.props, child.fetch))
          child.result.listRef.current = child.api
        }
      }
      runtime.commit()
      snapshots.push({ musicInfo: result.musicInfo, pic: result.pic, total: { ...result.total } })
      if (!owner.dirty) return result
    }
    assert.fail('effect updates did not settle')
  }
  return {
    render, requests, snapshots, children, timers,
    setPlayer(next, pic = next?.meta?.picUrl ?? '') {
      playerState.playMusicInfo.musicInfo = next
      playerState.musicInfo = { id: next?.id, pic }
      playerMusicInfo = playerState.musicInfo
    },
    async settle() { await flush(); return render() },
    tick() { const pending = [...timers.values()]; timers.clear(); for (const run of pending) run(); return render() },
    visitNew() { activeId = 'new'; return render() },
    refresh() { result.refreshComment(); return render() },
    get value() { return result },
    get hot() { return children.get('hot') },
    unmount() { runtime.unmount(owner); for (const child of children.values()) runtime.unmount(child.owner) },
  }
}

test('visible comments retain their song, cover, counts and list when playback advances', async() => {
  const f = fixture(); f.render()
  f.requests[0].resolve(response('one hot', 72)); await f.settle(); f.tick(); f.tick()
  const original = f.hot
  f.setPlayer(song('two'))
  f.render()
  assert.equal(f.value.musicInfo.id, 'one')
  assert.equal(f.value.pic, 'cover wy:one')
  assert.deepEqual(f.value.total, { hot: 72, new: 0 })
  assert.deepEqual(f.hot.list, [{ id: 'one hot' }])
  assert.equal(f.hot, original)
  assert.equal(f.requests.length, 1)
  // Metadata-only updates and source changes also cannot retarget a visible page.
  f.setPlayer(song('two', 'kw')); f.render()
  assert.equal(f.value.musicInfo.source, 'wy')
  assert.equal(f.requests.length, 1)
})

test('a song without metadata cover captures its resolved player cover before playback changes', () => {
  const f = fixture()
  const noCover = { ...song('one'), meta: { picUrl: '' } }
  f.setPlayer(noCover, null)
  f.render()
  assert.equal(f.value.pic, null)
  f.setPlayer(noCover, 'resolved cover one'); f.render()
  assert.equal(f.value.pic, 'resolved cover one')
  f.setPlayer(song('two'), 'resolved cover two'); f.render()
  assert.equal(f.value.pic, 'resolved cover one')
  assert.equal(f.value.musicInfo.id, 'one')
  assert.equal(f.requests.length, 1)
})

test('entering a song without a cover cannot borrow a late metadata cover from the old song', () => {
  const f = fixture()
  const oldSong = { ...song('one'), meta: { picUrl: null } }
  f.setPlayer(oldSong, null); f.render()
  f.render({ active: false })
  oldSong.meta.picUrl = 'late old cover'
  f.setPlayer({ ...song('two'), meta: { picUrl: null } }, null)
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.value.musicInfo.id, 'two')
  assert.equal(f.value.pic, null)
})

test('embedded comments receive visibility without changing the player or lyric active contracts', () => {
  const vertical = read('src/screens/PlayDetail/Vertical/index.tsx')
  assert.match(vertical, /<Comment embedded active=\{active && wasActiveRef\.current && pageIndex === 0\}/)
  assert.ok(vertical.includes('active={active && pageIndex === 1}'))
  assert.ok(vertical.includes('active={active && pageIndex === 2}'))
  const component = read('src/screens/Comment/index.tsx')
  assert.ok(component.includes('useCommentMusicInfo({ embedded, active, refreshKey })'))
  assert.ok(component.includes('<Image style={styles.cover} url={pic} />'))
  assert.doesNotMatch(component, /<(?:Hot|New)CommentPage\s[^>]*\bkey=/)
})

test('hidden playback changes make no requests; returning changes key and zeros totals together once', async() => {
  const f = fixture(); f.render()
  f.requests[0].resolve(response('one hot', 72)); await f.settle(); f.tick(); f.tick()
  f.visitNew()
  f.requests[1].resolve(response('one new', 93)); await f.settle(); f.tick(); f.tick()
  const originalHot = f.hot
  const originalNew = f.children.get('new')
  f.render({ active: false })
  f.setPlayer(song('two')); f.render()
  f.setPlayer(song('three', 'kw')); f.render()
  assert.equal(f.requests.length, 2)
  assert.equal(f.value.musicInfo.id, 'one')
  assert.deepEqual(f.value.total, { hot: 72, new: 93 })
  const firstReturn = f.snapshots.length
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.requests.length, 4) // one initial request per already-mounted tab
  assert.deepEqual(f.requests.slice(2).map(r => [r.kind, r.musicInfo.source, r.musicInfo.id, r.page]), [
    ['hot', 'kw', 'three', 1], ['new', 'kw', 'three', 1],
  ])
  assert.deepEqual(f.value.total, { hot: 0, new: 0 })
  assert.deepEqual(f.hot.list, [])
  assert.deepEqual(f.children.get('new').list, [])
  assert.equal(f.hot.status, 'loading')
  assert.equal(f.hot, originalHot)
  assert.equal(f.children.get('new'), originalNew)
  for (const snapshot of f.snapshots.slice(firstReturn)) {
    assert.equal(snapshot.musicInfo.id, 'three')
    assert.deepEqual(snapshot.total, { hot: 0, new: 0 })
  }
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.requests.length, 4)
})

test('a previously hidden unvisited page waits for visibility before its only initial request', () => {
  const f = fixture()
  f.render({ active: false })
  f.setPlayer(song('two')); f.render()
  assert.equal(f.requests.length, 0)
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].musicInfo.id, 'two')
})

test('returning to the same source/id keeps counts and list while retaining silent refresh', async() => {
  const f = fixture(); f.render()
  f.requests[0].resolve(response('one hot', 72)); await f.settle(); f.tick(); f.tick()
  f.render({ active: false })
  f.setPlayer({ ...song('one'), name: 'new metadata' }); f.render()
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.requests.length, 2)
  assert.equal(f.hot.status, 'idle')
  assert.deepEqual(f.hot.list, [{ id: 'one hot' }])
  assert.deepEqual(f.value.total, { hot: 72, new: 0 })
})

test('source participates in song identity even when ids match', () => {
  const f = fixture(); f.render()
  f.render({ active: false })
  f.setPlayer(song('one', 'kw')); f.render()
  assert.equal(f.requests.length, 1)
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.value.musicInfo.source, 'kw')
  assert.equal(f.requests.length, 2)
  assert.equal(f.requests[1].musicInfo.source, 'kw')
})

test('late requests cannot write totals, rows or loading state after changing comments, including A-B-A', async() => {
  const f = fixture(); f.render()
  f.render({ active: false })
  f.setPlayer(song('two')); f.render()
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.requests.length, 2)
  f.render({ active: false })
  f.setPlayer(song('one')); f.render()
  f.render({ active: true, refreshKey: 2 })
  assert.equal(f.requests.length, 3)
  const writes = f.hot.writes.length
  f.requests[0].resolve(response('stale one', 500))
  f.requests[1].reject(new Error('stale two'))
  await f.settle(); f.tick(); f.tick()
  assert.deepEqual(f.value.total, { hot: 0, new: 0 })
  assert.deepEqual(f.hot.list, [])
  assert.equal(f.hot.status, 'loading')
  assert.equal(f.hot.writes.length, writes)
  f.requests[2].resolve(response('current one', 17)); await f.settle(); f.tick(); f.tick()
  assert.deepEqual(f.hot.list, [{ id: 'current one' }])
  assert.deepEqual(f.value.total, { hot: 17, new: 0 })
})

test('refresh explicitly follows playback while local songs retain the unsupported path', async() => {
  const f = fixture(); f.render()
  f.requests[0].resolve(response('one hot', 72)); await f.settle(); f.tick(); f.tick()
  f.setPlayer(song('two'))
  f.refresh()
  assert.equal(f.value.musicInfo.id, 'two')
  assert.deepEqual(f.value.total, { hot: 0, new: 0 })
  assert.equal(f.requests.length, 2)
  f.render({ active: false })
  f.setPlayer(song('local-file', 'local')); f.render()
  assert.equal(f.requests.length, 2)
  f.render({ active: true, refreshKey: 1 })
  assert.equal(f.value.musicInfo.source, 'local')
  assert.deepEqual(f.value.total, { hot: 0, new: 0 })
  assert.equal(f.children.size, 0)
  assert.equal(f.requests.length, 2)
  f.requests[1].resolve(response('late online', 999)); await f.settle()
  assert.deepEqual(f.value.total, { hot: 0, new: 0 })
  assert.equal(f.timers.size, 0)
  const component = read('src/screens/Comment/index.tsx')
  assert.match(component, /musicInfo\.source\s*={2,3}\s*'local'/)
  assert.ok(component.includes("t('comment_not support')"))
})

test('standalone comments do not automatically follow the player and their refresh button still does', async() => {
  const f = fixture(); f.render({ embedded: false, active: true })
  f.requests[0].resolve(response('one hot', 72)); await f.settle(); f.tick(); f.tick()
  f.render({ active: false })
  f.setPlayer(song('two')); f.render()
  f.render({ active: true })
  assert.equal(f.value.musicInfo.id, 'one')
  assert.equal(f.value.pic, 'cover wy:two') // preserves the existing standalone cover behavior
  assert.equal(f.requests.length, 1)
  f.refresh()
  assert.equal(f.value.musicInfo.id, 'two')
  assert.equal(f.requests.length, 2)
})
