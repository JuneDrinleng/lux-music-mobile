<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

## v0.2.5

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

## v0.2.4

本次更新主要补充了部分功能的提示状态、优化了组件库设计，并完善了代码合规信息的声明。

### 新增

- 全局大量源码和配置增加了 `开源协议/闭源代码`（Apache-2.0 / Proprietary）的 License 声明，完善代码合规性。
- 新增 `SegmentedIconSwitch`（分段图标切换）组件。
- 启动页 (`Launch`) 新增了基于配置的 `Sync...` 同步加载状态显示。
- 新增 `src/components` 的结构说明文档 `instruction.md`，方便梳理各组件层级与职责。

### 调整

- 重构歌单页（`PlaylistTab`）列表 / 网格切换按钮，改为采用全新的 `SegmentedIconSwitch` 组件替换了之前的自定义实现，交互更统一。

### 构建

- 版本号更新到 0.2.4（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 95。
