<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# Lux Music 设计规范

本文描述 **当前竖屏界面已经落地的视觉**，方便以后新增页面（人写或 Agent 写）和现有页面保持一致。它不是重新设计，也不要求把旧页面改成同一套。

数值是写进样式里的设计稿数字，基准宽度 375（`src/utils/pixelRatio.ts`）。`createStyle`（`src/utils/tools.ts`）会按屏幕缩放宽高、边距、`fontSize`、`lineHeight`；`Text` 的 `size` 走 `setSpText`。圆角、`elevation`、阴影半径、字距不参与这套缩放。新代码应继续把下面的设计数字交给 `createStyle` / `Text`，不要先乘缩放再写入。

## 以哪些页面为准

新页面对齐下面这些已经美化过的竖屏实现：

| 表面 | 主要文件 |
| --- | --- |
| 首页 | `src/screens/Home/Vertical/Tabs/HomeTab.tsx` |
| 歌单 | `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`，以及 `src/components/playlist/` |
| 搜索 | `src/screens/Home/Vertical/SearchPage.tsx`，`src/screens/Home/Vertical/SharedTopBar.tsx`，`src/components/search/` |
| 设置及子页 | `src/screens/Home/Vertical/Tabs/SettingsTab.tsx`，`ResourceCacheSection.tsx`，`VersionChangelogDetail.tsx` |
| 底部播放条与底部导航 | `src/components/player/PlayerBar/index.tsx`，`src/screens/Home/Vertical/BottomNav.tsx` |
| 播放详情 | `src/screens/PlayDetail/Vertical/Pic.tsx` |

容器关系见 `src/screens/Home/Vertical/Main.tsx`：底部三个入口是首页、歌单、设置；搜索和设置子页、歌单详情盖在内容之上。

上游遗留表面（横屏 `src/screens/Home/Horizontal/`、`src/screens/Home/Views/` 里的旧搜索 / 歌单 / 排行榜 / 设置、`src/components/modern/`）仍在仓库里，视觉走主题 token。新竖屏页面不要照着它们抄。差异集中写在文末「已知不一致」。

## 设计理念

1. **浅色、留白、低对比底。** 首页、歌单、搜索、设置的页面底都是 `#eef0fb`，内容左右留 18，分组之间靠间距分开，而不是用深色大色块铺满屏幕。
2. **圆角和胶囊。** 搜索栏、头像、多数返回按钮是直径 44 的圆；封面和卡片用 16–26 的圆角；选中标签、筛选胶囊用全圆角。
3. **卡片和分组列表。** 歌单快捷入口、空状态、弹窗是白卡片。设置主页是「分组小标题 + 图标行 + 右箭头」，行与行之间只有一条浅分割线。
4. **黄绿做强调，黑色做图标。** 选中圆点、主按钮、底部导航当前项用同一族黄绿；设置行里的图标是黑色，颜色放在圆形底上。
5. **轻阴影。** 卡片 `elevation` 多为 2–3，阴影透明度约 0.08。浮动顶栏 `elevation: 0`，避免盖住滚动内容时打出一条硬阴影。

播放详情是同一产品里的另一张构图：白底、封面染色、黑胶唱片是播放器装饰，底部一块白面板。它仍然使用同一套墨色文字、来源色和按压反馈，但不要把「薰衣草底 + 设置列表」原样套到播放页上。

## 设计令牌

### 颜色

新美化页面的颜色目前仍大多是硬编码，不从上游 `useTheme()` 读取。新代码不要再写十六进制色值，从 `useLuxTheme()` 取色。默认黄绿主题的每个色值都对应当前界面字面量，不可改。

