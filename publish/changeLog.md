<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

## v0.2.7

本次更新聚焦歌单详情页与歌单选择弹窗的组件化重构，统一弹层与列表交互结构，并继续优化纵向首页中歌单详情态的显示关系。

### 新增

- 新增 `PlaylistDetail` 组件组，拆分歌单详情页头部、歌曲列表、歌曲单行与导入抽屉，便于后续扩展和维护。
- 新增 `PlaylistPicker` 组件组，统一“添加到歌单”“批量添加”“一键转存”场景下的摘要卡片、歌单列表与原地新建歌单入口。
- 新增通用 `BottomSheetModal` 底部抽屉外壳，用于统一遮罩、圆角、标题栏与底部安全区表现。

### 调整

- `MusicAddModal` 与 `MusicMultiAddModal` 统一改为复用 `PlaylistPickerDialog`，单曲添加、批量添加和转存的交互样式更加一致。
- `PlaylistTab` 歌单详情页改为通过组件编排组合实现，保留导入、转存、拖拽重排等能力的同时降低页面耦合度。
- 共享顶栏在独立歌单详情 overlay 显示时会自动隐藏，避免纵向首页顶部 UI 与详情页头部叠层冲突。
- 补充组件结构设计文档，记录歌单详情页与歌单选择器相关模块的职责划分。

### 修复

- 修复歌单导入抽屉在圆角、遮罩与底部安全区上的视觉不统一问题，底部弹层观感更完整。
- 修复歌单详情页拆分过程中重复内联实现带来的维护负担，后续调整弹层和列表样式时更不容易遗漏。

### 构建

- 版本号更新到 0.2.7（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 98。
