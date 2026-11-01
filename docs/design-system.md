<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# Lux Music 设计规范

本文描述 **`dev` 分支竖屏界面已经落地的视觉**（杂志风 / Editorial），方便以后新增页面（人写或 Agent 写）和现有页面保持一致。它不是重新设计，也不要求把旧页面改成同一套。

数值是写进样式里的设计稿数字，基准宽度 375（`src/utils/pixelRatio.ts`）。`createStyle`（`src/utils/tools.ts`）会按屏幕缩放宽高、边距、`fontSize`、`lineHeight`；`Text` 的 `size` 走 `setSpText`。圆角、`elevation`、字距不参与这套缩放。竖屏新页应把设计数字交给 `createStyle` / `Text`，不要先乘缩放再写入。

**与 `docs/design-system-magazine.md` 的关系：** 该文件是杂志风的设计历程与全页面清单（含设计稿路径）。**Agent 实现 UI 以本文为准**；色值仍只从 `useLuxTheme()` / `magazineRoles()` 读取，默认黄绿主题的每个字面量不可改。

## 以哪些页面为准

竖屏主壳与三 Tab 已切到杂志组件。新页面对齐下面这些实现：

| 表面 | 主要文件 |
| --- | --- |
| 主壳、底栏 Dock | `src/screens/Home/Vertical/index.tsx`，`src/components/magazine/Dock.tsx` |
| 首页 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |
| 歌单 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`，`src/components/playlist/` |
| 搜索 | `src/screens/Home/Vertical/SearchPage.tsx`，`src/components/search/` |
| 设置及子页 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx`，`ResourceCacheSection.tsx`，`VersionChangelogDetail.tsx` |
| 同步登录 | `src/screens/SyncLogin/index.tsx` |
| 顶栏 | `src/components/magazine/MagTopBar.tsx`（随内容滚动，不浮动） |
| 播放详情 | `src/screens/PlayDetail/Vertical/Pic.tsx` |

容器关系见 `src/screens/Home/Vertical/Main.tsx`：Pager 三页为首页、歌单、设置；搜索与设置子页、歌单详情等盖在内容之上。恒隐藏的 `SharedTopBar` 挂载及其专用 `GlassSearchField` 已删除，顶栏搜索胶囊已退役；首页 / 歌单 / 设置各自用 `MagTopBar` + 图标入口打开搜索或设置内 `UnderlineInput`。

上游遗留表面（横屏 `src/screens/Home/Horizontal/` 仍用玻璃 `PlayerBar`、旧 `BottomNav`；`src/screens/Home/Views/`、`src/components/modern/`）视觉走上游 `useTheme()`。新竖屏页面不要照着它们抄。

## 设计理念（当前竖屏）

1. **纸色铺底，不是白卡片。** 页面底是 `paper`（`bg.app`，默认 `#eef0fb`）。内容直接排在纸上；设置主页、缓存子页等**不再**套整块白圆角卡片 + 投影。分组靠 **主线（Rule）+ 区块标题（SectionHeader）+ 留白**。
2. **字号就是层级。** 一级页用 `magType.h1`（40 / 800）；设置子页用 `magType.h2`（32 / 800）；区块用 `magType.section`（22 / 800）；眉题用 `magType.eyebrow`（11 / 700 / 字距 2 / 大写）。详见 `src/theme/magazineType.ts`。
3. **墨色写数据，强调色写「此刻 / 已选」。** 正文、按钮、返回描边用 `ink`（`ink.strong`）。`accent.primary`（默认 `#c8e600`）用于：单选圆点、Dock 进度、当前强调填充；**不要**把强调色当大段文字色（要用 `ink.olive` / `accentInk`）。
4. **线分节。** 区块前用 1px 墨色 **Rule**（`Rule.tsx`）；行与行之间用 **Hairline**（`line.divider`）。设置列表行之间只有 hairline，没有左侧 72 缩进的老分割线。
5. **底栏是 Dock，不是玻璃胶囊。** 竖屏主页底部是 `Dock`：上方 64 迷你播放条 + 顶缘进度轨，下方 58 三图标导航；纸色底、无模糊玻璃、无黄绿 orb。当前 Tab 用 **`ink` 色图标**，未选用 `quiet`；**不是**旧版 52px 黄绿圆 orb（`BottomNav.tsx` 仅横屏等遗留路径）。

播放详情仍是播放器构图（封面染色、黑胶装饰、底部面板），但颜色仍从 `useLuxTheme()` 取；不要把「设置列表」的 Section 模式原样套到播放页。

## 设计令牌

### 颜色

