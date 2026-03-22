# lux-music-mobile 更新日志

本文档用于记录本仓库（fork 分支）的版本变更历史。

## [0.1.7] - 2026-03-22

### 调整

- 播放队列抽屉新增 `enabled` 开关，用于按页面控制抽屉启用状态。
- 首页在播放详情页打开时自动禁用队列抽屉，避免跨页面重复响应事件。
- 播放详情页接入独立 `PlayQueueSheet`，并按当前详情页实例进行启用控制。

### 修复

- 修复首页与播放详情页同时挂载队列抽屉时的 `toggle/show/hide` 事件冲突问题。
- 修复队列抽屉禁用后仍可能保持显示的问题，禁用时会立即关闭并重置动画状态。
- 修复播放详情页内队列抽屉显示时系统栏沉浸式状态同步问题。

### 构建

- 版本号统一更新到 `0.1.7`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `88`。

## [0.1.2] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.1.2`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `83`。

## [0.1.1] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.1.1`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `82`。

## [0.1.0] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.1.0`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `81`。

## [0.0.9] - 2026-03-22

### 新增

- 新增全局播放队列抽屉 `PlayQueueSheet`，支持查看当前队列、点击切歌、独立临时队列单曲移除与一键清空（含确认弹窗）。
- 新增播放队列清空相关多语言文案键：`play_queue_clear_current_btn`、`play_queue_clear_current_confirm`。

### 调整

- 首页结构重构为垂直 Tab 方案（Me / Settings），主流程收敛到 `src/screens/Home/Vertical/Tabs`，并移除旧 `src/screens/Home/Views/*` 页面实现。
- 底部播放栏与导航升级为卡片化样式，`PlayerBar` 新增 `inCard` 模式，队列入口改为联动全局队列抽屉。
- 歌单页与搜索等场景统一为“入队并播放”流程（`playListAsQueue` / `addMusicToQueueAndPlay`），队列行为更一致。
- Android 原生层启用沉浸式系统栏（透明状态栏/导航栏），并新增 `UtilsModule.setSystemBarsTransparent()` 供 JS 调用。

### 修复

- 修复设置页旧类型依赖残留问题：`src/types/app.d.ts` 改为本地 `SettingScreenIds` 联合类型，避免删除旧 Setting 目录后的引用异常。

### 构建

- 版本号统一更新到 `0.0.9`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `80`。

## [0.0.8] - 2026-03-22

### 新增

- 底部播放栏新增播放队列抽屉：支持查看当前队列、点播切歌、单曲移除、按名称升降序/随机排序。
- 新增播放队列全局事件（`togglePlayQueuePanel` / `showPlayQueuePanel` / `hidePlayQueuePanel`），用于详情页与播放栏联动控制队列面板。
- 我的歌单详情支持长按拖拽排序，拖拽过程提供位移预览并保存到列表顺序；新增单曲删除确认弹窗。
- 我的歌单新增“按时间排序”切换，支持在默认顺序与时间顺序之间快速切换。
- 新增本地封面缓存模块（`imageCache`），支持下载去重、运行时缓存与 `file://` 资源复用。

### 调整

- 播放详情页（封面/歌词）改为按音源动态着色，补充分享、喜欢、队列入口，交互与底部播放栏联动。
- 播放详情返回逻辑调整为直接关闭详情页（不再优先从歌词页切回封面页）。
- 首页垂直布局重构为内容层与控制层分离，底部手势区与导航区适配更稳定。
- Android 系统栏样式升级为沉浸式：`MainActivity` 与主题样式统一启用透明导航栏、亮色导航图标与对比度优化。
- 导航配置调整为 `drawBehind + transparent`，统一页面/弹窗沉浸式表现。
- 统一弹窗沉浸式参数（`navigationBarTranslucent`）并引入 `APP_LAYER_INDEX` 统一管理层级，减少遮挡问题。
- 歌曲分享策略优化：系统分享优先链接，剪贴板保留标题与链接。
- 安全提示与温馨提示文案优化，表达更简洁。

### 修复

- 更新下载流程增强：前台恢复后自动检查、下载会话状态守护、超时重试与中断恢复，减少“卡住”风险。
- 更新检测节流与并发保护完善，避免重复检查导致的状态抖动。
- 播放器初始化与恢复播放时强制同步音量/倍速并校正异常值，避免设置失效。
- 图片组件补充本地缓存优先命中与后台预热，弱网场景下封面加载稳定性提升。
- 我的页歌单批量操作与拖拽手势冲突场景下的交互稳定性提升。

