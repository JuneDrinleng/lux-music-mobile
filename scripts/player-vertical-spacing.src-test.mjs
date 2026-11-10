/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const pic = readFileSync(new URL('../src/screens/PlayDetail/Vertical/Pic.tsx', import.meta.url), 'utf8')
const transport = readFileSync(new URL('../src/screens/PlayDetail/Vertical/PlayerTransport.tsx', import.meta.url), 'utf8')
const lyric = readFileSync(new URL('../src/screens/PlayDetail/Vertical/Lyric.tsx', import.meta.url), 'utf8')
const seek = readFileSync(new URL('../src/screens/PlayDetail/Vertical/components/SeekBar.tsx', import.meta.url), 'utf8')
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

test('vertical player shares spare height only around the record and removes the extra lyric spacer', () => {
  for (const [name, grow, min] of [
    ['flexGapSm', 2, 24],
    ['flexGapRecord', 1, 30],
    ['flexGapTitle', 0, 18],
    ['flexGapLyric', 0, 0],
  ]) {
    const gap = style(name)
    assert.equal(gap.flexGrow, grow, name)
    assert.equal(gap.minHeight, min, name)
    assert.equal(gap.flexShrink, 0, name)
  }
})

test('disc keeps the historical lyric budget and releases the removed spacer without lowering the 200dp floor', () => {
  assert.equal(constant('PLAYER_RESERVED_ABOVE'), 10 + 14 + 24)
  assert.equal(constant('PLAYER_RESERVED_GAPS'), 30 + 18 + 0)
  assert.equal(constant('PLAYER_RESERVED_LYRIC'), 124)
  assert.equal(constant('PLAYER_DISC_MIN'), 200)
})

