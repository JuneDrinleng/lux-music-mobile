# lux-music-mobile 更新日志

本文档用于记录本仓库（fork 分支）的版本变更历史。
<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

<<<<<<< Updated upstream
## [0.2.18](https://github.com/lyswhut/lx-music-mobile/compare/v0.2.17...v0.2.18) - 2026-05-07

## v0.2.18

本次更新聚焦播放详情浮层重构、歌单详情组件提取与 UI 样式统一，将播放详情从原生导航页面改为浮层 overlay 架构，提取 PlaylistDetailView 可复用组件，并统一搜索栏/按钮视觉样式。

### 新增

- 新增 PlayDetailOverlay 浮层组件，播放详情从原生导航改为从底部滑入的 overlay，支持黑色遮罩背景与弹性动画（Easing.out(Easing.back(1.05))），通过全局事件 showPlayDetail/hidePlayDetail 控制显隐，横竖屏均已接入。
- 新增 PlaylistDetailView 可复用组件（525 行），从 PlaylistTab 中提取歌单详情完整渲染逻辑为独立组件，支持本地歌单/在线歌单/排行榜三种类型，自带开合动画、播放/删除/重命名/导入/拖拽排序等完整交互。
- 新增 PlayDetailContext 上下文（createContext + usePlayDetailClose hook），通过 Context 注入关闭回调，解耦 Pic/Lyric/Header 等子组件对 navigation.pop 的直接依赖。

### 调整

- GlassSearchField 毛玻璃效果简化：移除 @react-native-community/blur BlurView 依赖及 glassTint/glassFallback/glassRim 多层叠加层，改为纯色背景 #dce0e9 + 边框 #cdd2de。
- 搜索栏/按钮 UI 统一样式：移除 shadowColor/shadowOpacity/shadowRadius/elevation 阴影属性，简化按钮背景色为 #f0f1f6/#e8e9f0。
- PlayerBar 播放详情入口从 navigations.pushPlayDetailScreen 改为 global.app_event.showPlayDetail，统一 overlay 打开方式并预加载封面图。
- PlayDetail 导航层优化：pushPlayDetailScreen 提前设置 bgPic 封面图 + 黑色 componentBackgroundColor，避免推入动画过程中的白屏闪烁。
- SharedTopBar 在歌单详情打开时保持显示（移除 playlistDetailVisible 条件限制），提升导航一致性。
- 本地歌单详情缓存未命中时同步写入 snapshot 缓存（cachePlaylistSnapshot），避免下次打开重复加载。
- 关闭歌单详情浮层时发送 closePlaylistDetail 全局事件通知联动组件。
- Home/Horizontal 横屏主页挂载 PlayDetailOverlay，支持横屏模式下的播放详情浮层。
- PageContent 新增 pic prop 支持外部注入封面图，play detail overlay 模式下优先使用当前歌曲封面避免白底。
- SearchPage 搜索历史行样式收紧：行高 56→44，移除白色卡片背景色/圆角/阴影，行间距归零。
- PlaylistDetailHeader hero 容器添加 backgroundColor 兜底背景色 #eef0fb。
- PlayerBar loveIcon 尺寸 20→24、loveIconInCard 22→26，Pic sideActionIcon/likedIcon 20→24，触摸区域更友好。
- PlayDetail/index.tsx 新增 onClose prop 支持 overlay 模式关闭回调，保留原生 navigation.pop 兼容路径。

### 性能优化

- PlaylistDetailOverlay / PlaylistDetailScene 的 FlatList 添加 getItemLayout 属性，利用固定行高 SONG_ITEM_HEIGHT（70px）加速列表布局计算，减少渲染帧耗时。
- 歌单详情数据加载策略调整：线上歌单/排行榜全量数据加载完成后再一次性更新列表，避免先展示首页分页数据再替换为全量数据导致的二次渲染与视觉闪烁。

### 移除

- 移除 PlaylistTab 中 renderDetailScene 函数及 55 行 props 传递代码，由 PlaylistDetailView 自包含接管。
- 移除 GlassSearchField 中 BlurView 组件及 hasNativeBlurView UIManager 检测逻辑。
- 移除 .github/workflows/publish-version-info.yml GitHub Actions 流水线。

### 构建

- 版本号更新到 0.2.18。
- Android versionCode 升级到 109。

=======
## [0.2.19](https://github.com/JuneDrinleng/lux-music-mobile/compare/v0.2.18...v0.2.19) - 2026-05-07

## v0.2.19

本次更新聚焦歌单详情页内联化与主题适配，将 PlaylistDetailView 作为内联视图组件替代旧有的 PlaylistDetailOverlay 浮层，并适配主题背景色与底部安全区。

### 新增

- PlaylistDetailView 内联歌单详情组件：作为绝对定位的覆盖层渲染，统一处理本地歌单、在线歌单、排行榜三种详情展示。
- PlayDetailOverlay 播放详情浮层：在 Vertical 布局中新增播放详情覆盖层，支持从迷你播放栏点击进入。
- PlaylistDetailView 新增 `bottomPadding` prop：支持外部传入底部留白高度，FlatList 底部内容自动留出空间。

### 调整

- PlaylistTab 歌单详情入口重构：移除内联的 PlaylistDetailScene 渲染分支，统一通过 `global.app_event.openPlaylistDetail` 事件触发详情展示。
- PlaylistDetailView 背景色适配主题：根容器和 FlatList 背景色使用 `c-app-background` 主题变量，替换硬编码的 `#eef0fb`。
- PlaylistDetailHeader 主题适配：底部渐变遮罩、Hero 背景 Fallback、Section Header 背景色均使用 `c-app-background` 主题变量。
- Vertical 布局动态测量底部导航栏 + 迷你播放栏高度，并传入 PlaylistDetailView 的 `bottomPadding`，确保列表末尾歌曲不被遮挡。
- 移除搜索栏的玻璃拟态效果（GlassSearchField），统一搜索栏视觉风格。

