<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 软件交互规范

本文件是交互规则的维护入口。新增或修改交互时，先核对实际代码，同时更新本文与相应 `scripts/*.src-test.mjs`。视觉令牌、排版与颜色仍遵循 [design-system.md](design-system.md)。本文记录当前实现；尚未统一的地方明确标记为「待统一」，不代表已经具备该能力。

## 导航层级

- 一级：Home 主壳的首页 / 歌单 / 设置。竖屏为 `Home/Vertical/Main.tsx` 的三页 Pager + Dock；横屏 `Home/Horizontal/Main.tsx` 复用三 Tab，使用侧栏与 PlayerBar。
- 二级：设置选项、音效、AI 助手、账号、管理员控制台、同步状态。使用 Home 内的内容层，不创建独立原生窗口，不用原生 Modal 充当页面，也不调用 `Navigation.setRoot` 打开设置子页。
- 更深一级：音效详情、账号编辑/设备/数据空间/密码、管理员的用户/邀请/歌单/服务、同步地址检查/登录/注册/忘记密码。打开后只返回上一层，不能越级关闭整个设置。
- 弹层：地址/授权码/登录凭据输入、创建/删除确认、退出与数据导入选择、文件选择、图片裁切、更新提示。这些是临时任务，允许遮罩覆盖主壳；不把整页内容伪装成弹层来绕过二级页规则。
- 外部入口：GitHub Releases / 更新日志内 GitHub / 自定义源帮助交给 `openUrl`；图库裁切与系统文件授权由平台接管。它们不适用 App 内页面的固定过渡参数。

完整设置页面清单（名字对应状态/路由，便于代码检索）：

| 入口 | 页面 / 下级 | 挂载与实现 |
| --- | --- | --- |
| 语言 | `language` | SettingsTab → SettingsPage |
| 主题 | `theme`（六套本机主题） | 同上 |
| 回忆/统计样式 | `statsPageStyle`（布局和统计风格均为页内选项） | 同上 |
| 默认搜索源 | `searchSource` | 同上 |
| 自定义音源 | `player`；源管理为页内编辑模式 | 同上，Source 以 embedded 挂载；导入为文件选择弹层 |
| 一起听布局 | `togetherLayout` | 同上 |
| 同步地址与格式 | `sync`；地址历史管理为页内模式 | 同上；输入地址、LX 授权码、Lux 凭据为 MagDialog |
| 缓存/下载与数据管理 | `resourceCache` | 同上，ResourceCacheDetail |
| 关于 → 当前版本 | `changelog` | 同上，VersionChangelogDetail；没有独立「关于」整页 |
| AI 助手 | AiTokenStatusPage | SettingsTab → SettingsPage → 普通 View |
| 资料 hero（头像；重复账户列表行已移除） | AccountPage → `edit` / `devices` / `spaces` / `password` | SettingsPage + useSettingsSubpage；ChangePassword 在账号的子页过渡面内 |
| 音效/均衡器 | AudioEffectsPage → 响度与无缝播放详情 | 横竖屏 Main 的应用内层；useSettingsTransition + useSettingsSubpage |
| 管理员控制台（按条件显示） | dashboard → users / invites / playlists / service | AdminConsoleLayer → SettingsPage；内部 useSettingsTransition；loading / denied 是权限状态，不另算导航 |
| 账户昵称右侧同步胶囊（全部状态可见） | 同步服务 editor（成功/未同步/本地/进行中）或 SyncStatusPage（失败/过期/不兼容）→ ServerStep / SyncLogin | SettingsTab 的持久 SettingsPage host；返回逐层恢复 |
| 同步登录内部 | 服务器地址 → Lux AuthFlow / LX LegacySyncLogin；Lux → register / forgot | Settings 下以 onBack 回调嵌入，useSettingsSubpage；AuthFlow 通过 settings 标志启用同一规则。独立启动/首次引导保留自己的顶层流程 |

导出/导入备份直接打开 ChoosePath；检查更新触发现有更新流程；清除冲突策略、调试开关、复制诊断是动作，不产生二级页面。

## 设置一级页 B 版与同步入口

