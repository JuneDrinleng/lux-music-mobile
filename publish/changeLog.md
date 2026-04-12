<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

## v0.2.6

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