### 构建

- 版本号更新到 0.2.19。
- Android versionCode 升级到 110。
- 移除 `.github/workflows/publish-version-info.yml` 工作流。
>>>>>>> Stashed changes

## [0.2.17](https://github.com/lyswhut/lx-music-mobile/compare/v0.2.16...v0.2.17) - 2026-05-06

## v0.2.17

本次更新聚焦歌单详情页性能优化，将 PlaylistDetailOverlay 从单体组件重构为可复用 hook 架构，大幅提升首次打开流畅度。

### 性能优化

- PlaylistDetailOverlay 组件化重构：从 ~1100 行单体组件拆分为 usePlaylistDetailData / useSongDragReorder / usePlaylistImport 三个独立 hook，减少首帧 reconciliation 负担。
- renderSongItem 回调稳定化：使用 ref 替代 state 依赖，回调依赖从 14 项精简为 11 项全部稳定引用，避免拖拽排序期间不必要的行重渲染。
- PlaylistDetailSongItem 添加 React.memo 包裹及自定义比较函数，阻止未变更行在父组件更新时的无效重渲染。
- PlaylistDetailOverlay 添加 React.memo 及自定义比较函数，避免播放栏等父组件状态变化触发冗余渲染。
- MusicMultiAddModal 按需挂载：仅在线歌单/榜单详情时才渲染，本地歌单打开不再加载该重型组件。
- 歌单详情 Hero 封面预加载：detailHeroCover 确定后立即调用 Image.prefetch，减少封面白屏时间。
- 歌单详情入场动画延迟一帧启动：首帧先完成布局渲染，再通过 requestAnimationFrame 触发滑动动画，减少首帧卡顿。

### 构建

- 版本号更新到 0.2.17。
- Android versionCode 升级到 108。


## [0.2.16](https://github.com/lyswhut/lx-music-mobile/compare/v0.2.15...v0.2.16) - 2026-05-06

## v0.2.16

本次更新聚焦歌单详情页层级架构重构与播放控件交互优化，解决歌单详情浮层覆盖底部导航与迷你播放栏的问题，并统一喜欢按钮图标表达。

### 调整

- 歌单详情浮层（PlaylistDetailOverlay）架构重构：渲染挂载点从 Main.tsx（Content 内部）移至 Vertical/index.tsx（Content 同级），实现与底部控件的层级解耦。
- 歌单详情页底部控件保持可见：底部导航栏（BottomNav）与迷你播放栏（PlayerBar）在歌单详情打开时浮于详情之上，支持直接切换 Tab 和控制播放。
- 歌单详情页顶部栏自动隐藏：打开歌单详情时 SharedTopBar 不再显示，避免与底部控件层级联动调整时一并浮现。
- PlaylistDetailOverlay 内部场景层（scene）的 `zIndex` 与 `elevation` 收敛为 0，由外层容器 `playlistDetailLayer` 统一管理层级（zIndex: `controls`）。
- PlayerBar 喜欢按钮图标更换：未喜欢态从 `like.png` 替换为 `empty-heart.png`，已喜欢态从 `♥` 文字字符替换为 `fill-in-heart.png` 位图图标，移除对应的文字样式。

### 构建

- 版本号更新到 0.2.16。
- Android versionCode 升级到 107。

## [0.2.15](https://github.com/lyswhut/lx-music-mobile/compare/v0.2.14...v0.2.15) - 2026-05-06

## v0.2.15

本次更新聚焦播放详情页与评论页的深度整合、图标资源统一化，以及旧歌单详情独立页面的移除与浮层加载体验优化。

### 新增

- 播放详情页（PlayDetail）新增评论页作为首个 Pager 页面，从 Pic 封面页点击评论按钮可切换至评论页，三页布局变为 Comment → Pic → Lyric。
- Comment 页面新增 `embedded` 嵌入模式，支持在播放详情页内嵌展示，包含封面渐变背景、歌曲名/歌手信息展示与分享操作入口。
- 新增位图图标资源：`like.png`（喜欢）、`share.png`（分享）、`fire.png`（热门评论）、`latest.png`（最新评论）、`update-comment.png`（刷新评论），统一替换对应矢量图标。

### 调整

- Comment 页面重做：移除 `PagerView` 热门/最新评论切换，改为 `display` 属性控制显隐，减少组件开销；Header 重构为左侧返回 + 右侧分享的圆形按钮布局，支持 `embedded` 模式下的自定义返回/分享回调。
- PlayerBar 播放栏喜欢按钮从 `Icon` 矢量图标改为 `like.png` 位图资源，支持 `tintColor` 着色。
- PlayDetail Pic 封面页喜欢/分享按钮从矢量图标改为 `like.png`/`share.png` 位图资源。
- PlayDetail Lyric 歌词页分享按钮从矢量图标改为 `share.png` 位图资源。
- PlayDetail 返回键逻辑优化：Comment 页优先切回 Pic 页，Pic/Lyric 页直接关闭详情页，通过 `useBackHandler` 统一管理。
- PlaylistDetailOverlay 浮层 `zIndex`/`elevation` 从 `controls + 4` 调整为 `controls`，解决浮层覆盖层级过高导致遮挡其他控件的问题。
- PlaylistDetailOverlay 在线歌单/排行榜加载优化：`showLoading` 模式下优先加载第一页数据快速展示，再异步加载全量数据，减少白屏等待时间。
- PlaylistDetailOverlay 本地歌单详情缓存未命中时，从全局歌单内存列表（`getListMusicSync`）同步读取作为初始展示数据，避免 Loading 闪烁。
- 歌单列表、搜索页歌单入口统一改为通过 `global.app_event.openPlaylistDetail` 全局事件触发歌单详情，移除对已废弃的 `pushSonglistDetailScreen` 导航函数的调用。