| 角色 | 色值 | 依据 |
| --- | --- | --- |
| 页面背景 | `#eef0fb` | `SettingsTab` `container`，`PlaylistTab` `container`，`SearchPage` `overlayRoot`，`HomeTab` `container`，`SharedTopBar` `headerFloating` |
| 卡片 / 弹窗 | `#ffffff` | 设置 `modalCard`、歌单 `quickCard`。列表模式拖动抬起仍是白底 `playlistDragLiftedList`。宫格拖动不给整张卡片铺白底 |
| 卡片内的浅底 | `#f7f8fd`、`#f8f9fd`、`#eef1f7` | 设置 `accountMetaCard`、`aboutInfoWrap`、头像内底 |
| 头像未加载底 | `#f3eef2`（外圈内底）、`#eef1f7`（大头像） | `SharedTopBar` `avatarInner`，设置 `profileDetailAvatar` |
| 封面与图片占位 | `#e8eaef` | `COVER_PLACEHOLDER_COLOR`，`src/utils/imagePresentation.ts` |
| 页面大标题 | `#16181f` | 设置与首页问候，字号 30 |
| 子页大标题 | `#1a1c1e` | 设置子页 `profileDetailTitle`，字号 22 |
| 列表主文 | `#20242d` | 设置行标题、选中的单选项 |
| 播放条 / 搜索歌名 | `#111827` | `PlayerBar`、`SearchMusicResultRow`、播放详情歌名 |
| 搜索框已输入文字 | `#232733` | `SharedTopBar` `searchInput` |
| 次级文字 | `#767d89` | 设置行副标题，字号 12 |
| 分组小标题 | `#838995` | 设置 `sectionEyebrow`，字号 11 |
| 未选中单选项 | `#5f6572` | 设置 `optionDetailText` |
| 更弱的辅助字 | `#6b7280`、`#9ca3af`、`#9aa1ae` | 搜索歌手、播放时间、右箭头、占位符 |
| 分割线 | `#e1e6ef` | 设置 `groupDivider`、`optionDetailDivider` |
| 强调黄绿（圆点、主按钮） | `#c8e600` | 设置 `languageActiveDot`、`modalBtnPrimary` |
| 底栏当前项 | `#d7ef59` | `BottomNav` `activeOrbIndicator` |
| 首页筛选选中 | `#d9ef62` | `HomeTab` `filterChipActive` |
| 图标圆底 / 胶囊标签 | `#dbeb92` | 设置 `groupRowIconWrap`、`profileHeroMetaPill` |
| 图标本体（设置行） | `#000000` | 设置页 `MdiIcon` |
| 危险 | `#ef4444` | 退出登录标题、音源删除、错误圆点 |
| 喜欢 | `#FA5252` | 播放详情与搜索结果的实心心 |

设置行图标圆的底色按分组着色（图标仍是黑色）：

| 分组 | 底色 | 样式名 |
| --- | --- | --- |
| 默认 / 资料里的部分行 | `#dbeb92` | `groupRowIconWrap` |
| 外观 | `#ffedd5` | `iconWrapOrange` |
| 搜索与播放 | `#d1fae5` | `iconWrapGreen` |
| 数据与同步 | `#ede9fe` | `iconWrapPurple` |
| 关于 | `#fef9c3` | `iconWrapAmber` |
| 退出 | `#fee2e2` | `iconWrapRed` |

来源色（标签字、标签底、播放条进度环、播放详情歌手名）在多处重复，数值一致：

| 来源 | 字色 | 浅底 |
| --- | --- | --- |
| tx | `#31c27c` | `#ecfdf3` |
| wy | `#d81e06` | `#fef2f2` |
| kg | `#2f88ff` | `#eff6ff` |
| kw | `#f59e0b` | `#fffbeb` |
| mg | `#e11d8d` | `#fdf2f8` |
| 未知 | `#111827` | `#e5e7eb` |

集中导出在 `src/components/search/sourceTone.ts` 的 `getSourceTone`。播放条进度环另有 `local: #64748b`（`PlayerBar`），播放详情歌手色另有 `local: #475569`（`Pic.tsx`）。新的来源标签优先用 `getSourceTone`。

歌单封面缺图时用一组循环浅色，而不是灰色唱片图（`PlaylistTab.tsx` 的 `playlistCardTones`）：`#f6e2e7`、`#ebe4d7`、`#e4e8f1`、`#ece6f2`。

弹窗遮罩是 `rgba(34, 39, 51, 0.16)`。取消按钮底 `#f1f4fb`，取消字 `#4b5563`。搜索栏实色是底 `#dce0e9`、边 `#cdd2de`。玻璃条（底栏、播放条）是白 `0.28` / `0.26` 加上白 `0.08` 的 tint，没有原生模糊时退回白 `0.62`（`BottomNav`、`PlayerBar` 的 `glassFallback`）。

### 主题系统怎么取色，以及深色模式

仓库里仍有完整主题系统，**新美化页面没有走它**。

