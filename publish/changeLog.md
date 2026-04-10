## v0.2.0

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