### 修复

- PlaylistDetailOverlay 列表加载增加 `try-catch` 异常保护，避免网络异常或解析失败导致的白屏或未捕获异常。

### 移除

- 移除 SonglistDetail 独立页面（`src/screens/SonglistDetail/`），包括 `index.tsx`、`Header.tsx`、`MusicList.tsx`、`ActionBar.tsx`、`listAction.ts`、`state.ts`，功能已完全由 PlaylistDetailOverlay 浮层接管。
- 移除 `navigation.ts` 中的 `pushSonglistDetailScreen` 导航函数及 `ListInfoItem` 类型引用。
- 移除 `registerScreens.tsx` 中的 `SONGLIST_DETAIL_SCREEN` 屏幕注册。
- 移除 `screenNames.ts` 中的 `SONGLIST_DETAIL_SCREEN` 常量定义。
- 移除 `config/constant.ts` 中的 `COMPONENT_IDS.songlistDetail` 和 `NAV_SHEAR_NATIVE_IDS.songlistDetail_*` 常量。
- 移除 PlayDetail 返回键逻辑中对 `commonState.componentIds.comment` 的旧引用。

### 构建

- 版本号更新到 0.2.15。
- Android versionCode 升级到 106。

## [0.2.14] - 2026-05-06

本次更新聚焦歌单详情页视觉与交互全面升级，重做歌单英雄 Banner 与拖拽排序体验，优化页面过渡动画与加载性能，并修复拖拽排序多项交互缺陷。

### 新增

- PlaylistDetailHeader 新增全幅封面英雄 Banner 与 SVG 渐变遮罩，有封面时以歌曲封面为背景展示歌单信息，无封面时使用深色背景 + 渐变遮罩。
- PlaylistDetailSongItem 新增独立拖拽手柄按钮（`drag-reorder.png`），长按手柄触发排序拖拽，操作路径更明确。
- 新增歌单详情操作图标资源（`edit.png`、`delete.png`、`import.png`、`drag-reorder.png`），替换矢量图标为位图资源。

### 调整

- 歌单详情导航动画从共享元素过渡改为水平滑入/滑出动画，过渡更流畅稳定，并移除 `requestAnimationFrame` 包裹。
- 歌单拖拽排序交互动画从 `Animated.timing` 全面改为 `Animated.spring`，物理手感更自然。
- PlaylistDetailSongItem 卡片样式简化：移除边框与阴影，背景色统一为 `#eef0fb`，卡片间距由 10 收紧为 2。
- 歌单详情页、在线歌单详情页、排行榜详情页数据加载改为 `InteractionManager.runAfterInteractions` 延迟执行，减少页面过渡时的卡顿。
- Image 组件默认占位图从 `loadfail.gif` 回退到 `disk.png`，统一全局占位图资源。
- PlaylistTab 中 SharedTopBar 在歌单详情浮层可见时保持显示，提升导航一致性。
- 歌单详情打开方式统一通过 `global.app_event.openPlaylistDetail` 全局事件触发。

### 修复

- 修复歌单拖拽排序时 shift 计算仅覆盖 sourceIndex 到 targetIndex 之间的歌曲，解决旧逻辑遍历全部歌曲的性能浪费与动画遗漏。
- 修复拖拽位置计算使用绝对 pageY 导致列表有滚动偏移时定位偏差的问题，改为基于列表容器的 pageY 相对坐标。
- 修复 PanResponder 在拖拽激活时未设置 Capture 导致手势被子组件拦截的问题。
- 修复删除歌曲与拖拽排序可能并发执行的冲突，增加拖拽状态互斥检查。
- 修复 SonglistDetail 页面初始化时 `name`/`desc`/`playCount` 字段缺失导致的空值渲染问题。

### 移除

- 移除歌单详情页导航的 `sharedElementTransitions` 共享元素过渡动画及 `elementTransitions` 配置。
- 移除 SonglistDetail/MusicList 中重复的 `headerRef.setInfo` 调用及注释代码。
- 移除 navigation.ts 中 `NAV_SHEAR_NATIVE_IDS` 常量引用。

### 构建

- 版本号更新到 0.2.14。
- Android versionCode 升级到 105。

## [0.2.13] - 2026-05-02

本次更新聚焦首次启动体验优化与播放控制细节打磨，新增 Login 引导页统一承载安全提醒与协议确认，优化封面占位图资源与加载失败兜底表现，并修复搜索结果页封面不自动刷新的问题。

### 新增

- 首次启动新增 Login 登录引导页，合并展示安全提醒、许可协议与免费开源声明，需逐条勾选确认后方可进入应用。
- Image 组件新增 `placeholder` 和 `placeholderStyle` 属性，支持自定义占位图资源及其样式。
- 新增 `disk.png` 磁盘图标资源，作为歌曲封面及歌单卡片的默认占位图。
- 新增 `.gif` 模块类型声明（`src/types/common.d.ts`）。

### 调整

