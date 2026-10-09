<!-- Lux Repository Notice: registry of files explicitly marked as Lux Proprietary. See LICENSE-NOTICE.md. -->
# Lux Proprietary 文件清单

最后更新：2026-10-08

本清单用于明确标记本仓库中由 Lux Music 维护者保留权利的内容。
未出现在本清单中的文件，默认按仓库主许可证与 `LICENSE-NOTICE.md` 执行。

## 标注规则

- 仅登记可独立分离、且不构成上游 Apache-2.0 代码派生的原创内容。
- 登记后请在对应文件头或目录说明中添加 `Lux Proprietary` 标记。
- 对于本清单内文件，未经书面授权不得商用或再分发。
- 已标记为 `Modified by Lux Music ... Apache-2.0` 的上游派生文档，不属于 `Lux Proprietary`，因此不登记在本清单中。

## 已标记但不在本清单的 fork 后文件

| 路径 | 文件头标记 | 说明 |
| --- | --- | --- |
| `README.md` | `Modified by Lux Music ... Apache-2.0` | 上游 README 的派生修改版，继续按 Apache-2.0 处理 |
| `CHANGELOG.md` | `Modified by Lux Music ... Apache-2.0` | 上游 CHANGELOG 的派生修改版，继续按 Apache-2.0 处理 |
| `publish/changeLog.md` | `Modified by Lux Music ... Apache-2.0` | 上游发布说明文档的派生修改版，继续按 Apache-2.0 处理 |
| `LICENSE-NOTICE.md` | `Lux Repository Notice` | 仓库级授权/合规说明文档，不单独认定为 `Lux Proprietary` |
| `PROPRIETARY_FILES.md` | `Lux Repository Notice` | 仓库级权属登记说明文档，不单独认定为 `Lux Proprietary` |

## 文件列表

### 应用图片资源（assets/img/）

| 路径 | 类型 | 说明 | 首次加入 |
| --- | --- | --- | --- |
| `assets/img/DefaultAvatar.png` | `asset` | Lux Music 默认用户头像图片 | `2026-04-11` |
| `assets/img/greybg.png` | `asset` | Lux Music 灰色背景图 | `2026-04-11` |
| `assets/img/loadfail.png` | `asset` | Lux Music 图片加载失败占位图 | `2026-04-11` |
| `assets/img/nonebg.png` | `asset` | Lux Music 透明/无背景占位图 | `2026-04-11` |
| `assets/img/whitebg.png` | `asset` | Lux Music 白色背景图（启动页 Logo 背景）| `2026-04-11` |

### Android 应用图标（Lux 品牌图标）

| 路径 | 类型 | 说明 | 首次加入 |
| --- | --- | --- | --- |
| `android/app/src/main/appicon-playstore.png` | `asset` | Lux Music Google Play 商店图标 | `2026-04-11` |
| `android/app/src/main/res/drawable/appicon_background.xml` | `asset` | Lux 自适应图标背景色定义 | `2026-04-11` |
| `android/app/src/main/res/mipmap-hdpi/appicon.webp` | `asset` | Lux 应用图标 hdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-hdpi/appicon_foreground.webp` | `asset` | Lux 自适应图标前景 hdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-hdpi/appicon_round.webp` | `asset` | Lux 圆形图标 hdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-mdpi/appicon.webp` | `asset` | Lux 应用图标 mdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-mdpi/appicon_foreground.webp` | `asset` | Lux 自适应图标前景 mdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-mdpi/appicon_round.webp` | `asset` | Lux 圆形图标 mdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xhdpi/appicon.webp` | `asset` | Lux 应用图标 xhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xhdpi/appicon_foreground.webp` | `asset` | Lux 自适应图标前景 xhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xhdpi/appicon_round.webp` | `asset` | Lux 圆形图标 xhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xxhdpi/appicon.webp` | `asset` | Lux 应用图标 xxhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xxhdpi/appicon_foreground.webp` | `asset` | Lux 自适应图标前景 xxhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xxhdpi/appicon_round.webp` | `asset` | Lux 圆形图标 xxhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xxxhdpi/appicon.webp` | `asset` | Lux 应用图标 xxxhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xxxhdpi/appicon_foreground.webp` | `asset` | Lux 自适应图标前景 xxxhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-xxxhdpi/appicon_round.webp` | `asset` | Lux 圆形图标 xxxhdpi | `2026-04-11` |
| `android/app/src/main/res/mipmap-anydpi-v26/appicon.xml` | `asset` | Lux 自适应图标配置（anydpi）| `2026-04-11` |
| `android/app/src/main/res/mipmap-anydpi-v26/appicon_round.xml` | `asset` | Lux 自适应圆形图标配置（anydpi）| `2026-04-11` |