新竖屏颜色从 **`useLuxTheme()`** 读取；组件内优先 **`magazineRoles(colors)`**（`src/theme/magazineRoles.ts`）语义名，不要写十六进制。默认黄绿主题每个色值对应当前界面原来的字面量，**不可改**。

| 杂志角色 | 默认黄绿 | `LuxColors` 槽位 |
| --- | --- | --- |
| 页面纸底 `paper` | `#eef0fb` | `bg.app` |
| 列表主文 | `#20242d` | `ink.list` |
| 页面大标题 `display` | `#16181f` | `ink.pageTitle` |
| 数据墨 `ink` | `#111827` | `ink.strong` |
| 行副标题 `muted` | `#767d89` | `ink.secondary` |
| 眉题 `eyebrow` | `#838995` | `ink.eyebrow` |
| 未选单选 `option` | `#5f6572` | `ink.option` |
| 细线 `hairline` | `#e1e6ef` | `line.divider` |
| 强调 `accent` | `#c8e600` | `accent.primary` |
| 弱强调底 | `#dbeb92` | `accent.soft` |
| 设置图标底（分组） | 橙 `#ffedd5`、绿 `#d1fae5`、紫 `#ede9fe`、琥珀 `#fef9c3`、蓝灰 `#e2e8f0`、红 `#fee2e2` | `iconWrap.*` |
| 危险 / 喜欢 | `#ef4444` / `#FA5252` | `danger` / `like` |
| 封面占位 | `#e8eaef` | `surface.placeholder` |

完整槽位表见 `docs/theme-tokens.md` 与 `src/theme/luxTokens.ts` 注释。六套主题（雾蓝、樱粉、薰衣草、暖米、墨夜）补齐同一套槽位；设置「外观」主题只存本机。

来源色仍用 `getSourceTone`（`src/components/search/sourceTone.ts`）。歌单缺封面循环浅色见 `PlaylistTab` 的 `playlistCardTones`。

### 字号与字重

竖屏新页用 `@/components/common/Text` 的 `size` / `color`，字重写在 `style.fontWeight`。层级以 **`magType`**（`src/theme/magazineType.ts`）为准，不要再用本文旧版里的 30 号页标题或 `Typography.js`。

| 令牌 | size / 行高 | 字重 | 典型用途 |
| --- | --- | --- | --- |
| `magType.h1` | 40 / 44 | 800 | 设置、首页问候 |
| `magType.h2` | 32 / 38 | 800 | 设置子页标题 |
| `magType.section` | 22 / 28 | 800 | SectionHeader 区块名 |
| `magType.eyebrow` | 11 / 14 | 700，字距 2 | MagTopBar 刊头 masthead |
| `magType.rowTitle` | 16 / 22 | 700 | SettingRow 标题 |
| `magType.meta` | 12 / 16 | 400 | 行副标题、Dock 歌手行 |
| `magType.body` | 15 / 22 | 400 | 正文、SyncLogin 说明 |

MagTopBar 刊头：`SETTINGS · LUX MUSIC 1.8.0` 一类，11 号眉题色、大写、字距 2。

### 间距与栅格

| 常量 | 值 | 用途 |
| --- | --- | --- |
| `PAGE_GUTTER` | **22** | 页面左右内边距（替代旧 18） |
| `TOP_BAR_MARGIN_TOP` | 10 | MagTopBar 距状态栏下沿 |
| `H1_AFTER_TOP` | 18 | H1 距顶栏 |
| `RULE_GAP` / 紧凑 | 34 / 22 | 区块主线距上一块 |
| `RULE_TO_SECTION` | 12 | 主线到 SectionHeader 标题行 |
| `SETTING_ROW_MIN_HEIGHT` | 62 | 设置行 |
| `OPTION_ROW_MIN_HEIGHT` | 58 | 单选行 |
| `ICON_BLOCK` | 34 | 设置行图标方底（圆角 8） |

滚动底部让位的设计基准：**`DOCK_BASE_HEIGHT = 122`**（播放条 64 + 导航 58，`src/components/magazine/Dock.tsx`），再加 `useSystemGestureInsetBottom()`。首页和歌单根页以 `DOCK_BASE_HEIGHT` 为设计基准；非一级搜索/设置页与一起听通过 `components/common/VisibleDockHeight.tsx` 订阅主壳实际可见高度，隐藏为 0，可见时含实测分隔线及系统 inset。

### 圆角与阴影

杂志竖屏**默认无卡片阴影**。小封面 / Dock 封面 **圆角 4**；设置图标底 **8**；返回钮 40 圆、**1.5px 墨边**、透明底（`BackButton`）。旧规范里的 16–26 卡片圆角、头像 44 圆、玻璃底栏 **仅遗留页或样式表死代码** 仍可能出现，新代码不要新增。

