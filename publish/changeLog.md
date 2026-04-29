<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

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
