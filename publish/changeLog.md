<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

## v0.2.14

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