- 主题表在 `src/theme/themes/createThemes.js`，生成物是 `src/theme/themes/themes.ts`。改默认主题后需要 `npm run build:theme`。
- `buildActiveThemeColors`（`src/theme/themes/index.ts`）把主题展开成 `c-font`、`c-font-label`、`c-primary`、`c-app-background`、`c-main-background`、`c-border-background` 等。组件通过 `useTheme()`（`src/store/theme/hook.ts`）读取。
- 默认主题 id 是 `shadcn_light`，名称「现代浅色」（`src/config/defaultSetting.ts`）。它的 primary 是近黑 `rgb(17, 24, 39)`，应用底 `rgb(249, 249, 249)`，卡片底白色。
- 深色主题存在：id `black`，名称「黑灯瞎火」，`isDark: true`。`common.isAutoTheme` 为 true 且系统处于深色时，`getTheme` 会切到 `black`。默认设置里 `common.isAutoTheme` 是 `false`。
- 因此：**当前产品气质是浅色。** 设置、歌单、搜索、播放详情、底栏写死浅色，系统深色或用户切换 `black` 不会改变这些页面。旧的 `src/screens/Home/Views/` 和 `src/components/modern/` 才会跟着主题变。
- `src/theme/Colors.js` 的 `AppColors`、`src/theme/Typography.js` 的 `FontSizes` / `FontWeights`（SF Pro、圆角 4）是更早的常量。新页面没有引用它们。`BorderRadius.normal`（4）只出现在少数旧弹窗。

播放详情顶部渐变另走封面取色：`src/screens/PlayDetail/Vertical/coverTheme.ts`。那是播放页局部效果，不是全站主题。

### 字号与字重

文字用 `@/components/common/Text`，用 `size` 和 `color`，字重写在样式的 `fontWeight` 上。默认 `size` 是 15。不要改用 `Typography.js` 的 Heading / Body。

| 层级 | size | 字重 | 颜色 | 出现位置 |
| --- | --- | --- | --- | --- |
| 页面大标题 | 30 | 700 | `#16181f` | 设置页标题、首页问候 |
| 子页大标题 | 22 | 700 | `#1a1c1e` | 设置子页、资料名 |
| 播放页歌名 | 24 | 700 | `#111827` | `Pic.tsx`，居中 |
| 播放页歌手 | 18 | 400 | 来源色 | `Pic.tsx` |
| 区块标题 | 18 | 700 | `#111827` | 歌单库「我的歌单」等，`PlaylistLibraryScene` |
| 弹窗标题 | 17 | 700 | `#111827` | 设置 `modalTitle` |
| 列表主文 / 单选项 | 15 | 主文 700，单选项 600 | 选中 `#20242d`，未选 `#5f6572` | 设置行、子页选项 |
| 搜索歌名 / 输入 | 14 | 歌名 700 | `#111827` / 输入 `#232733` | 搜索结果、顶栏输入 |
| 播放条歌名 | 13（卡片内 14） | 700 | `#111827` | `PlayerBar` |
| 行副标题 | 12 | 常规 | `#767d89` | 设置行第二行 |
| 分组小标题 | 11 | 700 | `#838995` | 设置 `sectionEyebrow`，字距 1.4 |
| 时间、来源旁的弱信息 | 11 | 时间 700 | `#9ca3af` 或 `#6b7280` | 播放详情时间、搜索歌手 |
| 播放条歌手 | 10（卡片内 11） | 常规 | `#6b7280` | `PlayerBar` |

分组小标题还有 `textTransform: 'uppercase'`。中文不受大小写影响，字距仍然保留。

### 圆角

| 数值 | 用途 |
| --- | --- |
| 22 | 高 44 的搜索栏、头像外圈、歌单详情返回按钮、快捷歌单卡 |
| 20 | 44 头像的内圈 |
| 34 | 底部导航轨道、首页播放条玻璃壳 |
| 26 | 设置账户大卡 |
| 24 | 居中弹窗、歌单详情 hero、播放详情底部面板顶角 |
| 18 | 歌单封面、空状态块、设置里的信息块、宫格拖动抬起 |
| 16 | 列表拖动抬起、弹窗输入、部分封面 |
| 12 | 弹窗按钮、小型描边按钮 |
| 999 | 资料胶囊标签 |
| 5 | 直径 10 的单选圆点 |

播放详情主播放键是 72×72、圆角 36。播放条播放键是 40×40、圆角 20。

### 间距

| 数值 | 用途 |
| --- | --- |
| 18 | 页面左右内边距；顶栏 `paddingHorizontal`；设置子页标题区 |
| 16 | 顶栏底部间距（`SharedTopBar` `paddingBottom`） |
| 14 | 图标圆与文字的间距；歌单宫格底部间距；快捷卡内边距 |
| 12 | 搜索栏与头像的间距 |
| 10 | 设置行上下内边距 |
| 8 | 分组小标题与列表的间距量级（小标题 `marginBottom: 6`，区块常见 14–18） |

顶栏在状态栏之下再空 18：`SharedTopBar` 的 `paddingTop` 是 `statusBarHeight + 18`。