长按拖动：歌单卡片仍遵循 `PlaylistTab` 注释——宫格只在封面上加 elevation，不改 `zIndex`。

### 多主题与深色

`buildActiveThemeColors` / `useTheme()` 仍服务横屏与 `Home/Views`。竖屏美化页走 `useLuxTheme()`；**墨夜等 Lux 主题会改变 `paper` 与 ink**，与旧文档「设置写死浅色、系统 dark 无效」的表述不同——以 `luxTokens` + `LuxTheme.tsx` 为准。上游 id `black` 主题不影响竖屏 Lux 主题选择。

## 布局模式

### 页面骨架（竖屏 Home）

`src/screens/Home/Vertical/index.tsx`：

1. 状态栏；全屏纸色 `bg.app`。
2. `Content` → `Main.tsx` Pager：Home / Playlist / Settings，每页 **ScrollView 内嵌 MagTopBar**（随滚）。
3. 底部绝对定位 **`Dock`**：`DockPlayerSlot`（封面 44 r4、歌名 15/700、播放键 44 墨圆）+ 三 Tab 图标（`home-variant-outline` / `folder-music-outline` / `cog-outline`），顶缘 **3px  accent 进度** + 拇指。
4. 键盘弹出且 `common.autoHidePlayBar` 时可隐藏 Dock。

首页顶栏右侧：搜索 `IconButton` + 圆形头像进设置。设置采用 B 版：刊头「SETTINGS · LUX MUSIC」，下方 H1 右侧搜索图标展开 **UnderlineInput** 行，输入位于标题行后，正常下推内容。

### 设置主页

`SettingsTab.tsx`：

- 一级页无返回键，系统返回逻辑不变；二级及更深页保留共享返回。B 版 MagTopBar 刊头「SETTINGS · LUX MUSIC」，顶距 18、行高 14；18 间距后 H1「设置」（magType.h1）与搜索同排（28 图标 / 44 容器，右外移 8）；可选 UnderlineInput 在标题行后。
- **资料 hero 行**：上距 22，56 头像、14 间距、22/800 单行昵称；独立同步胶囊在昵称右侧，水平间距 8、与昵称垂直居中；昵称和签名共用账户按钮，先单行省略，胶囊不收缩、不换行。签名单独在下一行（12/16），距昵称 2；无签名沿用默认签名。搜索过滤资料时仍显示胶囊，本地/关闭同步也保留入口。
- `SyncStatusPill`（`screens/SyncStatus/index.tsx`）视觉最小高 28、内边距 8、11/700 字 + 12 图标，独立 44 最小触达容器（上下各 8 实际布局留位，与账户文字按钮横向分离），账户文字上留 8 与胶囊面顶边对齐。hero 保留最小高 68、头像 56 并垂直居中，状态刷新不改变布局；放大字体允许整体增高。成功/进行中为 accent.soft + ink.olive；本地/未同步为 paper + hairline 描边 + ink.secondary；错误为 paper + danger 描边与字。无新增主题色。账户其余区域仍进 AccountPage；胶囊只打开同步详情。
- 原独立同步主线、标题及状态整行移除，服务器/账号/连接状态/最近成功同步或活跃在成功与错误详情共享的 `SyncConnectionInfo` 展示；没有时间戳显示「暂无记录」，时间戳不代表在线。
- 各 **`SectionHeader`**（主线 + 22 号标题 + 右侧 12 号 meta 英文）+ 多行 **`SettingRow`**（34 图标底 + 16 标题 + 12 副标题 + chevron）。分组：外观（`iconWrap.orange`）、搜索与播放（`iconWrap.green`）、数据与同步（`iconWrap.purple`）、开发调试（条件显示，`iconWrap.blue`）、关于（`iconWrap.amber`）。账户至外观及其余组主线上距 22、栏目头距线 6。账户列表行及空分组已移除；资料 hero 打开完整 AccountPage，退出登录仍在该页。
- 子页：`MagTopBar` + `BackButton` + H2；单选用 **`OptionRow`**（选中 10×10 accent 圆点，浅色主题带墨边）。

弹窗 / 输入：杂志组件 `MagDialog`、`UnderlineInput`、`PrimaryButton`（墨底）等；缓存 **`ResourceCacheSection`** 为 Section + SettingRow + `CacheLimitSlider`，**无**整页白卡片容器。

### 设置子页动效

设置子页统一使用 `components/common/SettingsPage.tsx` 的应用内右侧过渡，保留 Dock / 播放条。页面动效、返回与触达规则以 [软件交互规范](interaction-spec.md) 为唯一维护入口。

### 同步登录