- 仅 Lux Music 服务端模式显示的设置入口包括：AI 助手（含「AI / MCP 令牌与最近操作」副标题）、「一起听同步诊断面板」开关状态行和「复制一起听诊断」动作行。`SettingsTab.tsx` 直接复用 #151 的 `isAiAssistantAvailable()` 与 `showAiAssistantEntry` 结果：配置加载完成、同步格式 `LX.Sync.Mode` 为 `lux` 且同步地址非空；本地（空地址）、LX Music、读取未完成或失败时隐藏。诊断两行另保留原开发构建 / dev 发布渠道限制；数据与同步分组及开发调试分组中的重复入口、设置搜索索引均使用同一条件，复制诊断也可命中开发调试分组。模式/地址事件实时更新，整行及其自带 Hairline 一起卸载；空的开发调试分组一起卸载，数据分组末行、圆角和间距保持原实现，不留空行。不修改已保存的诊断开关或诊断数据。
- 已打开 AI 助手时失去上述资格，通过持久 SettingsPage 的共享退出过渡返回设置主页并清除打开状态。当前两项诊断入口直接切换开关 / 复制文本，不产生诊断设置子页，因此无诊断子页残留或需关闭的路由；既有设置子页仍复用 SettingsPage 的过渡与返回。
- 设置是一级 Tab，移除左上切首页的伪返回；二级及更深页按钮和系统返回处理不变，首页仍从 Dock 进入。顶部为 SETTINGS · LUX MUSIC 刊头，H1 与搜索同排。handleToggleSettingsSearch 展开原 UnderlineInput 到标题行之后，正常下推；查询、清除、结果点击逻辑保持。
- `SettingsTab.tsx` 的 SyncStatusPill 移到昵称右侧（间距 8、垂直居中），签名独占下一行（12/16，距昵称 2），无签名沿用默认文案。昵称与签名共用最小高 44 的账户文字按钮；头像、账户文字、箭头进入完整 AccountPage，退出登录在账户内。账户文字与胶囊为横向独立同级按钮，没有覆盖胶囊的外层 TouchableOpacity 或无障碍按钮；胶囊上下各 8 的空间实际预留，最小命中高 44、视觉最小高 28，账户文字上留 8 对齐昵称与胶囊面。长昵称/签名优先单行省略，胶囊 flexShrink=0、不换行或截断；hero 最小高 68、56 头像居中，极端字体整体可增高。
- 胶囊读作「状态，查看同步详情」，状态变化 polite 播报。搜索过滤掉资料时、无服务器、本地、关闭同步时均保留胶囊，不依赖 showProfileHero 或模型非空。
- mapSyncStatus 保留会话/版本/传输错误优先级；本地无服务器显示本地模式，已配置但关闭或断开显示未同步。Connecting... 与 Wait syncing... 仅是连接/握手阶段，显示连接中；status.status=true 显示已同步，不能推断正在传输。模型仅在显式 syncing 任务信号时展示同步中；当前 socket 没有该任务信号，不伪造。连接中、同步中点胶囊只开详情，不触发重连。
- 成功/未同步/本地/进行中进入原同步服务 editor，保留地址历史、格式及凭据管理；失败/过期/不兼容沿原 SyncStatusPage 分流，保留重试、地址检查、离线、重新登录、本地用户与复制版本提示。两条路径均用 SyncConnectionInfo 展示服务器（可复制）、账号、连接状态及最近成功同步/活跃；没有有效时间戳显示暂无记录，历史时间戳不视为服务器在线证据。
- 删除独立同步区的主线、标题与整行外形；信息及入口按上述位置迁移。状态刷新不自动打开新页或改变按钮分区，既有成功恢复关闭错误页行为保留。共享 SettingsPage 的 248ms 对称进出、逐层返回及 Dock 行为不变。

## 设置页面过渡（唯一共用实现）

入口：`src/components/common/SettingsPage.tsx`。底层复用 `components/common/overlaySlideTransition.ts`，仅设置使用 `symmetric: true`，其他模块原有参数不受影响。

| 参数 | 打开 | 返回 |
| --- | --- | --- |
| progress | 0 → 1 | 1 → 0 |
| translateX | 当前窗口宽度 → 0，从右侧进入 | 0 → 当前窗口宽度，向右侧退出 |
| opacity | 0.92 → 1 | 1 → 0.92 |
| duration | 248ms | 248ms |
| easing | `Easing.bezier(0.22, 0.84, 0.22, 1)` | 同一个 easing 实例 |
| driver | native | native |

这是多数设置页面原有的打开模式；此次把返回也改成同参数的反向插值。不要复制 `Animated.timing` 到各页面，或再加独立的 fade / native slide。

使用方式：

