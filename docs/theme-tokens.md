<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 主题颜色令牌

竖屏美化页面里的颜色字面量已经收成默认黄绿主题，并改成从 `useLuxTheme()` 读取。色值以替换前的代码为准，不以来源资料里合并过的黄绿表为准。默认主题的值不可改。

读取方式：`useLuxTheme()`（`src/theme/LuxTheme.tsx`）。默认是 `limeTheme`。设置里的主题入口把 id 写在本机 `lux.theme.id`，不进上游设置，也不参与同步。模块级样式用 `sharedLuxStyles`，按颜色对象的引用缓存，同一主题只生成一次；换主题时引用变了就重建，缓存只有一槽。新代码不要再写十六进制色值。`scripts/check-lux-color-literals.mjs` 会扫描下面这些文件，出现新的颜色字面量就失败（`transparent` 除外）。

## 和上游主题的关系

上游主题仍是 `src/theme/themes/createThemes.js` 生成的 `themes.ts`，经 `useTheme()` 读取。默认 id 是 `shadcn_light`。旧横屏、`src/screens/Home/Views/`、`src/components/modern/` 继续走它。

`LuxThemeProvider` 包在上游 `Provider` 里面，不替换 `ThemeContext`，不读写上游的主题设置项。竖屏设置弹窗和 `PromptDialog` 的输入底改为 `surface.importField`，好让墨夜不再露出上游浅色输入框。

## 盘点范围

扫描了竖屏新美化表面及其直接组件，共 49 个文件，其中 36 个含颜色字面量，合计 785 处、207 个不重复色值。令牌按角色拆开之后是 227 个（同一色值会占多个令牌）。

包含：首页、歌单、搜索、顶栏、设置及子页、更新日志、播放队列、底部导航、迷你播放条、播放详情（`Pic` / `Lyric` / 封面兜底）、歌单与搜索组件、`PromptDialog`、`Dialog`、`SegmentedIconSwitch`、`ChangelogView`、封面占位色。

不包含，这次替换也没有改：

- `transparent`。它表示没有颜色，不是主题色。
- `coverTheme.ts` 里随封面计算的渐变。只有无封面时的固定兜底进了 `coverFallback`。
- `src/screens/PlayDetail/Vertical/Player/` 旧播放器。当前竖屏播放页用的是 `Pic` 和 `Lyric`。
- 播放详情里嵌着的评论页。它仍走上游 `useTheme()`。
- 横屏、`src/screens/Home/Views/`、`src/components/modern/`。

`#c8e600`、`#d7ef59`、`#d9ef62`、`#dbeb92` 保持四枚强调色。`rgba(244,247,252,0.72)` 与 `rgba(245,247,252,0.72)` 不合并。播放条本地色 `#64748b` 和播放详情本地色 `#475569` 不合并。搜索未知来源底 `#e5e7eb` 和队列未知来源底 `#f3f4f6` 不合并。

## 替换结果

下面文件里的颜色字面量已改为 `useLuxTheme()`。默认黄绿下取到的字符串和表里的色值相同。没有删、藏或移动任何界面。

同一色值有多个令牌时按角色取，不因为色值相同就共用。例如 `#111827` 同时是 `ink.strong`（标题，深色主题里会变浅）和 `ink.onAccent`（黄绿按钮上的字，应留深色）。设置弹窗输入框仍使用上游 `theme['c-primary-background']`。

另外 5 套主题补齐了全部 227 个槽位。`themes.json` 里有的角色直接采用，其余按同色系推导。黄绿不走推导，仍是下面的盘点表。

下表是替换前的盘点。出现次数按当时的字面量统计，试点两处也算在里面。

## 含颜色字面量的文件

- `src/components/ChangelogView.tsx`
- `src/components/common/Dialog.tsx`
- `src/components/common/PromptDialog.tsx`
- `src/components/common/SegmentedIconSwitch.tsx`
- `src/components/player/PlayerBar/index.tsx`
- `src/components/playlist/PlaylistDetailHeader.tsx`
- `src/components/stats/ListeningStatsPage.tsx`
- `src/components/playlist/PlaylistDetailOverlay.tsx`
- `src/components/playlist/PlaylistDetailScene.tsx`
- `src/components/playlist/PlaylistDetailSongItem.tsx`
- `src/components/playlist/PlaylistDetailView.tsx`
- `src/components/playlist/PlaylistImportPanel.tsx`
- `src/components/playlist/PlaylistLibraryCard.tsx`
- `src/components/playlist/PlaylistLibraryScene.tsx`
- `src/components/playlist/PlaylistSearchScene.tsx`
- `src/components/playlist/PlaylistSongDragOverlay.tsx`
- `src/components/search/GlassSearchField.tsx`
- `src/components/search/HighlightText.tsx`
- `src/components/search/SearchMusicResultRow.tsx`
- `src/components/search/SearchSonglistResultRow.tsx`
- `src/components/search/sourceTone.ts`
- `src/screens/Home/Vertical/BottomNav.tsx`
- `src/screens/Home/Vertical/PlayDetailOverlay.tsx`
- `src/screens/Home/Vertical/PlayQueueSheet.tsx`
- `src/screens/Home/Vertical/SearchPage.tsx`
- `src/screens/Home/Vertical/SharedTopBar.tsx`
- `src/screens/Home/Vertical/Tabs/HomeTab.tsx`
- `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`
- `src/screens/Home/Vertical/Tabs/CacheLimitSlider.tsx`
- `src/screens/Home/Vertical/Tabs/ResourceCacheSection.tsx`
- `src/screens/Home/Vertical/Tabs/SettingsTab.tsx`
- `src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`
- `src/screens/Home/Vertical/index.tsx`
- `src/screens/PlayDetail/Vertical/Lyric.tsx`
- `src/screens/PlayDetail/Vertical/Pic.tsx`
- `src/screens/PlayDetail/Vertical/coverTheme.ts`
- `src/screens/PlayDetail/Vertical/index.tsx`
- `src/utils/imagePresentation.ts`

## 令牌对照

「同值另有」列出别的角色。替换时用本行令牌，不要并进去。出现次数和文件按引入令牌之前的字面量统计。试点两处的字面量已经换成 hook，表里仍记下原来的文件。