`SyncLogin/index.tsx`：纸底、`TextTabs`（Lux / LX）、`UnderlineInput`、`PrimaryButton`；结构与设置同属杂志组件库。

### 歌单、搜索、播放详情

歌单库 / 详情 / 搜索仍见 `src/components/playlist/`、`SearchPage.tsx`；顶栏与子页返回统一 **MagTopBar + BackButton**。播放详情见 `Pic.tsx`（黑胶、来源色进度等），详细构图见 `design-system-magazine.md` §4.13。

## 组件清单

新竖屏页优先复用 **`src/components/magazine/`**（经 `index.ts` 导出）：

| 组件 | 何时用 |
| --- | --- |
| `MagTopBar` | 刊头 / 返回 / trailing 图标 |
| `SectionHeader` + `Rule` / `Hairline` | 设置与列表分节 |
| `SettingRow` | 设置入口行 |
| `OptionRow` | 单选列表 |
| `Dock` / `DockPlayerSlot` | 仅主壳；设置子页用共享可见高度留位 |
| `TextTabs`、`UnderlineInput`、`PrimaryButton`、`MagDialog`、`MagazineSheet` | 表单、面板、抽屉 |
| `RankedRow`、`SongRow`、`SourceTag` | 首页 / 搜索 / 歌单行 |
| `Text`、`MdiIcon`、`Image` | 文案与图标（设置行图标 **18**，色 **`ink`**，色相在图标底） |
| `getSourceTone` | 来源标 |

样式：`sharedLuxStyles` + `createStyle`。文案：`useI18n()`，三语 JSON。

**不要**在新竖屏页复用：已退役的胶囊搜索、`Home/Vertical/BottomNav` 玻璃轨（竖屏未接）、`src/components/modern/*` 主题卡片。

## 图标规则

MDI 经 `MdiIcon` / `mdiIconMap.ts`；`logo` 仍走 IcoMoon。Dock / 设置：**outline** 图标名与 `index.tsx` navItems 一致。返回 `chevron-left` 22；行尾 `chevron-right` 18 `quiet`。

## 图片与封面

仍遵循 `Image.tsx` / `imagePresentation.ts`：占位 `#e8eaef`，缓存命中不淡入，失败不显示唱片图。

## 动效与交互

- 按压：`SettingRow` / `OptionRow` 约 **0.7**；Dock 播放 **0.85**；BackButton **0.7**。
- 设置子页打开 / 返回：复用共享 SettingsPage，参数见 [软件交互规范](interaction-spec.md)。
- 歌单长按缩放 **1.02**，不改 `zIndex`（见 `playlistDragState.ts`）。

## 文案风格

界面文案进 `src/lang/zh-cn.json`、`zh-tw.json`、`en-us.json`。设置 Section 的 meta 可为英文栏目名（如 `APPEARANCE`）。更新日志用 `ChangelogView` 要点。

## 新页面自查清单

- 纸底：`useLuxTheme()` / `magazineRoles`，**不写 hex**。
- 左右 **22**，Section + SettingRow / OptionRow，MagTopBar 子页 + BackButton。
- 一级页之外的所有层级页面使用 SettingsPage / SubpageSurface 及共享焦点滚动；底部留位从 `useVisibleDockHeight()` 读取：Dock 隐藏为 0，可见为实测高度（含分隔线及 gesture inset）；设计基准仍为 122。
- 复用杂志组件；删除/隐藏既有 UI 时在 **PR 描述**单独列出（见 AGENTS.md）。

改规范时：**先对代码，再改本文**，并写上文件路径。

## 已知不一致

- `SettingsTab.tsx` 样式表仍保留未使用的玻璃搜索、`headerFloating`、18  padding 等旧类名。
- `PlaylistDetailOverlay.tsx` 底部歌曲留白使用实际可见 Dock + 42 内容留白；全屏导入覆盖 Dock，不重复让位。
- 横屏 `Home/Horizontal` 仍用旧 `PlayerBar` + 玻璃 `BottomNav`。
- `docs/design-system-magazine.md` 文首仍写「仅文档、未改代码」——**与 `dev` 实现不符**；以本文与代码为准。
- 强调黄绿、墨色、弱文字仍有多套近邻 hex（见 `luxTokens`）；不要「整理合并」默认主题字面量。
- 来源色、`local` 色在多个文件仍有副本。
- `page-hierarchy.md` 两 Tab 描述过时；`Main.tsx` 为三 Tab。

## 令牌文件

颜色：`src/theme/luxTokens.ts`，`useLuxTheme()`（`src/theme/LuxTheme.tsx`）。排版与间距常量：`src/theme/magazineType.ts`。角色映射：`src/theme/magazineRoles.ts`。不要在 UI 改动里改 `package.json` 版本号。
