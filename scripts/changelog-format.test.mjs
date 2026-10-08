import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'

const loadParser = () => {
  let code = fs.readFileSync(new URL('../src/utils/changelogFormat.js', import.meta.url), 'utf8')
  code = code
    .replace(/^\/\*[\s\S]*?\*\/\n/, '')
    .replace(/^export const /gm, 'const ')
  return new Function(`${code}\nreturn { parseChangelog };`)()
}

const { parseChangelog } = loadParser()

const inlineText = (inlines) => inlines.map(part => part.text).join('')

const DEV_NOTE = '- feat(settings): 当前版本可查看本次安装的更新日志'

const GITHUB_NOTES = [
  "## What's Changed",
  '* feat(settings): 当前版本可查看本次安装的更新日志 by @june in https://github.com/JuneDrinleng/lux-music-mobile/pull/12',
  '* fix(player): 顺滑歌单长按拖动排序 (#11)',
  '* perf(list): 减少歌单详情重渲染 by @a in https://github.com/JuneDrinleng/lux-music-mobile/pull/9',
  '* refactor(sync): 抽出同步登录',
  '* style(ui): 收紧设置页间距',
  '* chore: 更新依赖',
  '* docs: 补充说明',
  '* @june made their first contribution in https://github.com/JuneDrinleng/lux-music-mobile/pull/12',
  '**Full Changelog**: https://github.com/JuneDrinleng/lux-music-mobile/compare/v0.3.1...v0.4.0-dev.1',
].join('\n')

test('开发版单条约定式提交去掉前缀，不显示分组标题', () => {
  const doc = parseChangelog(DEV_NOTE)
  assert.equal(doc.fallback, false)
  assert.equal(doc.blocks.length, 1)
  assert.equal(doc.blocks[0].kind, 'item')
  assert.equal(inlineText(doc.blocks[0].inlines), '当前版本可查看本次安装的更新日志')
  assert.equal(JSON.stringify(doc.blocks).includes('feat'), false)
})

test('GitHub What\'s Changed 按类型分组，并去掉自动生成的噪音', () => {
  const doc = parseChangelog(GITHUB_NOTES)
  assert.equal(doc.fallback, false)
  assert.deepEqual(doc.blocks.map(block => block.kind == 'group' ? block.id : block.kind), ['feat', 'fix', 'improve', 'other'])
  const byId = Object.fromEntries(doc.blocks.map(block => [block.id, block.items.map(inlineText)]))
  assert.deepEqual(byId.feat, ['当前版本可查看本次安装的更新日志'])
  assert.deepEqual(byId.fix, ['顺滑歌单长按拖动排序'])
  assert.deepEqual(byId.improve, ['减少歌单详情重渲染', '抽出同步登录', '收紧设置页间距'])
  assert.deepEqual(byId.other, ['更新依赖', '补充说明'])
  const flat = JSON.stringify(doc.blocks)
  assert.equal(flat.includes("What's Changed"), false)
  assert.equal(flat.includes('Full Changelog'), false)
  assert.equal(flat.includes('by @'), false)
  assert.equal(flat.includes('(#11)'), false)
  assert.equal(flat.includes('first contribution'), false)
  assert.equal(flat.includes('https://'), false)
})

test('稳定版 0.3.1 说明去掉开头版本号，小标题加粗、列表保留，行内代码去掉反引号', () => {
  const feed = JSON.parse(fs.readFileSync(new URL('../publish/version.json', import.meta.url), 'utf8'))
  const doc = parseChangelog(feed.desc)
  assert.equal(doc.fallback, false)
  assert.equal(feed.version, '0.3.1')
  assert.equal(doc.blocks.some(block => block.kind == 'heading' && block.text == 'v0.3.1'), false)
  assert.equal(doc.blocks.some(block => block.kind == 'paragraph' && inlineText(block.inlines) == 'v0.3.1'), false)
  assert.equal(doc.blocks[0].kind, 'paragraph')
  assert.match(inlineText(doc.blocks[0].inlines), /^本次更新完善/)
  assert.deepEqual(
    doc.blocks.filter(block => block.kind == 'heading').map(block => block.text),
    ['新增', '调整', '兼容性', '构建'],
  )
  const added = doc.blocks.filter(block => block.kind == 'item')
  assert.ok(added.length >= 8)
  const compat = doc.blocks.find(block => block.kind == 'item' && inlineText(block.inlines).includes('/hello'))
  assert.ok(compat)
  assert.deepEqual(
    compat.inlines.filter(part => part.kind == 'code').map(part => part.text),
    ['/hello', '/id', '/ah'],
  )
  assert.equal(inlineText(compat.inlines).includes('`'), false)
  assert.equal(doc.blocks.some(block => block.kind == 'group'), false)
})

test('粗体和代码只去掉标记，多条同类提交仍保留分组标题', () => {
  const doc = parseChangelog([
    '这是 **重点** 和 `版本号`。',
    '',
    '- feat!: 第一条',
    '- feat(scope): 第二条',
  ].join('\n'))
  assert.equal(doc.blocks[0].kind, 'paragraph')
  assert.deepEqual(doc.blocks[0].inlines, [
    { kind: 'text', text: '这是 ' },
    { kind: 'strong', text: '重点' },
    { kind: 'text', text: ' 和 ' },
    { kind: 'code', text: '版本号' },
    { kind: 'text', text: '。' },
  ])
  assert.equal(doc.blocks[1].kind, 'group')
  assert.equal(doc.blocks[1].id, 'feat')
  assert.deepEqual(doc.blocks[1].items.map(inlineText), ['第一条', '第二条'])
})

test('markdown 标题和开头的开发版版本号不会进正文', () => {
  const doc = parseChangelog([
    'v0.4.0-dev.2',
    '## 新增',
    '- 一条说明',
    '## New Contributors',
  ].join('\n'))
  assert.deepEqual(doc.blocks.map(block => block.kind == 'heading' ? block.text : block.kind), ['新增', 'item'])
})

test('解析失败或空输入不抛错，无法识别时退回原文', () => {
  assert.doesNotThrow(() => parseChangelog(null))
  assert.equal(parseChangelog(null).fallback, true)
  assert.equal(parseChangelog('').fallback, false)
  assert.deepEqual(parseChangelog('').blocks, [])
  const broken = parseChangelog('普通一段说明，没有列表。')
  assert.equal(broken.fallback, false)
  assert.equal(broken.blocks[0].kind, 'paragraph')
  assert.equal(inlineText(broken.blocks[0].inlines), '普通一段说明，没有列表。')
})
