## v0.1.5

本次更新聚焦首页架构收敛、播放队列抽屉能力与沉浸式系统栏适配。

### 首页与结构
- 首页主流程重构为垂直 Tab 方案（Me / Settings），并移除旧的 Home Views 页面实现。
- 底部播放栏与导航升级为卡片化布局，播放器栏新增 `inCard` 模式。
- 播放器栏队列入口改为直接联动全局播放队列抽屉。

### 播放队列
- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- 补充播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 系统与稳定性
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。
- 设置页类型声明去耦：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免旧路径残留引用问题。

### 构建
- 版本号更新到 `0.1.5`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `86`。
