<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

## v0.2.13

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
