/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 已经改成 useLuxTheme() 的竖屏表面。新的颜色字面量应加令牌，不要写回这些文件。 */
export const MIGRATED_LUX_COLOR_FILES = [
  'src/components/ChangelogView.tsx',
  'src/components/common/Dialog.tsx',
  'src/components/common/PromptDialog.tsx',
  'src/components/common/SegmentedIconSwitch.tsx',
  'src/components/player/PlayerBar/index.tsx',
  'src/components/playlist/LocalSongsDetail.tsx',
  'src/components/playlist/PlaylistDetailHeader.tsx',
  'src/components/playlist/PlaylistDetailOverlay.tsx',
  'src/components/playlist/PlaylistDetailScene.tsx',
  'src/components/playlist/PlaylistDetailSongItem.tsx',
  'src/components/playlist/PlaylistDetailView.tsx',
  'src/components/playlist/PlaylistImportPanel.tsx',
  'src/components/playlist/PlaylistLibraryCard.tsx',
  'src/components/playlist/PlaylistLibraryScene.tsx',
  'src/components/playlist/PlaylistSearchScene.tsx',
  'src/components/playlist/PlaylistSongDragOverlay.tsx',
  'src/components/search/GlassSearchField.tsx',
  'src/components/search/HighlightText.tsx',
  'src/components/search/SearchMusicResultRow.tsx',
  'src/components/search/SearchSonglistResultRow.tsx',
  'src/components/search/sourceTone.ts',
  'src/screens/Home/Vertical/BottomNav.tsx',
  'src/screens/Home/Vertical/PlayDetailOverlay.tsx',
  'src/screens/Home/Vertical/PlayQueueSheet.tsx',
  'src/screens/Home/Vertical/SearchPage.tsx',
  'src/screens/Home/Vertical/SharedTopBar.tsx',
  'src/screens/Home/Vertical/Tabs/HomeTab.tsx',
  'src/screens/Home/Vertical/Tabs/PlaylistTab.tsx',
  'src/screens/Home/Vertical/Tabs/ResourceCacheSection.tsx',
  'src/screens/Home/Vertical/Tabs/SettingsTab.tsx',
  'src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx',
  'src/screens/Home/Vertical/index.tsx',
  'src/screens/PlayDetail/Vertical/Lyric.tsx',
  'src/screens/PlayDetail/Vertical/Pic.tsx',
  'src/screens/PlayDetail/Vertical/coverTheme.ts',
  'src/screens/PlayDetail/Vertical/index.tsx',
  'src/utils/imagePresentation.ts',
]

/** 不是主题色。封面运算生成的渐变不在源码里写成字面量。 */
const ALLOWED_LITERALS = new Set([
  'transparent',
])

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g
const COLOR_FN = /\b(?:rgba?|hsla?)\(\s*\d[\d\s,./%]*\)/gi

const stripNonCode = source => source
  .replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length))
  .replace(/(^|[^:\\])\/\/.*$/gm, (match, lead) => lead + ' '.repeat(match.length - lead.length))

export const findLuxColorLiterals = (source, file = '') => {
  const text = stripNonCode(source)
  const hits = []
  const report = (match, index) => {
    if (ALLOWED_LITERALS.has(match)) return
    const line = text.slice(0, index).split('\n').length
    hits.push({ file, line, match })
  }
  for (const match of text.matchAll(HEX)) report(match[0], match.index ?? 0)
  for (const match of text.matchAll(COLOR_FN)) report(match[0], match.index ?? 0)
  return hits
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectRun) {
  const hits = []
  for (const file of MIGRATED_LUX_COLOR_FILES) {
    const source = readFileSync(join(root, file), 'utf8')
    hits.push(...findLuxColorLiterals(source, file))
  }
  if (hits.length) {
    for (const hit of hits) {
      process.stderr.write(`${hit.file}:${hit.line} ${hit.match}\n`)
    }
    process.stderr.write(`已迁移文件里出现 ${hits.length} 处颜色字面量\n`)
    process.exit(1)
  }
  process.stdout.write(`已迁移的 ${MIGRATED_LUX_COLOR_FILES.length} 个文件没有新的颜色字面量\n`)
}