设置行 `minHeight: 60`，左右 18。图标槽 40×40，圆角 20。行分割线高 1、颜色 `#e1e6ef`，左边距 72（让开图标），右边距 18。子页单选项行 `minHeight: 58`，分割线左右都是 18。

歌单宫格单项宽度 `48.4%`，`justifyContent: 'space-between'`。

首页、歌单、设置的滚动底部要让出底栏：`BOTTOM_DOCK_BASE_HEIGHT = 164`，再加上系统手势 inset。搜索页当前用的是 112（`SearchPage.tsx`）。新的主 Tab 内容沿用 164。

### 阴影与 elevation

| 场景 | 写法 | 依据 |
| --- | --- | --- |
| 头像、搜索实心阴影 | `shadowColor #2d3242`，opacity 0.08，radius 12，offset `(0, 6)`，`elevation: 2` | 设置与歌单里的 `avatarBubble` |
| 白卡片 | `shadowColor #76809b` 或 `#2d3242`，opacity 0.08，radius 16–18，offset `(0, 8)`，`elevation: 3` | 歌单 `quickCard`、设置 `accountCard` |
| 居中弹窗 | 同上量级，`elevation: 4`，圆角 24 | 设置 `modalCard`；`Dialog.tsx` 为 `elevation: 4`、圆角 18 |
| 底部导航 / 首页播放条 | `shadowColor #81889a`，opacity 0.12，radius 14，offset `(0, 8)`，`elevation: 5` | `BottomNav` `rail`，`PlayerBar` `containerGlass` |
| 宫格长按抬起 | `elevation: 4` 只在封面，`shadowColor #000000`，opacity 0.16，radius 6，offset `(0, 3)`，圆角 18。整张卡片没有白底 | `PlaylistTab` `playlistDragLiftedCover` |
| 列表长按抬起 | `elevation: 4`，白底，圆角 16，阴影略轻 | `PlaylistTab` `playlistDragLiftedList` |
| 浮动顶栏 | `elevation: 0` | `SharedTopBar`、各页 `headerFloating` |

宫格长按抬起时，阴影和 `elevation` 只加在封面上，歌单名和歌曲数用 `opacity` 淡出（140ms）。列表模式仍是整行白底。两种模式都不改 `zIndex`。原因写在 `PlaylistTab.tsx` 的 `playlistDragLiftedCover` 注释里：Android 在 `zIndex` 变化时会重挂视图，进行中的触摸会丢失。

## 布局模式

### 页面骨架

竖屏主页（`src/screens/Home/Vertical/index.tsx` 与 `Main.tsx`）从上到下是：

1. 状态栏。
2. 悬浮顶栏 `SharedTopBar`：左侧 44 圆形头像（点按进入设置），右侧胶囊搜索。歌单详情或搜索全屏打开时顶栏隐藏，避免和详情返回按钮抢左上角。
3. 页面内容，背景 `#eef0fb`。首页和设置在顶栏下方放 30 号大标题。
4. 底部悬浮层：玻璃播放条 `PlayerBar`（封面 48、来源色进度环、歌名、黑圆播放键）和玻璃底部导航。

底部导航三项（`BottomNav.tsx`）：首页 `home`、歌单 `folder-music`、设置 `cog`。轨道圆角 34、最小高度 74。当前项是 52 的黄绿圆 `#d7ef59`，图标 `#2a311c` 并略向左 3、放大到 1.1；未选项图标 `#5f6574`。`activeOpacity` 为 0.82。

顶栏搜索是实色胶囊，不是设置页样式表里那套更早的玻璃搜索（那套留在 `SettingsTab` 的 `searchField`，当前顶栏以 `SharedTopBar` + `GlassSearchField` 为准）：高 44、圆角 22、底 `#dce0e9`、边 `#cdd2de`。放大镜 `magnify`，`rawSize` 17，颜色 `#666d7b`。占位符 `#9aa1ae`。有文字时清除钮 `#666d7b`，没有文字时 `#bcc2cf`。

### 设置主页

`SettingsTab.tsx` 在大标题下按分组小标题排列，组与组之间不套外框卡片：

- 资料
- 外观（语言）
- 搜索与播放（搜索音源、自定义音源）
- 数据与同步（同步地址、同步格式、冲突处理、缓存）
- 关于（当前版本、检查更新、GitHub Releases）

每一行：40 圆形色底 + 黑色图标，主标题 15 / 700 / `#20242d`，副标题 12 / `#767d89`，右侧 `chevron-right-2`，`rawSize` 18，颜色 `#9aa1ae`。行按压 `activeOpacity` 0.84。

