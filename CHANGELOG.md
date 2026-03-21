# lux-music-mobile 更新日志

本文档用于记录本仓库（fork 分支）的版本变更历史。

说明：本分支从 `0.0.x` 开始独立维护日志。

## [0.0.3] - 2026-03-21

### 变更

- 版本号统一更新为 `0.0.3`（`package.json`、`package-lock.json`、iOS 工程版本）。
- iOS 版本字段统一为 `0.0.3`（`MARKETING_VERSION`、`CURRENT_PROJECT_VERSION`、测试 Target 的 `CFBundleShortVersionString` 与 `CFBundleVersion`）。
- 升级 `react-native-image-colors` 到 `^1.5.2`，并更新安装后补丁以修正 Android `namespace` 与 `AndroidManifest` 包声明兼容问题。
- Android Gradle 仓库新增阿里云镜像源，提升依赖拉取稳定性。
- `SearchTipList` 组件样式写法调整为数组合并形式，减少对象展开写法。
- `Menu` 组件样式写法改为 style 数组合并形式，统一列表项渲染样式结构。
- `Modal` 组件背景层与内容层结构调整，优化背景点击关闭的覆盖区域处理。
- 新增/更新 Android `appicon` 相关资源与背景资源文件。

### 构建

- Android `versionCode` 保持 `74`。

## [0.0.2] - 2026-03-21

### 新增

- 我的页、底部导航、播放栏空状态接入多语言文案（简中 / 繁中 / English）。
- 设置页新增应用内语言切换入口。
- 设置页补充个人信息相关交互与文案（头像选择、昵称编辑）。

### 调整

- 应用品牌文案统一为 `lux-music-mobile`。
- Android 应用图标资源替换为新品牌图标。
- 搜索提交流程优化：提交关键词时同步到全局搜索状态。
- 发布更新说明改为由本仓库独立维护。

### 构建

- 版本号升级到 `0.0.2`。
- Android `versionCode` 升级到 `74`。

## [0.0.1] - 2026-03-20

### 新增

- 从上游 `lx-music-mobile` fork，建立本仓库独立发布线。

### 调整

- 检查更新目标仓库切换为 `JuneDrinleng/lux-music-mobile`。
- APK 产物命名前缀切换为 `lux-music-mobile`。
- 增加适配本仓库的 GitHub Actions 自动构建与发布流程。
