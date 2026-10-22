/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()
const load = file => {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(name => {
    const path = resolve(dirname(file), name)
    return load(existsSync(`${path}.ts`) ? `${path}.ts` : join(path, 'index.ts'))
  }, module, module.exports)
  return module.exports
}
const { findPlaylistDuplicates: groups, playlistDedupeSelection: selection, applyPlaylistDedupe: apply } = load(join(root, 'src/utils/playlistDedupe.ts'))
const song = (id, source = 'wy', extra = {}) => ({ id, source, name: 'Song', singer: 'Artist & Guest', interval: '03:20', meta: { songId: id }, ...extra })

test('playlist dedupe groups exact provider songmid or id and keeps the first occurrence without mutation', () => {
  const songs = [song('a'), song('b'), song('c', 'kg'), song('d', 'wy', { meta: { songId: 'a' } }), song('b')]
  const before = JSON.stringify(songs)
  assert.deepEqual(groups(songs), [{ indices: [0, 1, 2, 3, 4] }])
  assert.deepEqual(selection(songs).kept, [songs[0]])
  assert.equal(JSON.stringify(songs), before)
  const exact = [song('x'), song('y', 'wy', { meta: { songId: 'x' }, name: 'Different', interval: null }), song('y', 'wy', { name: 'Other' })]
  assert.deepEqual(groups(exact), [{ indices: [0, 1, 2] }])
})

test('cross-source exact rule requires identical title, artist set and known duration', () => {
  const a = song('a')
  assert.deepEqual(groups([a, song('b', 'kg', { singer: 'Guest / Artist', interval: '3:20' })]), [{ indices: [0, 1] }])
  for (const extra of [{ name: 'song' }, { name: 'Song live' }, { singer: 'Artist' }, { interval: '03:21' }, { interval: null }, { interval: '' }, { interval: 'bad' }, { interval: '00:00' }]) {
    assert.deepEqual(groups([a, song('b', 'kg', extra)]), [], JSON.stringify(extra))
  }
  assert.deepEqual(groups([song('a', 'wy', { singer: '' }), song('b', 'kg', { singer: '' })]), [])
  assert.deepEqual(groups([a, song('b')]), []) // Same metadata on one provider is insufficient.
})

test('unchecked duplicates and first occurrences are retained, with independent groups', () => {
  const songs = [song('a'), song('a'), song('b', 'wy', { name: 'Other' }), song('b', 'wy', { name: 'Other' }), song('a')]
  assert.deepEqual(groups(songs), [{ indices: [0, 1, 4] }, { indices: [2, 3] }])
  assert.deepEqual(selection(songs, new Set([0, 1, 3, 999])).kept, [songs[0], songs[2], songs[4]])
  assert.equal(selection(songs, new Set([1])).requiresOverwrite, true)
  assert.deepEqual(selection(songs, new Set()).removed, [])
})

test('no duplicates and empty playlists produce no removals', () => {
  for (const songs of [[], [song('a')], [song('a'), song('b')]]) {
    assert.deepEqual(groups(songs), [])
    assert.deepEqual(selection(songs).kept, songs)
    assert.deepEqual(selection(songs).removed, [])
  }
})

test('confirmed application uses synced removal, and overwrite only for retained id collisions', async() => {
  for (const songs of [[song('a'), song('b', 'kg')], [song('a'), song('a'), song('a')]]) {
    const calls = []
    const checked = new Set([1])
    assert.equal(await apply(songs, checked, {
      read: async() => songs,
      isCurrent: () => true,
      remove: async ids => calls.push(['remove', ids]),
      overwrite: async kept => calls.push(['overwrite', kept]),
    }), true)
    assert.deepEqual(calls, songs[1].id === 'a' ? [['overwrite', [songs[0], songs[2]]]] : [['remove', ['b']]])
  }
})

test('sync changes, space switches and unchecked reviews never issue mutations', async() => {
  const songs = [song('a'), song('b', 'kg')]
  for (const [latest, current, checked, expected] of [[songs.slice(1), true, new Set([1]), false], [songs, false, new Set([1]), false], [songs, true, new Set(), true]]) {
    assert.equal(await apply(songs, checked, {
      read: async() => latest,
      isCurrent: () => current,
      remove: async() => assert.fail('unexpected removal'),
      overwrite: async() => assert.fail('unexpected overwrite'),
    }), expected)
  }
})