- 安全提醒从独立弹窗（cheatTip）迁移至 Login 页面统一展示，首次启动体验更一致。
- PactModal 简化：移除首次同意协议后的编码消息弹窗，直接进入更新检查与深度链接初始化流程。
- 播放栏封面占位图从纯色圆形容器改为 `disk.png` 磁盘图标，视觉更自然。
- HomeTab 推荐 / 榜单中 Disc3 矢量图标替换为 `disk.png` 位图资源，统一占位图风格。
- 封面加载失败占位图资源从 `loadfail.png` 切换为 `loadfail.gif`。
- 封面占位图及空状态组件的 `resizeMode` 统一改为 `contain`，并新增居中对齐。

### 修复

- 修复搜索结果页封面在播放器异步获取到封面后不自动刷新的问题：`SearchMusicResultRow` 订阅 `picUpdated` 事件，匹配当前播放歌曲后实时更新封面。

### 移除

- 移除 `Pic.tsx` 播放栏封面独立组件，逻辑内聚至 PlayerBar 主组件。
- 移除 `cheatTip` 工具函数（`src/utils/tools.ts`）及对应启动时调用。
- 移除启动页图标容器的 `borderWidth` / `borderColor` 边框样式。

### 构建

- 版本号更新到 0.2.13。
- Android versionCode 升级到 104。

## [0.2.12] - 2026-05-02

本次更新聚焦用户主页体验升级与网络安全强化，新增个人资料卡片、快捷操作栏与歌单拖拽排序能力，优化设置页信息层级并统一图标资源，并为 OkHttp 启用 DNS-over-HTTPS 以提升 DNS 解析安全性。

### 新增

- PlaylistTab 新增个人资料 Hero 卡片，集中展示头像、昵称、签名、性别标识与今日听歌时长，点击可跳转至设置页编辑。
- 新增快捷操作栏（我喜欢的、本地歌曲、统计、一起听），快速触达常用功能入口。
- 新增歌单长按拖拽排序功能，支持列表视图与网格视图的拖拽重排，包含光标跟随缩放、相邻卡片移位动画等完整交互反馈。
- 新增歌单自定义排序模式（`list.playlistSortMode: 'custom'`），拖拽排序结果自动切换至自定义模式并持久化保存。
- 新增 `list.playlistCustomOrder` 配置项，存储歌单自定义排序的 ID 顺序。
- 新增 `openSettingsProfileDetail` 全局事件，支持从用户主页直接跳转至设置页个人资料详情。
- 新增 `hideAvatar` 属性到 SharedTopBar，非首页 Tab 时自动隐藏头像，搜索栏撑满顶栏宽度。
- OkHttp 启用 DNS-over-HTTPS（DOH），使用阿里云 DNS（`https://dns.alidns.com/dns-query`）进行安全 DNS 解析，React Native 网络层通过 `OkHttpClientProvider` 统一配置。

### 调整

- 个人资料 Hero 卡片从设置页移至 PlaylistTab 用户主页，设置页 Profile 入口简化为通用分组行样式。
- 底部导航图标从 lucide-react-native 矢量图标统一改为自定义 PNG 图片资源。
- 歌单排序按钮改为三轮切换：默认排序 → 时间排序 → 自定义排序，并对应不同图标。
- 歌单卡片视觉样式优化：移除边框与阴影，封面改为方形圆角，标题字重与间距收紧。
- PlaylistLibraryScene 组件支持注入 `profileHero` 和 `quickActionsRow` ReactNode，增强布局组合灵活性。
- 设置页新增页面标题栏，提升页面辨识度。

### 构建

- 版本号更新到 0.2.12。
- Android versionCode 升级到 103。

## [0.2.10] - 2026-04-30

本次更新聚焦设置页的信息架构重构与可用性优化，统一搜索/播放与同步配置入口，补齐图标资源与版本更新链路稳定性。

### 新增

- 设置页新增「搜索与播放」分组，集中承载默认搜索源与自定义音源管理入口。
- 新增同步地址与同步格式配置页，支持同步地址历史记录的选择、管理与删除。
- 新增多语言文案键（简中/繁中/英文），覆盖同步格式、音源管理、记录管理等新交互。
- 新增设置页图标资源与静态图片类型声明，支持本地 PNG 资源安全引用。

### 调整

- 设置页头像选择改为 `react-native-image-crop-picker` 裁剪流程，提升头像裁剪与保存体验。
- 自定义音源从嵌入式面板改为独立详情页，支持导入、切换与管理模式删除。
- 同步设置从嵌入式面板改为独立详情页，支持同步地址弹窗输入、格式切换与启停联动。
- 设置页布局与视觉样式整体收敛，分组间距、行高、图标配色与详情层级表现更统一。

### 修复

- 修复版本信息拉取与安装包下载在部分网络环境失败的问题，新增多组 GitHub 代理回退策略并完善逐地址重试。
- 修复设置页底部在手势导航设备上的安全区遮挡问题，底部留白改为基础高度 + 动态手势 inset。

### 构建

- 版本号更新到 0.2.10（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 101。

## [0.2.8] - 2026-04-29

本次更新聚焦歌曲封面图的加载健壮性与展示质量，建立跨渠道封面降级、失败重试与播放时回写的完整缓存闭环，并修复滚动列表底部被播放栏遮挡的布局问题。

### 新增

- 封面加载失败时自动进行三步降级：①重试本渠道 API → ②换同名同歌手的其他渠道封面 → ③展示 loadfail.png 占位图，完全消除封面空白/黑色的情况。
- 新增封面失败注册表（`coverFailureRegistry`，持久化到 AsyncStorage），仅无法从任何渠道获取封面的歌曲才写入；30 分钟冷却后在后台自动重试，app 启动时也触发一轮用户歌单扫描重试。
- 换源成功后立即将新 `picUrl` 持久化到 `meta.picUrl` 并写入 list store，下次打开直接渲染，无需重走换源流程。