### Android 启动屏图片

| 路径 | 类型 | 说明 | 首次加入 |
| --- | --- | --- | --- |
| `android/app/src/main/res/drawable-hdpi/launch_screen.png` | `asset` | Lux 启动屏竖屏 hdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-mdpi/launch_screen.png` | `asset` | Lux 启动屏竖屏 mdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-xhdpi/launch_screen.png` | `asset` | Lux 启动屏竖屏 xhdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-xxhdpi/launch_screen.png` | `asset` | Lux 启动屏竖屏 xxhdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-xxxhdpi/launch_screen.png` | `asset` | Lux 启动屏竖屏 xxxhdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-land-hdpi/launch_screen.png` | `asset` | Lux 启动屏横屏 hdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-land-mdpi/launch_screen.png` | `asset` | Lux 启动屏横屏 mdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-land-xhdpi/launch_screen.png` | `asset` | Lux 启动屏横屏 xhdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-land-xxhdpi/launch_screen.png` | `asset` | Lux 启动屏横屏 xxhdpi | `2026-04-11` |
| `android/app/src/main/res/drawable-land-xxxhdpi/launch_screen.png` | `asset` | Lux 启动屏横屏 xxxhdpi | `2026-04-11` |

### 通知图标

| 路径 | 类型 | 说明 | 首次加入 |
| --- | --- | --- | --- |
| `src/resources/images/notification_whitebg.xhdpi.png` | `asset` | Lux 通知栏白底图标（xhdpi，上游未含）| `2026-04-11` |

### 文档（docs/）

| 路径 | 类型 | 说明 | 首次加入 |
| --- | --- | --- | --- |
| `docs/page-hierarchy.md` | `doc` | Lux Music 页面层级说明文档（本仓库独立撰写）| `2026-04-11` |
| `docs/project-structure.md` | `doc` | Lux Music 项目结构说明文档（本仓库独立撰写）| `2026-04-11` |
| `docs/design-system.md` | `doc` | Lux Music 竖屏界面设计规范（从现有实现归纳，本仓库独立撰写）| `2026-10-08` |
| `src/component/instruction.md` | `doc` | `src/components` 目录逐文件用途说明文档（本仓库独立撰写）| `2026-04-11` |

### 代码组件