- 独立二级页：持久渲染 `<SettingsPage visible={...} onBack={...} bottomInset={...}>`，其 children 为接收 `back` 的函数。页内返回必须调用这个 `back`；组件保留退出内容，在动画完成后调用 onBack 并卸载。父层主动设置 visible=false 时也保留最后一帧内容到退出结束。
- 已有独立挂载的页面（音效）：`useSettingsTransition()` 提供 `style` 与 `requestClose`；用 `requestClose(onBack)`，完成后才通知 host 卸载。
- 内部状态子页：`useSettingsSubpage(root)` 提供 page / setPage / style。前进时右侧进入，退回 root 时先完整退出当前内容，再恢复父页。重复设置当前页不触发动画。管理员的栈回退通过同一 `useSettingsTransition(false)` 实现。
- 已有自己的返回拦截的内容传 `hardwareBack={false}`，由内容把按钮和硬件返回汇入同一个回调。无自定义逻辑时使用 SettingsPage 默认硬件返回处理。
- 重复返回合并；再次打开会使旧的退出回调失效；卸载时停止动画并使未完成的回调失效。

## 返回与手势

Android 系统返回键、系统边缘返回手势最终通过 `hardwareBackPress` 调用与页面按钮相同的返回函数。未实现随手指进度交互的页面边缘拖回，不能把 Android 系统返回等同于 App 的拖页手势。

最上层弹窗先处理 `onRequestClose`；普通页面按「最深子页 → 父页 → 设置主页」返回。账号保存、修改密码提交以及登录/本地空间切换中的阻塞状态沿用原有保护：按钮和硬件返回均不能中断正在提交的任务。Settings 的稳定 listener 不因父组件重渲染夺取更深层页面的返回优先级；当独立原生屏幕位于 Home 上方时，`isHomeScreenActive` 返回 false，设置共享 handler 不消费返回。

点击 Dock 切换一级 Tab 属于切换导航，不是 back：设置详情状态清空，再进入设置回到主页并滚动至顶部；EQ 的 Main host 同样清空。退出账号、完成登录/切换数据空间等导致应用重置的操作保留原有流程。

## Dock 与播放器

竖屏所有设置二级/更深页保持播放条和三图标 Dock 可见、可点。`DOCK_BASE_HEIGHT = 122`（64 + 58），加系统底部手势 inset。SettingsPage 的 bottomInset 和 EQ 根层 bottom 将内容及命中区域裁切在 Dock 上沿；裁切后的子页不再重复追加一份 Dock 高度。设置主页仍保留相同高度的滚动底部让位。

横屏 Main 已在 Header 和 PlayerBar 之间布局，SettingsTab / EQ 的 bottomInset 传 0；侧栏和 PlayerBar 留在主壳，不套用竖屏 122 的 Dock 空洞。

现有全局例外：键盘出现且 `common.autoHidePlayBar` 开启、没有 `keepPlayBarOnKeyboard` 覆盖时，竖屏主壳会隐藏 Dock（`Home/Vertical/index.tsx`）。**待统一**：是否让设置表单强制保留键盘上方 Dock 尚未落地；当前文档不声称键盘期间始终显示。临时原生 Modal / 系统选图等也会在视觉上遮住底栏，它们属于弹层/平台任务。

## 点击与按压

- 小型返回控件可见直径约 28，四侧 hitSlop=8，形成约 44 的触达区域；`BackButton` 非 compact 为 40，hitSlop=4。实际数字仍经过仓库的缩放规则，不应把视觉图标放大来凑触达面积。
- `IconButton` 默认 44 触达容器，内部图标默认 24；设置列表 `SettingRow` 的基本行高 62、`OptionRow` 58。新增图标按钮必须有 accessibilityLabel，状态按钮提供 disabled / selected。
- SettingRow、OptionRow、BackButton、IconButton 的 activeOpacity=0.7；Dock 播放键=0.85。按压反馈不改页面布局。
- 资料 hero 的三个账户按钮及同步胶囊均为 activeOpacity=0.7。**待统一**：部分历史 TextButton、EQ 预设仅垂直 hitSlop、其他遗留工具按钮尚未逐个验证最小触达区域（AudioEffects、Home/Views）。不在本次导航修改中重写控件。

## 拖动与滑块