### 调整

- 播放歌曲时获取到的新封面 URL 同步写回所有包含该歌曲的用户歌单（`persistCoverToUserLists`），不再仅更新临时播放队列。
- 歌单卡片封面取自歌单第一首歌曲的 `picUrl`；封面更新后通过 `list_music_update` 事件链路自动刷新歌单封面图。
- 跨渠道封面并发请求上限设为 3，防止列表批量封面失败时产生请求风暴。

### 修复

- 修复滚动到底部时最后一个列表项被底部 mini player 遮挡的问题：底部覆盖层实测高度约 156 px，将 `BOTTOM_DOCK_BASE_HEIGHT` 由 112 调整为 164，并在各滚动容器中叠加 `useSystemGestureInsetBottom()` 动态补偿系统手势导航栏高度。

### 构建

- 版本号更新到 0.2.8（package.json）。
- Android versionCode 升级到 99。

## [0.2.6] - 2026-04-12

本次更新聚焦在线歌单转存链路与垂直首页详情交互细节，补齐“从在线歌单一键转成本地歌单”的闭环，并优化详情页层级与关闭体验。

### 新增

- 在线歌单详情页新增“一键转存”入口，可将当前歌单歌曲一次性写入新的本地歌单。
- 批量添加弹窗支持在选择目标歌单时直接新建歌单，并自动沿用当前歌单标题作为默认名称。
- 补充“一键转存”多语言文案，覆盖简中、繁中与英文。

### 调整

- `CreateUserList`、`MusicMultiAddModal` 与歌单选择列表串联创建完成回调，新建歌单后会直接完成歌曲导入，减少重复操作。
- 垂直首页新增 `closePlaylistDetail` 事件，底部导航在搜索页激活态下再次点击可直接关闭独立歌单详情层。
- 调整详情浮层层级，避免歌单详情与底部控件的覆盖关系不稳定。

### 修复

- 修复新建歌单时重复提交可能导致的重复创建问题。
- 修复在线歌单转存时必须先退出当前详情再手动建歌单的流程割裂，转存完成后会直接给出结果反馈。

### 构建

- 版本号更新到 0.2.6（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 97。

## [0.2.5] - 2026-04-12

本次更新聚焦垂直搜索结果页的歌单检索能力与统一歌单详情流转，补齐在线歌单进入详情后的加载与播放体验，并同步完善相关文档说明。

### 新增

- 搜索结果页新增“歌曲 / 歌单”双类型切换，支持在同一搜索浮层里直接检索在线歌单。
- 歌单搜索结果支持直接打开统一歌单详情页，并展示封面、来源、作者 / 播放量等摘要信息。
- 新增搜索结果页、歌单详情页与组件结构设计文档，便于后续维护和继续扩展。

### 调整

- `AppEvent`、`Main` 与 `PlaylistTab` 的歌单详情打开链路升级为结构化 payload，同时兼容本地歌单与在线歌单两类详情请求。
- `PlaylistTab` 详情模式重构为复用同一套详情容器：本地歌单保留导入、删除、重排等编辑能力；在线歌单改为只读展示并支持直接播放到临时队列。
- 搜索页结果头部补充结果标题与类型切换栏，并按结果类型独立缓存请求状态，减少切换时的重复拉取。

### 修复

- 修复 `queueMetaId` 为空时仍调用 `slice()` 可能导致的异常，提升首页和歌单页队列来源解析稳定性。
- 修复从搜索结果进入歌单详情时的页面切换关系，返回后可回到原搜索结果上下文。

### 构建

- 版本号更新到 0.2.5（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 96。

## [0.2.4] - 2026-04-11

本次更新主要补充了部分功能的提示状态、优化了组件库设计，并完善了代码合规信息的声明。

### 新增

- 全局大量源码和配置增加了 Apache-2.0 / Proprietary 开源协议/闭源代码的 License 声明，完善代码合规性。
- 新增 SegmentedIconSwitch（分段图标切换）组件。
- 启动页 (Launch) 新增了基于配置的 Sync... 同步加载提示状态展示。
- 新增 src/components 的结构说明文档 instruction.md，方便梳理各组件层级与职责。

### 调整

- 重构歌单页（PlaylistTab）列表 / 网格切换按钮，改为采用全新的 SegmentedIconSwitch 组件替换了之前的自定义实现，交互更统一。

### 构建

- 版本号更新到 0.2.4（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 95。

## [0.2.3] - 2026-04-11

本次更新聚焦头像资源持久化、歌单页细节打磨与底部导航显示稳定性优化。

### 新增

- 新增应用内默认头像资源，并支持将用户自定义头像复制到应用私有目录持久化保存，减少临时文件失效后头像丢失的问题。
- 歌单页新增“歌单列表”标题文案，并补齐简中、繁中、英文三套多语言翻译。

### 调整

- 底部导航激活态指示器与图标对齐逻辑重构，优化不同像素密度设备上的居中表现与切换动画稳定性。
- 歌单页列表 / 网格切换器尺寸、滑块定位与空状态卡片样式继续打磨，页面观感更统一。
- 更新图片加载失败占位图资源，并统一默认头像与远程头像的显示回退逻辑。

### 修复

- 修复设置页与共享顶栏对 `file://` 头像路径的兼容处理，避免头像地址拼接异常导致的显示问题。
- 修复选择新头像后仍广播原始路径的问题，改为使用实际保存后的持久化路径同步界面。
- 修复历史头像文件不存在时未及时清理缓存记录的问题，减少启动后头像失效或读取异常。

### 构建

- 版本号更新到 0.2.3（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 94。

