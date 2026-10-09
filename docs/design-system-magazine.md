# Lux Music 杂志风设计规范（Magazine / Editorial）· v0.4

> 状态：**设计稿，仅文档**。没有改任何代码、没有开 PR。
> 读取基准：`JuneDrinleng/lux-music-mobile@dev`（2026-10-09 PT），重点参照 `docs/design-system.md`、`docs/theme-tokens.md`、`docs/page-hierarchy.md`、`docs/project-structure.md`，以及已经落地的杂志风听歌统计 `src/components/stats/ListeningStatsMagazine.tsx`（June 指定的参考页）。
> v0.4（2026-10-09 PT）：播放详情定稿 **22A-v4**：唱臂用 v3a 白臂墨边；去掉唱片与歌名之间的分隔线；喜欢旁的评论按钮换成「添加到歌单」。稿件 `pages-v2/22A-v4-player-vinyl.png`、`53-v4-warm-player-vinyl.png`、`56-v4-dark-player-vinyl.png`，对比表 `v4-22.png`。
> v0.3（2026-10-09 PT）：June 选定共用抽屉 **B 刊头**；播放详情以 **22A-v3** 为准（唱臂高对比 + 歌词移到歌手与进度条之间），v3a / v3b 两种唱臂对比方案待定。对比表 `v3-22.png`。
> v0.2（2026-10-09 PT）：June 已批准整套规范和除 14 / 25 / 26 以外的全部页面。§10 的前 4 项已拍板；播放详情**保留黑胶**；14 / 25 / 26 改由一个共用抽屉组件 `MagazineSheet` 承载（§4.15.1，A / B / C 三个方案待选）。v2 稿件在 `pages-v2/`，对比表为 `v2-sheet-A/B/C.png` 与 `v2-22.png`。
> 设计稿：`/workspace/dev-bot/magazine-design/pages/NN-*.png`（390 宽 @2x），联系表 `contact-1.png … contact-7.png`，HTML 源在 `html/`，生成脚本在 `src/`。

---

## 0. 一句话

**把整个 App 排成一本音乐杂志：纸色铺底，没有白卡片；数字和标题放大到海报级，靠细线分节；黑色写数据，只用一种强调色标出「此刻 / 当前 / 被选中」。**

---

## 1. 设计理念

1. **纸，不是卡片。** 页面底就是一张纸（`paper` = 现有 `bg.app`）。内容直接印在纸上，不再套白色圆角容器、不加投影。分组靠「粗细两种线 + 留白」，而不是靠盒子。
2. **字号就是层级。** 一页只有一个主角：一个超大数字（32 分、1.24 GB、1.8.0、86 首）或一个超大标题（听歌统计、飙升榜）。其余信息用 11 号大写字距小眉题、22 号区块标题、16 号行标题、12 号说明逐级让位。
3. **黑色负责数据，强调色负责「现在」。** 时长、计数、排名、主按钮都用墨色（`ink`）。强调色（`accent`）只出现在：当前时段的那根柱子、涨跌胶囊、正在播放、被选中的单选点、底栏当前项、进度/滑块拇指。每屏强调色元素的「语义」只有一个：**此刻 / 当前 / 已选**。
4. **线有两种。** 区块之间用 1px 墨色「主线」（rule，透明度 .9）；行与行之间用 1px 浅色「细线」（hairline）。主线后面紧跟区块标题，像杂志栏目开头。
5. **编辑式列表。** 排名用 30 号大数字：第 1 名实心，2–5 名描边空心；普通序号用 15 号两位数（01、02）。封面是「接近方形」的小圆角（4–6），不再用 16–26 的大圆角。
6. **克制的装饰。** 没有玻璃、没有渐变底、没有投影。唯一的「装饰」是排版本身：大小对比、字距、留白和线。封面图片承担色彩。

---

## 2. 页面清单（竖屏，按代码盘点）

> 来源：`src/navigation/registerScreens.tsx`、`src/screens/Home/Vertical/Main.tsx`（底栏三页：首页 / 歌单 / 设置；`page-hierarchy.md` 里「只有两个 Tab」已过时）、`SettingsTab.tsx` 的 `activeOptionDetail`（11 个子页）及其 5 个 `Modal`、`PlaylistTab.tsx`、`src/components/playlist/*`、`src/components/stats/*`、`src/screens/PlayDetail/Vertical/index.tsx`（Pager：评论 / 播放 / 歌词）、全局 Host 与 `navigation/components/*`。

| # | 页面 / 浮层 | 源文件 | 设计稿 |
| --- | --- | --- | --- |
| 01 | 启动闪屏 | `src/screens/Launch/index.tsx`、`src/screens/Launch/HomeBootSplash.tsx` | `01-launch-splash.png` |
| 02 | 欢迎与协议确认（首启） | `src/screens/Login/index.tsx` | `02-welcome.png` |
| 03 | 许可协议 / 安全提醒全文 | `src/screens/Agreement/index.tsx` | `03-agreement.png` |
| 04 | 协议更新弹窗 | `src/navigation/components/PactModal.tsx` | `04-pact-modal.png` |
| 05 | 同步登录（Lux 账号 / LX 连接码 / 无同步使用） | `src/screens/SyncLogin/index.tsx` | `05-sync-login.png` |
| 06 | 权限请求 | `src/components/PermissionPromptHost.tsx`（经 `PromptDialog`） | `06-permission.png` |
| 07 | 首页·全部（问候、筛选、每周发现、热门日推） | `src/screens/Home/Vertical/Tabs/HomeTab.tsx`（`AllContent`）、`SharedTopBar.tsx` | `07-home.png` |
| 08 | 首页·热门 / 其他（榜单速览） | `HomeTab.tsx`（`LbContent` / `OtherContent`） | `08-home-charts.png` |
| 09 | 歌单库·宫格（资料头、快捷入口、我的歌单） | `Tabs/PlaylistTab.tsx`、`components/playlist/PlaylistLibraryScene.tsx`、`PlaylistLibraryCard.tsx` | `09-library.png` |
| 10 | 歌单库·列表模式 + 来源筛选菜单 + 拖动排序 | 同上，`usePlaylistCardDrag.ts` | `10-library-list.png` |
| 11 | 歌单详情（自建） | `components/playlist/PlaylistDetailView.tsx`、`PlaylistDetailHeader.tsx`、`PlaylistDetailSongItem.tsx`、`PlaylistDetailOverlay.tsx` | `11-playlist-detail.png` |
| 12 | 歌单详情·多选（单选 / 区间 / 反选，添加 / 移动 / 移除） | `PlaylistDetailView.tsx`、`MusicMultiAddModal/*` | `12-playlist-select.png` |
| 13 | 榜单 / 在线歌单详情（一键转存） | `PlaylistDetailView.tsx`（leaderboard / online 类型）；遗留 `src/screens/LeaderboardDetail/index.tsx` | `13-online-detail.png` |
| 14 | 导入歌单面板（把其他歌单里、本歌单没有的歌导进来；已去重，不含试听列表） | `components/playlist/PlaylistImportPanel.tsx`、`hooks/usePlaylistImport.ts`、调用处 `PlaylistDetailView.tsx` | `pages-v2/14A/B/C-import-panel.png`（旧稿 14 作废） |
| 15 | 歌单内搜索 | `components/playlist/PlaylistSearchScene.tsx` | `15-playlist-search.png` |
| 16 | 本地歌曲 | `components/playlist/LocalSongsDetail.tsx` | `16-local-songs.png` |
| 17 | 听歌统计·杂志风（参考页） | `components/stats/ListeningStatsMagazine.tsx`、`ListeningStatsPage.tsx` | `17-stats-magazine.png` |
| 18 | 听歌统计·年度回顾风 | `components/stats/ListeningStatsReplay.tsx` | `18-stats-replay.png` |
| 19 | 搜索·最近搜索与建议 | `src/screens/Home/Vertical/SearchPage.tsx` | `19-search-initial.png` |
| 20 | 搜索结果·歌曲 | `SearchPage.tsx`、`components/search/SearchMusicResultRow.tsx`、`HighlightText.tsx` | `20-search-songs.png` |
| 21 | 搜索结果·歌单 | `SearchPage.tsx`、`components/search/SearchSonglistResultRow.tsx` | `21-search-songlists.png` |
| 22 | 播放详情（保留黑胶 + 唱臂） | `src/screens/PlayDetail/Vertical/Pic.tsx`、`components/SeekBar.tsx`、`Home/Vertical/PlayDetailOverlay.tsx` | `pages-v2/22A-v4-player-vinyl.png`（定稿；旧稿 22 与 v2 / v3 存档） |
| 23 | 歌词 | `src/screens/PlayDetail/Vertical/Lyric.tsx` | `23-lyrics.png` |
| 24 | 评论（热门 / 最新） | `src/screens/Comment/index.tsx`、`Comment/components/*`（竖屏以 embedded 形式嵌在播放 Pager 第 0 页） | `24-comments.png` |
| 25 | 播放队列（只有临时列表可加歌 / 移除 / 清空） | `src/screens/Home/Vertical/PlayQueueSheet.tsx` | `pages-v2/25A/B/C-play-queue.png`（旧稿 25 作废） |
| 26 | 添加 / 移动到歌单（含行内新建列表） | `components/MusicAddModal/*`（`Title`、`TargetPlaylistList`、`CreateUserList`；由搜索、队列、歌单搜索、歌单详情调起）；多选版 `MusicMultiAddModal/*` 共用同一列表 | `pages-v2/26A/B/C-add-to-playlist.png`（旧稿 26 作废） |
| 27 | 设置主页 | `Tabs/SettingsTab.tsx` | `27-settings.png` |
| 28 | 设置搜索（含无结果） | `SharedTopBar.tsx`（settings 模式）、`SettingsTab.tsx` `emptySearchCard` | `28-settings-search.png` |
| 29 | 个人资料 | `SettingsTab.tsx`（profileDetail 层） | `29-profile.png` |
| 30 | 修改昵称 / 签名弹窗 | `SettingsTab.tsx`（`isNameModalVisible` / `isSignatureModalVisible`） | `30-edit-nickname.png` |
| 31 | 语言 | `SettingsTab.tsx`（`language`） | `31-language.png` |
| 32 | 主题 | `SettingsTab.tsx`（`theme`）、`src/theme/luxTokens.ts` | `32-theme.png` |
| 33 | 统计页样式 | `SettingsTab.tsx`（`statsPageStyle`） | `33-stats-style.png` |
| 34 | 搜索来源 | `SettingsTab.tsx`（`searchSource`） | `34-search-source.png` |
| 35 | 自定义源（选择 / 导入 / 管理） | `SettingsTab.tsx`（`player`）、`Home/Views/Setting/settings/Basic/Source.tsx` | `35-custom-source.png` |
| 36 | 同步服务（地址记录 / 新增 / 管理） | `SettingsTab.tsx`（`sync`）+ 同步地址、连接码弹窗 | `36-sync-host.png` |
| 37 | 同步格式 | `SettingsTab.tsx`（`syncFormat`） | `37-sync-format.png` |
| 38 | Lux 账号登录弹窗 | `SettingsTab.tsx`（`isLuxLoginModalVisible`） | `38-lux-login.png` |
| 39 | 缓存管理 | `Tabs/ResourceCacheSection.tsx`、`CacheLimitSlider.tsx` | `39-cache.png` |
| 40 | 关于版本更新（当前版本 / 更新通道 / 更新日志） | `Tabs/VersionChangelogDetail.tsx`、`components/ChangelogView.tsx` | `40-about.png` |
| 41 | 性别 | `SettingsTab.tsx`（`gender`） | `41-gender.png` |
| 42 | 导出 / 导入数据·选择位置 | `components/common/ChoosePath/*`（含 `NewFolderModal`、`OpenStorageModal`） | `42-backup-path.png` |
| 43 | 首次同步方式（冲突策略） | `src/navigation/components/SyncModeModal.tsx` | `43-sync-mode.png` |
| 44 | 版本更新弹窗 | `src/navigation/components/VersionModal.tsx` | `44-version-modal.png` |
| 45 | 通用确认 + Toast（退出登录、清缓存、删除歌单等） | `components/AppDialogHost.tsx`、`common/ConfirmAlert.tsx`、`utils/tools.ts` `confirmDialog` / `toast` | `45-confirm-toast.png` |
| 46 | 新建 / 重命名歌单 | `components/common/PromptDialog.tsx`（`PlaylistLibraryScene` / `PlaylistDetailView`） | `46-new-playlist.png` |
| 47 | 自定义源管理（实验性） | `Home/Views/Setting/settings/Basic/UserApiEditModal/*` | `47-user-api.png` |
| 48 | 播放器设置 + 定时停止（**横屏遗留，竖屏未接入**） | `PlayDetail/components/SettingPopup/*`、`components/TimeoutExitEditModal.tsx` | `48-player-settings.png` |
| 49 | 组件样张（按钮、胶囊、Tabs、开关、滑块、输入、封面、加载、空状态、Toast、图标） | — | `49-components.png` |
| — | 迷你播放条 + 底部导航 | `components/player/PlayerBar/index.tsx`、`Home/Vertical/BottomNav.tsx` | 出现在所有主页面底部 |

