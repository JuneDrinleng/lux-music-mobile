<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

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