### 设置子页

子页是铺满的同色层，从右侧滑入（进入 248ms，离开 220ms，透明度 0.92 → 1）。层级在 `APP_LAYER_INDEX.controls` 之上（`src/config/constant.ts`）。

子页头部：

- 圆形返回。带「返回」二字时宽 82、高 36、圆角 18，底 `rgba(255,255,255,0.78)`，边 `rgba(231,236,245,0.96)`。图标 `chevron-left`，`rawSize` 20，颜色 `#232733`，文字 14 / 600。
- 右侧大标题 22 / 700 / `#1a1c1e`。

子页内容有两种：

- **继续用设置行**（个人资料）：头像、昵称、签名、性别、退出。退出标题用 `#ef4444`。
- **单选列表**：语言、搜索音源、同步格式、更新通道。一行一个选项，选中文字 `#20242d`，未选 `#5f6572`，选中项右侧一颗 10×10、圆角 5、颜色 `#c8e600` 的圆点。没有复选框。

需要输入的编辑（昵称、签名、同步地址）用居中白卡片：最大宽 360、圆角 24、标题 17。取消是灰底 `#f1f4fb`，确定是 `#c8e600` 底、`#111827` 字。同一结构也在 `src/components/common/PromptDialog.tsx`。

缓存子页（`ResourceCacheSection.tsx`）沿用选项行：一行容量，一行清理。

### 关于版本更新

设置里的版本子页按三个分组标题组织。页面大标题仍是「关于版本更新」（22 / 700 / `#1a1c1e`，`profileDetailTitle`）。分组标题用区块标题这一级（18 / 700 / `#111827`），样式复用 `SettingsTab` 的 `cardTitle`，左缘与 `optionDetailRow` 一样缩进 18。不要用设置主页的 11 号灰色 `sectionEyebrow`，否则会比版本号和日志分类更弱。实现文件是 `src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx`。行、分割线和圆点复用 `SettingsTab` 的子页样式。缓存管理、语言这些二级页没有第二级标题，也没有白色圆角分组卡片；这一页有三组，所以只加了区块标题，分组本身仍是 `#eef0fb` 上的 `sectionCard` / `sectionGroup`。

1. **当前版本信息**：版本号是 15 / 700 / `#20242d`（`groupRowTitle`，与缓存行同一级），通道名和发布日期是 13 / `#767d89`。
2. **更新通道**：稳定版 / 开发版两行单选，选中项右侧 `#c8e600` 圆点。
3. **更新日志**：`ChangelogView` 把正文收成要点。分类名（新增 / 修复 / 优化）是 15 / 600 / `#20242d`，要点是 15 号正文。然后才是「在 GitHub 查看完整更新日志」入口（右箭头，与设置行相同）。

写新页面或改这一页时按这三块排，不要再把通道和日志堆成没有分组标题的一整列。

### 歌单页

`PlaylistTab` 负责状态，画面拆在 `src/components/playlist/`：

- `PlaylistLibraryScene`：快捷歌单、展示切换、排序、新建。
- `PlaylistLibraryCard`：一张歌单。宫格封面圆角 18；列表行最小高度 70。
- `PlaylistDetailHeader` / `PlaylistDetailSongItem`：详情头与歌曲行。
- `PlaylistSearchScene`：从歌单进入的搜索，复用 `GlassSearchField` 和 `SearchMusicResultRow`。

详情从左侧圆形返回进入（44、圆角 22、内底 `#e8e9f0`）。封面 hero 圆角 24，封面 92、圆角 18。

### 搜索

`SearchPage.tsx` 全屏底色 `#eef0fb`。顶部是返回 + 搜索胶囊，下面是类型标题（字重 700）和分段图标切换。结果行用 `SearchMusicResultRow`：序号 14 / `#8a8f9d`，歌名 14 / `#111827`，来源标签用 `getSourceTone`，歌手 11 / `#6b7280`。空状态是白底、圆角 18 的块。历史词是描边小胶囊，圆角 14，边 `#e5e7eb`。

### 播放详情

`Pic.tsx`：页面白底。上半部分用封面做模糊染色（`coverTheme.ts`），中间是黑胶和唱臂，这是播放器造型，不是封面加载失败时的占位图。下半是白面板，顶圆角 24。歌名 24 居中，歌手用来源色。主播放键 72 的 `#111827` 圆，图标白色。上一首 / 下一首 `#374151`，循环和队列 `#9ca3af`。进度条颜色跟来源色，轨道是该色加上 `33` 透明度。

## 组件清单

新页面优先复用这些，而不是再写一套行、搜索框或弹窗。