主题变体：`50-warm-home`、`51-warm-library`、`52-warm-stats`、`53-warm-player`、`54-warm-settings`（暖米）；`55-dark-stats`、`56-dark-player`、`57-dark-settings`（墨夜）。其中 53 / 56 播放详情以 `pages-v2/53-warm-player-vinyl.png`、`pages-v2/56-dark-player-vinyl.png`（黑胶 A 方案）为准。

**不在本次范围（只记录）：** 横屏 `src/screens/Home/Horizontal/*`、`src/screens/PlayDetail/Horizontal/*`；上游旧视图 `src/screens/Home/Views/**`（旧排行榜 `MusicList`、`SearchTypeSelector`、旧设置分页）；`src/components/OnlineList/*`（`ListMenu`、`MultipleModeBar`）；`src/components/DesktopLyricEnable.tsx`（桌面歌词悬浮窗权限，竖屏未引用）；`src/components/modern/*`。`SettingPopup` 与 `TimeoutExitEditModal` 只在横屏用到，因为将来竖屏可能接入，所以仍画了 48 号稿。

---

## 3. 设计令牌

### 3.1 杂志角色 → 现有 `LuxColors`（不新增色值）

杂志风**只新增「角色名」，不新增颜色**。每个角色都指向 `src/theme/luxTokens.ts` 里已有的槽位，所以默认黄绿主题的色值 100% 保持不变（满足「默认黄绿色值不可改」与单测锁定）。建议在 `luxTokens.ts` 旁加一个只读映射 `magazineRoles(colors)`，组件只读角色名。

| 杂志角色 | 映射到的现有令牌 | 用途 |
| --- | --- | --- |
| `paper` 纸 | `bg.app` | 所有页面、弹窗、底部面板、底栏的底色（播放详情也改用纸色，见 §4.13） |
| `paperRaised` | `bg.plain` / `surface.card` | **只**留给图片占位外的极少数需要抬起的元素（例如拖动中的行）。不得再用作卡片 |
| `display` 标题墨 | `ink.pageTitle` | 40 号页面标题、超大数字、22 号区块标题 |
| `ink` 数据墨 | `ink.strong` | 正文主色、主线（rule）、主按钮底、柱状图、选中 Tab 下划线、返回按钮描边 |
| `ink.list` | `ink.list` | 设置行标题、列表行标题（与 `ink` 同级，略柔） |
| `muted` 次要墨 | `ink.secondary` | 行副标题、说明、单位（分、GB） |
| `eyebrow` 眉题墨 | `ink.eyebrow` | 11 号大写眉题、区块右侧小 meta、坐标轴 |
| `option` | `ink.option` | 未选中的单选项 |
| `faint` 淡墨 | `ink.faint` | 描边排名数字（2–5）、时长、脚注 |
| `quiet` 静墨 | `ink.quiet` | 未选中 Tab、右箭头、占位符、未选底栏项 |
| `hairline` 细线 | `line.divider` | 行间分割、Tab 底线、空柱 |
| `accent` 强调 | `accent.primary` | 「此刻 / 当前 / 已选」：当前柱、涨跌胶囊、单选点、底栏当前标记、进度条已播、滑块拇指 |
| `accentSoft` 弱强调 | `accent.soft` | 搜索高亮的「荧光笔」底、示例/状态小胶囊底、下降胶囊 |
| `onAccent` | `ink.onAccent` | 强调底上的字和图标 |
| `accentInk` 强调字 | `ink.olive` | 需要「强调色的文字」时用它（正在播放、已授权勾）。**不要**把 `accent` 直接当文字色 |
| `onInk` | `ink.onControl` | 墨色底（主按钮、播放键、Toast）上的字 |
| `danger` / `like` | `danger` / `like` | 删除、退出、错误；喜欢 |
| `placeholder` | `surface.placeholder` | 封面加载 / 失败底 |
| `skeleton` | `surface.skeleton` | 骨架条 |
| `scrim` | `scrim.import`（底部面板、弹窗统一） | 遮罩 |
| 设置图标底 | `accent.soft`（资料组）、`iconWrap.orange/green/purple/amber/red` | 见 §5 |
| 来源色 | `source.*`（`getSourceTone`） | 来源标签改为**描边小方标**：字色 + 1px 同色边，无底 |

> 角色收敛：现有 227 个槽位里，杂志风页面只需要上表约 20 个。其余（`glass.*`、`homeCards`、`homeHeroes`、`shadow.*`、`surface.searchEmpty` 等）在迁移完成后成为「仅遗留页面使用」，不删除，等旧页面下线再清理。

### 3.2 六套主题的杂志角色色值

全部取自 `docs/theme-tokens.md`「六套主题色值」现有值。

