<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

## v0.2.9

本次更新聚焦首页交互性能与排行榜详情能力，大幅优化 HomeTab 各 clip 的切换流畅度，并支持从榜单直接进入歌单详情页。

### 新增

- 排行榜歌单详情：HomeTab 榜单页「查看全部」按钮现可进入 `PlaylistDetailOverlay`，支持播放、导入整张榜单，与在线歌单详情体验统一（新增 `LeaderboardDetailPayload` 类型及对应加载逻辑）。

### 性能优化

- **HomeTab clip 切换零卡顿**：将 all / new+trending+top / other 三块内容提取为独立 `memo` 子组件（`AllContent`、`LbContent`、`OtherContent`），以 `display: none` 保活替代每次切换时的卸载/挂载，切换后 scroll 位置和 source 选择均保留；filter 按键改为先淡出（80 ms）再通过 `startTransition` 更新状态，彻底消除点击后的卡顿感。
- **Tab 切换提速**：`PagerView` 新增 `offscreenPageLimit={1}` 使相邻页面常驻内存；移除 Main.tsx 中每次状态变化都重建整棵渲染树的 `component = useMemo(...)` 反模式；`handleCloseSearchPage` / `handleClosePlaylistDetail` 改用 `useCallback` 稳定引用。
- **BottomNav 响应更快**：`TabItem` 用 `React.memo` 包裹，`handlePress` / `handleItemLayout` 加 `useCallback`，Tab 切换时不再全量重渲染。

### 清理

- 删除 `RankingsTab.tsx`：含硬编码 mock 数据的占位组件，整个项目无任何引用。
- 移除 `PlaylistTab` 中永久禁用的听歌统计功能（`SHOW_LISTENING_STATISTICS = false` 相关代码及样式）。
- 移除 `SettingsTab` 中永久禁用的高级开关区块（`SHOW_ADVANCED_SWITCHES = false` 相关代码）。
- 清理导航层大量已注释的废弃 screen 注册、screen name 常量及工具函数。
- 删除 `HomeTab.tsx` 中遗留的 16 个搜索栏时代残留样式（`topBar`、`searchDock` 等）。

### 修复

- 修复 `navigation.ts` 末尾孤立 `*/` 导致 Babel 解析报 `Unexpected token`、Metro 打包失败的问题。

### 构建

- 版本号更新到 0.2.9（package.json）。
- Android versionCode 升级到 100。
- 修复 `beta-pack.yml`：补充 GitHub Pre-release 发布步骤（`prerelease: true`，tag `v{version}-beta`），并修正 MD5 校验路径。

## v0.2.8

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