## [0.2.2] - 2026-04-10

本次更新继续聚焦 UI 的彻底重构与美化，重点补齐歌单联动、设置分层与搜索收口体验。


### 新增

- 新增歌单与当前播放队列的关联高亮能力，支持快速识别当前播放来源歌单。
- 新增歌单列表快捷播放/暂停按钮，降低播放操作路径。
- 新增设置页二级详情选择面板（语言、默认搜索音源、性别）。


### 调整

- 歌单页、搜索页、设置页继续统一视觉风格与交互节奏，整体页面切换更连贯。
- 搜索页关闭时统一执行状态重置（关键字、联想、结果、输入焦点），避免残留状态干扰下一次搜索。
- 通用图片组件切换到 React Native Image 缓存策略实现，弱网与失败兜底表现更稳定。


### 修复

- 修复通知栏喜欢状态在切歌/歌单变化后偶发不同步的问题。
- 修复下一首预加载缓存判定偏差（基于 track cacheKey 修正）。
- 修复 TX 搜索签名链路导致的请求稳定性问题。


### 构建

- 版本号更新到 0.2.2（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 93。

v0.2.1
本次更新继续聚焦 UI 的彻底重构与美化，并覆盖播放通知交互、搜索链路稳定性与缓存细节优化。


### 新增

- 新增播放通知栏「喜欢」动作联动：支持从系统通知栏直接收藏/取消收藏当前歌曲，并自动同步「我喜欢」歌单状态。
- 新增设置页性别字段（男 / 女 / 未设置），支持本地持久化与多语言文案。
- 新增 TX 搜索签名请求链路：引入 signRequest 与 SHA1 原生桥接能力。


### 调整

- 设置页重构为分层详情结构：个人资料、语言、默认搜索音源等选项改为独立详情面板，视觉层级与动效更统一。
- 歌单页视觉与交互细节继续打磨：卡片/列表样式优化，新增歌单快捷播放/暂停按钮，并支持按当前播放队列自动关联高亮。
- 搜索页关闭与重置流程重构，统一空状态展示与歌曲条目样式，交互更连贯。
- 通用图片组件从 FastImage 切换为 React Native Image 缓存策略实现，保持失败兜底与缓存命中能力。


### 修复

- 修复预加载下一首缓存判断不准确问题（改为基于 cacheKey 判定）。
- 修复通知栏喜欢状态在切歌/歌单更新后不同步的问题。


### 构建

- 版本号更新到 0.2.1（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 92。

v0.2.0
本次更新聚焦 UI 的彻底重构与美化，重点统一首页视觉风格与顶部交互体系。


### 新增

- 新增共享顶栏组件 `SharedTopBar`，统一头像入口、搜索入口与搜索清空交互。
- 共享顶栏搜索支持携带默认音源 `search.defaultSource`，并同步关键字/音源状态。


### 调整

- 首页垂直主容器统一接入共享顶栏，并根据当前 Tab / 搜索页 / 歌单详情状态动态控制显隐。
- `HomeTab`、`SettingsTab` 移除重复顶部区域，页面内容改为适配统一顶栏留白，整体观感更简洁。
- `PlaylistTab` 新增 `onSharedTopBarVisibleChange` 协同控制，歌单详情与搜索场景自动隐藏共享顶栏，页面沉浸感更强。
- 首页 UI 层级与交互动线进一步收敛，跨页面切换的一致性和连贯性显著提升。


### 构建

- 版本号更新到 `0.2.0`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `91`。

## [0.2.2] - 2026-04-11

本次更新继续聚焦 UI 的彻底重构与美化，重点补齐歌单联动、设置分层与搜索收口体验。

### 新增


- 新增歌单与当前播放队列的关联高亮能力，支持快速识别当前播放来源歌单。
- 新增歌单列表快捷播放/暂停按钮，降低播放操作路径。
- 新增设置页二级详情选择面板（语言、默认搜索音源、性别）。

### 调整


- 歌单页、搜索页、设置页继续统一视觉风格与交互节奏，整体页面切换更连贯。
- 搜索页关闭时统一执行状态重置（关键字、联想、结果、输入焦点），避免残留状态干扰下一次搜索。
- 通用图片组件切换到 React Native Image 缓存策略实现，弱网与失败兜底表现更稳定。

### 修复


- 修复通知栏喜欢状态在切歌/歌单变化后偶发不同步的问题。
- 修复下一首预加载缓存判定偏差（基于 track cacheKey 修正）。
- 修复 TX 搜索签名链路导致的请求稳定性问题。

### 构建


- 版本号更新到 0.2.2（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 93。

## [0.2.2] - 2026-04-10

### 新增

- 新增歌单与当前播放队列的关联高亮能力，支持在歌单列表中快速识别当前播放来源。
- 新增歌单卡片快捷播放/暂停入口，减少进入详情页后的二次操作。
- 新增设置页二级详情选择面板（语言、默认搜索音源、性别），提升选项可读性与操作聚焦度。

### 调整

- 本版继续聚焦 UI 的彻底重构与美化，重点打磨歌单页、搜索页、设置页的视觉统一与交互连贯性。
- 搜索页关闭流程重构为“先重置后退场”，统一清理关键字、联想词、结果与输入焦点状态。
- 通用图片组件切换到 React Native Image 缓存策略实现，保持兜底图、缓存命中与弱网展示稳定性。
- 设置页个人资料结构继续优化：头像、昵称、签名、性别均支持更清晰的分层编辑路径。

### 修复

- 修复播放通知栏喜欢状态在切歌与歌单变化后的同步时机问题。
- 修复下一首预加载缓存命中判断偏差问题，缓存判定改为结合 track cacheKey。
- 修复 TX 搜索请求稳定性问题，补齐签名链路与原生 SHA1 支持。