| 角色 | 黄绿（默认） | 雾蓝 | 樱粉 | 薰衣草紫 | 暖米 | 墨夜（深色） |
| --- | --- | --- | --- | --- | --- | --- |
| paper `bg.app` | `#eef0fb` | `#eef3f9` | `#faf0f3` | `#f3f0fb` | `#f6f1ea` | `#12141c` |
| display `ink.pageTitle` | `#16181f` | `#131c2f` | `#21161a` | `#1a1725` | `#201a15` | `#eff0f5` |
| ink `ink.strong` | `#111827` | `#0f172a` | `#1c1216` | `#16131f` | `#1c1712` | `#f3f4f8` |
| muted `ink.secondary` | `#767d89` | `#556274` | `#7a646e` | `#716a82` | `#6f6458` | `#a0a6b8` |
| eyebrow `ink.eyebrow` | `#838995` | `#64748b` | `#8a747c` | `#7d768f` | `#867a6d` | `#8b92a5` |
| faint `ink.faint` | `#9ca3af` | `#94a3b8` | `#a8929a` | `#9a93a8` | `#a3988b` | `#6b7285` |
| quiet `ink.quiet` | `#9aa1ae` | `#8393a8` | `#9e8890` | `#90899f` | `#998e81` | `#767d90` |
| hairline `line.divider` | `#e1e6ef` | `#d9e2ec` | `#eadde3` | `#ddd7eb` | `#e2d8cb` | `#2f3444` |
| accent `accent.primary` | `#c8e600` | `#2563eb` | `#db2777` | `#7c5cbf` | `#a65d28` | `#c8e600` |
| accentSoft `accent.soft` | `#dbeb92` | `#bfdbfe` | `#f9c2d4` | `#ddd0f5` | `#f0d5b8` | `#3d4a1a` |
| onAccent `ink.onAccent` | `#111827` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#111827` |
| accentInk `ink.olive` | `#58651b` | `#173473` | `#651a3b` | `#3d2f5c` | `#50321a` | `#d1e932` |
| onInk `ink.onControl` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#12141c` |
| danger | `#ef4444` | `#ef4444` | `#dc2626` | `#ef4444` | `#dc2626` | `#f87171` |
| like | `#FA5252` | `#FA5252` | `#e11d48` | `#FA5252` | `#e11d48` | `#fb7185` |

**强调色使用规则**

- 强调色只做**填充**（柱子、胶囊、圆点、拇指、2–3px 标记条），**不做文字色、不做大面积底**。黄绿 `#c8e600` 在纸上作文字对比度不足；要「强调色的字」用 `accentInk`。
- 浅色主题的单选点 / 拇指在强调填充外加 1.5–2px 墨色描边，保证黄绿、樱粉等浅强调色在纸上也看得清；墨夜不加描边。
- 每个视口里，强调色元素只表达一件事。参考页：今天这根柱 + 「↑32分」胶囊，都在说「今天」。
- 主按钮是**墨色**，不是强调色（现状 `modalBtnPrimary` 用 `#c8e600`，迁移时改为 `ink`）。

### 3.3 字体排印

字体：拉丁与数字 Roboto（Android 系统字体，800 可用），中文 Noto Sans CJK SC。数字一律开 `tnum`（RN：`fontVariant: ['tabular-nums']`）。字号仍是 375 基准的设计数字，交给 `createStyle` / `Text` 缩放。

| 层级 | 字号 / 行高 | 字重 | 字距 | 颜色 | 用在哪 |
| --- | --- | --- | --- | --- | --- |
| Display XL 数字 | 120 / 120 | 800 | -6 | display | 统计主时长（32分），单位 30/700 跟在后面 |
| Display L 数字 | 56–96 / 1.0 | 800 | -2 ～ -4 | display | 1.24 GB、1.8.0、86 首、1.2万 条评论、飙升榜（标题型） |
| H1 页面标题 | 40 / 44 | 800 | -1 | display | 一级页：设置、听歌统计、你好 June、本地歌曲 |
| H2 子页标题 | 32 / 38 | 800 | -0.8 | display | 设置子页、详情页标题、多选状态「已选 3 首」 |
| 区块标题 | 22 / 28 | 800 | -0.3 | display | 主线下的栏目名：时段分布、TOP 5 歌曲、外观 |
| 弹窗标题 | 22 / 28 | 800 | -0.3 | display | 所有弹窗、底部面板标题（面板可用 26） |
| 眉题 Eyebrow | 11 / 14 | 700 | 2，大写 | eyebrow | `LISTENING · 10月9日 周五`、`SETTINGS · 外观`、表单字段名 |
| 区块 meta | 12 / 16 | 600 | 1 | eyebrow | 区块标题右侧：按收听时长、APPEARANCE、48 首 · 自定义排序 |
| Tab | 15 / 20（小号 13） | 选中 800 / 未选 600 | 0 | ink / quiet | 范围 Tab、筛选、来源 |
| 排名数字 | 30 / 30（小号 20–22） | 800 | -1 | #1 display 实心；2–5 faint 描边 | 编辑式排名 |
| 序号 | 15 / 20 | 700 | 0 | faint | 普通歌曲列表 01、02… |
| 行标题 | 16 / 22 | 700 | 0 | ink / list | 歌名、歌单名、设置行 |
| 正文 | 15 / 22–25 | 400–500 | 0 | list | 评论、更新日志、协议 |
| 引导 Lead | 15 / 22 | 400 | 0 | muted | 标题下一句说明 |
| 行副标题 / meta | 12 / 16 | 400–600 | 0 | muted | 歌手 · 专辑、设置当前值 |
| 数值 | 15 / 20（单位 11/600 muted） | 800 | 0 | ink | 行尾时长 8分、15 小时 |
| 脚注 / 刻度 | 10–12 / 13–18 | 400–600 | 0 | faint / eyebrow | 图表坐标、脚注 |

> Android 中文字体通常只有 400 / 700 两档，800 会落到 700。超大数字、英文眉题走 Roboto，不受影响；中文标题 800 在设备上视同 700，设计稿按 800 绘制即可。

### 3.4 间距与栅格

- **页边距 22**（参考页 `content.paddingHorizontal: 22`，替代旧的 18）。内容宽 375 基准下为 331，390 屏上为 346。
- 4pt 基准。常用：4 / 6 / 8 / 10 / 12 / 14 / 18 / 22 / 28 / 34。
- **垂直节奏**（照参考页）：顶栏 `marginTop 10`；H1 距顶栏 18；眉题距 H1 8；Tab 距眉题 22；大数字标签距 Tab 28；**主线距上一块 34**，区块标题距主线 12，列表距区块标题 6。紧凑场景（子页第一组）主线距 22。
- 列表行：最小高 64（封面 46）、上下 12；设置行最小高 62、上下 10；单选行最小高 58；紧凑行（队列、导入、搜索建议）52–58。
- 双栏网格：两列，列距 14，行距 18，封面方形填满列宽（390 屏 166）。
- 底部让位：主 Tab 内容底部让出「播放条 64 + 底栏 58 + 手势 inset」，沿用 `BOTTOM_DOCK_BASE_HEIGHT` 的思路，数值按新底栏重算（约 140 + inset）。搜索页与主 Tab 统一，不再有 112 / 164 两套。

### 3.5 线

| 名称 | 规格 | 用途 |
| --- | --- | --- |
| 主线 rule | 1px，`ink`，opacity .9 | 区块开头、子页单选列表顶、弹窗顶（3px）、底栏顶 |
| 细线 hairline | 1px，`hairline` | 行间、Tab 底线、底栏内部分隔、快捷入口竖分隔 |
| 下划线 Tab | 3px，`ink`，圆角 2，压住 Tab 底线 | 选中 Tab |
| 输入下划线 | 1.5px，`ink`（未聚焦可用 hairline 1px；错误 `danger`） | 所有输入框 |
| 引用线 | 2px，`hairline`，左侧 | 评论楼中楼 |
| 强调标记 | 3px，`accent` | 正在播放行左缘、当前歌词左缘、底栏当前项顶 |

### 3.6 圆角与阴影

- 圆角收敛为四档：**0**（线、标记）、**4**（≤ 44 的小封面、Toast、菜单、来源标、复选框 3）、**6**（46–346 的封面、列表封面、hero 封面）、**8**（弹窗）、**14**（底部面板顶角）、**999**（按钮、胶囊、头像、播放键）。
- 不再使用 16 / 18 / 20 / 22 / 24 / 26 / 34。
- **没有阴影**。抬起只在拖动时用 `paperRaised` + 现有 `elevation: 4`（宫格只加在封面上的规则保留）。菜单用 1.5px 墨边 + 4px 硬阴影（hairline 色，偏移 4,4）代替模糊投影。

---

## 4. 组件

### 4.1 顶栏 Top bar
- 一级页（首页 / 歌单 / 设置）：左侧**眉题当刊头**（`LUX MUSIC · 10月9日 周五`、`LIBRARY · 我的音乐`、`SETTINGS · LUX MUSIC 1.8.0`），右侧图标按钮（搜索 24、头像 32）。下面紧接 H1。不再有胶囊搜索框悬浮顶栏；搜索改成图标入口（首页、歌单）或页内下划线搜索行（设置）。
- 子页 / 详情：左侧返回，右侧 0–2 个 40×40 图标按钮或一个文字按钮（管理、关闭、全选）。下面：眉题（所属栏目）→ H2 标题。
- 顶栏不浮动、不加底色、不加阴影，随内容滚动；需要常驻时（长列表）滚过 H1 后在顶栏中间淡入 15/800 的小标题，并在顶栏底出现 hairline。