### 构建

- 版本号统一为 `0.0.8`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `79`。

## [0.0.7] - 2026-03-21

### 调整

- 通知栏图标加载策略调整：Android 改为使用原生 `drawable` 资源名（`notification_whitebg`）加载，避免直接使用打包图片路径带来的兼容问题。
- 设置页中文文案优化：`setting_about` 由“关于 LX Music”简化为“关于”。

### 资源

- 新增 Android 通知栏小图标多密度资源：
  - `drawable-mdpi/notification_whitebg.png`
  - `drawable-hdpi/notification_whitebg.png`
  - `drawable-xhdpi/notification_whitebg.png`
  - `drawable-xxhdpi/notification_whitebg.png`
  - `drawable-xxxhdpi/notification_whitebg.png`

### 构建

- 版本号统一为 `0.0.7`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `78`。

## [0.0.6] - 2026-03-21

### 新增

- 播放详情页新增可拖拽进度条组件 `SeekBar`，封面页与歌词页统一支持拖拽快进/回退。
- 设置页新增「关于」信息卡，展示当前版本、下载更新状态，并提供 GitHub Releases 快捷入口。

### 调整

- 播放详情页返回键逻辑优化：在歌词页按返回先回到封面页，再次返回才关闭详情页。
- 我的页返回逻辑细化：优先关闭批量导入抽屉、退出歌单详情/搜索态/音源菜单。
- 设置页移除独立页面级返回拦截，避免与底部标签导航返回行为冲突。

### 修复

- 修复播放详情页封面页与歌词页进度条实现不一致的问题，统一为同一套进度与触控逻辑。

### 构建

- 版本号统一为 `0.0.6`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `77`。

## [0.0.5] - 2026-03-21

### 调整

- 系统通知栏小图标切换为新图标资源（`notification_whitebg.xhdpi.png`），修复通知栏仍显示旧图标的问题。
- 底部播放栏封面外圈进度效果从点阵环改为 SVG 连续圆环，进度显示更平滑。

### 修复

- 修复播放进度计算分母错误（`currentTime` -> `totalTime`）导致的进度异常问题。

### 构建

- 版本号统一为 `0.0.5`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `76`。
- 新增依赖 `react-native-svg`（`^13.10.0`）。

## [0.0.4] - 2026-03-21

### 新增

- Me 页歌单详情新增“歌曲 + 导入”批量导入入口：支持底部抽屉多选歌曲后一次添加。
- 批量导入候选支持去重：自动排除当前歌单已有歌曲，并忽略试听列表来源歌曲。
- 个人设置新增“个性签名”编辑项，支持保存后在 Me 页实时同步显示。
- 新增用户个性签名本地存储与事件通知（`userSignature` / `userSignatureUpdated`）。

### 调整

- Me 页快捷入口改版：
  - “本地歌曲”入口改为“试听列表”入口。
  - “我的歌单”区域不再展示试听列表。
  - “我喜欢的歌曲”文案改为“我喜欢”，图标改为实心心形。
- Me 页默认资料文案由“黄金会员 - 关注 128”改为“我是一个很有个性的人”。
- Me 页歌单详情支持快捷重命名与删除操作入口（针对用户歌单）。
- 设置页“播放设置”中的音源列表样式优化：
  - 取消浅灰色外层容器框。
  - 音源右侧 `×` 按钮与标题栏 `+` 按钮尺寸/视觉对齐。
- 设置页与 Me 页的多语言文案补充：
  - 新增个性签名相关文案键（简中/繁中/英文）。

### 修复

- 修复歌单批量导入抽屉在底部手势条区域显示不佳的问题（Android 导航栏安全区适配）。

### 构建

- 版本号统一为 `0.0.4`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `75`。
- 升级 `react-native-image-colors` 到 `^1.5.2` 并补充 Android 兼容修复。

## [0.0.2] - 2026-03-21

### 新增

- 我的页、底部导航、播放栏空状态接入多语言文案（简中 / 繁中 / English）。
- 设置页新增应用内语言切换入口。
- 设置页补充个人信息相关交互（头像选择、昵称编辑）。

### 调整

- 应用品牌文案统一为 `lux-music-mobile`。
- Android 应用图标资源替换为新品牌图标。
- 搜索提交流程优化：提交关键词时同步到全局搜索状态。
- 发布说明改为由本仓库独立维护。

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
