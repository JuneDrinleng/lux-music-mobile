/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/utils/aiTokenStatus.ts', import.meta.url), 'utf8')
const module = { exports: {} }
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
new Script(`(function(exports){${js}\n})`).runInThisContext()(module.exports)
const api = module.exports
const now = new Date(2026, 9, 22, 5, 43).getTime()
const token = { id: 'one /?', name: 'Grok Bot · June', scopes: ['playlist:read', 'history:read', 'playlist:write'], lastUsedAt: now - 120000, expiresAt: null, revokedAt: null }
const item = { at: now - 120000, action: 'mcp.create_playlist', summary: 'Tool succeeded', ok: true }
const defaults = { local: false, host: 'https://lux/base/', session: async() => ({ token: 'account-jwt' }), now }

test('AI client uses account GET endpoints, encoded token ID, deployment prefix and verified fields only', async() => {
  const calls = []
  const state = await api.loadAiTokenStatus({
    ...defaults,
    request: async(...args) => {
      calls.push(args)
      return calls.length === 1 ? { tokens: [{ ...token, hash: 'secret', last4: '1234', userId: 'private' }] } : { items: [item] }
    },
  })
  assert.deepEqual(calls.map(call => call.slice(0, 3)), [
    ['https://lux/base/api/me/tokens', undefined, 'account-jwt'],
    ['https://lux/base/api/me/tokens/one%20%2F%3F/activity?limit=50', undefined, 'account-jwt'],
  ])
  assert.equal(state.kind, 'ready')
  assert.deepEqual(state.tokens, [token])
  assert.deepEqual(state.operations, [{ ...item, tokenId: token.id }])
  assert.ok(calls.every(call => call[3] === undefined))
})

test('AI token metadata filters revoked/expired tokens, sorts by use and rejects malformed shapes', () => {
  assert.deepEqual(api.parseAiTokens({
    tokens: [
      { ...token, id: 'unused', lastUsedAt: null }, token,
      { ...token, id: 'expired', expiresAt: now }, { ...token, id: 'revoked', revokedAt: now },
    ],
  }, now).map(item => item.id), [token.id, 'unused'])
  for (const body of [null, {}, { tokens: null }, { tokens: [{ ...token, lastUsedAt: 'yesterday' }] }, { tokens: [{ ...token, scopes: [1] }] }]) assert.throws(() => api.parseAiTokens(body, now))
  for (const body of [{}, { items: [{ ...item, at: Infinity }] }, { items: [{ ...item, ok: 'true' }] }]) assert.throws(() => api.parseAiOperations(body, 'one'))
  assert.deepEqual(api.parseAiTokens({ tokens: [] }, now), [])
})

test('AI activity aggregates multiple tokens newest first without inventing operation detail', async() => {
  const state = await api.loadAiTokenStatus({
    ...defaults,
    request: async url => url.endsWith('/tokens')
      ? { tokens: [token, { ...token, id: 'two' }] }
      : { items: [{ ...item, at: url.includes('/two/') ? now : now - 1000 }] },
  })
  assert.equal(state.kind, 'ready')
  assert.deepEqual(state.operations.map(item => item.tokenId), ['two', token.id])
  assert.equal(api.aiOperationKey('mcp.create_playlist'), 'ai_tokens_op_create')
  assert.equal(api.aiOperationKey('playlist.addSongs'), 'ai_tokens_op_add')
  assert.deepEqual(api.aiScopeKeys(token.scopes), ['ai_tokens_scope_read_history', 'ai_tokens_scope_write'])
  assert.equal(api.aiOperationKey('new.server.action'), 'ai_tokens_op_unknown')
})

test('AI local/signed out/unsupported/error states terminate without forbidden requests', async() => {
  let requests = 0
  const request = async() => { requests++; return { tokens: [] } }
  const session = async() => { throw new Error('Local must not read credentials') }
  assert.deepEqual(await api.loadAiTokenStatus({ ...defaults, local: true, session, request }), { kind: 'local' })
  assert.deepEqual(await api.loadAiTokenStatus({ ...defaults, host: '', session, request }), { kind: 'local' })
  assert.deepEqual(await api.loadAiTokenStatus({ ...defaults, session: async() => null, request }), { kind: 'signedOut' })
  assert.equal(requests, 0)
  for (const status of [404, 501, 403, 500]) {
    const result = await api.loadAiTokenStatus({ ...defaults, request: async() => { throw Object.assign(new Error('HTTP failure'), { status }) } })
    assert.equal(result.kind, [404, 501].includes(status) ? 'unsupported' : 'error')
  }
  const missingActivity = await api.loadAiTokenStatus({
    ...defaults,
    request: async url => {
      if (url.endsWith('/tokens')) return { tokens: [token] }
      throw Object.assign(new Error('Not supported'), { status: 404 })
    },
  })
  assert.equal(missingActivity.kind, 'unsupported')
})