### 4.2 返回按钮
- 40×40 圆，1.5px `ink` 描边，透明底，`chevron-left` 22 `ink`。播放详情用 `chevron-down`。
- 全 App 只此一种（替代现在 36 / 44 / 38 三档）。不带「返回」文字。

### 4.3 文字 Tabs（范围 / 筛选 / 来源）
- 横排文字，间距 22（小号 18），底部一条 hairline；选中项 800 + `ink` + 3px 下划线；未选 600 + `quiet`。
- 用于：统计范围、首页筛选（全部 / 新发布 / 趋势 / 热门 / 其他）、榜单来源、搜索类型（歌曲 / 歌单）、本地歌曲（全部 / 设备 / 已缓存）、评论（热门 / 最新）、播放 Pager（评论 / 播放 / 歌词）。
- 超出宽度时横向滚动，不换行，不缩字号。

### 4.4 分段控件（备选）
- 只在「两项、需要强对比、且不是导航」时用：1.5px 墨边胶囊，选中段墨底纸字。例：宫格 / 列表若要文字化时。默认仍优先文字 Tabs 或两枚图标（选中 `ink`、未选 `quiet`）。
- `SegmentedIconSwitch` 迁移为「两枚图标 + 颜色区分」，去掉轨道和拇指。

### 4.5 区块头 Section header
- 主线 → 12 → 一行：左 22/800 标题，右 12/600 字距 1 的 `eyebrow` meta（排序方式、数量、英文栏目名），或一个「查看全部 →」文字链接（`ink`，700）。基线对齐。

### 4.6 编辑式排名行（Ranked row）
- 排名数字宽 44：#1 实心 `display`，#2–#5 **描边空心**（1.1px `faint`），字号 30/800。6 名以后退成 15 号序号。
- 封面 46–52，圆角 6；标题 16/700；副标题 12 `muted`；右侧数值 15/800 + 单位 11/600 `muted`，或「…」更多。
- 行间 hairline，最后一行无线。
- RN 实现：描边数字用 `react-native-svg` 的 `<Text stroke fill="none">`；做不到时退回 `fontWeight: '300'` + `faint`（即现在参考页的写法）。

### 4.7 歌曲行 Song row
- `[序号 30 | 封面 46 r6 | 标题 / 来源标 + 歌手 · 专辑 | 时长 12 faint | 操作]`。
- 来源标：10/700，字色 = 来源色，1px 同色描边，圆角 3，无底。
- 正在播放：序号换成 `equalizer` 图标（`accentInk`），整行左缘 3px `accent` 标记条。不改底色。
- 操作：拖动柄 `drag-horizontal-variant` 18 `quiet`；喜欢心形 20；更多 `dots-vertical` 20。
- 搜索命中：关键字用 `accentSoft` 做「荧光笔」底，字色不变。

### 4.8 封面尺寸

| 尺寸 | 圆角 | 用途 |
| --- | --- | --- |
| 40–44 | 4 | 播放条、队列、添加到歌单、歌词页头 |
| 46 | 6 | 列表行、排名行 |
| 52–64 | 6 | 榜单行、歌单列表行、歌单搜索结果 |
| 112–120 | 6 | 歌单详情头 |
| 166（半宽） | 6 | 歌单宫格 |
| 346（满宽） | 6 | 播放详情、每周发现、年度最常听 |

缺图仍用 `playlistCovers` 浅色块 + 图标；加载 / 失败仍是 `placeholder`，淡入与缓存规则不变（`Image.tsx`）。

### 4.9 按钮
- **主按钮**：高 44，全圆角，`ink` 底、`onInk` 字 15/700，可带 20 号图标。每屏最多一个。
- **次按钮**：高 44，全圆角，1.5px `ink` 描边，透明底，`ink` 字。
- **文字按钮**：14/700 `ink`，1.5px 下划线（偏移 4）；弱化版 `muted` 无下划线（取消）。
- **危险按钮**：`danger` 底白字；只在确认弹窗里。危险的入口行用 `danger` 文字，不用红按钮。
- 弹窗、面板底部：两个等宽按钮（次 + 主），间距 10。

### 4.10 胶囊 / 标签
- **涨跌胶囊 Delta pill**：高 26，全圆角，`accent` 底 `onAccent` 字 13/800，前置 14 号箭头。下降用 `accentSoft` 底 + `pillInk` 字（不用红色，杂志不制造焦虑）。
- **状态胶囊**：`今日 32 分钟`、`稳定版`、`1GB`：同上规格；数值类（缓存上限）高 24、字 12。
- **筛选 Chip**：高 30，1px `hairline` 描边，13/600；选中墨底纸字。用于历史搜索、定时分钟、推荐关键词。
- **示例 / 说明小标**：10/700，`accentSoft` 底。

### 4.11 开关、复选、单选
- **单选**：选中项文字 800 `ink` + 右侧 10 号 `accent` 圆点（浅色主题加 1.5px 墨描边）；未选 600 `option`。不加复选框。（与现状一致，只换字重。）
- **复选**：20×20，1.5px `ink` 描边，圆角 3；选中墨底 + 纸色粗勾。
- **开关**：44×26 胶囊，1.5px 描边；关：`quiet` 描边 + `quiet` 拇指；开：`ink` 底 + `accent` 拇指。

### 4.12 滑块
- 轨道 2px `hairline`，已滑过 4px `ink`；拇指 20 圆，`accent` 填充 + 2px `ink` 描边（墨夜无描边改用 `paper` 外环）。
- 刻度在下：10 号 `muted`，当前档 `ink` 700；数值放在区块头右侧的状态胶囊里（缓存页现有交互保持：拖动连续、松手写入、0 显示「关闭」、1024 显示「1GB」）。

### 4.13 输入框
- 下划线式：无底色、无圆角；字段名用眉题（11/700 字距 2）放在上方；输入 16–18/600；占位 `quiet`；光标 `ink`。
- 错误：下划线与提示文字 `danger`，提示 12 号放在线下 6。
- 搜索输入（搜索页、歌单内搜索）放大到 24/800，左侧 24 号放大镜，右侧清除 `close-circle` 20 `quiet`。设置页搜索为 15 号、1px hairline 的轻量版。
- 修复现状：墨夜下 `PromptDialog` 输入底不再需要 `surface.importField`，因为没有底。

### 4.14 设置行（无卡片）
- `[图标块 34×34 r8 组色 | 标题 16/700 list + 副标题 12 muted | 右值 13/600 muted（可选） | chevron 18 quiet]`，最小高 62，行间 hairline（从左缘开始，不再让出 72）。
- 分组：主线 → 区块标题（中文）+ 右侧英文 meta（APPEARANCE / SEARCH & PLAY / DATA & SYNC / ABOUT / PROFILE / ACCOUNT）。
- 资料入口提升为分组前的一行「资料头」：56 头像 + 22/800 昵称 + 12 号说明。
- 危险行（退出登录）：单独成组「账户」，标题 `danger`，图标块 `iconWrap.red`。

### 4.15 弹窗与底部面板
- **居中弹窗**：左右 22，`paper` 底，圆角 8，**顶部 3px 墨线**（像杂志插页），无阴影；内边距 22 / 22 / 18。结构：眉题 → 22/800 标题 → 14/21 `muted` 说明 → 内容（下划线输入 / 列表）→ 等宽双按钮。遮罩统一 `scrim.import`。
- **底部面板 Sheet**：统一用 `MagazineSheet`，见 §4.15.1。不再有「左取消 / 中标题 / 右操作」三段式。
- **菜单 Popover**（来源筛选、排序）：`paper` 底，1.5px 墨边，圆角 4，4px 硬阴影（hairline 色）；行高 42，选中项 800 + 强调点。
- 统一替代：`Dialog.tsx`（圆角 18）、设置 `modalCard`（圆角 24）、`PromptDialog`、`ConfirmAlert`、`VersionModal`、`PactModal`、`SyncModeModal`、`PermissionPromptHost`。

### 4.15.1 共用抽屉 `MagazineSheet`（14 导入 / 25 队列 / 26 添加）

**原则：** 导入歌单面板、播放队列、添加到歌单是同一个抽屉组件，三处只换内容。抓手、头部排版、眉题 / 标题、线、行样式、底栏按钮、圆角、边距全部一样，任何一处都不得私自加卡片、阴影或自定义头部。

**为什么旧稿被否：** ① 三个抽屉各长各的（导入是三段式头，队列有 Tabs，添加是另一种标题），不像一个系统；② 队列稿凭空加了「当前播放 / 我的歌单」Tabs，并在非临时列表上也画了加歌 / 移除，与代码不符；③ 行密度和层级不统一，标题、计数、操作没有固定位置。

**组件接口（建议）：**

```ts
<MagazineSheet
  visible onClose
  heightRatio={0.62 | 0.78}          // 队列 0.62（沿用 QUEUE_PANEL_HEIGHT_RATIO），导入 / 添加 0.78
  eyebrow="导入 · 到「深夜通勤」"      // 11/700 字距 2 大写，eyebrow 色
  title="导入"                         // 标题
  meta="36 首歌曲 · 已排除重复"         // 12/600 muted
  figure={{ value: '36', unit: '首可导入' }} // 大数字（B / C 方案使用）
  headerAction={{ text: '全选', tone: 'ink' | 'danger', disabled }} // 下划线文字按钮，至多一个
  subject={<SongSubject />}             // 可选：被操作的那首歌（添加页）
  sectionLabel="歌单列表"               // 可选：列表小标签
  rows={...} renderRow={MagazineSheetRow}
  footer={{ meta: '已选 3 / 36', cancel: '取消', primary: '添加(3)', disabled }} // 可选：只有需要「提交」的抽屉才有
  loading empty={{ text: '此歌单暂无歌曲' }}
/>
```