| 路径 | 类型 | 说明 | 首次加入 |
| --- | --- | --- | --- |
| `src/components/AppDialogHost.tsx` | `code` | Lux 全局对话框宿主组件，上游无对应文件 | `2026-04-11` |
| `src/components/modern/SearchBar.tsx` | `code` | Lux 独立设计的现代风格搜索框组件，上游无对应文件 | `2026-04-11` |
| `src/components/modern/SectionHeader.tsx` | `code` | Lux 独立设计的节标题组件，上游无对应文件 | `2026-04-11` |
| `src/components/modern/Surface.tsx` | `code` | Lux 独立设计的卡片容器组件，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Views/Mylist/LibraryTabs.tsx` | `code` | Lux 独立新增的媒体库标签组件，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Views/Mylist/RecentList.tsx` | `code` | Lux 独立新增的最近播放列表组件，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Vertical/BottomNav.tsx` | `code` | Lux 独立新增的底部导航栏组件，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Vertical/PlayQueueSheet.tsx` | `code` | Lux 独立新增的播放队列底部弹层，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Vertical/SearchPage.tsx` | `code` | Lux 独立新增的搜索页面组件，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Vertical/SharedTopBar.tsx` | `code` | Lux 独立新增的顶部共享导航栏，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Vertical/Tabs/HomeTab.tsx` | `code` | Lux 独立新增的主页 Tab 组件，上游无 Tabs 目录 | `2026-04-11` |
| `src/screens/Home/Vertical/Tabs/PlaylistTab.tsx` | `code` | Lux 独立新增的歌单 Tab 组件，上游无 Tabs 目录 | `2026-04-11` |
| `src/screens/Home/Vertical/Tabs/RankingsTab.tsx` | `code` | Lux 独立新增的排行榜 Tab 组件，上游无 Tabs 目录 | `2026-04-11` |
| `src/screens/Home/Vertical/Tabs/SettingsTab.tsx` | `code` | Lux 独立新增的设置 Tab 组件，上游无 Tabs 目录 | `2026-04-11` |
| `src/screens/Launch/index.tsx` | `code` | Lux Music 品牌启动/同步等待页，上游无此页面 | `2026-04-11` |
| `src/screens/LeaderboardDetail/index.tsx` | `code` | Lux 独立新增的排行榜详情页，上游无此页面 | `2026-04-11` |
| `src/components/common/PromptDialog.tsx` | `code` | Lux 独立新增的通用提示对话框组件，上游无对应文件 | `2026-04-11` |
| `src/components/PermissionPromptHost.tsx` | `code` | Lux 独立新增的权限提示宿主组件，上游无对应文件 | `2026-04-11` |
| `src/plugins/player/cache.ts` | `code` | Lux 独立新增的播放器缓存键工具，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Views/Search/Discover.tsx` | `code` | Lux 独立新增的搜索发现页内容组件，上游无对应文件 | `2026-04-11` |
| `src/screens/PlayDetail/Vertical/components/SeekBar.tsx` | `code` | Lux 独立新增的播放详情拖拽进度条组件，上游无对应文件 | `2026-04-11` |
| `src/screens/PlayDetail/Vertical/coverTheme.ts` | `code` | Lux 独立新增的播放详情封面配色工具，上游无对应文件 | `2026-04-11` |
| `src/types/appDialog.ts` | `code` | Lux 独立定义的 AppDialog 类型，上游无此类型文件 | `2026-04-11` |
| `src/types/permissionPrompt.ts` | `code` | Lux 独立定义的权限提示类型，上游无此类型文件 | `2026-04-11` |
| `src/utils/imageCache.ts` | `code` | Lux 独立实现的图片缓存工具，上游无对应文件 | `2026-04-11` |
| `src/utils/imagePresentation.ts` | `code` | Lux 独立实现的封面首帧展示决策，上游无对应文件 | `2026-10-08` |
| `src/components/playlist/playlistDragState.ts` | `code` | Lux 独立实现的歌单拖动结束/复位决策，上游无对应文件 | `2026-10-08` |
| `src/components/playlist/songRowKey.ts` | `code` | Lux 独立实现的歌单行稳定 key，上游无对应文件 | `2026-10-08` |
| `scripts/run-src-unit-tests.mjs` | `code` | Lux 独立新增的封面与歌单拖动单元测试入口，上游无对应文件 | `2026-10-08` |
| `src/utils/imageCachePolicy.ts` | `code` | Lux 独立实现的图片缓存淘汰策略，歌单封面不参与普通配额，上游无对应文件 | `2026-10-08` |
| `src/utils/playlistCoverQueue.ts` | `code` | Lux 独立实现的歌单封面预取队列，上游无对应文件 | `2026-10-08` |
| `src/utils/playlistCoverMap.ts` | `code` | Lux 独立实现的歌曲封面地址映射与缩图规则，上游无对应文件 | `2026-10-08` |
| `src/utils/playlistCoverStore.ts` | `code` | Lux 独立实现的封面地址本地存储，不进入同步列表，上游无对应文件 | `2026-10-08` |
| `src/utils/playlistCoverPrefetch.ts` | `code` | Lux 独立实现的歌单封面后台预取，上游无对应文件 | `2026-10-08` |
| `src/utils/musicUrlCache.ts` | `code` | Lux 独立实现的播放地址有效期判断，上游无对应文件 | `2026-10-09` |
| `src/utils/listenListLimit.ts` | `code` | Lux 独立实现的试听列表长度裁剪选择，上游无对应文件 | `2026-10-09` |
| `src/core/music/reuseMusicUrl.ts` | `code` | Lux 独立实现的播放地址复用，未过期或已缓存则直接使用，上游无对应文件 | `2026-10-09` |
| `src/core/list/enforceListenListLimit.ts` | `code` | Lux 独立实现的试听列表 50 首上限，通过既有删除动作同步，上游无对应文件 | `2026-10-09` |
| `scripts/check-lux-color-literals.mjs` | `code` | Lux 独立新增的竖屏颜色字面量回退检查，上游无对应文件 | `2026-10-08` |
| `src/utils/hooks/useSystemGestureInsetBottom.ts` | `code` | Lux 独立实现的系统手势内边距 Hook，上游无对应文件 | `2026-04-11` |
| `src/utils/musicSdk/tx/utils/crypto.js` | `code` | Lux 独立新增的 TX 搜索签名工具，上游无对应文件 | `2026-04-11` |
| `src/utils/musicSdk/tx/utils/index.js` | `code` | Lux 独立新增的 TX 搜索签名请求封装，上游无对应文件 | `2026-04-11` |
| `android/app/src/main/res/values-v29/styles.xml` | `code` | Lux 独立新增的 Android 29+ 系统栏样式配置，上游无对应文件 | `2026-04-11` |
| `src/screens/Home/Vertical/Tabs/VersionChangelogDetail.tsx` | `code` | Lux 独立新增的当前版本更新日志页，上游无对应文件 | `2026-10-08` |
| `src/utils/installedChangelog.ts` | `code` | Lux 独立新增的安装包内更新日志读取，上游无对应文件 | `2026-10-08` |
| `src/utils/changelogFormat.js` | `code` | Lux 独立新增的更新日志分点解析，上游无对应文件 | `2026-10-08` |
| `src/utils/changelogFormat.d.ts` | `code` | 上述解析器的类型声明 | `2026-10-08` |
| `src/components/ChangelogView.tsx` | `code` | Lux 独立新增的更新日志分点渲染，上游无对应文件 | `2026-10-08` |
| `src/theme/luxTokens.ts` | `code` | Lux 竖屏新页面的语义颜色令牌，上游主题表无此文件 | `2026-10-08` |
| `src/theme/LuxTheme.tsx` | `code` | Lux 竖屏主题上下文，与上游 `useTheme()` 分开 | `2026-10-08` |
| `src/theme/luxColorMath.ts` | `code` | Lux 主题色混合与对比度计算，上游无对应文件 | `2026-10-08` |
| `src/theme/buildLuxColors.ts` | `code` | Lux 由语义角色推导完整槽位，上游无对应文件 | `2026-10-08` |
| `src/theme/luxStyleCache.ts` | `code` | Lux 按颜色对象缓存样式，上游无对应文件 | `2026-10-08` |
| `src/theme/luxThemePreference.ts` | `code` | Lux 本机主题 id 存储，不进入同步，上游无对应文件 | `2026-10-08` |
| `android/app/src/main/java/cn/lux/music/mobile/utils/SystemBars.java` | `code` | Lux 按主题切换系统栏图标深浅，栏本身保持透明 | `2026-10-08` |
| `docs/theme-tokens.md` | `doc` | 默认黄绿令牌与新美化页面色值的对照，供后续替换硬编码 | `2026-10-08` |

## 维护模板

后续可按以下格式追加：

| 路径 | 类型 | 说明 | 首次加入 |
| --- | --- | --- | --- |
| `path/to/file` | `code` / `asset` / `doc` | 简述该内容为何为独立原创 | `YYYY-MM-DD` |