test('AI deadline ends loading for hung credentials or transport; a fresh retry succeeds', async() => {
  let release
  const late = new Promise(resolve => { release = resolve })
  let calls = 0
  assert.deepEqual(await api.loadAiTokenStatus({ ...defaults, session: () => late, request: async() => { calls++; return { tokens: [] } }, timeoutMs: 5 }), { kind: 'timeout' })
  release({ token: 'late' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls, 0)
  assert.deepEqual(await api.loadAiTokenStatus({ ...defaults, request: () => new Promise(() => {}), timeoutMs: 5 }), { kind: 'timeout' })
  assert.deepEqual(await api.loadAiTokenStatus({ ...defaults, request: async() => ({ tokens: [] }) }), { kind: 'ready', tokens: [], operations: [] })
})

test('AI relative time, calendar times and all operation/scope labels work in three languages', () => {
  assert.equal(api.aiRelativeTime(null, now).key, 'ai_tokens_never')
  assert.equal(api.aiRelativeTime(now + 1000, now).key, 'ai_tokens_just_now')
  assert.deepEqual(api.aiRelativeTime(now - 120000, now), { key: 'ai_tokens_minutes', count: 2 })
  assert.deepEqual(api.aiRelativeTime(now - 3600000, now), { key: 'ai_tokens_hours', count: 1 })
  assert.deepEqual(api.aiRelativeTime(now - 86400000, now), { key: 'ai_tokens_days', count: 1 })
  assert.equal(api.aiOperationTime(now, now).day, 'ai_tokens_today')
  assert.equal(api.aiOperationTime(new Date(2026, 9, 21, 22, 10).getTime(), now).day, 'ai_tokens_yesterday')
  assert.equal(api.aiOperationTime(new Date(2025, 9, 22).getTime(), now).date, '2025-10-22')
  for (const locale of ['zh-cn', 'zh-tw', 'en-us']) {
    const messages = JSON.parse(readFileSync(new URL(`../src/lang/${locale}.json`, import.meta.url), 'utf8'))
    for (const action of ['playlist.list', 'playlist.read', 'playlist.create', 'playlist.addSongs', 'playlist.removeSongs', 'history.read', 'stats.topTracks', 'token.whoami', 'mcp.list_devices', 'mcp.play_on_device', 'mcp.control_playback', 'unknown']) assert.ok(messages[api.aiOperationKey(action)], `${locale} ${action}`)
    for (const scope of token.scopes.concat(['player:control', 'together:request', 'new'])) assert.ok(messages[api.aiScopeKey(scope)])
    assert.ok(messages.ai_tokens_minutes.includes('{count}'))
  }
})

const renderPage = (loadStatus) => {
  const states = []; const effects = []; let cursor = 0
  const hooks = {
    useState: initial => {
      const i = cursor++; if (!(i in states)) states[i] = initial
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }]
    },
    useEffect: (effect, deps) => {
      const i = cursor++; const old = effects[i]
      if (!old || deps.some((value, j) => value !== old.deps[j])) effects[i] = { effect, deps, pending: true, cleanup: old?.cleanup }
    },
  }
  const jsx = (type, props) => ({ type, props })
  const deps = {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', ScrollView: 'ScrollView', View: 'View' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/StatusBar': { default: 'StatusBar' },
    '@/components/magazine': { MagTopBar: 'MagTopBar', Rule: 'Rule', SecondaryButton: 'SecondaryButton' },
    '@/theme/LuxTheme': { useLuxTheme: () => ({ colors: {} }), sharedLuxStyles: fn => () => fn() },
    '@/theme/magazineRoles': { magazineRoles: () => ({}) },
    '@/utils/tools': { createStyle: value => value },
    '@/store/common/hook': { useStatusbarHeight: () => 44 },
    '@/utils/hooks/useSystemGestureInsetBottom': { default: () => 0 },
    '@/lang': { useI18n: () => key => key },
    '@/plugins/sync/client/auth': { requestJson() {} },
    '@/utils/data': { findLuxAuthForHost() {} },
    '@/utils/dataSpace': { getActiveSpace: () => 'local' },
    '@/utils/aiTokenStatus': { ...api, loadAiTokenStatus: loadStatus },
  }
  const js = ts.transpileModule(readFileSync(new URL('../src/screens/AiTokenStatus/index.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }; let cleared = false
  new Script(`(function(require,module,exports,setInterval,clearInterval){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, name); return deps[name]
  }, module, module.exports, () => 1, () => { cleared = true })
  return {
    render() {
      cursor = 0
      const tree = module.exports.default({ host: defaults.host, lux: true, onBack() {} })
      for (const value of effects) if (value?.pending) { value.cleanup?.(); value.cleanup = value.effect(); value.pending = false }
      return tree
    },
    unmount() { effects.forEach(value => value?.cleanup?.()); assert.equal(cleared, true) },
  }
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]
const flush = () => new Promise(resolve => setImmediate(resolve))
test('AI page leaves loading on timeout, retry recovers, and unmount clears its clock', async() => {
  let attempt = 0
  const h = renderPage(async() => (++attempt === 1 ? { kind: 'timeout' } : { kind: 'ready', tokens: [], operations: [] }))
  assert.ok(nodes(h.render()).some(node => node.props?.children === 'ai_tokens_loading'))
  await flush()
  const tree = h.render()
  assert.ok(!nodes(tree).some(node => node.props?.children === 'ai_tokens_loading'))
  assert.ok(nodes(tree).some(node => node.props?.children === 'ai_tokens_timeout'))
  nodes(tree).find(node => node.type === 'SecondaryButton').props.onPress()
  h.render(); await flush()
  assert.ok(nodes(h.render()).some(node => node.props?.children === 'ai_tokens_empty'))
  h.unmount()
})

test('AI page unmount ignores a late response', async() => {
  let release
  const h = renderPage(() => new Promise(resolve => { release = resolve }))
  h.render(); h.unmount()
  release({ kind: 'ready', tokens: [token], operations: [] })
  await flush()
  assert.ok(!nodes(h.render()).some(node => node.props?.children === token.name))
})