- `components/magazine/MagSlider.tsx`：按下在轨道定位，拖动时 thumb 连续跟手；预览使用 dragRatio，松手吸附最近档位并调用 onCommit；终止清掉拖动态。轨道捕获 responder，拒绝中途转移；点刻度直接提交。
- `Tabs/CacheLimitSlider.tsx` 复用 MagSlider。**待统一**：外层容量 StatusChip 仍读持久 value，未跟随 dragRatio 预览；定位在 CacheLimitSlider 的 chipLabel。
- `AudioEffects/index.tsx` 的 EqBand：10 段、−12～+12dB、1dB 步进，纵向原生 transform 更新 thumb，pageY 固定基点保证跟手；拖动时禁止父 ScrollView，松手才调用 bridge 并成功后持久化，失败回滚；中止不写入。预览指当前 thumb / 数字，**待统一**：音频引擎的拖动实时预听尚未实现（commitAudioEffect 在 release 后）；独立分支的 reset/live 变更不包含在此规范的当前事实内。
- Dock 进度、歌单拖排等各有手势与提交协议，不能机械套用设置滑块的档位规则；歌单拖排在 `playlistDragState.ts` 保持原来 1.02 缩放与不改 zIndex 的约定。

## 抽屉、面板与对话框

`MagazineSheet.tsx` 已有公共协议：底部 panelH → 0 打开、反向关闭，220ms，`Easing.out(Easing.cubic)`，mask 同步渐变；关闭保留内容到动画结束；点遮罩、关闭按钮和原生 Modal 的系统返回都调用 requestClose。它没有实现下拉跟手关闭。inlineBottomInset 模式使用应用内 View，不自动注册 Modal 返回，调用方负责。

`MagDialog.tsx` 使用原生 Modal 的 fade，按钮/遮罩关闭与 onRequestClose 汇入 onClose，动画时长/曲线由平台控制，没有应用内统一参数。输入键盘相关让位保留组件现状。

**待统一**：`common/Modal.tsx`、ChoosePath 和自定义源导入弹层等历史组件仍有各自的 fade、返回与文件授权处理；未迁移为 MagazineSheet。原生选择器/图片裁切由系统决定过渡。它们不应作为新整页的实现范本。

## 歌单导入歌曲

- `PlaylistImportPanel.tsx` 与 `PlaylistImportFlow.tsx` 共用一个导入弹层和 `TextTabs`，标签顺序固定为「Lux 歌单 → 粘贴文本 → CSV 文件 → 平台链接」；从歌单打开时默认 Lux 歌单，每次关闭再打开重置。独立的文本/CSV 新建歌单入口没有目标歌单，仍默认粘贴文本，保留原三标签。
- 删除平台链接中的「从其他歌单选歌」按钮及其额外选歌抽屉，避免双入口。原搜索、逐首勾选、全选、计数和确认迁到 Lux 标签内；文本/CSV 的匹配、复核、导入及平台取歌流程保持原样。
- Lux 范围为 `useMyList()` 的本机可见歌单，排除当前目标与试听列表（沿用旧范围），包括本机可见的收藏；不浏览任意远端或其他账号歌单。先显示歌单及可导入数量，点歌单打开歌曲，点「选择其他歌单」回列表；切换来源歌单或标签保留本次勾选。
- 歌单没有独立创建时间字段；`core/list.ts` 的 `createList` 默认 ID 为 `userlist_${Date.now()}`，因此仅解析严格匹配 `userlist_` + 13 位数字的 ID 作为创建时间替代依据。默认最新在前，可切换最早在前；收藏、自定义/导入 ID 等时间未知者始终排在末尾并保持本机原顺序。同时间也保持原顺序。不用重排时间 `locationUpdateTime` 或歌单名字猜创建时间。界面有排序依据说明。
- 搜索为去除首尾空白、忽略大小写的子串匹配，支持歌单名、歌名、歌手；歌单名命中显示该歌单所有可导入歌曲，歌曲/歌手命中显示匹配歌曲及其歌单。搜索仅覆盖去重后可导入歌曲，不搜索目标已有歌曲；无歌曲或全被去重的歌单仍可按歌单名找到。
- 复用 `UnderlineInput`、`MagazineSheetRow`、`Checkbox`、`SecondaryButton`、`PrimaryButton`。逐首多选；「全选当前结果」只切换当前打开歌单在当前搜索条件下的歌曲，空搜索即全选该歌单。跨歌单同一 `source_id` 共用选中状态，清除当前全选保留其他歌曲的选择；底部计数是所有歌单的选中总数。
- 候选加载沿用原 `source_id` 去重及目标歌曲排除逻辑，并保留每首歌的全部来源歌单 ID。确认时再次排除目标现有歌曲，调用 `addListMusics`、遵循 `list.addMusicLocationType`，成功提示实际提交数量并关闭、刷新目标；失败提示且保留选择。提交期间禁用勾选、搜索、切标签及关闭，阻止重复提交。
- 复用导入页已有原生 Modal 过渡、顶栏返回和系统返回汇流；Lux 标签内返回关闭整个导入弹层，切换歌单通过页内按钮，不增加导航层。输入与列表位于 `KeyboardAvoidingView`（Android height / iOS padding）内，键盘出现时收缩可用高度；列表允许键盘期间点击、拖动收键盘，切标签收键盘。页边距 22；排序按钮可见高 28、上下 hitSlop 各 8，勾选行内预留 44 区域。
- `scripts/import-local.src-test.mjs` 覆盖排序、未知时间、跨歌单归属/去重、三类搜索及标签/组件接线；Android 键盘、窄屏横向标签滚动、系统返回与大量歌曲需真机确认。