**行 `MagazineSheetRow`（三处共用）：** `leading`（复选框 / 序号 / 图标块）+ 可选封面 + 主文 15/700 `ink` + 副文 12 `muted`（来源描边标 + 歌手 / 来源歌单）+ `trailing`（时长 / 操作图标 / 状态）。行间是通栏 hairline，最后一行不画；按压时透明度 0.7。当前行在页边距外画 4px `accent` 竖条，主文 800。不可用行（已在列表）主副文改 `faint`，图标块 55% 透明，尾部换成 `check` + 「已在列表」。

**三处内容映射（字段与代码一致）：**

| 槽位 | 14 导入（`PlaylistImportPanel`） | 25 队列（`PlayQueueSheet`） | 26 添加（`MusicAddModal`） |
| --- | --- | --- | --- |
| eyebrow | 导入 · 到「目标歌单」(`targetListName`) | 播放队列 · 正在播放 NN | 添加到歌单 / 移动到歌单（`isMove`） |
| title | 导入（`list_import`） | 队列名（试听列表 / 我的收藏 / 临时列表 / 歌单名 / 未在播放） | 添加 / 移动 |
| meta | `{num} 首歌曲` · 已排除重复；加载中显示「加载中...」 | `{num} 首` | 点歌单即添加 |
| headerAction | 全选 ↔ 取消（提交中禁用） | 清空当前播放列表（`danger`，仅临时列表且非空时可点，否则 `faint`；点后走 `confirmDialog`） | 无 |
| subject | — | — | 歌曲：封面 48 + 歌名 17/800 + 来源标 + 歌手 / 专辑 |
| leading | 复选框 20（选中 `ink` 填充 + `onInk` 勾） | 序号 01… 13/700 `faint` tnum | 34×34 r8 图标块：`placeholder` 底 + `ink` 图标（试听列表 `play-circle-outline`、我的收藏 `heart-outline`、自建歌单 `music-note-eighth`；新建列表为 1.5px 墨色虚线框 + `plus`） |
| 主 / 副文 | 歌名；来源标 + 歌手；来自「来源歌单」(`fromListName`) | 歌名；来源标 + 歌手 | 歌单名 |
| trailing | （C 方案显示时长） | 当前行：`pause` / `play` 18 `accentInk`；临时列表每行：`playlist-plus`（添加到歌单）+ `close`（移出），都是 20 `muted` | `plus-circle-outline` 22 `ink`；已存在：`check` + 已在列表（点按仍弹「列表已经存在这首歌啦」toast） |
| footer | 已选 N / 总数 · 取消 · 添加(N)（未选或提交中禁用） | 无 | 无 |
| 空 / 加载 | 「此歌单暂无歌曲」/「加载中...」，用 §4.18 空状态 | 「列表竟然是空的...」 | — |
| 行内状态 | — | 打开时滚动到当前曲目并居中（沿用） | 点「新建列表」后该行就地变成下划线输入框（占位「你想起啥名...」，回车 / 失焦提交，重名走确认），见 26B |

图标在组内同色、不重复：队列行尾 `playlist-plus` / `close` 同为 `muted`；添加页图标块统一 `placeholder` 底 + `ink` 图标，不再用现在的粉 / 蓝 / 棕三色底；「已存在」用 `check`，「可添加」用 `plus-circle-outline`，与新建列表的 `plus` 外形不同。

**已选定：B 刊头抽屉（June，2026-10-09）。** 14 / 25 / 26 统一按 B 实现：顶角 6、无抓手、顶部 3px `ink` 墨线、右上 34 描边圆形关闭；眉题 + 20/800 标题；56/800 大数字 + 单位（有 `subject` 的抽屉，例如添加页，用歌曲信息代替大数字）；`ink` 主线 + hairline 夹出的「meta ↔ 操作」工具条（没有操作时这里放空）；行高 56，导入行封面 40、队列行封面 36、添加行用图标块；底栏上沿是 `ink` 主线，左侧「取消」文字，右侧通栏 `ink` 主按钮，计数是 `accent` 圆标。稿件：`pages-v2/14B-import-panel.png`、`25B-play-queue.png`、`26B-add-to-playlist.png`，对比表 `v2-sheet-B.png`。A / C 两个方案仅作记录，不实现。

**三个方案（存档，B 已选定）：**

| | A 纸页抽屉（未选） | **B 刊头抽屉（✔ 已选）** | C 索引抽屉（未选） |
| --- | --- | --- | --- |
| 外形 | 顶角 14，抓手 36×4 | 顶角 6，无抓手，顶部 3px 墨线（与居中弹窗同语言），右上 34 描边圆形关闭 | 顶角 14，抓手 36×4 |
| 头部 | 眉题 + 右侧文字操作；30/800 大标题 + 右侧 meta；下方 1px 墨色主线 | 眉题 + 20/800 标题 + 关闭；56/800 大数字 + 单位（添加页换成歌曲 subject）；墨线 + hairline 夹出一条「meta ↔ 操作」工具条 | 左侧 64/300 细体大数字（已选数 / 曲目数 / 歌单数），竖 hairline 分隔；右侧眉题 + 22/800 标题 + meta / 操作 |
| 行 | 62 高，导入带 44 封面 | 56 高，导入 40 封面，队列也带 36 小封面 | 58 高，纯文字（无封面），导入行尾显示时长，信息更密 |
| 底栏 | hairline 上沿；左 meta，右「取消」文字 + 墨色胶囊主按钮 | 墨色主线上沿；左「取消」，右通栏墨色主按钮，计数是 `accent` 圆标 | 整条 `ink` 底栏（62 高）：`accent` 计数圆 + 已选文字；右侧「取消」+ 纸色胶囊主按钮 |
| 取舍 | 最接近听歌统计参考页，最安静 | 大数字最醒目，最「杂志封面」，但头部更高、列表可见行少一行 | 信息密度最高，底栏最有分量；去掉封面后靠来源标与歌名识别 |

通用尺寸：左右边距 22，遮罩 `scrim.import`，无阴影；进出场沿用 220ms `out(cubic)` 滑入。代码里的现行样式（导入面板 r22 白卡 + 每行白卡阴影 + `accent.chip` 黄绿确认按钮；队列 r20 白卡 + 当前行来源色底；添加弹窗 r12 彩色图标底卡片 + 黄绿加号块）全部由 `MagazineSheet` 取代。

### 4.16 底部导航与播放条（杂志化）
- 两者合成一个「底栏 Dock」，`paper` 底，**顶部 1px 墨色主线**，没有玻璃、没有圆角轨道、没有悬浮。
- **播放条**（高 64）：进度是一条贴在主线上的 2px `accent` 线（已播部分）；封面 44 r4；歌名 15/700 + 歌手 · 专辑 12 `muted`；播放键 40 圆 `ink` 底 `onInk` 图标；队列 `playlist-music` 24 `ink`。（替代现在的来源色进度环，来源色只留在标签里。）
- **底部导航**（高 58）：三等分，图标 22 + 文字 11；当前项 `ink` + 800，顶部一枚 24×3 `accent` 标记；未选 `quiet`。与播放条之间一条 hairline。
- 子页、详情页保留 Dock（现状如此），全屏层（播放详情、搜索输入聚焦时的键盘态、多选模式）隐藏导航或替换为操作栏（多选：添加到… / 移动到… / 移除）。