### 构建

- 版本号统一更新到 0.2.2（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 93。

## [0.2.1] - 2026-04-10

### 新增

- 新增播放通知栏「喜欢」动作联动：支持从系统通知栏直接收藏/取消收藏当前歌曲，并与「我喜欢」歌单状态实时同步。
- 新增设置页个人资料扩展项：增加性别字段（男 / 女 / 未设置），并补充对应多语言文案与本地持久化。
- 新增 TX 搜索签名请求链路：引入 signRequest 与 SHA1 原生桥接能力，提升接口可用性与稳定性。

### 调整

- 本版继续推进 UI 的彻底重构与美化，重点完善「歌单页 + 搜索页 + 设置页」三大核心页面的视觉一致性与交互层级。
- 设置页升级为分层详情结构：个人资料、语言、搜索音源等选项改为独立详情面板，动效过渡与信息组织更清晰。
- 歌单页卡片与列表样式细节重做，新增歌单快捷播放/暂停按钮，并支持根据当前播放队列自动高亮关联歌单。
- 搜索页重构关闭与重置流程，统一空状态展示与歌曲项样式，减少残留状态导致的交互割裂。
- 通用图片组件从 FastImage 切换为 React Native Image 缓存策略实现，并补齐失败兜底与缓存命中逻辑。

### 修复

- 修复预加载下一首时缓存判断不准确的问题：缓存校验改为结合歌曲 cacheKey，避免不同音质/来源缓存误判。
- 修复播放通知栏收藏状态不同步问题：在切歌、播放列表更新等场景下自动刷新通知栏喜欢状态。

### 构建

- 版本号统一更新到 0.2.1（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 92。

## [0.2.0] - 2026-04-10

### 新增

- 新增垂直布局共享顶栏组件 `SharedTopBar`，统一头像入口、搜索入口与搜索清空交互。
- 共享顶栏搜索支持携带默认音源（`search.defaultSource`）进入搜索页，并同步关键字/音源状态事件。

### 调整

- 本版聚焦首页 UI 的彻底重构与美化：将分散的头部样式与交互统一收敛为一致的视觉语言与布局体系。
- 首页垂直主容器统一接入共享顶栏，并根据当前 Tab、搜索页状态与歌单详情状态动态控制顶栏显隐。
- `HomeTab` 与 `SettingsTab` 移除各自重复的顶部搜索/头像区域，页面内容改为适配共享顶栏的统一顶部留白，视觉层次更干净。
- `PlaylistTab` 新增 `onSharedTopBarVisibleChange` 协同控制，在歌单详情页与搜索页场景隐藏共享顶栏，避免头部交互冲突并提升沉浸感。
- 主页垂直 Tab 层级结构进一步收敛，减少重复 UI 逻辑，页面切换行为与动线一致性更高。

### 构建

- 版本号统一更新到 `0.2.0`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `91`。

## [0.1.9] - 2026-04-10

### 新增

- 歌单页新增「网格 / 列表」双展示模式切换，支持按场景快速切换浏览密度。
- 新增歌单排序设置项 `list.playlistSortMode`（`default` / `time`），并持久化到设置配置中。
- 新增项目结构与页面层级文档：`docs/project-structure.md`、`docs/page-hierarchy.md`。

### 调整

- 首页主流程中 `MeTab` 重构为 `PlaylistTab`，横屏与竖屏入口统一切换到新的歌单页实现。
- 歌单页由「个人信息 + 歌单」混合结构调整为「歌单中心」结构，聚焦歌单浏览、管理与播放操作。
- 歌单详情页新增更自然的场景切换动画（进入 / 返回过渡、遮罩层联动），提升切页连贯性。
- 搜索区音源筛选菜单升级为动画展开面板，交互反馈与层级表现更清晰。
- 设置页视觉与信息层级重构：新增账号卡片（头像 / 昵称 / 个性签名）及语言、版本信息的聚合展示。

### 构建

- 版本号统一更新到 `0.1.9`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `90`。

## [0.1.2] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.1.2`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `83`。

## [0.1.1] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.1.1`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `82`。

## [0.1.0] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.1.0`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `81`。

## [0.0.9] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.0.9`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `80`。

## [0.0.8] - 2026-03-22

### 新增

- 底部播放栏新增播放队列抽屉：支持查看当前队列、点播切歌、单曲移除、按名称升降序/随机排序。
- 新增播放队列全局事件（`togglePlayQueuePanel` / `showPlayQueuePanel` / `hidePlayQueuePanel`），用于详情页与播放栏联动控制队列面板。
- 我的歌单详情支持长按拖拽排序，拖拽过程提供位移预览并保存到列表顺序；新增单曲删除确认弹窗。
- 我的歌单新增“按时间排序”切换，支持在默认顺序与时间顺序之间快速切换。
- 新增本地封面缓存模块（`imageCache`），支持下载去重、运行时缓存与 `file://` 资源复用。

### 调整

- 播放详情页（封面/歌词）改为按音源动态着色，补充分享、喜欢、队列入口，交互与底部播放栏联动。
- 播放详情返回逻辑调整为直接关闭详情页（不再优先从歌词页切回封面页）。
- 首页垂直布局重构为内容层与控制层分离，底部手势区与导航区适配更稳定。
- Android 系统栏样式升级为沉浸式：`MainActivity` 与主题样式统一启用透明导航栏、亮色导航图标与对比度优化。
- 导航配置调整为 `drawBehind + transparent`，统一页面/弹窗沉浸式表现。
- 统一弹窗沉浸式参数（`navigationBarTranslucent`）并引入 `APP_LAYER_INDEX` 统一管理层级，减少遮挡问题。
- 歌曲分享策略优化：系统分享优先链接，剪贴板保留标题与链接。
- 安全提示与温馨提示文案优化，表达更简洁。