| 组件 | 路径 | 何时用 |
| --- | --- | --- |
| `Text` | `src/components/common/Text.tsx` | 所有界面文字。用 `size`、`color`，不要裸用 React Native `Text` 写正文（更新日志里的加粗 / 行内代码除外，见 `ChangelogView`） |
| `MdiIcon` | `src/components/common/MdiIcon.tsx` | 新图标。传入 pictogrammers MDI 名称 |
| `Icon` | `src/components/common/Icon.tsx` | 已有调用可以留着。除 `logo` 外都会转到同一套 MDI。新代码优先 `MdiIcon` |
| `Image` | `src/components/common/Image.tsx` | 网络封面、头像。自带占位灰、缓存和淡入 |
| `GlassSearchField` | `src/components/search/GlassSearchField.tsx` | 高 44 的胶囊搜索外壳。顶栏已经盖了实色，需要同一种搜索框时用它 |
| `SearchMusicResultRow` | `src/components/search/SearchMusicResultRow.tsx` | 歌曲搜索结果 |
| `SearchSonglistResultRow` | `src/components/search/SearchSonglistResultRow.tsx` | 歌单搜索结果 |
| `getSourceTone` | `src/components/search/sourceTone.ts` | 来源标签颜色 |
| `PromptDialog` | `src/components/common/PromptDialog.tsx` | 带输入的确认（新建歌单、改名） |
| `Dialog` | `src/components/common/Dialog.tsx` | 带标题的白卡片弹层 |
| `confirmDialog` | `src/utils/tools.ts` | 是 / 否确认（清缓存等） |
| `ChangelogView` | `src/components/ChangelogView.tsx` | 更新日志要点 |
| `SegmentedIconSwitch` | `src/components/common/SegmentedIconSwitch.tsx` | 两个图标之间的切换（宫格 / 列表、搜索类型） |
| 歌单场景组件 | `src/components/playlist/` | 歌单库、详情、导入、拖动。页面文件只接线。约定写在 `docs/ui-refactor-interfaces.md` |
| `PlayerBar`、`BottomNav` | 见上表 | 主框架的底栏。新页面留出 164 的底部空间，不要再做一个导航 |

样式统一用 `createStyle`。文案用 `useI18n()` 的 `t()`（`src/lang/i18n.ts`）。

下面这些不要当作新页面的视觉来源：

- `src/components/modern/Surface.tsx`、`SearchBar.tsx`、`SectionHeader.tsx`：早期组件，吃主题色，圆角 16 / 12，阴影另一套。目前只有旧排行榜和 `Discover` 引用。
- `src/theme/Typography.js`、`src/theme/Colors.js`。
- `src/screens/Home/Views/**` 的列表行。

## 图标规则

全 App 图标已统一为 Material Design Icons（pictogrammers MDI，经 `react-native-vector-icons` 的 `MaterialCommunityIcons`，对应 PR #13）。

- 映射表在 `src/components/common/mdiIconMap.ts`。旧的 IcoMoon 名字（如 `chevron-right-2`、`search-2`）会转到 MDI；已经是 MDI 名字的会原样使用。
- 唯一仍走 IcoMoon 的是 `logo`（`Icon.tsx`）。应用标志不要换成通用 MDI。
- `MdiIcon` 的 `size` 会按宽度缩放；`rawSize` 是不缩放的像素，适合以前就按字号写死的箭头。
- 设置行图标：`MdiIcon` `size={24}`，颜色 `#000000`。色相放在 40 的圆底上，不要把图标本身涂成绿或紫。
- 资料子页的昵称、签名仍通过 `Icon` 画 `menu`、`comment`，`rawSize` 18，颜色 `#000000`。缓存管理与同组其他行一样用 `MdiIcon` `size={24}`、`iconWrapPurple`。新行用 `MdiIcon` 24。
- 右箭头：`chevron-right-2`（即 MDI `chevron-right`），`rawSize` 18，`#9aa1ae`。
- 返回：`chevron-left`，`rawSize` 20，`#232733`。
- 底栏：`size` 24；当前 `#2a311c`，未选 `#5f6574`。
- 顶栏搜索：`magnify`，`rawSize` 17，`#666d7b`。
- 喜欢：实心 `heart` 为 `#FA5252`，空心 `heart-outline` 为 `#9ca3af`（播放详情）或 `#737373`（搜索行）。

## 图片与封面

加载中和失败都只显示浅灰底，不放唱片图、不放 `assets/img/loadfail.png`。逻辑在 `src/components/common/Image.tsx` 和 `src/utils/imagePresentation.ts`（PR #15）。