### 4.17 播放详情 / 歌词 / 评论
- 顶部：返回（chevron-down）+ 居中文字 Tabs「评论 · 播放 · 歌词」（对应现有 Pager 0/1/2）+ 分享。
- **保留黑胶（June 已拍板）**，但改成杂志语言：纸色背景，去掉封面模糊染色、径向光晕和底部白色圆角面板；唱片本身、纹路、封面圆标、唱臂和旋转动画都保留。
- 唱片：直径约 330（`Pic.tsx` 现为 `min(屏宽×0.9, 450)`，杂志版改为 `屏宽 − 2×22 − 16`），底色 `surface.vinyl`，外圈 3px `scrim.vinylRing`（墨夜改 `hairline`，否则深底上看不见边），纹路 `line.white` 低透明（沿用 `vinylGrooves`），一道 `glass.line16` 弧形高光，中心封面圆标约 66%（沿用 `recordInner`）+ `scrim.vinylInner` 细边 + 纸色中心孔。不加投影。
- 唱臂（v3，高对比，June 要求唱臂必须明显跳出唱片）：唱片底色接近纯黑，所以唱臂一律用**「浅色芯 + 深色边」或「深色芯 + 浅色光圈」**的双层描边，保证压在唱片上和压在纸上都看得清。只用现有令牌：
  - **✔ v3a 白臂墨边（`22A-v3a`，June 选定，用于 22A-v4）**：浅色主题臂芯 4px `surface`（`#ffffff` / 暖米 `#ffffff`）+ 外描 7px `ink`；支点 30 圆，`surface` 底 + 2px `ink` 边 + `ink` 轴心；唱头 20×24 r2.5 `surface` + 1.5px `ink` 边，唱针 10×4 `accent`。压在黑唱片上是白线，压在纸上是墨线轮廓，两种背景对比都最高。
  - **v3b 墨臂纸边（`22A-v3b`，未选，存档）**：臂芯 4px `ink` + 外描 8px `paper` 光圈；支点 `paper` 底 + 2px `ink` 边；唱头 `ink` + 2.5px `paper` 边，唱针 `accent`。保持「墨色」杂志语言，靠纸色光圈把唱臂从黑唱片上切出来。
  - **墨夜**：`ink` 本身就是浅色（`#f3f4f8`），所以两种方案都变成浅色臂 + `paper`（`#12141c`）深色边；区别只在支点（v3a 浅底深轴，v3b 深底浅边）。外圈仍用 `hairline` 描边，让唱片边缘在深底上可见。
  - 不再使用 `decor.tonearm*` 令牌（它们与唱片、纸的对比都太低，正是 v2 被退回的原因）；这三个令牌只留给横屏。抬起 / 落下沿用 `TONEARM_OUT_ANGLE 18° / IN -2°`。`decor.tonearm*` 三个令牌保留给横屏，竖屏杂志版改读 `ink` / `paper` / `accent`。
- **定稿 22A-v4「居中唱片 + 唱臂」（June 已拍板；默认 / 暖米 53 / 墨夜 56 均按此出稿）：** 眉题 `NOW PLAYING · 来自「歌单名」` → 唱片居中、v3a 唱臂在右上 → **（不画分隔线，唱片下留 30 空白直接接歌名）** → 歌名 32/800 左对齐 + 来源标 + 歌手 · 专辑；右侧两个按钮：**添加到歌单 `playlist-plus` 26 `ink`** + 喜欢 `heart` 26 `like`（未喜欢时 `heart-outline` `ink`）→ 歌词两行（当前句 17/800 `ink`，下一句 14 `faint`，左侧 3px `accent` 竖条）→ 进度 → 控制行。间距：唱片下 30 → 标题块 → 18 → 歌词 → 14 → 进度 → 10 → 控制行。
- **添加到歌单按钮（替换评论按钮）：** 点按后用当前曲目打开 `MusicAddModal`，即共用抽屉 `MagazineSheet` B 版（`26B`），参数为 `{ musicInfo, listId: '', isMove: false }`，与 `PlayQueueSheet.handleShowMusicAddModal` 相同。竖屏 `Pic.tsx` 现在没有这个入口，需要在 Pic 里挂一个 `MusicAddModal` ref（横屏 `PlayDetail/Horizontal/MoreBtn/MusicAddBtn.tsx` 已有同样的做法，可参考）。图标 `playlist-plus` 在本页唯一：控制行右侧的队列按钮是 `playlist-music`，分享是 `share-variant-outline`，没有重复；它和队列行尾的「添加到歌单」用的是同一个图标，全 App 含义一致。
- **评论入口仍然保留（已核对代码）：** `src/screens/PlayDetail/Vertical/index.tsx` 是 `PagerView`（`initialPage={1}`），第 0 页是 `<Comment embedded …>`，第 1 页是 `Pic`，第 2 页是 `Lyric`。在播放页**向右滑**就到评论页（进入第 0 页时会 `triggerCommentRefresh`），评论页返回走 `onCommentBack → setPage(1)`。杂志版顶部的「评论 · 播放 · 歌词」文字 Tabs 直接映射到 `setPage(0/1/2)`，所以点「评论」也能到。⚠️ 现行代码的 Pic 顶部只有返回和分享、**没有**文字 Tabs，Tabs 是本规范新增的；迁移时如果 Tabs 还没做，就会丢掉评论的点按入口（只能滑动），所以去掉评论按钮和加 Tabs **必须在同一个 PR**。去掉评论按钮后，`Pic` 的 `onCommentPress` prop 和 index 里的 `onPicCommentPress` 可以改为供 Tabs 使用，或者删掉。
- 22A（v2 版，唱臂低对比 + 歌词在底部）作废：`pages-v2/22A-player-vinyl.png`、`53-warm-player-vinyl.png`、`56-dark-player-vinyl.png` 只作记录。
- 22A-v3（v3a / v3b，唱片下有墨色主线、喜欢旁是评论按钮）作废：`pages-v2/22A-v3a/v3b-*`、`53-v3*`、`56-v3*` 只作记录。
- **方案 22B「唱片出套」（未选，存档）：** 眉题 `SIDE A · 03 / 18` → 250 方形封面（唱片套）压在左侧，唱片从套口向右露出约 100、顶部一枚 3px `accent` 刻度随唱片旋转 → 墨色主线 → 「03」描边胶囊 + 歌单 · 第 N 首 → 歌名 40/800 → 进度 / 控制 / 歌词同 A。没有唱臂，更像唱片封套排版；播放时只转唱片，暂停时唱片缩回套里 20%（可选）。
- 进度条：2px hairline 轨道 + 4px `ink` 已播 + `accent` 拇指（浅色主题 2px 墨描边）。现在的来源色进度 / 歌手名来源色**不用**，来源色只留在来源标里。
- 控制行：循环 24 `muted` / 上一首 36 `ink` / 播放 72 `ink` 圆 + `onInk` 图标 / 下一首 36 / 队列 `playlist-music` 24 `muted`。
- 歌词页：小头（封面 48 + 歌名 + 喜欢）→ hairline → 已唱 18/600 `faint`，当前句 28/800 `display` + 左 3px `accent` 标记，下一句 `muted`，再往后 `faint` → 底部进度 + 56 播放键控制行。
- 评论页：超大数字「1.2万 条评论」→ Tabs 热门 / 最新 → 评论：头像 32 + 昵称 13/800 + 时间 11 faint + 右侧赞数；正文 15/23；楼中楼左侧 2px hairline 引用线。评论页改读 `useLuxTheme()`（现在还走上游 `useTheme()`）。

### 4.18 空状态
- 不放插画、不放灰卡片。结构：眉题（`EMPTY · 0 首` / `NO RESULT · 0 项`）→ 26/800 标题 → 14 `muted` 说明 → 可选的 Chip 建议或次按钮 + 文字按钮。左对齐，上方留 34。

### 4.19 加载
- 列表：骨架行（46 方块 r6 + 两条 12/10 高的 `skeleton` 条），不加脉冲以外的动效（沿用 `HomeTab` 的 pulse）。
- 全局 / 区块：眉题 `LOADING` + 2px hairline 轨道里 30% 的 `ink` 进度段来回移动。
- 首屏：`HomeBootSplash` 改为纸色刊头（大号 Lux Music + 期号式版本眉题 + 底部细进度线）。

### 4.20 Toast
- `ink` 底、`onInk` 字 13/600，圆角 4，左侧 16 号状态图标；错误态 `danger` 底。出现在 Dock 上方 12，居中。

---

## 5. 图标规则

1. 全部 MDI（`MdiIcon`），线性（outline）优先；填充版只用于「状态为真」：`heart`（已喜欢）、`play` / `pause`、`checkbox-marked`。
2. 尺寸：行内 18–20，按钮 22–24，底栏 22，大控制 36。颜色默认 `ink`，弱化 `muted` / `quiet`。不再把普通图标涂成强调色。
3. **设置图标块：同组同色。** 组色取现有令牌，组内不许混色：

| 分组 | 图标块底 | 图标 |
| --- | --- | --- |
| 资料 | `accent.soft` | 头像 `image-outline`、昵称 `card-account-details-outline`、签名 `fountain-pen-tip`、性别 `gender-male-female` |
| 外观 | `iconWrap.orange` | 语言 `translate`、主题 `palette-outline`、统计页样式 `newspaper-variant-outline` |
| 搜索与播放 | `iconWrap.green` | 搜索来源 `text-search`、自定义源 `puzzle-outline` |
| 数据与同步 | `iconWrap.purple` | 同步服务 `server-network`、同步格式 `swap-horizontal`、清除冲突策略 `source-branch-remove`、缓存管理 `broom`、导出 `database-export-outline`、导入 `database-import-outline` |
| 关于 | `iconWrap.amber` | 当前版本 `information-outline`、检查更新 `update`、GitHub `github` |
| 账户（危险） | `iconWrap.red` | 退出登录 `logout` |

4. **全 App 不重复：** 一个图标只对应一个含义。现状需要改的：
   - 资料页「昵称 `menu`」与播放条/队列的 `menu` 撞 → 昵称改 `card-account-details-outline`，队列统一 `playlist-music`。
   - 资料页「签名 `comment`」与评论入口撞 → 签名改 `fountain-pen-tip`，评论统一 `comment-text-outline`。
   - 设置「搜索来源 `magnify`」与搜索入口撞 → 改 `text-search`。
   - 「自定义源 `music-box-multiple`」与本地 / 音乐类图标易混 → 改 `puzzle-outline`。
   - 「当前版本 `certificate`」→ `information-outline`（证书语义不对）。
   - 资料组的头像行用头像图、性别行用性别徽章色 → 统一为资料组图标块。
   - 快捷入口「本地 `download`」与下载语义撞 → 改 `folder-download-outline`。
