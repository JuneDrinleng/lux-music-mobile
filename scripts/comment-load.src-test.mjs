import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Script } from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const flush = () => new Promise(resolve => setImmediate(resolve))

function fixture() {
  const refs = []; const effects = []; const timers = new Map(); const requests = []; const totals = []; const writes = []
  let cursor = 0; let timerId = 0; let result; let list = []; let status
  const listApi = {
    setList(value) { list = value; writes.push(value) },
    getList: () => list,
    setStatus(value) { status = value },
  }
  const effect = (fn, deps) => {
    const i = cursor++; const old = effects[i]
    if (!old || deps.some((value, j) => value !== old.deps[j])) effects[i] = { fn, deps, pending: true, cleanup: old?.cleanup }
  }
  const deps = {
    react: {
      useRef(value) { const i = cursor++; return refs[i] ??= { current: value } },
      useEffect: effect,
      useLayoutEffect: effect,
    },
    '@/utils/musicSdk': { default: { wy: { comment: {} }, kw: { comment: {} } } },
    './utils': { filterList: items => [...new Map(items.map(item => [item.id, item])).values()] },
  }
  const js = ts.transpileModule(read('src/screens/Comment/useCommentLoad.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports,setTimeout,clearTimeout){${js}\n})`).runInThisContext()(
    name => { assert.ok(name in deps, name); return deps[name] }, module, module.exports,
    fn => { const id = ++timerId; timers.set(id, fn); return id }, id => timers.delete(id),
  )
  const fetchComments = (song, page, limit) => new Promise((resolve, reject) => requests.push({ song, page, limit, resolve, reject }))
  const render = (source = 'wy', id = 'one', refreshKey = 0) => {
    cursor = 0
    result = module.exports.default({ musicInfo: { source, id }, onUpdateTotal: value => totals.push(value), refreshKey }, fetchComments)
    result.listRef.current = listApi
    for (const e of effects) if (e?.pending) { e.cleanup?.(); e.cleanup = e.fn(); e.pending = false }
    return result
  }
  const tick = () => {
    const pending = [...timers]; timers.clear()
    for (const [, fn] of pending) fn()
  }
  return {
    render,
    requests,
    totals,
    timers,
    writes,
    tick,
    get list() { return list },
    get status() { return status },
    unmount() { effects.forEach(e => e?.cleanup?.()) },
  }
}
const response = (id, maxPage = 3) => ({ comments: [{ id }], total: 45, maxPage })

test('comment generations ignore old source/song successes and failures, including A-B-A', async() => {
  const f = fixture()
  f.render(); f.render('kw'); f.render('wy')
  f.requests[0].resolve(response('old'))
  f.requests[1].reject(new Error('old error'))
  await flush()
  assert.deepEqual(f.list, [])
  assert.deepEqual(f.totals, [])
  assert.equal(f.timers.size, 0)
  f.requests[2].resolve(response('current')); await flush()
  f.tick(); f.tick()
  assert.deepEqual(f.list, [{ id: 'current' }])
  assert.equal(f.status, 'idle')
})

test('comment refresh clears initial delays, coalesces pulls and supersedes pagination', async() => {
  const f = fixture(); let h = f.render()
  f.requests[0].resolve(response('initial')); await flush()
  assert.equal(f.timers.size, 1)
  h.handleListRefresh(); h.handleListRefresh()
  assert.equal(f.requests.length, 2)
  assert.equal(f.timers.size, 0)
  assert.equal(f.status, 'refreshing')
  f.requests[1].resolve(response('fresh')); await flush()
  h.handleListLoadMore(); h.handleListLoadMore()
  assert.equal(f.requests.length, 3)
  assert.equal(f.requests[2].page, 2)
  h.handleListRefresh()
  f.requests[3].resolve(response('replacement', 1)); await flush()
  f.requests[2].resolve(response('stale-page')); await flush()
  assert.deepEqual(f.list, [{ id: 'replacement' }])
  assert.equal(f.status, 'end')
  h.handleListLoadMore(); assert.equal(f.requests.length, 4)
  h = f.render('wy', 'one', 1)
  assert.equal(f.status, 'end') // silent refresh keeps display/status
  h.handleListRefresh(); assert.equal(f.requests.length, 5)
  f.requests[4].reject(new Error('offline')); await flush()
  assert.equal(f.status, 'error')
})

test('comment pagination appends/dedupes; silent refresh skips busy requests', async() => {
  const f = fixture(); f.render()
  f.render('wy', 'one', 1); assert.equal(f.requests.length, 1)
  f.requests[0].resolve(response('first')); await flush(); f.tick(); f.tick()
  const h = f.render('wy', 'one', 2)
  assert.equal(f.status, 'idle'); assert.deepEqual(f.list, [{ id: 'first' }])
  f.requests[1].resolve(response('silent')); await flush()
  h.handleListLoadMore()
  f.requests[2].resolve({ ...response('next'), comments: [{ id: 'silent' }, { id: 'next' }] }); await flush()
  assert.deepEqual(f.list, [{ id: 'silent' }, { id: 'next' }])
})

test('comment song changes and unmount clear either delay and ignore late completions', async() => {
  for (const ticks of [0, 1]) {
    const f = fixture(); f.render()
    f.requests[0].resolve(response('first')); await flush()
    if (ticks) f.tick()
    assert.equal(f.timers.size, 1)
    f.render('wy', 'two'); assert.equal(f.timers.size, 0)
    f.unmount()
    const writes = f.writes.length
    f.requests[1].resolve(response('late')); await flush(); f.tick()
    assert.equal(f.writes.length, writes); assert.equal(f.timers.size, 0)
  }
  const f = fixture(); f.render(); f.requests[0].resolve(response('first')); await flush(); f.tick()
  f.unmount(); assert.equal(f.timers.size, 0)
})

test('both comment screens use shared loader and images remain automatic without dead translations', () => {
  for (const kind of ['Hot', 'New']) {
    const source = read(`src/screens/Comment/Comment${kind}.tsx`)
    assert.ok(source.includes(`useCommentLoad(props, get${kind}Comment)`))
    assert.ok(!source.includes('setTimeout'))
  }
  const image = read('src/screens/Comment/components/CommentImage.tsx')
  for (const dead of ['setShow', 'useState(true)', 'TouchableOpacity', 'defaultPic', 'useTheme', 'comment_show_image']) assert.ok(!image.includes(dead), dead)
  assert.ok(image.includes('<Image'))
  assert.ok(image.includes('getSize(url,'))
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) assert.ok(!('comment_show_image' in JSON.parse(read(`src/lang/${locale}.json`))))
})
