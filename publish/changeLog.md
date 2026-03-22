## v0.1.8

本次更新聚焦播放详情页的播放模式切换体验与状态同步。

### 调整
- 封面页与歌词页新增播放模式快捷切换按钮，支持 `listLoop / random / list / singleLoop / single` 循环切换。
- 播放模式图标改为根据当前 `player.togglePlayMethod` 动态显示。
- 模式切换后会即时写入设置，并弹出多语言提示当前模式。

### 修复
- 修复播放详情页底部播放模式图标与实际模式不同步的问题。
- 修复封面页与歌词页播放模式控制不一致的问题。

### 构建
- 版本号更新到 `0.1.8`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `89`。