- 占位色 `COVER_PLACEHOLDER_COLOR = #e8eaef`。没有地址或加载失败时，整块就是这个底。
- `showFallback={false}` 时不铺这块灰。
- 缓存命中（`peekCachedImageUri` 已有本地文件）：第一帧直接显示，不淡入，不先闪占位。
- 缓存未命中：先空着（灰底），下载完成后再淡入。时长 `COVER_FADE_MS = 150`，缓动 `Easing.out(Easing.cubic)`。
- 已经显示着的远程 URL 不要中途换成 `file://`。`nextCoverUri` 会保住当前远程地址，避免原生图片重挂时闪一下灰底；本地文件留到下次挂载再用。
- 本地路径和 `file://` 直接显示，不走这段淡入。

歌单缺封面时用 `playlistCardTones` 的浅色块。播放详情里的黑胶是播放器装饰，封面图层本身仍走 `Image`。

## 动效与交互

- **按压。** `TouchableOpacity` 的 `activeOpacity`：底栏、返回、搜索触发用 0.82；设置行和单选项用 0.84；列表与播放控制用 0.8；主播放键 0.85。不要用没有按压变化的裸 `View` 当按钮。
- **设置子页。** 自右滑入 248ms，返回 220ms，透明度从 0.92 到 1。
- **顶栏模式切换**（音乐搜索 / 设置搜索、头像收起）：188ms（`SharedTopBar.tsx`）。
- **歌单长按拖动。** 缩放 `PLAYLIST_LIFT_SCALE = 1.02`（`src/components/playlist/playlistDragState.ts`），140ms，`Easing.out(Easing.cubic)`（`usePlaylistCardDrag.ts`）。宫格抬起时 `elevation: 4` 和阴影只在封面圆角 18 上，歌单名和歌曲数同步用 `opacity` 淡出 140ms，占位保留；列表模式仍是整行白底、圆角 16。不要在抬起时修改 `zIndex`。
- **歌曲行长按**是另一套浮层（`useSongDragReorder.ts`）：弹簧到 1.06，出现 120ms，松手后 140ms 淡出。不要把 1.06 用到歌单卡片上，也不要为了这首浮层去改卡片的 `zIndex`。
- **底栏当前项**用位移动画跟着选中 tab，图标在选中时 `scale: 1.1`。
- **播放详情切歌封面**交叉过渡 280ms（`COVER_TRANSITION_DURATION`）。黑胶自转 30s 是播放器装饰，不是通用动效。

## 文案风格

- 界面文案走 i18n。`useI18n()` 的 `t('key')`，词条同时写进 `src/lang/zh-cn.json`、`src/lang/zh-tw.json`、`src/lang/en-us.json`。缺省语言是 `zh_cn`（`src/lang/i18n.ts`）。只改简体会在繁体和英文里直接缺句。
- 简体用词短、直接，和现有设置行一致：名词短语作标题（「语言」「同步格式」「缓存管理」），副标题补充当前值或一句说明。按钮用已有的「取消」「确定」一类键，不在组件里写死中文。
- 产品专名可以保留拉丁写法（GitHub、Lux）。不要在新的中文标题里夹英文句子。
- 更新日志用要点，不贴 GitHub 的 What's Changed 原文。解析器是 `src/utils/changelogFormat.js`：识别 `feat` / `fix` / `perf` / `refactor` 等提交前缀和 Markdown 列表，收成四组。`ChangelogView` 用圆点渲染。分组标题走 i18n：新增、修复、优化、其他（`changelog_group_feat` 等）。解析失败时退回原文，所以日志正文仍应写成列表或约定式提交说明。
- 版本子页的三块小标题（当前版本信息、更新通道、更新日志）同样要有三套语言的键，不要只在组件里写简体。

## 新页面自查清单

加页面或改 UI 之前先重读本文，然后逐项核对：

- 页面底用 `#eef0fb`（播放详情保持白底）。文字层级、圆角、间距、阴影用上面的表，不新造一套强调色。
- 设置类入口用「分组小标题 + 图标行 + 右箭头」；二选一或多选一用右侧 `#c8e600` 圆点。
- 子页用圆形返回 + 22 号大标题，从右侧进入。
- 图标用 `MdiIcon`。设置行图标黑色、24，颜色在圆底上。
- 封面用 `Image`。加载和失败只有 `#e8eaef`，缓存命中不淡入。
- 可点区域有 `activeOpacity`（0.8–0.85 这一档）。
- 长按拖动的卡片是缩放 1.02、`elevation: 4`（宫格只加在封面上）、不改 `zIndex`。
- 文案进三份语言包。更新日志用要点。
- 底部内容让出 164 + 手势 inset，不把列表画进播放条下面。
- 复用「组件清单」里的组件。歌单和搜索不要在页面文件里再堆一整份 JSX。
- **删除、隐藏或移动任何已经存在的 UI 之前，必须在 PR 描述里单独列出。** 每一处被删掉、被藏起来或被挪走的入口、按钮、文案或整块区域各写一行，并写原因。不要只写在 commit message 里。

