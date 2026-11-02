/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const pic = readFileSync(new URL('../src/screens/PlayDetail/Vertical/Pic.tsx', import.meta.url), 'utf8')
const style = name => {
  const match = pic.match(new RegExp(`\\b${name}: (\\{[^}]+\\})`))
  assert.ok(match, `${name} style exists`)
  return runInNewContext(`(${match[1]})`)
}
const constant = name => {
  const match = pic.match(new RegExp(`const ${name} = ([\\d +]+)`))
  assert.ok(match, `${name} constant exists`)
  return runInNewContext(match[1])
}

test('vertical player keeps the lowered record and a flexible lyric gap with a safe minimum', () => {
  for (const [name, grow, min] of [
    ['flexGapSm', 2, 24],
    ['flexGapRecord', 1, 30],
    ['flexGapTitle', 0, 18],
    ['flexGapLyric', 1, 12],
  ]) {
    const gap = style(name)
    assert.equal(gap.flexGrow, grow, name)
    assert.equal(gap.minHeight, min, name)
    assert.equal(gap.flexShrink, 0, name)
  }
})

test('disc keeps the historical lyric and gap budgets without lowering the 200dp floor', () => {
  assert.equal(constant('PLAYER_RESERVED_ABOVE'), 10 + 14 + 24)
  assert.equal(constant('PLAYER_RESERVED_GAPS'), 30 + 18 + 18)
  assert.equal(constant('PLAYER_RESERVED_LYRIC'), 124)
  assert.equal(constant('PLAYER_DISC_MIN'), 200)
})

test('667dp and tall screens retain the pre-three-line disc diameter', () => {
  const body = pic.match(/const discSize = useMemo\(\(\) => \{([\s\S]*?)\n {2}\},/)[1]
  for (const [width, scrollHeight, expected] of [[360, 456, 200], [375, 445, 200], [412, 678, 350]]) {
    const context = {
      winSize: { width },
      scrollHeight,
      hasLyricPreview: true,
      PAGE_GUTTER: 22,
      ...Object.fromEntries(['PLAYER_RESERVED_ABOVE', 'PLAYER_RESERVED_TITLE', 'PLAYER_RESERVED_LYRIC', 'PLAYER_RESERVED_GAPS', 'PLAYER_DISC_MIN'].map(name => [name, constant(name)])),
    }
    const actual = runInNewContext(`(() => {${body}})()`, context)
    assert.equal(actual, expected, String(width))
    const before = runInNewContext(`(() => {${body}})()`, { ...context, PLAYER_RESERVED_LYRIC: 110 + 14 })
    assert.equal(actual, before, 'same scroll viewport yields the #165 diameter')
  }
  assert.match(pic, /<\/ScrollView>\s*<PlayerTransport/)
  assert.equal(style('scroll').flex, 1)
})
