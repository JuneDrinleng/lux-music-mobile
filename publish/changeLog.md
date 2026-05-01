<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->

## v0.2.12

本次更新聚焦用户主页体验升级与网络安全强化，新增个人资料卡片、快捷操作栏与歌单拖拽排序能力，优化设置页信息层级并统一图标资源，并为 OkHttp 启用 DNS-over-HTTPS 以提升 DNS 解析安全性。

### 新增

- PlaylistTab 新增个人资料 Hero 卡片，集中展示头像、昵称、签名、性别标识与今日听歌时长，点击可跳转至设置页编辑。
- 新增快捷操作栏（我喜欢的、本地歌曲、统计、一起听），快速触达常用功能入口。
- 新增歌单长按拖拽排序功能，支持列表视图与网格视图的拖拽重排，包含光标跟随缩放、相邻卡片移位动画等完整交互反馈。
- 新增歌单自定义排序模式（`list.playlistSortMode: 'custom'`），拖拽排序结果自动切换至自定义模式并持久化保存。
- 新增 `list.playlistCustomOrder` 配置项，存储歌单自定义排序的 ID 顺序。
- 新增 `openSettingsProfileDetail` 全局事件，支持从用户主页直接跳转至设置页个人资料详情。
- 新增 `hideAvatar` 属性到 SharedTopBar，非首页 Tab 时自动隐藏头像，搜索栏撑满顶栏宽度。
- OkHttp 启用 DNS-over-HTTPS（DOH），使用阿里云 DNS（`https://dns.alidns.com/dns-query`）进行安全 DNS 解析，React Native 网络层通过 `OkHttpClientProvider` 统一配置。

### 调整

- 个人资料 Hero 卡片从设置页移至 PlaylistTab 用户主页，设置页 Profile 入口简化为通用分组行样式。
- 底部导航图标从 lucide-react-native 矢量图标统一改为自定义 PNG 图片资源。
- 歌单排序按钮改为三轮切换：默认排序 → 时间排序 → 自定义排序，并对应不同图标。
- 歌单卡片视觉样式优化：移除边框与阴影，封面改为方形圆角，标题字重与间距收紧。
- PlaylistLibraryScene 组件支持注入 `profileHero` 和 `quickActionsRow` ReactNode，增强布局组合灵活性。
- 设置页新增页面标题栏，提升页面辨识度。

### 构建

- 版本号更新到 0.2.12。
- Android versionCode 升级到 103。