5. 底栏：首页 `home-variant-outline`、歌单 `folder-music-outline`、设置 `cog-outline`（选中不换填充版，靠颜色 + 强调标记区分）。
6. 应用标志仍用 IcoMoon `logo`，不换 MDI。

---

## 6. 动效

| 场景 | 动效 | 时长 / 缓动 |
| --- | --- | --- |
| 子页、详情、统计进入 | 自右滑入 + 透明度 .92→1（沿用） | 248ms 进 / 220ms 出，`Easing.out(cubic)` |
| Tab 切换 | 3px 下划线水平滑到新位置并改宽度；内容淡入 | 180ms |
| 大数字 | 切换范围 / 首次进入时 0→目标值滚动计数 | 600ms，`out(cubic)`；减少动态效果时直接显示 |
| 柱状图 | 柱子自底向上长出，逐根延迟 20ms | 320ms |
| 当前强调标记（正在播放、底栏） | 位移，不缩放 | 200ms |
| 底部面板 / 弹窗 | 面板自下滑入；弹窗淡入 + 8px 上移；遮罩淡入 | 260ms / 200ms |
| 按压 | 透明度 0.7（行、按钮），不缩放 | 即时 |
| 歌词滚动 | 当前句平滑居中，字号 18→28 插值 | 280ms |
| 封面切歌 | 唱片中心圆标交叉淡入 + 轻缩放（沿用 `COVER_TRANSITION_DURATION` 280ms） | — |
| 黑胶 | 播放时唱片 30s 一圈匀速自转（`RECORD_SPIN_DURATION`），暂停时停在当前角度；唱臂随播放 / 暂停在 18° ↔ −2° 间摆动；22B 中刻度随唱片转动。减少动态效果时唱片不转、唱臂直接到位 | 30s 线性 / 唱臂沿用 |
| 拖动 | 歌单 1.02 / 歌曲 1.06（沿用，不改 `zIndex`） | 140ms |

全部尊重系统「减少动态效果」：计数、长出、滑入改为直接出现。

---

## 7. Do / Don't

**Do**
- 每页先决定「主角数字或主角标题」，把它放到 Display 级。
- 用主线开栏目、hairline 分行；栏目头 = 中文标题 + 右侧英文 / 排序 meta。
- 数据用墨色；「当前 / 今天 / 已选 / 正在播放」才用强调色。
- 列表左对齐、数字右对齐，数字开 tnum。
- 浅强调色（黄绿）做填充时加墨色描边或放在墨色旁边。
- 中文正文用 15 号起步，行高 1.5。
- 所有颜色从 `useLuxTheme()` 取，经杂志角色名读。

**Don't**
- 不要再用白色圆角卡片、玻璃、模糊、投影来分组。
- 不要用强调色写字、做大块底色或做主按钮。
- 不要在同一屏放两个 Display 级元素互相抢。
- 不要用 16–26 的大圆角；封面不超过 6。
- 不要把排名 2–5 和 #1 做成同样实心——#1 是唯一的实心大字。
- 不要为了「杂志感」用衬线中文或斜体；本系统是无衬线大字编辑风。
- 不要一个图标多用，也不要组内混色。
- 不要为了氛围在纸上铺渐变底。

---

## 8. 迁移指南（从现行 `design-system.md`）

### 8.1 对照表

| 现行 | 杂志风 |
| --- | --- |
| 页面底 `#eef0fb` + 白卡片 `#ffffff` | 只有纸 `bg.app`，卡片取消 |
| 页面大标题 30/700 | H1 40/800/-1 |
| 子页大标题 22/700，返回胶囊 82×36「返回」 | 眉题 + H2 32/800；返回 40 描边圆 |
| 分组小标题 11 灰（`sectionEyebrow`） | 主线 + 22/800 区块标题 + 右侧英文 meta |
| 设置行 40 圆形图标底，分割线左缩 72 | 34 方圆角图标块 r8，分割线通栏 |
| 单选点 `#c8e600`（无描边） | 同色 + 1.5px 墨描边（浅色主题） |
| 主按钮 `#c8e600` 底 | `ink` 底 `onInk` 字 |
| 取消按钮 `#f1f4fb` 灰底 | 1.5px 墨边描边按钮 |
| 弹窗白卡圆角 24 / `Dialog` 18 | 纸色、圆角 8、顶部 3px 墨线 |
| 胶囊搜索框（`SharedTopBar` 44 高） | 一级页：搜索图标；搜索页：24/800 下划线大输入 |
| 玻璃播放条 + 来源色进度环 + 玻璃底栏圆点 | 纸色 Dock：主线 + 2px 强调进度 + 文字底栏 + 强调标记 |
| 首页英雄卡 / 推荐卡（`homeHeroes` / `homeCards`） | 满宽封面「本周发现」+ 文字；日推为编辑式列表 |
| 歌单快捷入口圆形图标泡 | 四等分文字入口，竖 hairline 分隔 |
| 歌单宫格封面 r18 | r6 |
| 播放详情白底 + 黑胶 + 封面染色 + 白面板 + 评论按钮 | 纸底 + **保留黑胶**（v3a 白臂墨边，无分隔线，歌词在歌手与进度条之间，评论按钮换成添加到歌单）+ 主线 + 左对齐大标题；去染色和白面板 |
| 导入面板 / 播放队列 / 添加到歌单三种各自样式 | 一个共用 `MagazineSheet`，只换内容 |
| 来源标签（浅底彩字） | 描边小方标（无底） |
| 阴影 5 种颜色 | 无阴影 |

### 8.2 令牌层（第一步，零视觉变化）
1. 在 `src/theme/` 加 `magazineRoles.ts`：`export const magazineRoles = (c: LuxColors) => ({ paper: c.bg.app, display: c.ink.pageTitle, ink: c.ink.strong, muted: c.ink.secondary, eyebrow: c.ink.eyebrow, faint: c.ink.faint, quiet: c.ink.quiet, hairline: c.line.divider, accent: c.accent.primary, accentSoft: c.accent.soft, onAccent: c.ink.onAccent, accentInk: c.ink.olive, onInk: c.ink.onControl, danger: c.danger, like: c.like, placeholder: c.surface.placeholder, skeleton: c.surface.skeleton, scrim: c.scrim.import })`。只是别名，不改 `limeColors` 一个字符，单测与 `check-lux-color-literals.mjs` 不受影响。
2. 加 `src/theme/magazineType.ts`：上面的字号表（设计数字，交给 `createStyle`）和 `RULE_GAP = 34` 等节奏常量。

### 8.3 组件层（第二步）
新建 `src/components/magazine/`，每个组件一个文件，先在统计页内部替换验证：`MagTopBar`、`BackButton`、`TextTabs`、`SectionHeader`（含主线）、`Rule` / `Hairline`、`RankNumber`（svg 描边）、`RankedRow`、`SongRow`、`SettingRow`、`OptionRow`、`PrimaryButton` / `SecondaryButton` / `TextButton`、`DeltaPill` / `Chip` / `SourceTag`、`Toggle` / `Checkbox`、`MagSlider`（由 `CacheLimitSlider` 抽出）、`UnderlineInput`、`MagDialog` / `MagazineSheet`（+ `MagazineSheetRow`）/ `MagMenu`、`EmptyState`、`Skeleton`、`Toast`、`Dock`（`PlayerBar` + `BottomNav` 合并）。
`ListeningStatsMagazine.tsx` 里的 `styles.rule / sectionHead / tabs / rank / pill` 已经是这些组件的原型，直接抽出。

**硬性要求：** `PlaylistImportPanel`、`PlayQueueSheet`、`MusicAddModal`（以及共用 `TargetPlaylistList` 的 `MusicMultiAddModal`）**必须全部改用 `MagazineSheet` + `MagazineSheetRow`**，不得各自保留头部、行或按钮样式；`MusicAddModal` 现在用的居中 `Dialog`（height 78%）同时改为底部抽屉。三处在同一个 PR 里迁移，PR 附 14 / 25 / 26 同方案截图对照。`MagazineSheet` 也是后续其他底部面板的唯一实现。

