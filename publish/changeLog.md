## v0.2.17

本次更新聚焦歌单详情页性能优化，将 PlaylistDetailOverlay 从单体组件重构为可复用 hook 架构，大幅提升首次打开流畅度。

### 性能优化

- PlaylistDetailOverlay 组件化重构：从 ~1100 行单体组件拆分为 usePlaylistDetailData / useSongDragReorder / usePlaylistImport 三个独立 hook，减少首帧 reconciliation 负担。
- renderSongItem 回调稳定化：使用 ref 替代 state 依赖，回调依赖从 14 项精简为 11 项全部稳定引用，避免拖拽排序期间不必要的行重渲染。
- PlaylistDetailSongItem 添加 React.memo 包裹及自定义比较函数，阻止未变更行在父组件更新时的无效重渲染。
- PlaylistDetailOverlay 添加 React.memo 及自定义比较函数，避免播放栏等父组件状态变化触发冗余渲染。
- MusicMultiAddModal 按需挂载：仅在线歌单/榜单详情时才渲染，本地歌单打开不再加载该重型组件。
- 歌单详情 Hero 封面预加载：detailHeroCover 确定后立即调用 Image.prefetch，减少封面白屏时间。
- 歌单详情入场动画延迟一帧启动：首帧先完成布局渲染，再通过 requestAnimationFrame 触发滑动动画，减少首帧卡顿。

### 构建

- 版本号更新到 0.2.17。
- Android versionCode 升级到 108。
