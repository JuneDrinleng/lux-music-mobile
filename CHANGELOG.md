# lux-music-mobile ????

???????????fork ???????????
<!-- Modified by Lux Music: derived from the upstream LX Music Mobile documentation file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. -->
## [0.2.4] - 2026-04-11

本次更新主要补充了部分功能的提示状态、优化了组件库设计，并完善了代码合规信息的声明。

### 新增

- 全局大量源码和配置增加了 Apache-2.0 / Proprietary 开源协议/闭源代码的 License 声明，完善代码合规性。
- 新增 SegmentedIconSwitch（分段图标切换）组件。
- 启动页 (Launch) 新增了基于配置的 Sync... 同步加载提示状态展示。
- 新增 src/components 的结构说明文档 instruction.md，方便梳理各组件层级与职责。

### 调整

- 重构歌单页（PlaylistTab）列表 / 网格切换按钮，改为采用全新的 SegmentedIconSwitch 组件替换了之前的自定义实现，交互更统一。

### 构建

- 版本号更新到 0.2.4（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 95。

## [0.2.3] - 2026-04-11

??????????????????????????????????

### ??

- ???????????????????????????????????????????????????????
- ???????????????????????????????????

### ??

- ?????????????????????????????????????????????
- ????? / ?????????????????????????????????
- ??????????????????????????????????

### ??

- ??????????? `file://` ????????????????????????????
- ???????????????????????????????????????
- ????????????????????????????????????????

### ??

- ?????? 0.2.3?package.json?package-lock.json?iOS ????
- Android versionCode ??? 94?
## [0.2.2] - 2026-04-10

### 新增

- 新增歌单与当前播放队列的关联高亮能力，支持在歌单列表中快速识别当前播放来源。
- 新增歌单卡片快捷播放/暂停入口，减少进入详情页后的二次操作。
- 新增设置页二级详情选择面板（语言、默认搜索音源、性别），提升选项可读性与操作聚焦度。

### 调整

- 本版继续聚焦 UI 的彻底重构与美化，重点打磨歌单页、搜索页、设置页的视觉统一与交互连贯性。
- 搜索页关闭流程重构为“先重置后退场”，统一清理关键字、联想词、结果与输入焦点状态。
- 通用图片组件切换到 React Native Image 缓存策略实现，保持兜底图、缓存命中与弱网展示稳定性。
- 设置页个人资料结构继续优化：头像、昵称、签名、性别均支持更清晰的分层编辑路径。

### 修复

- 修复播放通知栏喜欢状态在切歌与歌单变化后的同步时机问题。
- 修复下一首预加载缓存命中判断偏差问题，缓存判定改为结合 track cacheKey。
- 修复 TX 搜索请求稳定性问题，补齐签名链路与原生 SHA1 支持。

### 构建

- 版本号统一更新到 0.2.2（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 93。

## [0.2.1] - 2026-04-10

### 新增

- 新增播放通知栏「喜欢」动作联动：支持从系统通知栏直接收藏/取消收藏当前歌曲，并与「我喜欢」歌单状态实时同步。
- 新增设置页个人资料扩展项：增加性别字段（男 / 女 / 未设置），并补充对应多语言文案与本地持久化。
- 新增 TX 搜索签名请求链路：引入 signRequest 与 SHA1 原生桥接能力，提升接口可用性与稳定性。

### 调整

- 本版继续推进 UI 的彻底重构与美化，重点完善「歌单页 + 搜索页 + 设置页」三大核心页面的视觉一致性与交互层级。
- 设置页升级为分层详情结构：个人资料、语言、搜索音源等选项改为独立详情面板，动效过渡与信息组织更清晰。
- 歌单页卡片与列表样式细节重做，新增歌单快捷播放/暂停按钮，并支持根据当前播放队列自动高亮关联歌单。
- 搜索页重构关闭与重置流程，统一空状态展示与歌曲项样式，减少残留状态导致的交互割裂。
- 通用图片组件从 FastImage 切换为 React Native Image 缓存策略实现，并补齐失败兜底与缓存命中逻辑。

### 修复

- 修复预加载下一首时缓存判断不准确的问题：缓存校验改为结合歌曲 cacheKey，避免不同音质/来源缓存误判。
- 修复播放通知栏收藏状态不同步问题：在切歌、播放列表更新等场景下自动刷新通知栏喜欢状态。

### 构建

- 版本号统一更新到 0.2.1（package.json、package-lock.json、iOS 工程）。
- Android versionCode 升级到 92。

## [0.2.0] - 2026-04-10

### 新增

- 新增垂直布局共享顶栏组件 `SharedTopBar`，统一头像入口、搜索入口与搜索清空交互。
- 共享顶栏搜索支持携带默认音源（`search.defaultSource`）进入搜索页，并同步关键字/音源状态事件。

### 调整

- 本版聚焦首页 UI 的彻底重构与美化：将分散的头部样式与交互统一收敛为一致的视觉语言与布局体系。
- 首页垂直主容器统一接入共享顶栏，并根据当前 Tab、搜索页状态与歌单详情状态动态控制顶栏显隐。
- `HomeTab` 与 `SettingsTab` 移除各自重复的顶部搜索/头像区域，页面内容改为适配共享顶栏的统一顶部留白，视觉层次更干净。
- `PlaylistTab` 新增 `onSharedTopBarVisibleChange` 协同控制，在歌单详情页与搜索页场景隐藏共享顶栏，避免头部交互冲突并提升沉浸感。
- 主页垂直 Tab 层级结构进一步收敛，减少重复 UI 逻辑，页面切换行为与动线一致性更高。

### 构建

- 版本号统一更新到 `0.2.0`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `91`。

## [0.1.9] - 2026-04-10

### 新增

- 歌单页新增「网格 / 列表」双展示模式切换，支持按场景快速切换浏览密度。
- 新增歌单排序设置项 `list.playlistSortMode`（`default` / `time`），并持久化到设置配置中。
- 新增项目结构与页面层级文档：`docs/project-structure.md`、`docs/page-hierarchy.md`。

### 调整

- 首页主流程中 `MeTab` 重构为 `PlaylistTab`，横屏与竖屏入口统一切换到新的歌单页实现。
- 歌单页由「个人信息 + 歌单」混合结构调整为「歌单中心」结构，聚焦歌单浏览、管理与播放操作。
- 歌单详情页新增更自然的场景切换动画（进入 / 返回过渡、遮罩层联动），提升切页连贯性。
- 搜索区音源筛选菜单升级为动画展开面板，交互反馈与层级表现更清晰。
- 设置页视觉与信息层级重构：新增账号卡片（头像 / 昵称 / 个性签名）及语言、版本信息的聚合展示。

### 构建

- 版本号统一更新到 `0.1.9`（`package.json`、`package-lock.json`、iOS 工程）。
- Android `versionCode` 升级到 `90`。

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

