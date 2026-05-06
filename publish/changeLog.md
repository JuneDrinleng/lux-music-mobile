## v0.2.15

本次更新聚焦播放详情页与评论页的深度整合、图标资源统一化，以及旧歌单详情独立页面的移除与浮层加载体验优化。

### 新增

- 播放详情页（PlayDetail）新增评论页作为首个 Pager 页面，从 Pic 封面页点击评论按钮可切换至评论页，三页布局变为 Comment → Pic → Lyric。
- Comment 页面新增 `embedded` 嵌入模式，支持在播放详情页内嵌展示，包含封面渐变背景、歌曲名/歌手信息展示与分享操作入口。
- 新增位图图标资源：`like.png`（喜欢）、`share.png`（分享）、`fire.png`（热门评论）、`latest.png`（最新评论）、`update-comment.png`（刷新评论），统一替换对应矢量图标。

### 调整

- Comment 页面重做：移除 `PagerView` 热门/最新评论切换，改为 `display` 属性控制显隐，减少组件开销；Header 重构为左侧返回 + 右侧分享的圆形按钮布局，支持 `embedded` 模式下的自定义返回/分享回调。
- PlayerBar 播放栏喜欢按钮从 `Icon` 矢量图标改为 `like.png` 位图资源，支持 `tintColor` 着色。
- PlayDetail Pic 封面页喜欢/分享按钮从矢量图标改为 `like.png`/`share.png` 位图资源。
- PlayDetail Lyric 歌词页分享按钮从矢量图标改为 `share.png` 位图资源。
- PlayDetail 返回键逻辑优化：Comment 页优先切回 Pic 页，Pic/Lyric 页直接关闭详情页，通过 `useBackHandler` 统一管理。
- PlaylistDetailOverlay 浮层 `zIndex`/`elevation` 从 `controls + 4` 调整为 `controls`，解决浮层覆盖层级过高导致遮挡其他控件的问题。
- PlaylistDetailOverlay 在线歌单/排行榜加载优化：`showLoading` 模式下优先加载第一页数据快速展示，再异步加载全量数据，减少白屏等待时间。
- PlaylistDetailOverlay 本地歌单详情缓存未命中时，从全局歌单内存列表（`getListMusicSync`）同步读取作为初始展示数据，避免 Loading 闪烁。
- 歌单列表、搜索页歌单入口统一改为通过 `global.app_event.openPlaylistDetail` 全局事件触发歌单详情，移除对已废弃的 `pushSonglistDetailScreen` 导航函数的调用。

### 修复

- PlaylistDetailOverlay 列表加载增加 `try-catch` 异常保护，避免网络异常或解析失败导致的白屏或未捕获异常。

### 移除

- 移除 SonglistDetail 独立页面（`src/screens/SonglistDetail/`），包括 `index.tsx`、`Header.tsx`、`MusicList.tsx`、`ActionBar.tsx`、`listAction.ts`、`state.ts`，功能已完全由 PlaylistDetailOverlay 浮层接管。
- 移除 `navigation.ts` 中的 `pushSonglistDetailScreen` 导航函数及 `ListInfoItem` 类型引用。
- 移除 `registerScreens.tsx` 中的 `SONGLIST_DETAIL_SCREEN` 屏幕注册。
- 移除 `screenNames.ts` 中的 `SONGLIST_DETAIL_SCREEN` 常量定义。
- 移除 `config/constant.ts` 中的 `COMPONENT_IDS.songlistDetail` 和 `NAV_SHEAR_NATIVE_IDS.songlistDetail_*` 常量。
- 移除 PlayDetail 返回键逻辑中对 `commonState.componentIds.comment` 的旧引用。

### 构建

- 版本号更新到 0.2.15。
- Android versionCode 升级到 106。
