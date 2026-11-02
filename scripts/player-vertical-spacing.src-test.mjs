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

test('vertical player gives spare height to the top and keeps lyric gaps fixed', () => {
  for (const [name, grow, min] of [
    ['flexGapSm', 2, 24],
    ['flexGapRecord', 1, 30],
    ['flexGapTitle', 0, 18],
    ['flexGapLyric', 0, 18],
  ]) {
    const gap = style(name)
    assert.equal(gap.flexGrow, grow, name)
    assert.equal(gap.minHeight, min, name)
    assert.equal(gap.flexShrink, 0, name)
  }
})

test('disc budget covers eyebrow and minimum gaps without lowering the 200dp floor', () => {
  assert.equal(constant('PLAYER_RESERVED_ABOVE'), 10 + 14 + 24)
  assert.equal(constant('PLAYER_RESERVED_GAPS'), 30 + 18 + 18)
  assert.equal(constant('PLAYER_RESERVED_LYRIC'), 22 + 28 + 22 + 18 + 18 + 8 + 44)
  assert.equal(constant('PLAYER_DISC_MIN'), 200)
})