test('667dp and tall screens retain the pre-three-line disc diameter', () => {
  const body = pic.match(/const discSize = useMemo\(\(\) => \{([\s\S]*?)\n {2}\},/)[1]
  for (const [width, scrollHeight, expected] of [[360, 456, 200], [375, 445, 200], [375, 560, 250], [412, 678, 352]]) {
    const context = {
      winSize: { width },
      scrollHeight,
      hasLyricPreview: true,
      PAGE_GUTTER: 22,
      ...Object.fromEntries(['PLAYER_RESERVED_ABOVE', 'PLAYER_RESERVED_TITLE', 'PLAYER_RESERVED_LYRIC', 'PLAYER_RESERVED_GAPS', 'PLAYER_DISC_MIN'].map(name => [name, constant(name)])),
    }
    const actual = runInNewContext(`(() => {${body}})()`, context)
    assert.equal(actual, expected, String(width))
    const before = runInNewContext(`(() => {${body}})()`, { ...context, scrollHeight: scrollHeight - 21, PLAYER_RESERVED_LYRIC: 110 + 14, PLAYER_RESERVED_GAPS: 30 + 18 + 18 })
    assert.ok(actual >= before, 'the expanded viewport and released spacer never shrink the dev.22 disc')
  }
  assert.match(pic, /<\/ScrollView>\s*<PlayerTransport/)
  assert.equal(style('scroll').flex, 1)
})


test('only play opts into seek overlap; lyric keeps the default transport layout', () => {
  assert.match(pic, /<PlayerTransport\s+seekOverlapTop=\{21\}/)
  assert.doesNotMatch(lyric, /seekOverlapTop/)
  assert.match(transport, /seekOverlapTop = 0/)
  assert.match(transport, /seekOverlapTop\?: number/)
  assert.match(transport, /seekOverlapTop > 0/)
  assert.match(transport, /createStyle\(\{ overlap: \{ marginTop: -seekOverlapTop, zIndex: 1 \} \}\)/)
  assert.match(transport, /: undefined/)
  assert.equal(style('scroll').zIndex, 2, 'capsules and entry hint win overlapping hits')
  assert.match(seek, /wrap: \{[\s\S]*?height: 44/)
  assert.match(seek, /const TRACK_H = 2/)
  assert.match(seek, /onStartShouldSetPanResponder: \(\) => true/)
  // At the 375 baseline, actions retain their 44 row / 36 pill geometry.
  const actionBottom = 0
  const pillBottom = actionBottom - (44 - 36) / 2
  const panelTop = actionBottom - 21
  const seekTop = panelTop + 8
  const trackTop = seekTop + (44 - 2) / 2
  assert.equal(trackTop - pillBottom, 12)
  assert.equal(actionBottom - seekTop, 13, 'document the overlap that prioritizes actions')
  assert.ok(trackTop > actionBottom, 'the visible rail remains clear of the scroll hit region')
})


test('June 2026-11-10: disc size is independent of loading, empty and populated lyrics', () => {
  const body = pic.match(/const discSize = useMemo\(\(\) => \{([\s\S]*?)\n {2}\},/)[1]
  assert.doesNotMatch(body, /hasLyricPreview|lyricLines/)
  assert.match(pic, /\}, \[scrollHeight, winSize.width\]\)/)
  const constants = Object.fromEntries(['PLAYER_RESERVED_ABOVE', 'PLAYER_RESERVED_TITLE', 'PLAYER_RESERVED_LYRIC', 'PLAYER_RESERVED_GAPS', 'PLAYER_DISC_MIN'].map(name => [name, constant(name)]))
  for (const width of [320, 375, 412]) {
    for (const scrollHeight of [0, 445, 560, 678]) {
      const sizes = [false, true].flatMap(hasLyricPreview => [[], [{ text: 'loaded' }]].map(lyricLines => runInNewContext(`(() => {${body}})()`, {
        ...constants, PAGE_GUTTER: 22, winSize: { width }, scrollHeight, hasLyricPreview, lyricLines,
      })))
      assert.ok(sizes.every(size => size === sizes[0]), `${width} / ${scrollHeight}`)
    }
  }
})

test('preview JSX always renders a full nonshrinking slot; empty lyrics have no click target', () => {
  const slot = style('lyricPreviewSlot')
  assert.equal(slot.height, 22 + 28 + 22 + 18 + 18 + 8 + 44)
  assert.equal(slot.flexShrink, 0)
  assert.equal(slot.justifyContent, 'flex-end', 'keep actions at the bottom when extras change')
  const jsx = pic.match(/<View style=\{styles.lyricPreviewSlot\}>[\s\S]*?<\/View>/)?.[0]
  assert.ok(jsx, 'the slot wraps the conditional content, not the other way around')
  const output = ts.transpileModule(`const slot = (${jsx})`, {
    compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: 'element' },
  }).outputText
  const availability = pic.match(/const currentLyric = [\s\S]*?const hasLyricPreview = [^\n]+/)[0]
  for (const [lyricLines, line, visible] of [
    [[], 0, false], [[], -1, false], [[{ text: '' }], 0, false],
    [[{ text: 'current' }], 0, true], [[{ text: 'previous' }, { text: '' }], 1, true],
    [[{ text: '' }, { text: 'next' }], 0, true],
    [[{ text: 'extras', translation: 'translation', roma: 'roma' }], 0, true],
  ]) {
    const onLyricPress = () => assert.fail('render must not trigger navigation')
    const tree = runInNewContext(`${availability}\n${output}\nslot`, {
      styles: { lyricPreviewSlot: slot },
      lyricLines,
      line,
      active: true,
      onLyricPress,
      View: 'View',
      LyricPreview: 'LyricPreview',
      element: (type, props, ...children) => ({ type, props, children }),
    })
    assert.equal(tree.type, 'View')
    assert.equal(tree.props.style.height, 160, 'same full slot in every lyric state')
    assert.equal(tree.props.onPress, undefined)
    const content = tree.children[0]
    if (visible) {
      assert.equal(content.type, 'LyricPreview')
      assert.equal(content.props.lines, lyricLines)
      assert.equal(content.props.onPress, onLyricPress)
    } else assert.equal(content, null, 'blank slot has no preview, capsules or navigation')
  }
})
