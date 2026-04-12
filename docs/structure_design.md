<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 组件设计与使用说明

| 组件负责内容     | 对于模块化代码          | 参考实现                                                   |
| :--------------- | :---------------------- | :--------------------------------------------------------- |
| 滑槽滑块切换按钮 | SegmentedIconSwitch.tsx | 歌单管理页面（我的歌单）中视图切换（卡片与横向列表的切换） |
| 底部抽屉面板壳   | BottomSheetModal.tsx    | 歌单详情页中“导入歌曲”底部抽屉的统一遮罩、标题栏与底部安全区 |
| 歌单详情页容器   | PlaylistDetailScene.tsx | 歌单详情页主体布局，承接头部、歌曲列表和详情页专属弹层     |
| 歌单详情页头部   | PlaylistDetailHeader.tsx | 歌单详情页顶部返回、封面、标题、来源信息与主操作按钮       |
| 歌单歌曲列表     | PlaylistSongList.tsx    | 歌单详情页歌曲列表、空态与拖拽中的悬浮歌曲卡片             |
| 歌曲列表单行     | PlaylistSongRow.tsx     | 歌单详情页单曲行展示、点击播放、长按拖拽入口、删除按钮     |
| 歌单导入抽屉     | PlaylistImportDrawer.tsx | 本地歌单详情页中从其他歌单导入歌曲的选择抽屉               |
| 歌单选择弹窗骨架 | PlaylistPickerDialog.tsx | “添加到歌单”与“一键转存”弹窗的统一摘要区与列表区布局       |
| 歌单选择弹窗头部 | PlaylistPickerHeader.tsx | 单曲添加/批量添加弹窗顶部摘要信息（封面、标题、说明）      |
| 歌单选择列表     | PlaylistPickerList.tsx  | 目标歌单列表渲染与弹窗内新建歌单入口                       |
| 歌单选择列表项   | PlaylistPickerListItem.tsx | 目标歌单选择项与“已存在/可添加”状态展示                  |
| 弹窗内新建歌单行 | PlaylistPickerCreateRow.tsx | 在歌单选择弹窗内原地创建新歌单                           |

# 页面代码文件

| 页面内容 | 对于模块化代码 | 参考实现 |
| :------- | :------------- | :------- |
| 纵向首页主容器 | Home/Vertical/Main.tsx | 管理 SharedTopBar、PagerView，以及从 HomeTab 打开的歌单详情独立 overlay |
| 我的歌单页 | Home/Vertical/Tabs/PlaylistTab.tsx | 管理歌单列表、搜索态、歌单详情态，并编排 PlaylistDetail 系列组件 |
| 首页发现页 | Home/Vertical/Tabs/HomeTab.tsx | 通过 `openPlaylistDetail` 打开歌单详情页 overlay |
| 添加到歌单弹窗 | components/MusicAddModal/MusicAddModal.tsx | 单曲添加到歌单时复用 PlaylistPickerDialog |
| 批量添加到歌单弹窗 | components/MusicMultiAddModal/MusicMultiAddModal.tsx | 在线歌单一键转存/批量添加时复用 PlaylistPickerDialog |
