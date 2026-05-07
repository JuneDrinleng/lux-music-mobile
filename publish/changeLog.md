## v0.2.18

本次更新聚焦播放详情浮层重构、歌单详情组件提取与 UI 样式统一，将播放详情从原生导航页面改为浮层 overlay 架构，提取 PlaylistDetailView 可复用组件，并统一搜索栏/按钮视觉样式。

### 新增

- 新增 PlayDetailOverlay 浮层组件，播放详情从原生导航改为从底部滑入的 overlay，支持黑色遮罩背景与弹性动画（Easing.out(Easing.back(1.05))），通过全局事件 showPlayDetail/hidePlayDetail 控制显隐，横竖屏均已接入。
- 新增 PlaylistDetailView 可复用组件（525 行），从 PlaylistTab 中提取歌单详情完整渲染逻辑为独立组件，支持本地歌单/在线歌单/排行榜三种类型，自带开合动画、播放/删除/重命名/导入/拖拽排序等完整交互。
- 新增 PlayDetailContext 上下文（createContext + usePlayDetailClose hook），通过 Context 注入关闭回调，解耦 Pic/Lyric/Header 等子组件对 navigation.pop 的直接依赖。

### 调整

- GlassSearchField 毛玻璃效果简化：移除 @react-native-community/blur BlurView 依赖及 glassTint/glassFallback/glassRim 多层叠加层，改为纯色背景 #dce0e9 + 边框 #cdd2de。
- 搜索栏/按钮 UI 统一样式：移除 shadowColor/shadowOpacity/shadowRadius/elevation 阴影属性，简化按钮背景色为 #f0f1f6/#e8e9f0。
- PlayerBar 播放详情入口从 navigations.pushPlayDetailScreen 改为 global.app_event.showPlayDetail，统一 overlay 打开方式并预加载封面图。
- PlayDetail 导航层优化：pushPlayDetailScreen 提前设置 bgPic 封面图 + 黑色 componentBackgroundColor，避免推入动画过程中的白屏闪烁。
- SharedTopBar 在歌单详情打开时保持显示（移除 playlistDetailVisible 条件限制），提升导航一致性。
- 本地歌单详情缓存未命中时同步写入 snapshot 缓存（cachePlaylistSnapshot），避免下次打开重复加载。
- 关闭歌单详情浮层时发送 closePlaylistDetail 全局事件通知联动组件。
- Home/Horizontal 横屏主页挂载 PlayDetailOverlay，支持横屏模式下的播放详情浮层。
- PageContent 新增 pic prop 支持外部注入封面图，play detail overlay 模式下优先使用当前歌曲封面避免白底。
- SearchPage 搜索历史行样式收紧：行高 56→44，移除白色卡片背景色/圆角/阴影，行间距归零。
- PlaylistDetailHeader hero 容器添加 backgroundColor 兜底背景色 #eef0fb。
- PlayerBar loveIcon 尺寸 20→24、loveIconInCard 22→26，Pic sideActionIcon/likedIcon 20→24，触摸区域更友好。
- PlayDetail/index.tsx 新增 onClose prop 支持 overlay 模式关闭回调，保留原生 navigation.pop 兼容路径。

### 性能优化

- PlaylistDetailOverlay / PlaylistDetailScene 的 FlatList 添加 getItemLayout 属性，利用固定行高 SONG_ITEM_HEIGHT（70px）加速列表布局计算，减少渲染帧耗时。
- 歌单详情数据加载策略调整：线上歌单/排行榜全量数据加载完成后再一次性更新列表，避免先展示首页分页数据再替换为全量数据导致的二次渲染与视觉闪烁。

### 移除

- 移除 PlaylistTab 中 renderDetailScene 函数及 55 行 props 传递代码，由 PlaylistDetailView 自包含接管。
- 移除 GlassSearchField 中 BlurView 组件及 hasNativeBlurView UIManager 检测逻辑。
- 移除 .github/workflows/publish-version-info.yml GitHub Actions 流水线。

### 构建

- 版本号更新到 0.2.18。
- Android versionCode 升级到 109。