| 令牌 | 色值 | 出现次数 | 文件 | 同值的其它令牌 |
| --- | --- | --- | --- | --- |
| `bg.app` | `#eef0fb` | 27 | `src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailOverlay.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistDetailView.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `bg.plain` | `#ffffff` | 50 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/common/SegmentedIconSwitch.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx`、`src/screens/PlayDetail/Vertical/coverTheme.ts`、`src/screens/PlayDetail/Vertical/index.tsx` | 同值另有 `surface.card`、`ink.onControl`、`line.white`、`coverFallback.bottom` |
| `surface.card` | `#ffffff` | 50 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/common/SegmentedIconSwitch.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx`、`src/screens/PlayDetail/Vertical/coverTheme.ts`、`src/screens/PlayDetail/Vertical/index.tsx` | 同值另有 `bg.plain`、`ink.onControl`、`line.white`、`coverFallback.bottom` |
| `surface.muted` | `#f7f8fd` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `surface.mutedAlt` | `#f8f9fd` | 2 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `surface.well` | `#eef1f7` | 11 | `src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `surface.avatar` | `#f3eef2` | 4 | `src/components/playlist/PlaylistDetailHeader.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `surface.placeholder` | `#e8eaef` | 1 | `src/utils/imagePresentation.ts` |  |
| `surface.skeleton` | `#e2e6ef` | 5 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `surface.search` | `#dce0e9` | 4 | `src/components/search/GlassSearchField.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `surface.cancel` | `#f1f4fb` | 2 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `surface.neutral` | `#f3f4f6` | 8 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx` | 同值另有 `source.queueUnknown.background` |
| `surface.backBubble` | `#f0f1f6` | 2 | `src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `surface.backInner` | `#e8e9f0` | 2 | `src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `surface.importMuted` | `#edf0f7` | 11 | `src/components/playlist/PlaylistImportPanel.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `surface.importField` | `#f8f9fc` | 2 | `src/components/playlist/PlaylistImportPanel.tsx` |  |
| `surface.importSelected` | `#f6f9ea` | 1 | `src/components/playlist/PlaylistImportPanel.tsx` |  |
| `surface.queueAlt` | `#f1f5f9` | 1 | `src/screens/Home/Vertical/PlayQueueSheet.tsx` |  |
| `surface.playerTrack` | `#e8e8ec` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `surface.sourceActive` | `#f4f4f7` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `surface.actionDisabled` | `#f8fafc` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `surface.songlistCard` | `#f2f5fb` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `surface.confirmDisabled` | `#eef1f6` | 1 | `src/components/playlist/PlaylistImportPanel.tsx` |  |
| `surface.emptyBlock` | `#eef1f8` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `surface.searchEmpty` | `#fcfbfc` | 1 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `surface.segment` | `#dfe6f3` | 1 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `surface.segmentAlt` | `#e3e9f4` | 1 | `src/components/common/SegmentedIconSwitch.tsx` |  |
| `surface.heroFallback` | `#1e2233` | 1 | `src/components/playlist/PlaylistDetailHeader.tsx` |  |
| `surface.playGlass` | `#1d2434` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `surface.vinyl` | `#111111` | 1 | `src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `ink.pageTitle` | `#16181f` | 7 | `src/components/playlist/PlaylistLibraryScene.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` | 同值另有 `homeHeroes[0].ink` |
| `ink.subpageTitle` | `#1a1c1e` | 7 | `src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `ink.list` | `#20242d` | 36 | `src/components/ChangelogView.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/ResourceCacheSection.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx` |  |
| `ink.strong` | `#111827` | 66 | `src/components/ChangelogView.tsx`、`src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.onAccent`、`control.play`、`control.playShadow`、`shadow.dialog`、`source.unknown.text`、`source.queueUnknown.text` |
| `ink.input` | `#232733` | 14 | `src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `ink.secondary` | `#767d89` | 18 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx` |  |
| `ink.eyebrow` | `#838995` | 5 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `ink.option` | `#5f6572` | 18 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx` |  |
| `ink.meta` | `#6b7280` | 32 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailOverlay.tsx`、`src/components/playlist/PlaylistDetailScene.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistDetailView.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx` |  |
| `ink.faint` | `#9ca3af` | 22 | `src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `ink.quiet` | `#9aa1ae` | 24 | `src/components/playlist/PlaylistSearchScene.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/ResourceCacheSection.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx` |  |
| `ink.cancel` | `#4b5563` | 8 | `src/components/ChangelogView.tsx`、`src/components/common/PromptDialog.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `ink.searchIcon` | `#666d7b` | 8 | `src/components/playlist/PlaylistSearchScene.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx` |  |
| `ink.searchClearIdle` | `#bcc2cf` | 2 | `src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx` |  |
| `ink.navActive` | `#2a311c` | 1 | `src/screens/Home/Vertical/BottomNav.tsx` |  |
| `ink.navIdle` | `#5f6574` | 1 | `src/screens/Home/Vertical/BottomNav.tsx` |  |
| `ink.icon` | `#000000` | 33 | `src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayDetailOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `shadow.black`、`scrim.mask` |
| `ink.onControl` | `#ffffff` | 50 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/common/SegmentedIconSwitch.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx`、`src/screens/PlayDetail/Vertical/coverTheme.ts`、`src/screens/PlayDetail/Vertical/index.tsx` | 同值另有 `bg.plain`、`surface.card`、`line.white`、`coverFallback.bottom` |
| `ink.nearBlack` | `#1A1A1A` | 6 | `src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/screens/Home/Vertical/SearchPage.tsx` |  |
| `ink.lyricNav` | `#0f172a` | 3 | `src/screens/PlayDetail/Vertical/Lyric.tsx` |  |
| `ink.rowTitle` | `#171a22` | 4 | `src/components/playlist/PlaylistLibraryCard.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `ink.cardTitle` | `#1c1c1e` | 2 | `src/components/playlist/PlaylistLibraryCard.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx` |  |
| `ink.emptyAction` | `#19171c` | 1 | `src/components/playlist/PlaylistLibraryScene.tsx` |  |
| `ink.importConfirm` | `#17191f` | 1 | `src/components/playlist/PlaylistImportPanel.tsx` |  |
| `ink.chipActive` | `#31351b` | 2 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `ink.chipIdle` | `#5d6271` | 2 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `ink.miniPlay` | `#303340` | 8 | `src/components/playlist/PlaylistLibraryCard.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `ink.displayIdle` | `#72798a` | 2 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `ink.profileMeta` | `#6a707c` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `ink.emptySearch` | `#707789` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `ink.historyIcon` | `#757b85` | 2 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `ink.songCount` | `#8e8e93` | 2 | `src/components/playlist/PlaylistLibraryCard.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx` |  |
| `ink.suggestArrow` | `#8a909c` | 2 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `ink.searching` | `#8a92a1` | 2 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `ink.heroArrow` | `#8f96a2` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `ink.index` | `#8a8f9d` | 11 | `src/components/search/SearchMusicResultRow.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `ink.rowMeta` | `#7d8190` | 6 | `src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryCard.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `ink.selection` | `#6f7688` | 1 | `src/screens/Home/Vertical/SharedTopBar.tsx` |  |
| `ink.olive` | `#58651b` | 3 | `src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` | 同值另有 `badge.online` |
| `ink.pill` | `#383d2b` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `ink.compact` | `#374151` | 5 | `src/components/ChangelogView.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `control.skip` |
| `ink.heartIdle` | `#737373` | 2 | `src/components/search/SearchMusicResultRow.tsx` |  |
| `ink.onAccent` | `#111827` | 66 | `src/components/ChangelogView.tsx`、`src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.strong`、`control.play`、`control.playShadow`、`shadow.dialog`、`source.unknown.text`、`source.queueUnknown.text` |
| `accent.primary` | `#c8e600` | 4 | `src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `accent.nav` | `#d7ef59` | 1 | `src/screens/Home/Vertical/BottomNav.tsx` |  |
| `accent.chip` | `#d9ef62` | 4 | `src/components/playlist/PlaylistImportPanel.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `accent.soft` | `#dbeb92` | 3 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `accent.thumbBorder` | `#ddf27a` | 1 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `accent.navShadow` | `#b5cc49` | 1 | `src/screens/Home/Vertical/BottomNav.tsx` |  |
| `accent.highlight` | `#85b300` | 1 | `src/components/search/HighlightText.tsx` |  |
| `accent.chipRipple` | `rgba(217,239,98,0.5)` | 2 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `danger` | `#ef4444` | 8 | `src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx` |  |
| `like` | `#FA5252` | 3 | `src/components/player/PlayerBar/index.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `control.play` | `#111827` | 66 | `src/components/ChangelogView.tsx`、`src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.strong`、`ink.onAccent`、`control.playShadow`、`shadow.dialog`、`source.unknown.text`、`source.queueUnknown.text` |
| `control.playShadow` | `#111827` | 66 | `src/components/ChangelogView.tsx`、`src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.strong`、`ink.onAccent`、`control.play`、`shadow.dialog`、`source.unknown.text`、`source.queueUnknown.text` |
| `control.skip` | `#374151` | 5 | `src/components/ChangelogView.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.compact` |
| `iconWrap.orange` | `#ffedd5` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `iconWrap.green` | `#d1fae5` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `iconWrap.purple` | `#ede9fe` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `iconWrap.amber` | `#fef9c3` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `iconWrap.red` | `#fee2e2` | 2 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `badge.online` | `#58651b` | 3 | `src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` | 同值另有 `ink.olive` |
| `badge.male` | `#bfdbfe` | 2 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `badge.female` | `#fce7f3` | 2 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `badge.unknown` | `#e2e8f0` | 2 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `searchField.border` | `#cdd2de` | 4 | `src/components/search/GlassSearchField.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `glass.fill08` | `rgba(255,255,255,0.08)` | 3 | `src/components/player/PlayerBar/index.tsx`、`src/screens/Home/Vertical/BottomNav.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `glass.fill14` | `rgba(255,255,255,0.14)` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `glass.fill26` | `rgba(255,255,255,0.26)` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `glass.fill28` | `rgba(255,255,255,0.28)` | 2 | `src/screens/Home/Vertical/BottomNav.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `glass.fill30` | `rgba(255,255,255,0.3)` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `glass.fill44` | `rgba(255,255,255,0.44)` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `glass.fill52` | `rgba(255,255,255,0.52)` | 4 | `src/components/search/SearchSonglistResultRow.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `glass.fill62` | `rgba(255,255,255,0.62)` | 3 | `src/components/player/PlayerBar/index.tsx`、`src/screens/Home/Vertical/BottomNav.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `glass.fill70` | `rgba(255,255,255,0.7)` | 1 | `src/screens/Home/Vertical/BottomNav.tsx` |  |
| `glass.fill72` | `rgba(255,255,255,0.72)` | 2 | `src/components/player/PlayerBar/index.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `glass.fill78` | `rgba(255,255,255,0.78)` | 2 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `glass.fill88` | `rgba(255,255,255,0.88)` | 4 | `src/components/playlist/PlaylistDetailOverlay.tsx`、`src/components/playlist/PlaylistDetailView.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `glass.fill90` | `rgba(255,255,255,0.9)` | 3 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `glass.fill92` | `rgba(255,255,255,0.92)` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `glass.fill95` | `rgba(255,255,255,0.95)` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `glass.line16` | `rgba(255,255,255,0.16)` | 5 | `src/components/player/PlayerBar/index.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `glass.line18` | `rgba(255,255,255,0.18)` | 2 | `src/screens/Home/Vertical/BottomNav.tsx` |  |
| `glass.line45` | `rgba(255,255,255,0.45)` | 1 | `src/screens/Home/Vertical/BottomNav.tsx` |  |
| `glass.rim56` | `rgba(244,247,252,0.56)` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `glass.rim58` | `rgba(244,247,252,0.58)` | 2 | `src/screens/Home/Vertical/BottomNav.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `glass.rim72` | `rgba(244,247,252,0.72)` | 5 | `src/components/playlist/PlaylistDetailOverlay.tsx`、`src/components/playlist/PlaylistDetailView.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `glass.rim72Warm` | `rgba(245,247,252,0.72)` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `glass.stroke` | `rgba(230,234,243,0.92)` | 4 | `src/components/search/SearchSonglistResultRow.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `glass.backBorder` | `rgba(231,236,245,0.96)` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `shadow.ink` | `#2d3242` | 5 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `shadow.card` | `#76809b` | 8 | `src/components/playlist/PlaylistDetailOverlay.tsx`、`src/components/playlist/PlaylistDetailView.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `shadow.dock` | `#81889a` | 2 | `src/components/player/PlayerBar/index.tsx`、`src/screens/Home/Vertical/BottomNav.tsx` |  |
| `shadow.dialog` | `#111827` | 66 | `src/components/ChangelogView.tsx`、`src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.strong`、`ink.onAccent`、`control.play`、`control.playShadow`、`source.unknown.text`、`source.queueUnknown.text` |
| `shadow.black` | `#000000` | 33 | `src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayDetailOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.icon`、`scrim.mask` |
| `shadow.playGlass` | `#2f3748` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `shadow.searchCard` | `#2b1f25` | 1 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `shadow.segment` | `#687189` | 2 | `src/components/common/SegmentedIconSwitch.tsx`、`src/screens/Home/Vertical/SearchPage.tsx` |  |
| `shadow.softCard` | `#747b8f` | 6 | `src/components/search/SearchSonglistResultRow.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `shadow.menu` | `#7b8193` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `shadow.hero` | `#84789b` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `scrim.mask` | `#000000` | 33 | `src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayDetailOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.icon`、`shadow.black` |
| `scrim.settings` | `rgba(34, 39, 51, 0.16)` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `scrim.dialog` | `rgba(15,23,42,0.22)` | 2 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx` |  |
| `scrim.import` | `rgba(17, 24, 39, 0.32)` | 1 | `src/components/playlist/PlaylistImportPanel.tsx` |  |
| `scrim.menu` | `rgba(17, 24, 39, 0.35)` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `scrim.wash` | `rgba(17,24,39,0.04)` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `scrim.home` | `rgba(22,24,31,0.08)` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `scrim.homeStrong` | `rgba(22,24,31,0.28)` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `scrim.heroPhoto` | `rgba(0,0,0,0.45)` | 1 | `src/components/playlist/PlaylistDetailHeader.tsx` |  |
| `scrim.lyricIdle` | `rgba(15,23,42,0.35)` | 1 | `src/screens/PlayDetail/Vertical/Lyric.tsx` |  |
| `scrim.lyricHairline` | `rgba(15,23,42,0.04)` | 1 | `src/screens/PlayDetail/Vertical/Lyric.tsx` |  |
| `scrim.lyricTrack` | `rgba(15,23,42,0.1)` | 1 | `src/screens/PlayDetail/Vertical/Lyric.tsx` |  |
| `scrim.vinylRing` | `rgba(15,23,42,0.08)` | 1 | `src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `scrim.vinylInner` | `rgba(15,23,42,0.55)` | 1 | `src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `line.divider` | `#e1e6ef` | 2 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `line.soft` | `#d1d5db` | 3 | `src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `line.hairline` | `#ececf0` | 2 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `line.neutral` | `#e5e7eb` | 12 | `src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `source.unknown.background` |
| `line.prompt` | `#eef0f3` | 3 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx` |  |
| `line.panel` | `#d9d9de` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `line.modal` | `#f1f1f3` | 1 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` |  |
| `line.detail` | `#e3e8f3` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `line.detailDisabled` | `#edf2f7` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `line.import` | `#d5d8e0` | 1 | `src/components/playlist/PlaylistImportPanel.tsx` |  |
| `line.searchEmpty` | `#eadfe4` | 1 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `line.segment` | `#d4ddeb` | 1 | `src/screens/Home/Vertical/SearchPage.tsx` |  |
| `line.segmentAlt` | `#d7deec` | 1 | `src/components/common/SegmentedIconSwitch.tsx` |  |
| `line.importSelected` | `#d7e08b` | 1 | `src/components/playlist/PlaylistImportPanel.tsx` |  |
| `line.thumb` | `#eef2f8` | 1 | `src/components/common/SegmentedIconSwitch.tsx` |  |
| `line.white` | `#ffffff` | 50 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/common/SegmentedIconSwitch.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx`、`src/screens/PlayDetail/Vertical/coverTheme.ts`、`src/screens/PlayDetail/Vertical/index.tsx` | 同值另有 `bg.plain`、`surface.card`、`ink.onControl`、`coverFallback.bottom` |
| `source.tx.text` | `#31c27c` | 6 | `src/components/player/PlayerBar/index.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `source.tx.background` | `#ecfdf3` | 3 | `src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `source.wy.text` | `#d81e06` | 6 | `src/components/player/PlayerBar/index.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `source.wy.background` | `#fef2f2` | 4 | `src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` | 同值另有 `queue.close` |
| `source.kg.text` | `#2f88ff` | 6 | `src/components/player/PlayerBar/index.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `source.kg.background` | `#eff6ff` | 4 | `src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` | 同值另有 `queue.current` |
| `source.kw.text` | `#f59e0b` | 6 | `src/components/player/PlayerBar/index.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `source.kw.background` | `#fffbeb` | 3 | `src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `source.mg.text` | `#e11d8d` | 6 | `src/components/player/PlayerBar/index.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `source.mg.background` | `#fdf2f8` | 3 | `src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `source.unknown.text` | `#111827` | 66 | `src/components/ChangelogView.tsx`、`src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.strong`、`ink.onAccent`、`control.play`、`control.playShadow`、`shadow.dialog`、`source.queueUnknown.text` |
| `source.unknown.background` | `#e5e7eb` | 12 | `src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `line.neutral` |
| `source.queueUnknown.text` | `#111827` | 66 | `src/components/ChangelogView.tsx`、`src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistLibraryScene.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/components/search/SearchMusicResultRow.tsx`、`src/components/search/SearchSonglistResultRow.tsx`、`src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` | 同值另有 `ink.strong`、`ink.onAccent`、`control.play`、`control.playShadow`、`shadow.dialog`、`source.unknown.text` |
| `source.queueUnknown.background` | `#f3f4f6` | 8 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/playlist/PlaylistDetailSongItem.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSearchScene.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx` | 同值另有 `surface.neutral` |
| `source.localPlayer` | `#64748b` | 1 | `src/components/player/PlayerBar/index.tsx` |  |
| `source.localDetail` | `#475569` | 2 | `src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `queue.current` | `#eff6ff` | 4 | `src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` | 同值另有 `source.kg.background` |
| `queue.close` | `#fef2f2` | 4 | `src/components/search/sourceTone.ts`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` | 同值另有 `source.wy.background` |
| `decor.tonearmPivot` | `#a7afbe` | 1 | `src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `decor.tonearmArm` | `#b8bfcc` | 1 | `src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `decor.tonearmHead` | `#7f8898` | 1 | `src/screens/PlayDetail/Vertical/Pic.tsx` |  |
| `coverFallback.top` | `#f6e6de` | 1 | `src/screens/PlayDetail/Vertical/coverTheme.ts` |  |
| `coverFallback.middle` | `#f8eee7` | 1 | `src/screens/PlayDetail/Vertical/coverTheme.ts` |  |
| `coverFallback.glow` | `#fbf6f2` | 1 | `src/screens/PlayDetail/Vertical/coverTheme.ts` |  |
| `coverFallback.bottom` | `#ffffff` | 50 | `src/components/common/Dialog.tsx`、`src/components/common/PromptDialog.tsx`、`src/components/common/SegmentedIconSwitch.tsx`、`src/components/player/PlayerBar/index.tsx`、`src/components/playlist/PlaylistDetailHeader.tsx`、`src/components/playlist/PlaylistImportPanel.tsx`、`src/components/playlist/PlaylistSongDragOverlay.tsx`、`src/screens/Home/Vertical/PlayQueueSheet.tsx`、`src/screens/Home/Vertical/SearchPage.tsx`、`src/screens/Home/Vertical/SharedTopBar.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx`、`src/screens/Home/Vertical/index.tsx`、`src/screens/PlayDetail/Vertical/Lyric.tsx`、`src/screens/PlayDetail/Vertical/Pic.tsx`、`src/screens/PlayDetail/Vertical/coverTheme.ts`、`src/screens/PlayDetail/Vertical/index.tsx` | 同值另有 `bg.plain`、`surface.card`、`ink.onControl`、`line.white` |
| `coverFallback.accent` | `#cf5f35` | 1 | `src/screens/PlayDetail/Vertical/coverTheme.ts` |  |
| `homeCards[0].surface` | `#f2d6e6` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[0].accent` | `#cf4f8f` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[0].ink` | `#4f2340` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[0].soft` | `#f9edf4` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[1].surface` | `#e7ecfa` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[1].accent` | `#5f76d9` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[1].ink` | `#26355f` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[1].soft` | `#f2f5fd` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[2].surface` | `#e8f0d7` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[2].accent` | `#8caf33` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[2].ink` | `#435817` | 2 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` | 同值另有 `homeHeroes[1].accent` |
| `homeCards[2].soft` | `#f5f8ea` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[3].surface` | `#f4e6d8` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[3].accent` | `#c68444` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[3].ink` | `#5b3b1c` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeCards[3].soft` | `#faf2ea` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[0].surface` | `#f3d7ed` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[0].accent` | `#613060` | 2 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[0].ink` | `#16181f` | 7 | `src/components/playlist/PlaylistLibraryScene.tsx`、`src/screens/Home/Vertical/Tabs/HomeTab.tsx`、`src/screens/Home/Vertical/Tabs/SettingsTab.tsx` | 同值另有 `ink.pageTitle` |
| `homeHeroes[0].textSoft` | `#61556d` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[1].surface` | `#dff0ad` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[1].accent` | `#435817` | 2 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` | 同值另有 `homeCards[2].ink` |
| `homeHeroes[1].ink` | `#1f2613` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[1].textSoft` | `#526236` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[2].surface` | `#f3e6d5` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[2].accent` | `#6b4b2e` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[2].ink` | `#22170e` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `homeHeroes[2].textSoft` | `#705640` | 1 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |  |
| `playlistCovers[0].surface` | `#f6e2e7` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[0].accent` | `#cf385b` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[0].ink` | `#652233` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[1].surface` | `#ebe4d7` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[1].accent` | `#8a6745` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[1].ink` | `#45301d` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[2].surface` | `#e4e8f1` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[2].accent` | `#556b96` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[2].ink` | `#293548` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[3].surface` | `#ece6f2` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[3].accent` | `#7f5da5` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |
| `playlistCovers[3].ink` | `#413052` | 1 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` |  |

## 六套主题色值

黄绿一列必须和上面的盘点表相同，单测会锁住。其余五套：themes.json 里有的角色直接采用，没有单独槽位的按同色系推导。墨夜的页面底、卡片、占位、分割线和玻璃填充都落在深色上。

| 槽位 | 黄绿 | 雾蓝 | 樱粉 | 薰衣草紫 | 暖米 | 墨夜 |
| --- | --- | --- | --- | --- | --- | --- |
| bg.app | #eef0fb | #eef3f9 | #faf0f3 | #f3f0fb | #f6f1ea | #12141c |
| bg.plain | #ffffff | #ffffff | #ffffff | #ffffff | #ffffff | #1c1f2a |
| surface.card | #ffffff | #ffffff | #ffffff | #ffffff | #ffffff | #1c1f2a |
| surface.muted | #f7f8fd | #f4f8fc | #fdf6f8 | #f8f6fd | #faf7f2 | #252836 |
| surface.mutedAlt | #f8f9fd | #f9fbfd | #fefafb | #fbfafe | #fcfbf8 | #212431 |
| surface.well | #eef1f7 | #fbfcfe | #fefcfc | #fcfcfe | #fdfcfa | #212431 |
| surface.avatar | #f3eef2 | #eaf3fe | #fdf1f6 | #f5f2fe | #f3efe8 | #2a242e |
| surface.placeholder | #e8eaef | #e4eaf2 | #eee4e8 | #e9e5f2 | #ebe4da | #2a2e3c |
| surface.skeleton | #e2e6ef | #dfe6ef | #ece1e6 | #e4dfef | #e7dfd3 | #2c3140 |
| surface.search | #dce0e9 | #dce6f0 | #eedfe5 | #e4dff0 | #e8dfd3 | #2a2e3c |
| surface.cancel | #f1f4fb | #eef3f8 | #f5eaee | #efeaf8 | #efe7dc | #2a2e3c |
| surface.neutral | #f3f4f6 | #eff3f7 | #f6f1f3 | #f1eef7 | #f3efe9 | #292c3b |
| surface.backBubble | #f0f1f6 | #fcfdfe | #fefcfd | #fdfcfe | #fdfcfb | #1f222e |
| surface.backInner | #e8e9f0 | #edf1f7 | #f4edf0 | #f1eef7 | #f2ede7 | #252936 |
| surface.importMuted | #edf0f7 | #f9fafd | #fdf9fa | #faf9fd | #fcfaf7 | #222532 |
| surface.importField | #f8f9fc | #fbfcfe | #fefcfc | #fcfcfe | #fdfcfa | #232633 |
| surface.importSelected | #f6f9ea | #e2efff | #fce4ec | #f0eafb | #f8ecdf | #313b20 |
| surface.queueAlt | #f1f5f9 | #f7f9fc | #fdf8f9 | #f9f8fd | #fbf8f5 | #232634 |
| surface.playerTrack | #e8e8ec | #e0e7f0 | #ece1e6 | #e4dfef | #e7dfd4 | #2c303f |
| surface.sourceActive | #f4f4f7 | #f7fafd | #fef9fa | #faf9fe | #fbf9f6 | #222533 |
| surface.actionDisabled | #f8fafc | #fafcfd | #fefbfc | #fcfbfe | #fcfbf9 | #20232f |
| surface.songlistCard | #f2f5fb | #f8fafc | #fdf9fa | #faf9fd | #fbf9f6 | #222531 |
| surface.confirmDisabled | #eef1f6 | #fcfdfe | #fefdfd | #fdfdfe | #fefdfc | #1f222e |
| surface.emptyBlock | #eef1f8 | #fdfefe | #fefdfe | #fefdff | #fefdfc | #202330 |
| surface.searchEmpty | #fcfbfc | #fdfefe | #fefdfe | #fefdff | #fefdfc | #1a1d27 |
| surface.segment | #dfe6f3 | #e0e8f1 | #f0e4e9 | #e5e0f1 | #e9e1d6 | #282c3a |
| surface.segmentAlt | #e3e9f4 | #e4eaf1 | #f0e7eb | #e7e2f1 | #eae3da | #2b303f |
| surface.heroFallback | #1e2233 | #04060c | #080506 | #060509 | #080605 | #6d6e70 |
| surface.playGlass | #1d2434 | #030509 | #060405 | #050407 | #060504 | #9e9fa1 |
| surface.vinyl | #111111 | #010102 | #010101 | #010101 | #010101 | #131414 |
| ink.pageTitle | #16181f | #131c2f | #21161a | #1a1725 | #201a15 | #eff0f5 |
| ink.subpageTitle | #1a1c1e | #161f32 | #24181d | #1c1928 | #221c17 | #edeef4 |
| ink.list | #20242d | #1e293b | #2d1f25 | #242033 | #2a231c | #e5e7ef |
| ink.strong | #111827 | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| ink.input | #232733 | #182234 | #261a1f | #1e1b2b | #241e18 | #ebecf3 |
| ink.secondary | #767d89 | #556274 | #7a646e | #716a82 | #6f6458 | #a0a6b8 |
| ink.eyebrow | #838995 | #64748b | #8a747c | #7d768f | #867a6d | #8b92a5 |
| ink.option | #5f6572 | #5b697d | #806a74 | #766f87 | #786d60 | #989eb0 |
| ink.meta | #6b7280 | #5f6e83 | #846e77 | #79728a | #7e7266 | #9299ac |
| ink.faint | #9ca3af | #94a3b8 | #a8929a | #9a93a8 | #a3988b | #6b7285 |
| ink.quiet | #9aa1ae | #8393a8 | #9e8890 | #90899f | #998e81 | #767d90 |
| ink.cancel | #4b5563 | #475569 | #6b5560 | #5b5470 | #6b5f52 | #c5cad8 |
| ink.searchIcon | #666d7b | #5c6a7e | #816b74 | #766f88 | #796e61 | #979daf |
| ink.searchClearIdle | #bcc2cf | #b7c3d2 | #c9b8bf | #bcb5ca | #c3b8ab | #444a5b |
| ink.navActive | #2a311c | #132349 | #3b1526 | #261f39 | #322216 | #d7ef59 |
| ink.navIdle | #5f6574 | #64748b | #8a747c | #7d768f | #867a6d | #8b92a5 |
| ink.icon | #000000 | #000000 | #000000 | #000000 | #000000 | #f3f4f8 |
| ink.onControl | #ffffff | #ffffff | #ffffff | #ffffff | #ffffff | #12141c |
| ink.nearBlack | #1A1A1A | #020306 | #040303 | #030305 | #040303 | #e5e7ef |
| ink.lyricNav | #0f172a | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| ink.rowTitle | #171a22 | #121b2d | #1f1519 | #191623 | #1f1914 | #f0f1f6 |
| ink.cardTitle | #1c1c1e | #1e293b | #2d1f25 | #242033 | #2a231c | #e5e7ef |
| ink.emptyAction | #19171c | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| ink.importConfirm | #17191f | #1e293b | #2d1f25 | #242033 | #2a231c | #e5e7ef |
| ink.chipActive | #31351b | #142854 | #46172b | #2c2342 | #3a2617 | #f1f3ec |
| ink.chipIdle | #5d6271 | #64748b | #8a747c | #7d768f | #867a6d | #8b92a5 |
| ink.miniPlay | #303340 | #2c3649 | #3b2e33 | #332f3d | #3a332d | #dfe1e7 |
| ink.displayIdle | #72798a | #75849b | #957f87 | #878098 | #908578 | #80879a |
| ink.profileMeta | #6a707c | #59677a | #7e6872 | #746d85 | #756a5d | #9ba1b3 |
| ink.emptySearch | #707789 | #617086 | #877179 | #7b748c | #817669 | #8f96a9 |
| ink.historyIcon | #757b85 | #7e8ea4 | #9b858d | #8d869d | #968b7e | #798093 |
| ink.songCount | #8e8e93 | #8a9aaf | #a28c94 | #948da3 | #9d9285 | #71788b |
| ink.suggestArrow | #8a909c | #8d9cb1 | #a48e96 | #968fa4 | #9f9487 | #70778a |
| ink.searching | #8a92a1 | #708096 | #927c84 | #847d95 | #8d8275 | #838a9d |
| ink.heroArrow | #8f96a2 | #8695ab | #9f8991 | #918aa1 | #9a8f82 | #757c8f |
| ink.index | #8a8f9d | #6e7d94 | #907a82 | #837c94 | #8c8073 | #858c9f |
| ink.rowMeta | #7d8190 | #627188 | #88727a | #7b748d | #83776a | #8e95a8 |
| ink.selection | #6f7688 | #5d6b80 | #826c75 | #777089 | #7b6f63 | #969caf |
| ink.olive | #58651b | #173473 | #651a3b | #3d2f5c | #50321a | #d1e932 |
| ink.pill | #383d2b | #13254d | #3e1627 | #28203c | #352416 | #ebf1cb |
| ink.compact | #374151 | #313d4f | #48373f | #3f3a4f | #423a31 | #cdd0dc |
| ink.heartIdle | #737373 | #77879d | #968088 | #898299 | #928679 | #7e8598 |
| ink.onAccent | #111827 | #ffffff | #ffffff | #ffffff | #ffffff | #111827 |
| accent.primary | #c8e600 | #2563eb | #db2777 | #7c5cbf | #a65d28 | #c8e600 |
| accent.nav | #d7ef59 | #3b82f6 | #ec4899 | #9476d1 | #c47a3a | #d7ef59 |
| accent.chip | #d9ef62 | #2f71f0 | #e33686 | #8768c7 | #b46a30 | #cfea28 |
| accent.soft | #dbeb92 | #bfdbfe | #f9c2d4 | #ddd0f5 | #f0d5b8 | #3d4a1a |
| accent.thumbBorder | #ddf27a | #80aef9 | #f388bd | #b9a6e1 | #d9a97f | #b3c752 |
| accent.navShadow | #b5cc49 | #1943a0 | #951b51 | #543f82 | #713f1b | #889c00 |
| accent.highlight | #85b300 | #1b47a9 | #9e1c56 | #59428a | #78431d | #d7ed47 |
| accent.chipRipple | rgba(217,239,98,0.5) | rgba(59,130,246,0.5) | rgba(236,72,153,0.5) | rgba(148,118,209,0.5) | rgba(196,122,58,0.5) | rgba(215,239,89,0.5) |
| danger | #ef4444 | #ef4444 | #dc2626 | #ef4444 | #dc2626 | #f87171 |
| like | #FA5252 | #FA5252 | #e11d48 | #FA5252 | #e11d48 | #fb7185 |
| control.play | #111827 | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| control.playShadow | #111827 | #0f172a | #1c1216 | #16131f | #1c1712 | #9e9fa1 |
| control.skip | #374151 | #141d30 | #22171b | #1b1826 | #211b16 | #e5e7ef |
| iconWrap.orange | #ffedd5 | #fdeed3 | #fdeed3 | #fdeed3 | #fdeed3 | #6e4f1e |
| iconWrap.green | #d1fae5 | #d4f2e8 | #d4f2e8 | #d4f2e8 | #d4f2e8 | #175a4b |
| iconWrap.purple | #ede9fe | #eae2fd | #eae2fd | #eae2fd | #eae2fd | #463678 |
| iconWrap.amber | #fef9c3 | #fbf1d3 | #fbf1d3 | #fbf1d3 | #fbf1d3 | #6a571d |
| iconWrap.red | #fee2e2 | #fcdddd | #fcdddd | #fcdddd | #fcdddd | #6c2d34 |
| badge.online | #58651b | #173473 | #651a3b | #3d2f5c | #50321a | #d1e932 |
| badge.male | #bfdbfe | #dce9fd | #dce9fd | #dce9fd | #dce9fd | #284578 |
| badge.female | #fce7f3 | #fcdeed | #fcdeed | #fcdeed | #fcdeed | #6b2f54 |
| badge.unknown | #e2e8f0 | #e6ecf3 | #f1e9ed | #e9e5f2 | #ece6dd | #272c3a |
| searchField.border | #cdd2de | #c5d3e3 | #dfccd4 | #d0c8e2 | #d6cab8 | #3a4052 |
| glass.fill08 | rgba(255,255,255,0.08) | rgba(255,255,255,0.08) | rgba(255,255,255,0.08) | rgba(255,255,255,0.08) | rgba(255,255,255,0.08) | rgba(28,31,42,0.08) |
| glass.fill14 | rgba(255,255,255,0.14) | rgba(255,255,255,0.14) | rgba(255,255,255,0.14) | rgba(255,255,255,0.14) | rgba(255,255,255,0.14) | rgba(28,31,42,0.14) |
| glass.fill26 | rgba(255,255,255,0.26) | rgba(255,255,255,0.26) | rgba(255,255,255,0.26) | rgba(255,255,255,0.26) | rgba(255,255,255,0.26) | rgba(28,31,42,0.26) |
| glass.fill28 | rgba(255,255,255,0.28) | rgba(255,255,255,0.28) | rgba(255,255,255,0.28) | rgba(255,255,255,0.28) | rgba(255,255,255,0.28) | rgba(28,31,42,0.28) |
| glass.fill30 | rgba(255,255,255,0.3) | rgba(255,255,255,0.3) | rgba(255,255,255,0.3) | rgba(255,255,255,0.3) | rgba(255,255,255,0.3) | rgba(28,31,42,0.3) |
| glass.fill44 | rgba(255,255,255,0.44) | rgba(255,255,255,0.44) | rgba(255,255,255,0.44) | rgba(255,255,255,0.44) | rgba(255,255,255,0.44) | rgba(28,31,42,0.44) |
| glass.fill52 | rgba(255,255,255,0.52) | rgba(255,255,255,0.52) | rgba(255,255,255,0.52) | rgba(255,255,255,0.52) | rgba(255,255,255,0.52) | rgba(28,31,42,0.52) |
| glass.fill62 | rgba(255,255,255,0.62) | rgba(255,255,255,0.62) | rgba(255,255,255,0.62) | rgba(255,255,255,0.62) | rgba(255,255,255,0.62) | rgba(28,31,42,0.62) |
| glass.fill70 | rgba(255,255,255,0.7) | rgba(255,255,255,0.7) | rgba(255,255,255,0.7) | rgba(255,255,255,0.7) | rgba(255,255,255,0.7) | rgba(28,31,42,0.7) |
| glass.fill72 | rgba(255,255,255,0.72) | rgba(255,255,255,0.72) | rgba(255,255,255,0.72) | rgba(255,255,255,0.72) | rgba(255,255,255,0.72) | rgba(28,31,42,0.72) |
| glass.fill78 | rgba(255,255,255,0.78) | rgba(255,255,255,0.78) | rgba(255,255,255,0.78) | rgba(255,255,255,0.78) | rgba(255,255,255,0.78) | rgba(28,31,42,0.78) |
| glass.fill88 | rgba(255,255,255,0.88) | rgba(255,255,255,0.88) | rgba(255,255,255,0.88) | rgba(255,255,255,0.88) | rgba(255,255,255,0.88) | rgba(28,31,42,0.88) |
| glass.fill90 | rgba(255,255,255,0.9) | rgba(255,255,255,0.9) | rgba(255,255,255,0.9) | rgba(255,255,255,0.9) | rgba(255,255,255,0.9) | rgba(28,31,42,0.9) |
| glass.fill92 | rgba(255,255,255,0.92) | rgba(255,255,255,0.92) | rgba(255,255,255,0.92) | rgba(255,255,255,0.92) | rgba(255,255,255,0.92) | rgba(28,31,42,0.92) |
| glass.fill95 | rgba(255,255,255,0.95) | rgba(255,255,255,0.95) | rgba(255,255,255,0.95) | rgba(255,255,255,0.95) | rgba(255,255,255,0.95) | rgba(28,31,42,0.95) |
| glass.line16 | rgba(255,255,255,0.16) | rgba(255,255,255,0.16) | rgba(255,255,255,0.16) | rgba(255,255,255,0.16) | rgba(255,255,255,0.16) | rgba(107,114,133,0.16) |
| glass.line18 | rgba(255,255,255,0.18) | rgba(255,255,255,0.18) | rgba(255,255,255,0.18) | rgba(255,255,255,0.18) | rgba(255,255,255,0.18) | rgba(107,114,133,0.18) |
| glass.line45 | rgba(255,255,255,0.45) | rgba(255,255,255,0.45) | rgba(255,255,255,0.45) | rgba(255,255,255,0.45) | rgba(255,255,255,0.45) | rgba(229,231,239,0.45) |
| glass.rim56 | rgba(244,247,252,0.56) | rgba(251,252,254,0.56) | rgba(254,252,252,0.56) | rgba(252,252,254,0.56) | rgba(253,252,250,0.56) | rgba(51,55,70,0.56) |
| glass.rim58 | rgba(244,247,252,0.58) | rgba(251,252,254,0.58) | rgba(254,252,252,0.58) | rgba(252,252,254,0.58) | rgba(253,252,250,0.58) | rgba(51,55,70,0.58) |
| glass.rim72 | rgba(244,247,252,0.72) | rgba(251,252,254,0.72) | rgba(254,252,252,0.72) | rgba(252,252,254,0.72) | rgba(253,252,250,0.72) | rgba(51,55,70,0.72) |
| glass.rim72Warm | rgba(245,247,252,0.72) | rgba(245,249,254,0.72) | rgba(254,248,250,0.72) | rgba(249,249,254,0.72) | rgba(250,248,244,0.72) | rgba(53,50,63,0.72) |
| glass.stroke | rgba(230,234,243,0.92) | rgba(225,232,240,0.92) | rgba(238,228,233,0.92) | rgba(228,223,239,0.92) | rgba(232,224,213,0.92) | rgba(46,50,66,0.92) |
| glass.backBorder | rgba(231,236,245,0.96) | rgba(230,236,243,0.96) | rgba(241,233,237,0.96) | rgba(233,229,242,0.96) | rgba(236,230,221,0.96) | rgba(47,51,67,0.96) |
| shadow.ink | #2d3242 | #0b1120 | #150e11 | #110e17 | #15110e | #c2c3c6 |
| shadow.card | #76809b | #556376 | #756369 | #6a647a | #72685d | #767c8c |
| shadow.dock | #81889a | #6e7d94 | #907a82 | #837c94 | #8c8073 | #858c9f |
| shadow.dialog | #111827 | #0f172a | #1c1216 | #16131f | #1c1712 | #000000 |
| shadow.black | #000000 | #000000 | #000000 | #000000 | #000000 | #000000 |
| shadow.playGlass | #2f3748 | #090e19 | #110b0d | #0d0b13 | #110e0b | #929295 |
| shadow.searchCard | #2b1f25 | #566174 | #6a5d62 | #615e6d | #645f57 | #b2adb3 |
| shadow.segment | #687189 | #5a687d | #7c6870 | #716a81 | #796e62 | #7d8395 |
| shadow.softCard | #747b8f | #6b7b92 | #8f7981 | #817a93 | #8a7f72 | #868da0 |
| shadow.menu | #7b8193 | #617086 | #877179 | #7b748c | #817669 | #8f96a9 |
| shadow.hero | #84789b | #6849c0 | #b7604d | #a168a9 | #929247 | #58c04a |
| scrim.mask | #000000 | #000000 | #000000 | #000000 | #000000 | #000000 |
| scrim.settings | rgba(34, 39, 51, 0.16) | rgba(15,23,42,0.16) | rgba(28,18,22,0.16) | rgba(22,19,31,0.16) | rgba(28,23,18,0.16) | rgba(0,0,0,0.16) |
| scrim.dialog | rgba(15,23,42,0.22) | rgba(15,23,42,0.22) | rgba(28,18,22,0.22) | rgba(22,19,31,0.22) | rgba(28,23,18,0.22) | rgba(0,0,0,0.55) |
| scrim.import | rgba(17, 24, 39, 0.32) | rgba(15,23,42,0.32) | rgba(28,18,22,0.32) | rgba(22,19,31,0.32) | rgba(28,23,18,0.32) | rgba(0,0,0,0.62) |
| scrim.menu | rgba(17, 24, 39, 0.35) | rgba(15,23,42,0.35) | rgba(28,18,22,0.35) | rgba(22,19,31,0.35) | rgba(28,23,18,0.35) | rgba(0,0,0,0.66) |
| scrim.wash | rgba(17,24,39,0.04) | rgba(15,23,42,0.04) | rgba(28,18,22,0.04) | rgba(22,19,31,0.04) | rgba(28,23,18,0.04) | rgba(0,0,0,0.16) |
| scrim.home | rgba(22,24,31,0.08) | rgba(15,23,42,0.08) | rgba(28,18,22,0.08) | rgba(22,19,31,0.08) | rgba(28,23,18,0.08) | rgba(0,0,0,0.28) |
| scrim.homeStrong | rgba(22,24,31,0.28) | rgba(15,23,42,0.28) | rgba(28,18,22,0.28) | rgba(22,19,31,0.28) | rgba(28,23,18,0.28) | rgba(0,0,0,0.48) |
| scrim.heroPhoto | rgba(0,0,0,0.45) | rgba(0,0,0,0.45) | rgba(0,0,0,0.45) | rgba(0,0,0,0.45) | rgba(0,0,0,0.45) | rgba(0,0,0,0.45) |
| scrim.lyricIdle | rgba(15,23,42,0.35) | rgba(15,23,42,0.35) | rgba(28,18,22,0.35) | rgba(22,19,31,0.35) | rgba(28,23,18,0.35) | rgba(0,0,0,0.45) |
| scrim.lyricHairline | rgba(15,23,42,0.04) | rgba(15,23,42,0.04) | rgba(28,18,22,0.04) | rgba(22,19,31,0.04) | rgba(28,23,18,0.04) | rgba(0,0,0,0.16) |
| scrim.lyricTrack | rgba(15,23,42,0.1) | rgba(15,23,42,0.1) | rgba(28,18,22,0.1) | rgba(22,19,31,0.1) | rgba(28,23,18,0.1) | rgba(0,0,0,0.22) |
| scrim.vinylRing | rgba(15,23,42,0.08) | rgba(15,23,42,0.08) | rgba(28,18,22,0.08) | rgba(22,19,31,0.08) | rgba(28,23,18,0.08) | rgba(0,0,0,0.2) |
| scrim.vinylInner | rgba(15,23,42,0.55) | rgba(15,23,42,0.55) | rgba(28,18,22,0.55) | rgba(22,19,31,0.55) | rgba(28,23,18,0.55) | rgba(0,0,0,0.7) |
| line.divider | #e1e6ef | #d9e2ec | #eadde3 | #ddd7eb | #e2d8cb | #2f3444 |
| line.soft | #d1d5db | #e6ecf3 | #f1e9ed | #e9e5f2 | #ece6dd | #2e3242 |
| line.hairline | #ececf0 | #f1f4f8 | #f7f2f4 | #f2f0f7 | #f4f0eb | #2c3140 |
| line.neutral | #e5e7eb | #eaeff5 | #f3ecf0 | #ece9f4 | #efeae2 | #2b2f3e |
| line.prompt | #eef0f3 | #f4f7fa | #f9f5f7 | #f5f4f9 | #f7f4f0 | #2c303f |
| line.panel | #d9d9de | #e1e8f0 | #efe4e9 | #e4e0ef | #e8e1d6 | #2e3343 |
| line.modal | #f1f1f3 | #f7f9fb | #faf8f9 | #f8f6fb | #f9f6f4 | #2b2f3e |
| line.detail | #e3e8f3 | #e8eef4 | #f2ebee | #ebe7f3 | #eee8e0 | #2d3241 |
| line.detailDisabled | #edf2f7 | #f4f6f9 | #f9f5f7 | #f5f3f9 | #f6f3ef | #2b2f3e |
| line.import | #d5d8e0 | #e4eaf1 | #f0e7eb | #e7e2f1 | #eae3da | #2e3342 |
| line.searchEmpty | #eadfe4 | #dae7f8 | #f6e4eb | #e7e3f7 | #e8e0d3 | #352f3a |
| line.segment | #d4ddeb | #e5ebf2 | #f1e8ec | #e8e4f1 | #ebe4dc | #2d3241 |
| line.segmentAlt | #d7deec | #e3e9f1 | #efe6ea | #e6e1f0 | #e9e2d8 | #2d3141 |
| line.importSelected | #d7e08b | #6a99f4 | #e96da1 | #a890d7 | #c79369 | #89a00c |
| line.thumb | #eef2f8 | #f6f8fa | #faf7f8 | #f7f5fa | #f8f5f2 | #232633 |
| line.white | #ffffff | #ffffff | #ffffff | #ffffff | #ffffff | #f3f4f8 |
| source.tx.text | #31c27c | #279b63 | #279b63 | #279b63 | #279b63 | #31c27c |
| source.tx.background | #ecfdf3 | #eaf9f2 | #eaf9f2 | #eaf9f2 | #eaf9f2 | #21433c |
| source.wy.text | #d81e06 | #d81e06 | #d81e06 | #d81e06 | #d81e06 | #f07167 |
| source.wy.background | #fef2f2 | #fbe9e6 | #fbe9e6 | #fbe9e6 | #fbe9e6 | #4b3137 |
| source.kg.text | #2f88ff | #2f88ff | #2f88ff | #2f88ff | #2f88ff | #60a5fa |
| source.kg.background | #eff6ff | #eaf3ff | #eaf3ff | #eaf3ff | #eaf3ff | #2b3c58 |
| source.kw.text | #f59e0b | #c47e09 | #c47e09 | #c47e09 | #c47e09 | #fbbf24 |
| source.kw.background | #fffbeb | #fef5e7 | #fef5e7 | #fef5e7 | #fef5e7 | #4d4229 |
| source.mg.text | #e11d8d | #e11d8d | #e11d8d | #e11d8d | #e11d8d | #f472b6 |
| source.mg.background | #fdf2f8 | #fce8f4 | #fce8f4 | #fce8f4 | #fce8f4 | #4c3149 |
| source.unknown.text | #111827 | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| source.unknown.background | #e5e7eb | #eef2f6 | #f6f0f2 | #f0edf6 | #f2ede8 | #282d3b |
| source.queueUnknown.text | #111827 | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| source.queueUnknown.background | #f3f4f6 | #eff2f7 | #f5eff1 | #f2eff7 | #f3efe9 | #212431 |
| source.localPlayer | #64748b | #64748b | #6e7487 | #6a758c | #6d7684 | #98a4b8 |
| source.localDetail | #475569 | #4c5a6d | #595a6b | #565c72 | #555a63 | #d0d9e4 |
| queue.current | #eff6ff | #eff5fd | #f3f4fb | #f0f4fe | #f1f4f8 | #263248 |
| queue.close | #fef2f2 | #f0eff7 | #fdeef1 | #f7eef7 | #f6ece7 | #3b2b32 |
| decor.tonearmPivot | #a7afbe | #b0bccd | #c2b0b7 | #b5aec3 | #bcb2a5 | #53596b |
| decor.tonearmArm | #b8bfcc | #b9c3d1 | #c6b8bd | #bdb9c6 | #c3bcb4 | #535869 |
| decor.tonearmHead | #7f8898 | #77879d | #968088 | #898299 | #928679 | #7e8598 |
| coverFallback.top | #f6e6de | #e8f1fe | #fdeff5 | #f3f1fe | #f2ede5 | #332730 |
| coverFallback.middle | #f8eee7 | #eff6ff | #fef4f8 | #f7f5ff | #f6f3ed | #2e262f |
| coverFallback.glow | #fbf6f2 | #f6faff | #fef9fb | #fbfaff | #faf8f5 | #2a242e |
| coverFallback.bottom | #ffffff | #ffffff | #ffffff | #ffffff | #ffffff | #1c1f2a |
| coverFallback.accent | #cf5f35 | #6592f2 | #e76aa1 | #947fc0 | #ab7e5b | #96a412 |
| homeCards[0].surface | #f2d6e6 | #d3e0fb | #f8d4e4 | #e5def2 | #eddfd4 | #49531f |
| homeCards[0].accent | #cf4f8f | #2563eb | #db2777 | #7c5cbf | #a65d28 | #c8e600 |
| homeCards[0].ink | #4f2340 | #1b4194 | #851e4b | #4e3b77 | #683e1e | #cee825 |
| homeCards[0].soft | #f9edf4 | #e9f0fd | #fceaf2 | #f2eff9 | #f6efea | #353c24 |
| homeCards[1].surface | #e7ecfa | #dcd3fb | #f8d7d4 | #efdef2 | #edecd4 | #29531f |
| homeCards[1].accent | #5f76d9 | #5125eb | #db3727 | #b15cbf | #a6a028 | #4de600 |
| homeCards[1].ink | #26355f | #331f94 | #85261f | #6b3b77 | #68621e | #66e825 |
| homeCards[1].soft | #f2f5fd | #eee9fd | #fcebea | #f7eff9 | #f6f6ea | #233c24 |
| homeCards[2].surface | #e8f0d7 | #fbe7d3 | #d4f8e1 | #f0f2de | #d4e8ed | #151b5b |
| homeCards[2].accent | #8caf33 | #eb8525 | #27db67 | #b3bf5c | #288aa6 | #0010e6 |
| homeCards[2].ink | #435817 | #885427 | #1f743c | #61673b | #235663 | #7c84f2 |
| homeCards[2].soft | #f5f8ea | #fdf3e9 | #eafcf0 | #f8f9ef | #eaf4f6 | #181d45 |
| homeCards[3].surface | #f4e6d8 | #f4fbd3 | #d4f6f8 | #e2f2de | #d4d6ed | #3a175b |
| homeCards[3].accent | #c68444 | #c6eb25 | #27d1db | #6dbf5c | #2832a6 | #9100e6 |
| homeCards[3].ink | #5b3b1c | #5d701f | #1f6f75 | #467241 | #232663 | #c67cf2 |
| homeCards[3].soft | #faf2ea | #fafde9 | #eafbfc | #f1f9ef | #eaebf6 | #2d1b45 |
| homeHeroes[0].surface | #f3d7ed | #cfddfb | #f7cfe1 | #e2dbf1 | #ebdbd0 | #505b1d |
| homeHeroes[0].accent | #613060 | #2563eb | #db2777 | #7c5cbf | #a65d28 | #c8e600 |
| homeHeroes[0].ink | #16181f | #1a3d8b | #7c1d47 | #49386f | #613a1d | #cce719 |
| homeHeroes[0].textSoft | #61556d | #3663c1 | #b93c74 | #7861aa | #935f39 | #bad040 |
| homeHeroes[1].surface | #dff0ad | #fbd0cf | #d4f7cf | #f1e9db | #d0ebe5 | #143b62 |
| homeHeroes[1].accent | #435817 | #eb2925 | #3bdb27 | #bf9d5c | #28a687 | #007be6 |
| homeHeroes[1].ink | #1f2613 | #7d2028 | #2c771f | #6b583e | #225f4d | #5dabef |
| homeHeroes[1].textSoft | #526236 | #b73d41 | #418e33 | #947d5f | #418f77 | #388ad6 |
| homeHeroes[2].surface | #f3e6d5 | #dccffb | #f7d6cf | #efdbf1 | #ebebd0 | #265b1d |
| homeHeroes[2].accent | #6b4b2e | #5e25eb | #db4327 | #b75cbf | #a3a628 | #3ee600 |
| homeHeroes[2].ink | #22170e | #371e8b | #7c2b1f | #67386f | #605f1d | #50e719 |
| homeHeroes[2].textSoft | #705640 | #5b3ac1 | #b94f40 | #9f61aa | #838133 | #60d040 |
| playlistCovers[0].surface | #f6e2e7 | #dbeafe | #fce7f0 | #ede9fe | #ebe4d7 | #3a2a32 |
| playlistCovers[0].accent | #cf385b | #587ac2 | #ba5d86 | #8776ad | #9b7658 | #8f9b14 |
| playlistCovers[0].ink | #652233 | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| playlistCovers[1].surface | #ebe4d7 | #e5f0fd | #fcedf3 | #f1eefe | #f1ece2 | #322934 |
| playlistCovers[1].accent | #8a6745 | #4325eb | #db2b27 | #aa5cbf | #958924 | #5de600 |
| playlistCovers[1].ink | #45301d | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| playlistCovers[2].surface | #e4e8f1 | #e0e7ff | #fde8e4 | #e0e7ff | #f6e2e7 | #2a3344 |
| playlistCovers[2].accent | #556b96 | #617ec3 | #bb6586 | #877cb0 | #a27a65 | #81951f |
| playlistCovers[2].ink | #293548 | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
| playlistCovers[3].surface | #ece6f2 | #d8e4ff | #fcdfe0 | #dfe1fd | #f5dfdb | #333d31 |
| playlistCovers[3].accent | #7f5da5 | #1e8ebc | #db27bf | #5c64bf | #a62b28 | #e6a800 |
| playlistCovers[3].ink | #413052 | #0f172a | #1c1216 | #16131f | #1c1712 | #f3f4f8 |
