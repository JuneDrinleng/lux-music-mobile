<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 主题颜色令牌

竖屏美化页面里的颜色字面量已经收成默认黄绿主题，并改成从 `useLuxTheme()` 读取。色值以替换前的代码为准，不以来源资料里合并过的黄绿表为准。默认主题的值不可改。

读取方式：`useLuxTheme()`（`src/theme/LuxTheme.tsx`）返回 `limeTheme`（`src/theme/luxTokens.ts`）。模块级样式用 `sharedLuxStyles`，同一个颜色对象只生成一次样式。新代码不要再写十六进制色值。`scripts/check-lux-color-literals.mjs` 会扫描下面这些文件，出现新的颜色字面量就失败（`transparent` 除外）。

## 和上游主题的关系

上游主题仍是 `src/theme/themes/createThemes.js` 生成的 `themes.ts`，经 `useTheme()` 读取。默认 id 是 `shadcn_light`。旧横屏、`src/screens/Home/Views/`、`src/components/modern/` 继续走它。

`LuxThemeProvider` 包在上游 `Provider` 里面，不替换 `ThemeContext`，不读设置里的主题项，也没有切换函数。设置弹窗输入框仍使用 `theme['c-primary-background']`，这次没有改。

另外 5 套主题只声明了 id（`mist_blue`、`sakura`、`lavender`、`oat_milk`、`ink_night`），没有色值，也没有入口。

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

另外 5 套主题仍然只有 id，没有色值，也没有切换入口。

下表是替换前的盘点。出现次数按当时的字面量统计，试点两处也算在里面。

## 含颜色字面量的文件

- `src/components/ChangelogView.tsx`
- `src/components/common/Dialog.tsx`
- `src/components/common/PromptDialog.tsx`
- `src/components/common/SegmentedIconSwitch.tsx`
- `src/components/player/PlayerBar/index.tsx`
- `src/components/playlist/PlaylistDetailHeader.tsx`
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