### 8.4 页面层（第三步，按风险从低到高）
1. 设置子页（语言、主题、统计页样式、搜索来源、同步格式、性别）→ 2. 设置主页、资料、缓存、关于 → 3. 所有弹窗 / 面板（统一到 `MagDialog` / `MagazineSheet`；14 / 25 / 26 三个抽屉同一 PR）→ 4. 歌单库、歌单详情、本地歌曲、导入、搜索 → 5. 首页 → 6. Dock（播放条 + 底栏）→ 7. 播放详情、歌词、评论 → 8. 启动、协议、同步登录、权限。
每一步按现行规范要求，在 PR 描述里**单列删除 / 隐藏 / 移动的 UI**，本方案涉及的有：
- 首页：英雄卡与推荐卡的卡片外形（内容保留为「本周发现」+ 日推列表）。
- 歌单库：资料卡白卡、快捷入口圆形图标泡。
- 设置：子页「返回」二字；设置行圆形图标底；`SettingsTab` 未引用的玻璃搜索样式（可顺手清理）。
- 播放条 / 底栏：玻璃、来源色进度环、底栏黄绿圆点。
- 播放详情：封面模糊染色与径向光晕、底部白色圆角面板、唱片投影、歌手名 / 进度条的来源色（**黑胶与唱臂保留**，唱臂改为双层描边高对比样式，见 §4.17）。
- 播放详情（移动 / 替换）：歌名行左侧的评论按钮（`Pic.tsx` `onCommentPress`，图标 `comment`）**删除**，评论改由顶部「评论」文字 Tab 或右滑进入 Pager 第 0 页；原位置（喜欢按钮旁）**新增**「添加到歌单」`playlist-plus`；唱片与歌名之间不画分隔线；唱臂 `decor.tonearm*` 低对比配色换成 v3a 白臂墨边；歌名 / 歌手由居中改为左对齐；歌词预览从页面底部移到歌手与进度条之间。
- 导入面板：每行白卡 + 阴影、工具条灰底胶囊、黄绿确认按钮、三段式头部。
- 播放队列：当前行的来源色底（改为 `accent` 竖条）、灰底「清空」胶囊（改为 `danger` 下划线文字）。
- 添加到歌单：居中 `Dialog`（改为底部抽屉）、歌曲信息白卡、彩色图标底、黄绿加号块。
- 缓存管理：整页白卡片。
- 弹窗：灰底取消按钮、黄绿主按钮。

### 8.5 实现注意
- **描边数字**：RN `Text` 没有 text-stroke，用 `react-native-svg` `<Text stroke={faint} strokeWidth={1.1} fill="none">`；Android 低端机可退回 300 字重。
- **字距**：`letterSpacing` 不参与 `createStyle` 缩放（现状），眉题 2、Display -6 直接写。
- **大数字行高**：120 号用 `lineHeight: 120`，并 `includeFontPadding: false`，否则 Android 上方多出空白。
- **深色**：墨夜里 `onInk` 是纸色，主按钮变成「白底黑字」；单选点、拇指去掉墨描边；来源色用 `buildLuxColors` 已有的深色版本。
- **i18n**：英文眉题（LISTENING、SETTINGS、APPEARANCE…）也走 `t()`，三份语言包同步；英文界面下它们与中文标题同语言时可隐藏右侧 meta 以免重复。
- **无障碍**：浅色主题 `muted` `#767d89` 在纸上对比度偏低（现状如此，默认色值不可改）——所以杂志风把关键信息全部放到 `ink` / `display`，`muted` 只承担次要说明；12 号以下文字不使用 `faint`。
- **黄绿特例**：`accent.primary #c8e600` 与纸 `#eef0fb` 对比度很低，必须遵守「只填充 + 墨描边 / 墨色相邻」。

---

## 9. 设计稿索引

`/workspace/dev-bot/magazine-design/pages/`：
01 启动闪屏 · 02 欢迎与协议确认 · 03 许可协议 / 安全提醒 · 04 协议更新弹窗 · 05 同步登录 · 06 权限请求 · 07 首页·全部 · 08 首页·热门榜单 · 09 歌单库·宫格 · 10 歌单库·列表与来源菜单 · 11 歌单详情 · 12 歌单详情·多选 · 13 榜单/在线歌单详情 · 14 导入歌曲面板 · 15 歌单内搜索 · 16 本地歌曲 · 17 听歌统计·杂志风 · 18 听歌统计·年度回顾风 · 19 搜索·最近与建议 · 20 搜索结果·歌曲 · 21 搜索结果·歌单 · 22 播放详情 · 23 歌词 · 24 评论 · 25 播放队列 · 26 添加到歌单 · 27 设置主页 · 28 设置搜索 · 29 个人资料 · 30 修改昵称弹窗 · 31 语言 · 32 主题 · 33 统计页样式 · 34 搜索来源 · 35 自定义源 · 36 同步服务 · 37 同步格式 · 38 Lux 账号登录弹窗 · 39 缓存管理 · 40 关于版本更新 · 41 性别 · 42 导出/导入·选择位置 · 43 首次同步方式 · 44 版本更新弹窗 · 45 确认弹窗与提示 · 46 新建歌单弹窗 · 47 自定义源管理（实验性） · 48 播放器设置与定时停止 · 49 组件样张 · 50–54 暖米（首页、歌单库、听歌统计、播放详情、设置） · 55–57 墨夜（听歌统计、播放详情、设置）。

**播放详情定稿 v4（以此为准）：** `pages-v2/22A-v4-player-vinyl.png`（默认黄绿）、`pages-v2/53-v4-warm-player-vinyl.png`（暖米）、`pages-v2/56-v4-dark-player-vinyl.png`（墨夜），对比表 `v4-22.png`。

v3 播放详情（存档，被 v4 取代）：`pages-v2/22A-v3a-player-vinyl.png`、`22A-v3b-player-vinyl.png`、`53-v3a-warm-player-vinyl.png`、`53-v3b-warm-player-vinyl.png`、`56-v3a-dark-player-vinyl.png`、`56-v3b-dark-player-vinyl.png`，对比表 `v3-22.png`。

v2（替换旧稿 14 / 22 / 25 / 26，以及 53 / 56 的播放详情）在 `/workspace/dev-bot/magazine-design/pages-v2/`：`14A/14B/14C-import-panel`、`25A/25B/25C-play-queue`、`26A/26B/26C-add-to-playlist`、`22A-player-vinyl`、`22B-player-vinyl`、`53-warm-player-vinyl`、`56-dark-player-vinyl`。对比表：`v2-sheet-A.png`、`v2-sheet-B.png`、`v2-sheet-C.png`（每张为同一抽屉方案下的 14 / 25 / 26），`v2-22.png`（22A / 22B / 暖米 / 墨夜）。生成脚本 `src/v2.js`、`src/build-v2.js`、`src/compare-v2.py`。

联系表：`contact-1.png`（01–08）、`contact-2.png`（09–16）、`contact-3.png`（17–24）、`contact-4.png`（25–32）、`contact-5.png`（33–40）、`contact-6.png`（41–49）、`contact-7.png`（50–57）。
所有稿件中的歌名、歌手、数值、地址均为**示例数据**（页面右上角「示例」小标）。

---

## 10. June 的决定（2026-10-09）

**已拍板：**
1. 播放详情**保留黑胶唱片效果**，改为杂志样式（§4.17）。
2. 主按钮用**墨色 `ink`**（§4.9），强调色只做填充。
3. 排名 2–5 用**描边空心数字**（svg stroke，§4.6 / §8.5）。
4. 页边距 **22，全 App 推开**（§3.4）。

**仍待定（保持草案写法）：**
5. 首页「每周发现」满宽封面是否保留英文标题 Discover Weekly。
6. 竖屏是否接入「播放器设置 / 定时停止」（48 号稿只是预留样式）。

**新增待选：**
7. ✔ **已定：共用抽屉 `MagazineSheet` 用 B 刊头**（§4.15.1）。14 / 25 / 26 按 `14B` / `25B` / `26B` 实现，A / C 存档。
8. ✔ **已定：播放详情 = 22A-v4**。唱臂用 **v3a 白臂墨边**；去掉唱片与歌名之间的分隔线；喜欢旁的评论按钮换成「添加到歌单」（`playlist-plus` → `MagazineSheet` B），评论通过「评论」Tab / 右滑 Pager 第 0 页进入（§4.17）。稿件 `22A-v4`、`53-v4`、`56-v4`，对比表 `v4-22.png`。22B、22A-v2/v3 都已存档。
9. ✔ **已定：资料库「我的歌单」工具栏 = 方案 A**（`lib-toolbar-A.png`）。
   - 标题行：「我的歌单」+ 墨色「＋ 新建」胶囊（视觉约 34，可点 44，靠 hitSlop）。
   - 下一行：方角 1px 墨框 `MagSegmented` compact「宫格 | 列表」（视觉高约 28，宽随两字标签 + 小图标；可点 44 靠 hitSlop）+「排序：最近更新 ▾」，展开 `MagMenu`：按最近更新 / 按最早更新 / 自定义排序（注「拖动卡片即切换到此项」）；工具行 `minHeight` 44。
   - 元信息只写「N 个歌单」。
   - 快捷入口行到区块标题的间距收紧到约 28pt：快捷入口行 `marginBottom` 0，区块 `marginTop` 16，`SectionHeader showRule={false}`，标题行 `minHeight` 44。
   - B / C 存档。
10. ✔ **已定：收听时长一律用「分钟」**，超过 1 小时也不换算（「85 分钟」「1,240 分钟」，千分位），全 App 不出现「小时」。单位统一写「分钟」，不写「分」。
11. ✔ **已定：听歌统计「年度回顾风」= 年度听歌报告方案 B**（`replay-report-B.png` / `replay-report-B-ink.png`）。**纵向 ScrollView**：8 个全幅色块上下堆叠（自然高度，非横向 Stories 分页）；每块顶部静态度：`01 / 08` + 分段指示 + 英文栏目名；保留区间 Tab 与墨夜反色；时长一律「分钟」+ 千分位；不做曲风分布与「保存为图片」。A 存档。