### 修复

- 更新下载流程增强：前台恢复后自动检查、下载会话状态守护、超时重试与中断恢复，减少“卡住”风险。
- 更新检测节流与并发保护完善，避免重复检查导致的状态抖动。
- 播放器初始化与恢复播放时强制同步音量/倍速并校正异常值，避免设置失效。
- 图片组件补充本地缓存优先命中与后台预热，弱网场景下封面加载稳定性提升。
- 我的页歌单批量操作与拖拽手势冲突场景下的交互稳定性提升。

### 构建

- 版本号统一为 `0.0.8`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `79`。

## [0.0.7] - 2026-03-21

### 调整

- 通知栏图标加载策略调整：Android 改为使用原生 `drawable` 资源名（`notification_whitebg`）加载，避免直接使用打包图片路径带来的兼容问题。
- 设置页中文文案优化：`setting_about` 由“关于 LX Music”简化为“关于”。

### 资源

- 新增 Android 通知栏小图标多密度资源：
  - `drawable-mdpi/notification_whitebg.png`
  - `drawable-hdpi/notification_whitebg.png`
  - `drawable-xhdpi/notification_whitebg.png`
  - `drawable-xxhdpi/notification_whitebg.png`
  - `drawable-xxxhdpi/notification_whitebg.png`

### 构建

- 版本号统一为 `0.0.7`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `78`。

## [0.0.6] - 2026-03-21

### 新增

- 播放详情页新增可拖拽进度条组件 `SeekBar`，封面页与歌词页统一支持拖拽快进/回退。
- 设置页新增「关于」信息卡，展示当前版本、下载更新状态，并提供 GitHub Releases 快捷入口。

### 调整

- 播放详情页返回键逻辑优化：在歌词页按返回先回到封面页，再次返回才关闭详情页。
- 我的页返回逻辑细化：优先关闭批量导入抽屉、退出歌单详情/搜索态/音源菜单。
- 设置页移除独立页面级返回拦截，避免与底部标签导航返回行为冲突。

### 修复

- 修复播放详情页封面页与歌词页进度条实现不一致的问题，统一为同一套进度与触控逻辑。

### 构建

- 版本号统一为 `0.0.6`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `77`。

## [0.0.5] - 2026-03-21

### 调整

- 系统通知栏小图标切换为新图标资源（`notification_whitebg.xhdpi.png`），修复通知栏仍显示旧图标的问题。
- 底部播放栏封面外圈进度效果从点阵环改为 SVG 连续圆环，进度显示更平滑。

### 修复

- 修复播放进度计算分母错误（`currentTime` -> `totalTime`）导致的进度异常问题。

### 构建

- 版本号统一为 `0.0.5`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `76`。
- 新增依赖 `react-native-svg`（`^13.10.0`）。

## [0.0.4] - 2026-03-21

### 新增

- Me 页歌单详情新增“歌曲 + 导入”批量导入入口：支持底部抽屉多选歌曲后一次添加。
- 批量导入候选支持去重：自动排除当前歌单已有歌曲，并忽略试听列表来源歌曲。
- 个人设置新增“个性签名”编辑项，支持保存后在 Me 页实时同步显示。
- 新增用户个性签名本地存储与事件通知（`userSignature` / `userSignatureUpdated`）。

### 调整

- Me 页快捷入口改版：
  - “本地歌曲”入口改为“试听列表”入口。
  - “我的歌单”区域不再展示试听列表。
  - “我喜欢的歌曲”文案改为“我喜欢”，图标改为实心心形。
- Me 页默认资料文案由“黄金会员 - 关注 128”改为“我是一个很有个性的人”。
- Me 页歌单详情支持快捷重命名与删除操作入口（针对用户歌单）。
- 设置页“播放设置”中的音源列表样式优化：
  - 取消浅灰色外层容器框。
  - 音源右侧 `×` 按钮与标题栏 `+` 按钮尺寸/视觉对齐。
- 设置页与 Me 页的多语言文案补充：
  - 新增个性签名相关文案键（简中/繁中/英文）。

### 修复

- 修复歌单批量导入抽屉在底部手势条区域显示不佳的问题（Android 导航栏安全区适配）。

### 构建

- 版本号统一为 `0.0.4`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `75`。
- 升级 `react-native-image-colors` 到 `^1.5.2` 并补充 Android 兼容修复。

## [0.0.2] - 2026-03-21

### 新增

- 我的页、底部导航、播放栏空状态接入多语言文案（简中 / 繁中 / English）。
- 设置页新增应用内语言切换入口。
- 设置页补充个人信息相关交互（头像选择、昵称编辑）。

### 调整

- 应用品牌文案统一为 `lux-music-mobile`。
- Android 应用图标资源替换为新品牌图标。
- 搜索提交流程优化：提交关键词时同步到全局搜索状态。
- 发布说明改为由本仓库独立维护。

### 构建

- 版本号升级到 `0.0.2`。
- Android `versionCode` 升级到 `74`。

## [0.0.1] - 2026-03-20

### 新增

- 从上游 `lx-music-mobile` fork，建立本仓库独立发布线。

### 调整

- 检查更新目标仓库切换为 `JuneDrinleng/lux-music-mobile`。
- APK 产物命名前缀切换为 `lux-music-mobile`。
- 增加适配本仓库的 GitHub Actions 自动构建与发布流程。