本文件描述现状。改规范本身时，先改对应实现，再改本文，并写上文件路径。

## 已知不一致

下面只记录，本规范不要求顺手改掉。

- 新页面颜色大多仍写死。`useLuxTheme()` 已能提供同一套黄绿值，但替换硬编码的改动尚未做完，所以上游主题系统和深色主题 `black` 对它们仍不生效。默认主题底色 `rgb(249, 249, 249)` 与页面底 `#eef0fb` 也不是同一个值（`createThemes.js` 与各 Tab 的 `container`）。
- `src/theme/Typography.js`、`src/theme/Colors.js` 仍导出另一套字号和绿色 `secondary`，新页面未使用。`BorderRadius.normal` 为 4。
- `src/components/modern/` 使用主题色，圆角 16 / 12，只被旧排行榜和搜索发现页引用。
- 圆角同时存在 12、14、15、16、18、20、22、24、26、34、999。返回按钮有三档：设置子页 36 / 圆角 18，歌单详情 44 / 圆角 22，播放详情 38 / 圆角 19 且没有填充底。
- 强调黄绿有多颗：`#c8e600`、`#d7ef59`、`#d9ef62`、`#dbeb92`。墨色有 `#16181f`、`#1a1c1e`、`#20242d`、`#111827`、`#232733`。弱文字有 `#838995`、`#767d89`、`#6a707c`、`#707789`、`#6b7280`、`#9ca3af`、`#9aa1ae`、`#5f6572`、`#4b5563`。
- 阴影颜色不统一：`#2d3242`、`#76809b`、`#81889a`、`#111827`、`#000000`。
- `SettingsTab` 的样式表里仍有一套未再引用的玻璃搜索（`searchField`，白 0.28）。屏幕上的顶栏是 `SharedTopBar` 的实色胶囊 `#dce0e9`。`PlaylistTab` 的 `searchWrap` 同样只留在样式表里。
- 占位灰不完全相同：图片 `#e8eaef`，首页骨架 `#e2e6ef`（`HomeTab`），头像井 `#eef1f7` / `#f3eef2`。
- 来源色表在 `sourceTone.ts`、`PlaylistTab.tsx`、`PlayerBar`、`Pic.tsx`、`Lyric.tsx` 各有一份。`local` 的色值还不一致。
- 歌曲拖动缩放 1.06，歌单卡片拖动缩放 1.02。
- 搜索页底部留白常量是 112，主 Tab 是 164。
- 搜索区块标题有一处字重 800（`SearchPage` `initialSectionTitle`），其余大标题是 700。
- 设置资料子页的昵称、签名仍是 `Icon` + `rawSize` 18，和其余设置行的 `MdiIcon` 24 混排。
- 同步格式行的副标题直接写了 `lux music` / `lx music`（`SettingsTab.tsx`），没有走 i18n。音源菜单里有硬编码 `All`（`PlaylistTab.tsx` `getSourceMenuLabel`）。
- 播放详情在没有歌名时的兜底字符串是英文 `Midnight City Echoes` / `Neon Dreamer`（`Pic.tsx`）。
- 横屏 `src/screens/Home/Horizontal/` 和 `src/screens/Home/Views/` 仍是上游列表与主题色。`docs/page-hierarchy.md` 里关于「只有歌单和设置两个 Tab」的描述已经过时，当前 `Main.tsx` 有首页、歌单、设置三页。
- `assets/img/loadfail.png` 仍在资源清单里，`Image` 组件已经不再用它做失败图。

## 建议中的令牌文件

颜色令牌在 `src/theme/luxTokens.ts`，读取用 `useLuxTheme()`（`src/theme/LuxTheme.tsx`）。默认只有黄绿，色值与当前界面字面量一致，不可改；对照表在 `docs/theme-tokens.md`。这套上下文不替换上游 `useTheme()`。圆角、间距、字号仍以本文为准，不在颜色令牌里。已有页面里的硬编码要另开改动替换，替换时取到的值必须和原来相同。不要在同一改动里改 `package.json` 的版本号。