## 评论加载

- `screens/Comment/useCommentLoad.ts` 为热门/最新注入各自请求函数；请求身份包含来源与歌曲 id。换歌或卸载使旧代次失效，并清理全部延时；过期成功、失败及延时均不能更新列表、总数或状态。
- 首次加载保留收到结果后 300ms 写列表、再 300ms 更新状态的展示节奏；期间阻止更多加载。下拉刷新取消旧加载/延时，同一刷新期间的重复下拉合并；分页保持追加与去重，刷新替换第一页。
- 静默刷新保留当前列表与状态，忙碌期间跳过；热门/最新各自保存分页状态，切换沿用现有惰性挂载。失败显示原有重试状态。
- 评论图片继续自动显示，不提供“点击显示图片”开关。页面过渡与返回保持既有实现。
- `scripts/comment-load.src-test.mjs` 使用可控 Promise/时钟验证代次隔离、刷新合并、分页、静默刷新及退出清理。

## 维护与验证

`settings-navigation.src-test.mjs` 审核设置入口清单，检查全部选项 renderer 位于 SettingsPage，屏幕挂载与下级页引用公共 helper，横竖屏均衡器 host 均存在；新增入口或绕过 helper 应让测试失败，更新审计后才能修改清单。该文件还用真实 helper 和可控动画时钟验证按钮/硬件返回的参数、延迟卸载、重复返回、重新打开取消旧回调及子页恢复。

每次改导航后运行 `node scripts/run-src-unit-tests.mjs`、改动文件 eslint、TypeScript 基线差异检查。静态与模拟时钟不替代真机：仍需 Android 按钮/手势返回、快速连点、键盘、旋转、长内容及 Dock 点击的设备验证。

## 首页推荐区与封面加载

