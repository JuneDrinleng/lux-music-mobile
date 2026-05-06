## v0.2.16

本次更新聚焦歌单详情页层级架构重构与播放控件交互优化，解决歌单详情浮层覆盖底部导航与迷你播放栏的问题，并统一喜欢按钮图标表达。

### 调整

- 歌单详情浮层（PlaylistDetailOverlay）架构重构：渲染挂载点从 Main.tsx（Content 内部）移至 Vertical/index.tsx（Content 同级），实现与底部控件的层级解耦。
- 歌单详情页底部控件保持可见：底部导航栏（BottomNav）与迷你播放栏（PlayerBar）在歌单详情打开时浮于详情之上，支持直接切换 Tab 和控制播放。
- 歌单详情页顶部栏自动隐藏：打开歌单详情时 SharedTopBar 不再显示，避免与底部控件层级联动调整时一并浮现。
- PlaylistDetailOverlay 内部场景层（scene）的 `zIndex` 与 `elevation` 收敛为 0，由外层容器 `playlistDetailLayer` 统一管理层级（zIndex: `controls`）。
- PlayerBar 喜欢按钮图标更换：未喜欢态从 `like.png` 替换为 `empty-heart.png`，已喜欢态从 `♥` 文字字符替换为 `fill-in-heart.png` 位图图标，移除对应的文字样式。

### 构建

- 版本号更新到 0.2.16。
- Android versionCode 升级到 107。
