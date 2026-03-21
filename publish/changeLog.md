## v0.0.3

本次更新基于当前代码改动整理，重点是版本同步、依赖兼容与构建稳定性优化。

### 版本与构建

- 版本号统一更新到 `0.0.3`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 保持 `74`。
- Android Gradle 仓库新增阿里云镜像（`google/public`）以提升拉取稳定性。

### 依赖与兼容

- `react-native-image-colors` 升级到 `^1.5.2`。
- 安装后补丁更新：修正 Android `namespace`，并移除库 Manifest 的 `package` 声明以避免冲突。

### 代码与资源

- `SearchTipList` 组件样式写法调整为 style 数组合并形式。
- `Menu` 组件样式写法改为 style 数组合并形式，统一列表项样式结构。
- `Modal` 组件背景层与内容层结构调整，优化背景点击关闭区域处理。
- 新增/更新 Android `appicon` 系列资源与背景资源文件。

### 维护

- 发布说明与版本文案继续由本仓库维护。
