/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nativeRequire = createRequire(import.meta.url)
const cache = new Map()
const load = file => {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(name => {
    if (!name.startsWith('.')) return nativeRequire(name)
    const path = resolve(dirname(file), name)
    return load([`${path}.ts`, `${path}.js`, join(path, 'index.ts'), join(path, 'index.js')].find(existsSync))
  }, module, module.exports)
  return module.exports
}
const parser = load(join(root, 'src/utils/playlistImport/parser.ts'))
const scorer = load(join(root, 'src/utils/playlistImport/score.ts'))
const song = (name, singer = '周杰伦', interval = '04:30') => ({ name, singer, interval })
test('pasted lines support both orders, album/duration, whitespace, slash and artist parentheses', () => {
  const tracks = parser.parseText('\uFEFF晴天 - 周杰伦 - 叶惠美 - 04:30\r\n周杰伦 - 夜曲\nLemon / 米津玄師\n后来（刘若英）\n小幸運 田馥甄\n平凡之路\n\n')
  assert.equal(tracks.length, 6)
  assert.deepEqual(tracks[0], { original: '晴天 - 周杰伦 - 叶惠美 - 04:30', title: '晴天', artist: '周杰伦', album: '叶惠美', duration: 270, reversible: true })
  assert.equal(scorer.scoreTrack(tracks[1], song('夜曲')), 100)
  assert.equal(tracks[2].artist, '米津玄師')
  assert.equal(tracks[3].artist, '刘若英')
  assert.equal(tracks[4].artist, '田馥甄')
  assert.equal(tracks[5].artist, '')
  assert.equal(parser.parseText('七里香 (Live)')[0].title, '七里香 (Live)')
})
test('CSV handles BOM, quoted commas/newlines/escaped quotes and reordered multilingual headers', () => {
  const rows = parser.parseCSV('\uFEFFartist,title,album,duration\r\nA,"Hello, ""World""","line1\nline2",3:20\r\n')
  assert.deepEqual(rows, [{ original: 'A · Hello, "World" · line1\nline2 · 3:20', title: 'Hello, "World"', artist: 'A', album: 'line1\nline2', duration: 200 }])
  assert.equal(parser.parseCSV('歌手,歌名\n周杰伦,晴天')[0].title, '晴天')
  assert.equal(parser.parseCSV('晴天,周杰伦,,270')[0].duration, 270)
  assert.throws(() => parser.parseCSV('歌手,专辑\nA,B'), /MISSING_TITLE/)
  assert.throws(() => parser.parseCSV('title\n"unfinished'), /UNCLOSED_QUOTE/)
  assert.throws(() => parser.parseCSV('"title"garbage'), /INVALID_QUOTES/)
  assert.deepEqual(parser.parseCSV(''), [])
  assert.equal(parser.durationSeconds('3:99'), undefined)
})
test('CSV detects UTF8/BOM and GBK bytes without guessing from already decoded text', () => {
  const iconv = nativeRequire('iconv-lite')
  for (const text of ['歌名,歌手\n晴天,周杰伦', '\uFEFFtitle,artist\nLemon,A', 'title\n😀']) assert.equal(parser.detectCSVEncoding(Buffer.from(text)), 'utf8')
  const gbk = iconv.encode('歌名,歌手\n晴天,周杰伦', 'gbk')
  assert.equal(parser.detectCSVEncoding(gbk), 'gbk')
  assert.equal(parser.parseCSV(iconv.decode(gbk, parser.detectCSVEncoding(gbk)))[0].title, '晴天')
  for (const bytes of [[0xc0, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe4]]) assert.equal(parser.detectCSVEncoding(Uint8Array.from(bytes)), 'gbk')
})
test('platform links preserve URLs for existing SDK ID/short-link parsing and reject spoofed hosts', () => {
  for (const [url, source] of [['https://y.qq.com/n/ryqq/playlist/12', 'tx'], ['https://music.163.com/#/playlist?id=42', 'wy'], ['https://www.kugou.com/share/x', 'kg'], ['https://h5app.kuwo.cn/m/bodian/collection.html?playlistId=2', 'kw'], ['https://music.migu.cn/v5/#/playlist?playlistId=3', 'mg']]) assert.deepEqual(parser.parsePlatformLink(`分享 ${url}`), { source, url })
  assert.equal(parser.parsePlatformLink('https://qq.com.evil.com/a'), null)
  assert.equal(parser.parsePlatformLink('not a link'), null)
})
test('scores normalize traditional Chinese, full width, artist order, brackets and featured artists; versions/duration penalize', () => {
  const track = { title: '小幸運', artist: '田馥甄', duration: 270 }
  assert.equal(scorer.scoreTrack(track, song('小幸运', '田馥甄')), 100)
  assert.equal(scorer.scoreTrack({ title: 'Ｌｅｍｏｎ（电影主题曲）', artist: 'A feat. B' }, song('lemon', 'B / A')), 100)
  assert.ok(scorer.scoreTrack(track, song('小幸运 (Live)', '田馥甄')) < 90)
  assert.ok(scorer.scoreTrack(track, song('小幸运', 'Other')) < 90)
  assert.ok(scorer.scoreTrack(track, song('小幸运', '田馥甄', '08:00')) < 90)
  assert.ok(scorer.scoreTrack(track, song('完全不同', '田馥甄')) < 60)
  assert.equal(scorer.matchStatus(100), 'matched')
  assert.equal(scorer.matchStatus(95, 94), 'uncertain')
  assert.equal(scorer.matchStatus(74), 'uncertain')
  assert.equal(scorer.matchStatus(59), 'unmatched')
  assert.equal(scorer.matchStatus(scorer.scoreTrack({ title: '晴天', artist: '' }, song('晴天'))), 'uncertain')
})
const { matchTracks } = load(join(root, 'src/utils/playlistImport/matcher.ts'))
const online = (id, source, name = '晴天') => ({ ...song(name), id, source })
test('matching bounds concurrency, yields, ranks source preference and reports all status buckets', async() => {
  let active = 0; let maximum = 0; let yields = 0
  const progress = []
  const controller = new AbortController()
  const rows = await matchTracks([{ title: '晴天', artist: '周杰伦', original: '晴天' }, { title: 'unknown', artist: '', original: 'unknown' }], {
    sources: ['tx', 'wy', 'kg'],
    signal: controller.signal,
    concurrency: 2,
    yieldThread: async() => { yields++ },
    search: async(query, source) => {
      active++; maximum = Math.max(active, maximum)
      await new Promise(resolve => setTimeout(resolve, 2)); active--
      return query.startsWith('unknown') ? [] : [online(source, source)]
    },
    onProgress: (rows, count) => progress.push(count),
  })
  assert.equal(maximum, 2); assert.ok(yields >= 2)
  assert.equal(rows[0].status, 'matched'); assert.equal(rows[0].candidates[0].song.source, 'tx')
  assert.equal(rows[1].status, 'unmatched'); assert.deepEqual(progress, [1, 2])
})
test('timeouts retire a hanging provider and failures allow other providers to continue', async() => {
  const calls = []
  const rows = await matchTracks(Array.from({ length: 3 }, () => ({ title: '晴天', artist: '周杰伦', original: '' })), {
    sources: ['tx', 'wy', 'kg'],
    signal: new AbortController().signal,
    timeoutMs: 5,
    search: async(query, source) => {
      calls.push(source)
      if (source === 'tx') return new Promise(() => {})
      if (source === 'wy') throw new Error('offline')
      return [online('ok', 'kg')]
    },
  })
  assert.equal(calls.filter(source => source === 'tx').length, 1)
  assert.equal(rows.length, 3); assert.ok(rows.every(row => row.status === 'matched'))
})
test('cancellation interrupts a hanging request promptly and suppresses late progress', async() => {
  const controller = new AbortController(); let updates = 0; let finish
  const pending = matchTracks([{ title: '晴天', artist: '', original: '' }], {
    sources: ['tx'],
    signal: controller.signal,
    timeoutMs: 1000,
    search: async() => new Promise(resolve => { finish = resolve }),
    onProgress: () => updates++,
  })
  await new Promise(resolve => setTimeout(resolve, 5)); controller.abort()
  await assert.rejects(pending, /IMPORT_CANCELLED/)
  finish([online('late', 'tx')]); await new Promise(resolve => setTimeout(resolve, 1))
  assert.equal(updates, 0)
  await assert.rejects(matchTracks([], { sources: ['tx'], signal: controller.signal, search: async() => [] }).then(() => { if (controller.signal.aborted) throw new Error('IMPORT_CANCELLED') }), /IMPORT_CANCELLED/)
})
