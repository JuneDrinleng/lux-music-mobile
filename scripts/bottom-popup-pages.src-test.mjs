/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { harness } from './player-enter-animation.src-test.mjs'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('original Modal pages share the #162 bottom lifecycle, never the horizontal 248ms clock', () => {
  for (const file of ['src/components/shareCard/ShareCardPage.tsx', 'src/components/playlist/SmartPlaylistEditor.tsx', 'src/components/playlist/PlaylistImportFlow.tsx']) {
    const source = read(file)
    assert.match(source, /useBottomPopupTransition\(height, 'modal', true\)/, file)
    assert.doesNotMatch(source, /useSettingsTransition|translateX|248|Animated.timing|animationType="slide"/, file)
    assert.match(source, /requestClose\(finishClose\)/)
    assert.match(source, /<Modal transparent visible animationType="none" onRequestClose=\{(?:onClose|close)\}/)
    assert.match(source, /backgroundColor: colors.shadow.black, opacity: backdropOpacity/)
    assert.match(source, /<Animated.View style=\{\[\{ flex: 1 \}, pageStyle\]\}/)
  }
  assert.match(read('src/screens/Home/Vertical/PlayDetailOverlay.tsx'), /useBottomPopupTransition\(screenHeight, 'player'\)/)
  assert.match(read('src/screens/PlayDetail/Vertical/Lyric.tsx'), /<ShareCardPage initialTab="lyrics"/)
  assert.match(read('src/components/stats/MonthlyReportPage.tsx'), /<ShareCardPage initialTab="monthly"/)
  assert.match(read('src/components/playlist/PlaylistImportPanel.tsx'), /return <PlaylistImportFlow/)
})

test('Modal profile uses the device short animation resource and original Android cosine easing in both directions', () => {
  const h = harness()
  let page = h.render(() => h.bottom.useBottomPopupTransition(800, 'modal', true))
  const enter = h.animations.at(-1)
  assert.equal(enter.config.duration, 173, 'device resource fixture, not a hardcoded guessed duration')
  assert.equal(enter.config.useNativeDriver, true)
  assert.deepEqual(page.style.transform[0].translateY.outputRange, [800, 0])
  assert.equal(page.style.opacity, undefined, 'original Modal did not fade the content')
  assert.deepEqual(page.backdropOpacity.outputRange, [0, 0.5])
  for (const value of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
    assert.equal(enter.config.easing(value), Math.cos((value + 1) * Math.PI) / 2 + 0.5)
  }
  enter.finish()
  let closed = 0
  const back = () => page.requestClose(() => { closed++ })
  back(); back()
  const exit = h.animations.at(-1)
  assert.equal(h.animations.length, 2, 'button/system back share the same close lock')
  assert.equal(exit.config.duration, enter.config.duration)
  assert.equal(exit.config.easing, enter.config.easing)
  assert.equal(exit.config.toValue, 0)
  assert.equal(closed, 0, 'parent must remain mounted throughout exit')
  page = h.render(() => h.bottom.useBottomPopupTransition(450, 'modal', true))
  assert.equal(h.animations.length, 2, 'IME/rotation updates geometry without replaying entry')
  assert.deepEqual(page.style.transform[0].translateY.outputRange, [450, 0])
  exit.finish(false)
  assert.equal(closed, 0)
  page.requestOpen(); enter.finish()
  back(); h.animations.at(-1).finish()
  assert.equal(closed, 1)
  h.unmount()
  assert.match(read('android/app/src/main/java/cn/lux/music/mobile/utils/UtilsModule.java'), /constants.put\("modalSlideDuration", reactContext.getResources\(\).getInteger\(android.R.integer.config_shortAnimTime\)\)/)
})

test('Modal exit interrupted by reopen or unmount cannot release stale page content', () => {
  const h = harness()
  let page = h.render(() => h.bottom.useBottomPopupTransition(800, 'modal', true))
  let closed = 0
  page.requestClose(() => { closed++ })
  const stale = h.animations.at(-1)
  stale.value.setValue(0.4)
  page.requestOpen()
  assert.equal(h.animations.at(-1).value.value, 0.4)
  stale.finish()
  assert.equal(closed, 0)
  page = h.render(() => h.bottom.useBottomPopupTransition(800, 'modal', true))
  page.requestClose(() => { closed++ })
  const exit = h.animations.at(-1)
  h.unmount(); exit.finish()
  assert.equal(closed, 0)
})