- `RecommendationSection.tsx` 横向 ScrollView 以左右负 `PAGE_GUTTER` 外边距铺到页面两侧，使用默认 hidden 裁剪；内容左右补回同一缩放后的 `PAGE_GUTTER`。页边距内可见的相邻卡片仍保留，所有可见像素落在原生滚动视口内，不依赖 bounds 外绘制。卡宽仍按内侧实测宽 W 的 300/349、间隔 14/349 计算；首卡左停靠与末卡右停靠均在原页边距内侧，最大偏移仍为 2C+G−W。snap 间隔仍为 C+G，末端由原生钳制；结束后仍按 round(x/(C+G)) 钳制到 0/1 更新圆点及「播放推荐」，padding 不增加偏移基数。卡高、圆角、背景、蒙层、按压与端点反馈保持原实现。
- `HomeTab.tsx` 的「全部」区域在筛选切换时保持挂载、仅隐藏：透明且绝对定位移出文档流，关闭触摸，以 `accessibilityElementsHidden` / `no-hide-descendants` 隐藏无障碍子树。保持原布局宽度及原生图片、横向 ScrollView 实例，避免 `display:none` 的零尺寸重布局。其他榜单筛选继续按需挂载，不额外常驻。
- 返回「全部」沿用 `ContentReveal` 的 260ms、`Easing.out(Easing.cubic)`、opacity 0→1 / translateY 8→0；离开时停止动画。切筛选纵向滚动回顶；推荐卡横向位置、页码与对应播放按钮保持原卡片。隐藏或离开首页 Tab 时，暂停推荐自动刷新、跨日检查及封面日期定时器；恢复时校验日期并后台刷新。在途请求允许收尾，数据空间切换仍立即使旧请求失效。
- 今日推荐重挂载先同步读取内存快照，按当前数据空间、本地日期、可用音源身份校验并过滤不喜欢的歌曲，再后台刷新，不先清空有效结果。每周推荐沿用歌单元数据的同步快照，后台结果更新同一快照；快照按数据空间隔离。
- `FrostedCover` 显式 `fadeDuration=0`，保留 H1B v5B 的原生 `blurRadius=14`、cover / resize、0.66 纸色蒙层和墨色前景，不改裁切、按压反馈或默认主题色。当前依赖没有独立导出该原生模糊结果的接口；view-shot 是视图截图而非等价的后处理导出，因此采用允许的后备方案：原图缓存到现有 `image-cache`，同步复用 `peekCachedImageUri` 的内存路径/磁盘索引，保留已处理的原生图片实例。不声称产生了持久化预模糊小图；全卸载或内存回收仍可能重新处理模糊。
- 封面按现有 URL 的 MD5 key 缓存，模糊参数属于保留的原生实例，不新增另一套文件 key。今日封面不额外 pin，服从现有普通图片数量/字节上限、LRU 清理及手动清除；每周封面若已被歌单预热 pin，则沿用歌单封面豁免。加载失败清理失效路径，下次加载可重新下载。无新增依赖、磁盘目录或缓存容量豁免。
- 开屏预热等待首页挂载后两张实际背景图的 `onLoad`（包括同尺寸原生模糊），而不把原图 `Image.prefetch` 当作模糊就绪。无封面时允许占位；失败/慢请求由既有开屏 deadline 放行。仍使用 `homeBootRevealAt`：原 3500ms 停留、预载 2500ms 预算和最多额外 1500ms，取原有上限；不延长等待。开屏结束清理一次性就绪记录。
- `scripts/recommend-blur-cache.src-test.mjs`、`recommend-home.src-test.mjs`、`recommend.src-test.mjs` 和 `run-src-unit-tests.mjs` 验证缓存命中、快照隔离、隐藏恢复与原等待上限。闪烁/白边、冷启动时长、实际缓存体积及显存占用仍需 Android release 真机确认。

## 异步数量与列表的出现动画

- `components/playlist/LocalSongsDetail.tsx` 首次成功读取前，大数字和全部 / 设备 / 已缓存 Tab 首数用「—」占位，容量行保留现有加载文案；首次读取失败显示三语失败提示，占位不变，不冒充成功空库。只有成功确认为空才显示 0。保留即时进入页面，不等待数据、不延长 `useOverlaySlideTransition` 的 248ms。
- 数字复用 `components/common/useRollingNumber.ts`：首次数据就绪后由 0 滚至目标，760ms、三次缓出，按进度插值取整，工作量与最终首数无关。大数字与全部 Tab 共用同一显示值，设备 / 缓存各自插值。刷新保留成功数字与容量；新结果从当前显示值滚至新值，相同值不重播。后台补资料、封面和切 Tab 不重播计数。
- 容量本次直接显示成功结果，不滚动字节或切换中的单位，避免格式抖动；刷新保留原容量。尚未增加跨页面挂载的快照，重新打开从未知态开始。
- 列表复用 `components/common/useStaggeredAppear.ts`：以 FlatList 首次报告的可见行（最多 12 条）为一批，每条间隔 40ms、单条 320ms，opacity 0→1、translateY 8→0，分段缓出；一个 `useNativeDriver: true` 时钟驱动全部行。初批之外直接显示，滚动、封面补齐、切 Tab、刷新、初次空库后导入均不整列重播。虚拟列表重新挂载行沿用已完成时钟。
- 数字文本用 JS Animated 时钟（原生驱动不能更新文字内容），每帧只更新页头。`components/common/useReducedMotion.ts` 读取并监听系统「减少动画」：偏好尚未知时保守地直接显示结果；开启或动画中开启时立即到最终值，列表直接显示。卸载停止动画、移除监听，失效读取代次不回写。
- 以后同类异步计数与列表页面复用以上 common hooks 和 `asyncAppearMath.ts` 的插值 / 时序，不各自复制动画。当前只接入本地歌曲页；纯函数与模拟时钟验证见 `scripts/async-appear.src-test.mjs`，Android 性能与视觉仍需真机确认。
