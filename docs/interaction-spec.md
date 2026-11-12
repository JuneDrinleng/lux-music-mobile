<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 软件交互规范

本文件是交互规则的维护入口。新增或修改交互时，先核对实际代码，同时更新本文与相应 `scripts/*.src-test.mjs`。视觉令牌、排版与颜色仍遵循 [design-system.md](design-system.md)。本文记录当前实现；尚未统一的地方明确标记为「待统一」，不代表已经具备该能力。

## 导航层级

- 一级：Home 主壳的首页 / 歌单 / 设置。竖屏为 `Home/Vertical/Main.tsx` 的三页 Pager + Dock；横屏 `Home/Horizontal/Main.tsx` 复用三 Tab，使用侧栏与 PlayerBar。
- 二级：设置选项、音效、AI 助手、账号、管理员控制台、同步状态。使用 Home 内的内容层，不创建独立原生窗口，不用原生 Modal 充当页面，也不调用 `Navigation.setRoot` 打开设置子页。
- 更深一级：音效详情、账号设备/数据空间/密码、管理员的用户/邀请/歌单/服务。同步地址检查/登录/注册/忘记密码移至根 LoginGate 内部。打开后只返回上一层，不能越级关闭整个设置。
- 弹层：账号单字段资料编辑、创建/删除确认、退出与数据导入选择、文件选择、图片裁切、更新提示。这些是临时任务，允许遮罩覆盖主壳；不把整页内容伪装成弹层来绕过二级页规则。
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
| 同步地址与格式（含搜索命中） | LoginGate 主态 | `requestLogin` 根替换；方式、地址与凭据均为草稿 |
| 缓存/下载与数据管理 | `resourceCache` | 同上，ResourceCacheDetail |
| 关于 → 性能诊断 / 日志 · 导出应用日志 | 原地切换 / 系统分享面板，不产生二级页 | SettingsTab → perfDiagnostics/lifecycle |
| 关于 → 当前版本 | `changelog` | 同上，VersionChangelogDetail；没有独立「关于」整页 |
| AI 助手 | AiTokenStatusPage | SettingsTab → SettingsPage → 普通 View |
| 设置资料 hero（头像；重复账户列表行已移除） | AccountPage → `devices` / `spaces` / `password`；四资料行分别开单字段面板 | 整页为 SettingsPage + useSettingsSubpage；字段编辑为 MagazineSheet；ChangePassword 在账号的子页过渡面内 |
| 音效/均衡器 | AudioEffectsPage → 响度与无缝播放详情 | 横竖屏 Main 的应用内层；useSettingsTransition + useSettingsSubpage |
| 管理员控制台（按条件显示） | dashboard → users / invites / playlists / service | AdminConsoleLayer → SettingsPage；内部 useSettingsTransition；loading / denied 是权限状态，不另算导航 |
| 账户昵称右侧同步胶囊（全部状态可见） | 同步连接详情（成功/未同步/本地/进行中）或 SyncStatusPage（失败/过期/不兼容） | 状态与诊断保留持久 SettingsPage；修复地址/登录/换方式进入根 Gate |
| 统一登录 L1 | 最近账号 → Lux / LX / 本地确认；历史、记录管理、注册、帮助 | `SyncLogin/LoginGate.tsx`，内部全部 `useSettingsSubpage`，无 Dock；旧表单壳留 PR5 清理 |

导出/导入备份直接打开 ChoosePath；检查更新触发现有更新流程；清除冲突策略、调试开关、复制诊断是动作，不产生二级页面。

## 设置一级页 B 版与同步入口

- 账号主页 `AccountPage.tsx` 的「切换」组在本地、LX、Lux 服务端模式下均只显示「这台手机上的账号」「切换账号」两行；移除重复的「管理本机数据」行。两行紧邻，只有行间细线，首行上方不补分隔线或占位，末行不画底线。相同的数据管理页仍可从设置 →「数据管理与同步」→「缓存管理」（`SettingsTab.tsx` → `resourceCache` / `ResourceCacheDetail`）进入；账号 →「这台手机上的账号」子页（`AccountSpaces.tsx`）中的「管理本机数据」按钮及其回调也保留。功能、路由、三语翻译和共享过渡/返回规则保持原实现；守护见 `scripts/account-page.src-test.mjs`。
- 仅 Lux Music 服务端模式显示的设置入口包括：AI 助手（含「AI / MCP 令牌与最近操作」副标题）、「一起听同步诊断面板」开关状态行和「复制一起听诊断」动作行。`SettingsTab.tsx` 直接复用 #151 的 `isAiAssistantAvailable()` 与 `showAiAssistantEntry` 结果：配置加载完成、同步格式 `LX.Sync.Mode` 为 `lux` 且同步地址非空；本地（空地址）、LX Music、读取未完成或失败时隐藏。诊断两行另保留原开发构建 / dev 发布渠道限制；数据与同步分组及开发调试分组中的重复入口、设置搜索索引均使用同一条件，复制诊断也可命中开发调试分组。模式/地址事件实时更新，整行及其自带 Hairline 一起卸载；空的开发调试分组一起卸载，数据分组末行、圆角和间距保持原实现，不留空行。不修改已保存的诊断开关或诊断数据。
- 已打开 AI 助手时失去上述资格，通过持久 SettingsPage 的共享退出过渡返回设置主页并清除打开状态。当前两项诊断入口直接切换开关 / 复制文本，不产生诊断设置子页，因此无诊断子页残留或需关闭的路由；既有设置子页仍复用 SettingsPage 的过渡与返回。
- 设置是一级 Tab，移除左上切首页的伪返回；二级及更深页按钮和系统返回处理不变，首页仍从 Dock 进入。顶部为 SETTINGS · LUX MUSIC 刊头，H1 与搜索同排。handleToggleSettingsSearch 展开原 UnderlineInput 到标题行之后，正常下推；查询、清除、结果点击逻辑保持。
- `SettingsTab.tsx` 的 SyncStatusPill 移到昵称右侧（间距 8、垂直居中），签名独占下一行（12/16，距昵称 2），无签名沿用默认文案。昵称与签名共用最小高 44 的账户文字按钮；头像、账户文字、箭头进入完整 AccountPage，退出登录在账户内。账户文字与胶囊为横向独立同级按钮，没有覆盖胶囊的外层 TouchableOpacity 或无障碍按钮；胶囊上下各 8 的空间实际预留，最小命中高 44、视觉最小高 28，账户文字上留 8 对齐昵称与胶囊面。长昵称/签名优先单行省略，胶囊 flexShrink=0、不换行或截断；hero 最小高 68、56 头像居中，极端字体整体可增高。
- 胶囊读作「状态，查看同步详情」，状态变化 polite 播报。搜索过滤掉资料时、无服务器、本地、关闭同步时均保留胶囊，不依赖 showProfileHero 或模型非空。
- mapSyncStatus 保留会话/版本/传输错误优先级；本地无服务器显示本地模式，已配置但关闭或断开显示未同步。Connecting... 与 Wait syncing... 仅是连接/握手阶段，显示连接中；status.status=true 显示已同步，不能推断正在传输。模型仅在显式 syncing 任务信号时展示同步中；当前 socket 没有该任务信号，不伪造。连接中、同步中点胶囊只开详情，不触发重连。
- 成功/未同步/本地/进行中进入同步服务详情，保留地址历史管理、格式与暂停同步动作；身份、地址与凭据输入改走 Gate。失败/过期/不兼容沿原 SyncStatusPage 分流，保留重试、地址检查、离线、重新登录、本地用户与复制版本提示。两条路径均用 SyncConnectionInfo 展示服务器（可复制）、账号、连接状态及最近成功同步/活跃；没有有效时间戳显示暂无记录，历史时间戳不视为服务器在线证据。
- 删除独立同步区的主线、标题与整行外形；信息及入口按上述位置迁移。状态刷新不自动打开新页或改变按钮分区，既有成功恢复关闭错误页行为保留。共享 SettingsPage 的 248ms 对称进出、逐层返回及 Dock 行为不变。

## 性能诊断（第 1 批测量）

- 入口：竖屏「设置」→「关于」→「性能诊断」，位于检查更新之后；复用 SettingRow，点整行切换右侧「开 / 关」，说明在行下方完整展示。所有账户模式与发布渠道可见，设置搜索可命中名称、说明及日志导出。未新增子页，不改变共享转场与返回。
- `LX.AppSetting['debug.perfDiagnostics']` 默认关闭，沿用本机设置持久化；旧设置缺失或不是布尔 true 时迁移为关闭。开启后卡顿、存储/播放历史和五个组件提交次数立即开始测量；关闭立即取消 100ms 采样定时器并移除 AppState 监听，丢弃未汇总计数。开启、关闭各写一行含版本和设备型号的 `[perf]` 应用日志。
- 启动测量需彻底划掉后台后重新打开。设置加载前只暂存时间戳，加载后开启则汇总、关闭则丢弃；不调整初始化顺序或 await。记录每个 init await 耗时、bootLog 时间点、启动至开屏消失总耗时，以及实际 reveal 与 homeBootDeadline 的差值。优先使用 JS performance.now；不支持时使用 Date.now，并标明时钟与模块加载时间。
- 前台以 100ms 采样 JS 间隔，漂移严格大于 50ms 计为一次卡顿；每 60 秒一行 `[perf] minute` 汇总样本数、卡顿数、最大漂移、存储调用次数/总及最大耗时/总及最大字符串长度、当前历史条数、HomeTab / PlaylistTab / SettingsTab / Dock / PlayDetail 提交次数，然后清零。后台暂停定时器；回前台重新建立时间基准，保留未汇总计数，后台间隔不计为卡顿。存储长度复用原有 JSON 字符串，不额外序列化，也不记录内容或存储键。
- 导出：竖屏「设置」→「关于」→「日志 · 导出应用日志」，先汇总当前未满一分钟的数据、等应用日志待写操作完成，再将现有缓存目录 `error.log` 的全文交给系统分享面板，用户选择保存或分享目标；失败显示三语提示，可重试。该动作在开关关闭时也可用，关闭时仅导出现有日志，不产生诊断行或定时器。此前竖屏没有可用的应用日志导出按钮，本次新增此入口并复用 `src/utils/log.ts` 的 getLogs；不移动已有入口。
- 真机基线操作：打开性能诊断 → 冷启动 3 次（每次彻底划掉后台）→ 播放一首歌 2 分钟以上并在播放页停留一会 → 从上述入口导出 → 发给开发 Bot。完成后可关闭；本批不优化播放历史、启动顺序、渲染或歌词动画。

## 账号二级页 B：点行即改

June 于 **2026-11-06（北京时间）** 选定 `/workspace/dev-bot/account-redesign/plan.md` §6 的 B，视觉参考 `B.png`、`B-edit.png`。实现入口为 `src/screens/Account/AccountPage.tsx`，单项面板为 `AccountProfileSheet.tsx`，资料读写在 `src/plugins/sync/client/profile.ts`；本节替代旧三级「编辑资料」页及固定标题勾保存规则。

- 二级账号页的标题为「SETTINGS · 账号」眉题、H2「账号」、只读身份行。「资料」依次有头像、昵称、个性签名、性别四行，各自显示当前值和明确字段编辑语义；昵称保留一起听用途说明，签名为空按既有默认文案显示，性别使用实际保存值。删除大头像／大昵称 hero、笼统「编辑」按钮和独立三级资料编辑页面壳；原字段、校验、裁切和保存功能全部迁到单项面板，不再有整页 `edit` 导航入口。
- 点行只打开该字段的 `MagazineSheet`，同一时刻只允许一个编辑面板。打开时读取当前身份／资料空间和最新已保存资料作为内存草稿与 dirty 快照；不因头像选图、性别选择、失焦或关闭立即保存。头像保留系统图库 400×400、圆形辅助裁切、base64 仅在内存预览；取消图库不报错，图片必须再明确保存才应用。
- 昵称提交 trim，保留一起听房间／分享水印说明，不新增必填或长度约束；空昵称沿用默认展示名。签名输入上限 140，并显示计数；提交 trim 后截取 140，等于默认签名文案时存空值，空签名展示时沿用默认。性别为男／女／未设置（`male` / `female` / `unknown`）。登录用户名保持只读，与昵称区别，不能在字段面板修改。
- 面板保留当前保存范围、就近错误说明、取消与底部墨色「保存」按钮。无修改或提交中禁用保存，提交中加载；保存成功关闭面板，仍在原二级账号页，刷新字段行和设置主页个人卡。失败停留面板并保留草稿，可重试；远端失败不宣称已修改或已同步，不能降级为仅写本机。
- 取消、右上关闭、遮罩及 Android 系统返回汇入同一关闭回调：IME 可见先收键盘；键盘已收起时，无修改直接关闭，脏草稿先确认「放弃修改」，取消确认继续编辑。提交和图库裁切期间锁住关闭／重复提交；保存完成前不能通过返回丢失在途任务。共享 `MagazineSheet` 保留原 220ms `out(cubic)` 底部进出和退出后卸载，未增加下拉跟手关闭。临时任务覆盖 Dock；输入、范围／错误、取消和保存位于可用面板视口内，小视口仍可滚动露出保存，不以固定键盘高度重复缩小 Android 视口。
- 本地：只读本地用户／无需登录，四字段写本机 local 资料空间。LX：可见 LX Music 与本机范围，仍共用 local，资料不上传 LX。Lux：只读用户名／服务器／管理员或成员，面板说明服务端保存，仍走四字段 `PATCH /api/me/profile`；离线查看保留 Lux 身份与空间，允许查看和起草，但保存失败保留草稿，不伪装成本地模式。
- 单项提交与后台资料拉取／应用按**同身份、同空间**共享串行队列。操作保留身份代次和空间快照，入队后及每次异步返回后验证仍匹配；仅替换当前编辑字段，再沿用服务端优先保存。Lux 提交前重新取得最新远端资料合并其余三项，重试也重新读取，避免超时或远端成功而本机部分落盘后把旧字段重发；队列中较早取得的后台响应不能在保存后覆盖它。没有对应会话／URL／token 或身份已改变时拒绝保存，旧任务不得落入新空间。
- 保障边界：PATCH 失败不写本机；远端成功后的本机字段／头像落盘仍非原子，本机存储失败可能远端已更新，错误不能承诺所有字段均未修改。现有服务端没有版本冲突协议，即使先读取最新资料，也不能完全排除另一设备在读取与 PATCH 之间修改造成的覆盖；需要真机确认网络失败／重试和跨设备编辑边界。
- 「切换」组保留「这台手机上的账号」「切换账号」原两个入口、账号列表与最近登录列表的区别、原 `resourceCache` 数据管理回调和 Gate 事务。为匹配已选 B 图，仅账号主页「切换」组改为 62 最小行高、16/22 主文、1px 主线与 `quiet` 箭头；这与旧 56／15／2px／`ink` 几何不同，以 `plan.md` B 节和 B 图优先，PR／结果须单列改样式及原因。Lux 安全组、设备数量未知提示、移除设备／退出其他设备确认、修改密码全部校验／token 轮换、退出时保留／删除本机数据确认保持原样式与去向。设置主页 hero、独立同步胶囊和管理员控制台入口不变。

单项合并、Lux 并发／失败及账号页四行／无编辑 hero 的源码守护与单元测试随实现更新。Android IME、图库取消／裁切返回、脏确认、提交锁、大字长文、暗色主题、保存刷新及安全／切换仍须真机验收。

## 所有非一级页统一过渡（唯一共用实现）

入口：`src/components/common/SettingsPage.tsx`。底层唯一时钟为 `components/common/overlaySlideTransition.ts`，除下述底部弹出页例外外，所有非一级页（二级、三级、四级及更深）共用同一参数与实现，不限于设置。页面、层级、原动画、处理及逐页真机清单见 [subpage-animation-audit.md](subpage-animation-audit.md)。原生 stack 通过 `navigation/SubpageScreen.tsx` 包装，默认关闭平台 push/pop，公共 pop 等待 JS 退出；普通原生全屏任务 Modal 关闭平台动画，内部使用同一共享过渡；历史 Modal slide 页面走下述底部弹出例外。

| 参数 | 打开 | 返回 |
| --- | --- | --- |
| progress | 0 → 1 | 1 → 0 |
| translateX | 当前窗口宽度 → 0，从右侧进入 | 0 → 当前窗口宽度，向右侧退出 |
| opacity | 0.92 → 1 | 1 → 0.92 |
| duration | 248ms | 248ms |
| easing | `Easing.bezier(0.22, 0.84, 0.22, 1)` | 同一个 easing 实例 |
| driver | native | native |

这是二级设置页的打开/返回模式；除底部弹出页外，所有其他非一级页使用同参数的反向插值。不要复制 `Animated.timing` 到各页面，或再加独立的 fade / native slide。

**例外：底部弹出页**（播放详情、分享卡片预览、智能歌单编辑、导入流程，以及原有播放队列、歌词选句等临时抽屉）不属于二级页同款横向转场，保持从下往上进入、往下退出。June 于 2026-11-01 确认后三个任务页恢复 #158 前的底部弹出。`common/bottomPopupTransition.ts` 从 #162 播放详情实现抽取同一生命周期，按 player / modal 原参数运行；不添加第二套例外判断或横向时钟。其他抽屉未被 #158–#161 改成横向，不改写。

| 路径 | 进入 | 退出 | 背景与返回 |
| --- | --- | --- | --- |
| 播放详情竖屏持久 overlay（`Home/Vertical/PlayDetailOverlay.tsx`） | translateY 当前窗口高度→0，420ms，`Easing.out(Easing.back(1.05))` | translateY 0→窗口高度，300ms，`Easing.out(Easing.cubic)` | native driver；独立 `colors.scrim.mask` 遮罩 opacity 随 progress 0↔1；退出完成才隐藏、恢复 bgPic 与清 componentId；快速重复关闭合并，退出中重开从当前位置反向，旧回调失效，保留懒挂载 |
| 播放详情原生 stack（横屏/启动直接打开） | 原生 content.translationY 高度→0，420ms spring；alpha 0.92→1 | 原生 content.translationY 0→高度，300ms 平台默认插值；alpha 1→0.92 | 黑色 componentBackgroundColor 防白闪；显式 enabled 覆盖全局禁用动画，skipAnimation=true 时 push/pop 均禁用；不包 SubpageScreen，无第二段 JS 动画；按钮/Android 三键/系统边缘返回共用 pop，注册表只合并原生 pop，不等待 JS 时钟；平台独立横向 popGesture 保持关闭 |
| 分享卡片预览（`ShareCardPage.tsx`，月报及播放器歌词选句→生成卡片入口） | translateY 当前窗口高度→0；设备 `config_shortAnimTime`；Android 默认 AccelerateDecelerate（cosine） | 0→当前窗口高度；同一时长与 easing | 原为不透明 `Modal animationType="slide"`、`statusBarTranslucent`，无自定义时长/easing/独立遮罩；现保留全屏 Modal 和所有入口，用同一底部 hook 复现原参数，退出完成才调用父层 onClose；背景压暗恢复 RN 非透明 Modal 的 0.5，颜色取主题 `shadow.black`；内容无透明度动画 |
| 智能歌单编辑（`SmartPlaylistEditor.tsx`，歌单库新建、详情规则编辑） | 同上，系统短动画时长及 cosine easing，底部→原位 | 同上，原位→底部 | 原为不透明 Modal slide；同一底部 hook、0.5 压暗、退出完成后卸载；保留 coversDock、FocusVisibleScrollView 与保存 FocusVisibleAction |
| 导入流程（`PlaylistImportFlow.tsx`，歌单库/各详情→PlaylistImportPanel；Lux/文本/CSV/平台/匹配审核） | 同上，系统短动画时长及 cosine easing，底部→原位 | 同上，原位→底部 | 原为不透明 Modal slide；同一底部 hook、0.5 压暗、退出完成后卸载；保留提交保护、取消匹配、审核返回、焦点滚动及 coversDock |
| MagazineSheet 及其播放队列、歌词选句、下载、去重等调用方 | 原有 translateY 底部→0，220ms，`Easing.out(Easing.cubic)` | 原位→底部，同为220ms与同一 easing | 原有遮罩和临时任务返回规则保留；播放器评论/播放/歌词 Pager 是页内横向切换，不改为整页纵移 |

竖屏 `PlayerChrome.tsx` 的评论 / 播放 / 歌词 Tabs 使用独立全宽绝对定位层，以屏幕中线居中；与 44 高按钮行同顶距并垂直居中，睡眠定时状态不改变 Tab 位置。层容器使用 `pointerEvents="box-none"`，保留返回 / 睡眠定时 / 分享点击；Tab 点按、Pager 左右滑动及选中下划线继续共用原页码状态，无障碍 tab 角色与 selected 状态保留。文字 15/20、选中 800 / 未选 600，gap 20、底部留白 6、下划线 3；不改变上述进出过渡或横屏播放器。睡眠定时按完整胶囊宽预算判断碰撞，没有固定屏宽断点：有 pill 且 `windowWidth / 2 - tabsWidth / 2 < fullPillWidth + shareWidth + gutter + minGap` 才只显示月亮，相等仍显示「☾ 倒计时」。tabsWidth 优先实测，回退为 `6 * setSpText(15) + 2 * styles.tabsInner.gap`；完整宽预算为 `setSpText(13) * (3.2 + max(0, pill.length - 7) * 0.55) + 20 + 3`，shareWidth=缩放后44、gutter=缩放后22、minGap=8，收起后仍用完整文案计算。无定时也显示月亮；两态都能打开定时面板查看倒计时，无障碍标签保留倒计时。Tab 始终以屏幕中线居中。

原参数依据 `git show 6dc3b7d3^:<路径>` 与 `git show 6dc3b7d3 -- <路径>`：三个任务页均直接使用原生 Modal slide，调用方没有额外动画。RN 0.73 Android 的 `catalyst_slide_up/down.xml` 使用 `@android:integer/config_shortAnimTime`（设备资源，通常为 200ms，不写死数值）、默认 `AccelerateDecelerateInterpolator`，无内容 alpha；原非透明 Modal 由窗口压暗 0.5。为确保退出完成才卸载，现关闭原生动画，复用 #162 底部生命周期作等参数 JS native-driver 纵移；`UtilsModule.modalSlideDuration` 直接导出设备资源，cosine 公式与 Android 默认插值一致；透明 Modal 内用主题黑色及 0↔0.5 进度压暗恢复底页可见性，不叠加另一段动画。系统返回由 Modal.onRequestClose 汇入原页面关闭逻辑；退出中重复关闭合并、重开和卸载使旧完成回调失效。独立评论、白噪音混音器等仍为共享横向子页；不因播放器入口更改其转场。共享祖先栈、键盘/Dock/FocusVisible、登录根与 LoginGate 事务均保持原规则。

使用方式：

- 独立二级页：持久渲染 `<SettingsPage visible={...} onBack={...} bottomInset={...}>`，其 children 为接收 `back` 的函数。页内返回必须调用这个 `back`；组件保留退出内容，在动画完成后调用 onBack 并卸载。父层主动设置 visible=false 时也保留最后一帧内容到退出结束。
- 已有独立挂载的页面（音效）：`useSettingsTransition()` 提供 `style` 与 `requestClose`；用 `requestClose(onBack)`，完成后才通知 host 卸载。
- 内部状态子页：`useSettingsSubpage(root)` 提供 page / pages / setPage / style，配合 `<SettingsSubpage pages={pages} style={style}>{page => …}</SettingsSubpage>` 渲染整个祖先栈。前进时保留父页的原生视图、滚动位置和组件实例，新页叠在上方；只给最顶层子页施加共享过渡，祖先页保持完整不透明、原位可见，不使用条件卸载、display:none 或 opacity=0。返回按钮、三键和系统边缘返回手势走同一 requestClose，248ms 结束后才移除出栈页；返回到任一已有祖先均适用，连续返回不重复出栈，每次完成后解除共享 closing 防重入锁，下一层仍能正常退出。初始深链也渲染根父页；登录 Gate 内部所有深度同样启用共享转场；协议 welcome 到 Gate 是根替换。管理员沿用自己的 routeStack / useSettingsTransition(false)，同样交给 SettingsSubpage 渲染，不再只渲染当前 route。
- SettingsSubpage 按深度使用稳定 key，祖先页不接收触摸且对无障碍隐藏，视觉仍保持绘制；SubpageActiveContext 向嵌套子树传递激活状态，后台服务器检查、Lux/LX 登录及共享 Settings 返回监听不消费系统返回，防止异步状态更新重新注册监听后抢走前景页返回；栈宿主及各层使用 useLuxTheme 的纸底并裁切在共享 SettingsPage / SubpageSurface 的可见视口内，不改变 Dock 占位和键盘避让。账号、AuthFlow、同步登录、音效详情、统计/月报/回放、歌单在线搜索和管理员内部页共用此容器，任意更深层级遵循同一约定；账号字段编辑按上文使用临时单项面板。
- 已有自己的返回拦截的内容传 `hardwareBack={false}`，由内容把按钮和硬件返回汇入同一个回调。无自定义逻辑时使用 SettingsPage 默认硬件返回处理。
- 重复返回合并；再次打开会使旧的退出回调失效；卸载时停止动画并使未完成的回调失效。

## 返回与手势

Android 系统返回键、系统边缘返回手势最终通过 `hardwareBackPress` 调用与页面按钮相同的返回函数。原生栈关闭平台独立 pop 手势，以免绕过共享退出；未实现随手指进度交互的页面边缘拖回，不能把 Android 系统返回等同于 App 的拖页手势。

最上层弹窗先处理 `onRequestClose`；普通页面按「最深子页 → 父页 → 设置主页」返回。账号保存、修改密码提交以及登录/本地空间切换中的阻塞状态沿用原有保护：按钮和硬件返回均不能中断正在提交的任务。共享 useBackHandler 的稳定 listener 不因父组件重渲染夺取更深层页面的返回优先级；当独立原生屏幕位于 Home 上方时，`isHomeScreenActive` 返回 false，设置共享 handler 不消费返回。

点击 Dock 切换一级 Tab 属于切换导航，不是 back：设置详情状态清空，再进入设置回到主页并滚动至顶部；EQ 的 Main host 同样清空。退出账号、完成登录/切换数据空间等导致应用重置的操作保留原有流程。

## Dock 与播放器

键盘未打开时，竖屏所有设置二级/更深页保持播放条和三图标 Dock 可见、可点。`DOCK_BASE_HEIGHT = 122`（64 + 58），加系统底部手势 inset。SettingsPage 的共享可见高度和 EQ 根层 bottom 将内容及命中区域裁切在 Dock 上沿；裁切后的子页不再重复追加一份 Dock 高度。设置主页仍保留相同高度的滚动底部让位。

横屏 Main 已在 Header 和 PlayerBar 之间布局，SettingsTab / EQ 的 bottomInset 传 0；侧栏和 PlayerBar 留在主壳，不套用竖屏 122 的 Dock 空洞。

## 键盘与 Dock

规则适用于**一级页之外的所有层级页面**：二级、三级、四级及更深，包括全屏 overlay/全屏任务页，不限于设置模块。键盘弹出时背景不漏底，输入框和提交按钮保持可见（极小视口优先输入、提交仍可滚达），Dock 按用户自动隐藏设置显隐。临时 MagDialog / PromptDialog / ConfirmAlert / MagazineSheet 和横屏全屏输入法不属于这次统一范围。逐页盘点、范围外输入和待执行真机清单见 [ime-all-levels-audit.md](ime-all-levels-audit.md)。

新页面必须复用共享容器/组件：设置层使用 `SettingsPage`（裁切后向子树提供 0 高度）；其他非一级内容使用 `SubpageSurface`（纸底、实际 Dock 留位且仅消费一次）。覆盖主壳的原生全屏 Modal 使用 `coversDock`，不再预留被覆盖的 Dock；只在 iOS 启用 padding 避让，Android 依赖窗口 resize。滚动表单用 `FocusVisibleScrollView`；虚拟列表用 `renderFocusVisibleScroll`，保留原生 scroll ref 与列表事件；UnderlineInput 或 `FocusVisibleInput` 上报焦点，滚动中的主操作用 `FocusVisibleAction`。固定底部操作可保留原位置，但必须位于可见窗口内；全局搜索顶栏在原位使用有界共享滚动容器，小视口可滚动露出输入。

- `Home/Vertical/index.tsx` 是竖屏 Dock 显隐与占位的唯一来源，通过 `VisibleDockHeightContext` / `useVisibleDockHeight()` 共享同一帧的高度。开启 `common.autoHidePlayBar` 且键盘显示、没有保留请求时隐藏 Dock，占位立即为 0；关闭键盘或显式保留播放条/Dock 时使用包含导航、分隔线和系统 inset 的实际测量高度。保留最后一次非零测量供恢复使用，不在隐藏时清掉测量后等待再次 onLayout。首次测量前按 Dock 各段缩放高度估算，不能重复加 inset。
- SettingsPage（背景及命中区）、设置主页、一起听聊天/邀请及其内联面板订阅这份高度，不再把固定 `122 + inset` 当作永远可见的空间。裁切后的设置子页不重复加 Dock；没有竖屏 provider 的横屏宿主仍使用 0，由横屏主壳布局。保留 Dock 时页面止于它的真实上沿，不能覆盖它的点击区域。
- Android 保持窗口 resize，不在表单再次减键盘高度或新增 Android KAV height/padding。`FocusVisibleScrollView` 按实际原生视口测量；`UnderlineInput` 转发焦点并保留调用方 onFocus/onBlur，在聚焦、视口布局、内容高度及 keyboardDidShow 后重新检查。仅在被遮挡时做最小滚动，失焦/卸载使旧回调失效。`FocusVisibleAction` 标记滚动内容中的主要按钮（包括位于输入上方的保存，上下沿一起测量）；输入与按钮能同时容纳时一并显示，极小视口优先输入、按钮仍可滚动到达。固定 footer 位于滚动视口之外，不叠加键盘高度。
- 已接入：修改密码、服务器地址检查、Lux 登录/注册、LX 旧登录、管理员用户搜索，以及一起听邀请码。账号昵称／签名从三级表单移到单项 MagazineSheet，输入／保存可见和返回规则由上文账号 B 面板协议维护；旧「编辑资料」固定标题勾保存已移除。其他页面原有提交位置保持。复用的独立登录/引导表单也获得焦点滚动能力。表单使用 `keyboardShouldPersistTaps="handled"`，包括管理员用户搜索。
- 全局搜索与歌单在线搜索遵循同一自动隐藏设置，不再因处于搜索模式强制保留 Dock；搜索与列表空间使用实际可见高度。其他既有显式保留请求仍通过 `setKeepPlayBarOnKeyboard` 通知主壳，本次不重构全局布尔值的并发所有权。
- 收键盘后恢复 Dock 和原页面范围，保留草稿与合理滚动位置，不重播页面过渡。IME 可见时 Android 系统返回先由系统关闭键盘，再次返回沿既有逐层逻辑；提交期间的保护不变。
- `scripts/ime-layout.src-test.mjs` 覆盖显隐组合、保留播放条、测量恢复、最小滚动、按钮可见、极小视口与 blur/unmount 清理。静态/模拟测试不能替代 Android resize、边到边 IME、候选栏变化、大字体、手势/三键导航及快速开合的真机验证。
- MagDialog、PromptDialog、ConfirmAlert、MagazineSheet 的其他调用方（原生 Modal 与 inline 的自身缩高逻辑）及横屏全屏输入法保留现有窗口／避让策略；账号单项面板按上文单独接入输入／保存可见性。临时原生 Modal / 系统选图允许覆盖底栏。

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

- 弹窗内长内容必须置于有界的 ScrollView / FlatList 中并可上下滚动；`VersionModal.tsx` 的更新日志保留 `ScrollView`、`maxHeight: 220` 与 `nestedScrollEnabled`。
- `MagDialog` 的背景点击层与普通 View 卡片必须为兄弟节点，背景绝对填充，卡片绘制在背景之上；卡片不得用 Touchable / Pressable（包括空 onPress）包裹来阻止穿透，也不得捕获子内容的滚动或输入手势。卡片保留原生 View（`collapsable={false}`），点击卡片空白处不关闭。
- 点击卡片外仅在 `bgHide=true` 时调用 onClose；`bgHide=false` 时仍阻挡底页触摸但不关闭。embedded 与原生 Modal 共用相同内容结构；embedded 返回继续由宿主处理，原生 Modal 保留 `onRequestClose={onClose}`，不以 bgHide 限制系统返回。按钮各自的回调、禁用态、尺寸、位置、圆角、遮罩色与动画保持现状。源码守护见 `scripts/dialog-scroll.src-test.mjs`；Android 长日志滚动、输入、遮罩和返回仍需真机确认。

**待统一**：`common/Modal.tsx`、ChoosePath 和自定义源导入弹层等历史组件仍有各自的 fade、返回与文件授权处理；未迁移为 MagazineSheet。原生选择器/图片裁切由系统决定过渡。它们不应作为新整页的实现范本。

## 歌单导入歌曲

- `PlaylistImportPanel.tsx` 与 `PlaylistImportFlow.tsx` 共用一个导入弹层和 `TextTabs`，标签顺序固定为「Lux 歌单 → 粘贴文本 → CSV 文件 → 平台链接」；从歌单打开时默认 Lux 歌单，每次关闭再打开重置。独立的文本/CSV 新建歌单入口没有目标歌单，仍默认粘贴文本，保留原三标签。
- 删除平台链接中的「从其他歌单选歌」按钮及其额外选歌抽屉，避免双入口。原搜索、逐首勾选、全选、计数和确认迁到 Lux 标签内；文本/CSV 的匹配、复核、导入及平台取歌流程保持原样。
- Lux 范围为 `useMyList()` 的本机可见歌单，排除当前目标与试听列表（沿用旧范围），包括本机可见的收藏；不浏览任意远端或其他账号歌单。先显示歌单及可导入数量，点歌单打开歌曲，点「选择其他歌单」回列表；切换来源歌单或标签保留本次勾选。
- 歌单没有独立创建时间字段；`core/list.ts` 的 `createList` 默认 ID 为 `userlist_${Date.now()}`，因此仅解析严格匹配 `userlist_` + 13 位数字的 ID 作为创建时间替代依据。默认最新在前，可切换最早在前；收藏、自定义/导入 ID 等时间未知者始终排在末尾并保持本机原顺序。同时间也保持原顺序。不用重排时间 `locationUpdateTime` 或歌单名字猜创建时间。界面有排序依据说明。
- 搜索为去除首尾空白、忽略大小写的子串匹配，支持歌单名、歌名、歌手；歌单名命中显示该歌单所有可导入歌曲，歌曲/歌手命中显示匹配歌曲及其歌单。搜索仅覆盖去重后可导入歌曲，不搜索目标已有歌曲；无歌曲或全被去重的歌单仍可按歌单名找到。
- 复用 `UnderlineInput`、`MagazineSheetRow`、`Checkbox`、`SecondaryButton`、`PrimaryButton`。逐首多选；「全选当前结果」只切换当前打开歌单在当前搜索条件下的歌曲，空搜索即全选该歌单。跨歌单同一 `source_id` 共用选中状态，清除当前全选保留其他歌曲的选择；底部计数是所有歌单的选中总数。
- 候选加载沿用原 `source_id` 去重及目标歌曲排除逻辑，并保留每首歌的全部来源歌单 ID。确认时再次排除目标现有歌曲，调用 `addListMusics`、遵循 `list.addMusicLocationType`，成功提示实际提交数量并关闭、刷新目标；失败提示且保留选择。提交期间禁用勾选、搜索、切标签及关闭，阻止重复提交。
- 复用导入页的公共非一级页过渡（Modal 的原生动画关闭）、顶栏返回和系统返回汇流；Lux 标签内返回关闭整个导入弹层，切换歌单通过页内按钮，不增加导航层。输入与列表位于共享 `SubpageSurface coversDock`，Android 依赖原生窗口 resize、iOS 使用 padding；列表通过 `renderFocusVisibleScroll` 让表头输入随可用视口滚动；列表允许键盘期间点击、拖动收键盘，切标签收键盘。页边距 22；排序按钮可见高 28、上下 hitSlop 各 8，勾选行内预留 44 区域。
- `scripts/import-local.src-test.mjs` 覆盖排序、未知时间、跨歌单归属/去重、三类搜索及标签/组件接线；Android 键盘、窄屏横向标签滚动、系统返回与大量歌曲需真机确认。

## 评论加载

- **评论页跟随歌曲规则（June 2026-11-04 定）：** 竖屏播放详情的嵌入评论页以当前页码及详情页可见性判断是否 active。正在看评论页时切歌，保留该页原歌曲的评论、歌名、歌手、评论数与封面，不因播放歌曲变化清空或重新请求；封面优先使用该页歌曲的封面元数据，播放器封面仅在来源与歌曲 id 均匹配时取快照。评论页不可见期间切歌不触发评论请求。
- 从播放页或歌词页返回评论页，或关闭详情后重新打开并进入评论页时，比较当前播放歌曲与评论页歌曲的 `source + id`；不同则在同一次渲染中切换歌曲并归零热门/最新评论数，清除旧列表、显示现有加载态并请求新歌曲。同一首歌保留原有静默刷新；详情重开仍按既有规则先落播放页，不为重开过程中的旧评论页码发请求。手动「刷新」仍立即切到当前播放歌曲，同歌时按原行为刷新。
- 跟随只作用于嵌入评论页，独立评论页保持现有行为。切换歌曲不卸载重挂热门/最新容器，保留标签选择与惰性挂载状态；切到 `source === 'local'` 仍显示现有「不支持」状态。旧歌曲的迟到结果继续由下述请求代次保护隔离。
- `screens/Comment/useCommentLoad.ts` 为热门/最新注入各自请求函数；请求身份包含来源与歌曲 id。换歌或卸载使旧代次失效，并清理全部延时；过期成功、失败及延时均不能更新列表、总数或状态。
- 首次加载保留收到结果后 300ms 写列表、再 300ms 更新状态的展示节奏；期间阻止更多加载。下拉刷新取消旧加载/延时，同一刷新期间的重复下拉合并；分页保持追加与去重，刷新替换第一页。
- 静默刷新保留当前列表与状态，忙碌期间跳过；热门/最新各自保存分页状态，切换沿用现有惰性挂载。失败显示原有重试状态。
- 评论图片继续自动显示，不提供“点击显示图片”开关。页面过渡与返回保持既有实现。
- `scripts/comment-load.src-test.mjs` 使用可控 Promise/时钟验证代次隔离、刷新合并、分页、静默刷新及退出清理。

## 维护与验证

`settings-navigation.src-test.mjs` 审核设置入口清单，检查全部选项 renderer 位于 SettingsPage，屏幕挂载与下级页引用公共 helper，横竖屏均衡器 host 均存在；新增入口或绕过 helper 应让测试失败，更新审计后才能修改清单。该文件还用真实 helper 和可控动画时钟验证按钮/硬件返回的参数、延迟卸载、重复返回、重新打开取消旧回调及子页恢复；多层叠栈断言覆盖打开/返回中间帧的祖先视图、背景/位置/可见性、触摸与无障碍隔离、初始深链、连续逐层退出和取消过期回调。

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

## 登录领域术语与兼容阶段（LoginGate PR1）

本节保留 PR1 合入时的会话领域和存储契约；执行行为以其后的 PR2 条目为准。PR1 阶段仍使用原有 welcome、SyncLogin、AuthFlow、设置登录与账户空间入口，默认路由、页面、返回和播放行为不变；尚未实现 App 级 LoginGate 或身份切换事务。内部子页仍遵循本文指定的共享过渡和返回实现。

- `ActiveSession`：显式产品身份联合，provider 为 local / lx / lux；与 socket 的 `Session`、底层协议 `LX.Sync.Mode = lx | lux` 区分。local 与 LX 共用 `local`，Lux 继续使用原 `luxSpaceId(serverId,userId)`，不改变数据空间布局。PR1 只把已认证的身份快照传给兼容记录适配器，尚未把它替换为全 App 的唯一资格源。
- `SessionConnectivity`：online / connecting / offline / expired / incompatible / disabled，独立于产品身份；暂停同步不等于退出账号。此类型在 PR2 接入协调器前不改变现有状态展示。
- `LoginIntent`：显式 reason、source、目标 provider/身份/recent、initialHost、returnPolicy 与白名单 resumeTask；`initialHost=null` 表示新建不回填，undefined 才允许历史建议。任务包含 transitionId、过期时间、所需能力和可选 expectedServerId/roomId；本 PR 仅定义契约，不启用任务续接或修改旧路由参数语义。
- `RecentLogin` / `loginRecents:v1`：全局的成功登录元数据，含方式、服务器、真实用户身份/显示名、头像首字母、原空间 ID、成功时间与凭据引用。Lux 按真实 `(serverId,userId)` 唯一；LX 按服务器身份、保留大小写的部署路径与本机设备身份唯一，多个 LX 记录仍指向 local。URL 只规范协议/主机及尾斜线，不降低部署路径大小写，不接受 URL 内的用户密码、query 或 fragment。
- 成功记录：旧 LX 认证及 key 保存完成、Lux 匹配认证/空间选择/首次导入处理完成后，且旧连接流程已创建 socket 后，由兼容适配器记账（尚不等待完整同步握手）；显式完成本地使用时记录 local。空间迁移未就绪或空间不匹配不记账。失败尝试、只有凭据、地址历史、空间 lastActiveAt、离线缓存都不是成功时间证据。自动重新认证成功可以更新使用时间。PR2 将把记录发布移到协调器真正的 activation commit。
- 历史迁移：schema 的 history 与 knownAccounts 独立于 recents；旧数据没有可靠成功时间，recents 保持空，不补 Date.now。旧共用地址历史的协议保持未知，只有分方式草稿提供协议证据；已有会话/空间只提供需要登录的身份和地址，不复制数据。缺少 serverId 的旧会话不推断新空间。迁移不写回旧地址、草稿或空间；单次原子发布，无额外完成标记，失败下次读取重试。
- `CredentialRef`：凭据逻辑索引，值通过凭据层读取，recent 不含明文密码、连接码、access/refresh token 或 LX key，也不记录密钥日志。Lux refresh 沿用现有复合账号 Keychain service；同步长期 key（包括兼容 Lux socket key）由旧 get/setSyncAuthKey API 转接安全仓库。逐条安全写入并回读验证后，把原 key 索引项替换为引用；进程中断可重放。安全存储不可用时拒绝读取/保存，不回落明文；未成功迁移的旧明文仅作为原位重试源保留。已有短期 access token 与旧表单保存行为不在本 PR 中重构，不能声称所有凭据都已迁入 Keychain。
- 边界：移除最近记录只删除 metadata；清凭据继续走旧按方式能力；退出/删除空间继续走原有流程，既不因记录删除清凭据，也不因清凭据删除最近记录或音乐库。`authHint` 是展示快照，消费引用时必须重新检查可用性，不能据此认定会话有效。

PR2 的协调器、屏障与 journal 见下节；PR3 才实现 June 选定的 L1 统一登录视觉和入口收敛；PR4 接入能力引导与续接；PR5 清理旧适配层。当前不宣称统一登录完成。

## App 级登录门与切换事务基础（LoginGate PR2）

PR2 保留原有 welcome / ServerStep / AuthFlow / LX 表单的视觉与功能，不提前实现 L1 最近账号界面。身份写入由 `core/appSession` 的 `AppSessionCoordinator` 统一接管；原有 `setSyncMode` / `setSyncHost` 只提交 intent，表单选择不修改有效连接。原账号资料更新可以更新同一身份，不能通过该路径换身份。`ActiveSession` 在空间准备完成后发布，旧兼容成功记账仅用于启动时选定的旧实现。

- `requestLogin(LoginIntent)` 串行受理切换。重复开始或提交复用在途任务；模式、服务器、账号空间、本地使用、退出登录和旧根导航适配器均经过控制器。`initialHost=null` 不建议历史，目标协议显式传递，旧 username 参数只用于预填。普通连接重试与冷启动恢复校验当前身份，不把网络故障解释为换号。
- 顺序为冻结播放/队列/同步写 → 等待原生 pause 并核实 → 固定源物理 key 保存位置与待写历史（临时列表沿用原空间持久列表，临时插队及列表来源附加到已有 @play_info 的可选字段）→ 下载原生暂停栅栏 → 持久化 `gatePending` → 停止一起听跟随/上报并显式离房 → 断开连接及重连定时器 → 根替换为旧登录表单。播放、保存、下载暂停失败发生在检查点前时留在原 Main，保持暂停并允许重试；服务端拒绝离房时清检查点并中止切换，不静默关闭房间。
- Android `DownloadModule.pauseSpace` 与入队/重试/URL 更新/恢复/重建队列共享原生串行执行器。先写暂停状态、等待 WorkManager 取消、等待 worker 文件锁，再核实没有 queued/running；失败中止切换。journal 只记录本次实际暂停的 ID，不包含用户原已暂停项。切回后仍保持暂停，复用现有下载恢复按钮由用户明确恢复，不自动恢复授权 URL 解析或下载。
- `authenticateLuxCandidate` / `authenticateLxCandidate` 返回内存候选身份及 prepare/activate，不在网络认证阶段切有效空间或发布成功记录。准备时先保存匹配身份的凭据，再复用空间串行锁、首次导入和缓存生命周期；App 级原生 AccountDataDialog / SyncModeModal 在 Main 卸载后仍可处理导入及冲突。空间未就绪拒绝提交。有效目标队列与进度恢复为暂停状态，成功与取消均不自动续播、入房或恢复下载。
- `appSessionJournal:v1` 是中性全局检查点：transitionId、generation、phase、原身份、intent、候选身份引用、切换暂停下载 ID；无密码、连接码或 token。phase 为 gatePending / authenticating / preparing / committing。跨 AsyncStorage 与 Keychain 的准备失败保留已保存凭据和原数据，不发布半完成身份。Main 根替换成功后清 journal；清理失败也回 Gate。崩溃重启只要 journal 存在（含无法解析的旧版本）就冻结并进 Gate，不自动重连旧账号，也不 catch 后进首页；重新认证/空间准备可安全重试。
- `sessionGeneration` 在冻结时递增；旧 profile、历史/游标、下载 URL、媒体 URL、401/refresh 回调与房间控制不能在新身份提交后回写。目标 socket 只在目标空间准备完成后获准同步；Gate 期间媒体通知、耳机、车载和延迟播放路径同样受播放栅栏控制。
- 旧登录根消费统一 intent，返回从根执行原身份重新认证/准备与主壳重建，不能直接 pushHome 绕过未完成事务。清凭据和主动退出撤销返回原账号资格。主动退出保留源空间的存储归属，按原确认选择清凭据/删除数据，之后留 Gate；不隐式进入 local Main。注册、忘记密码、地址历史、数据管理和旧表单入口继续保留。
- 兼容实现在启动、尚无事务时选择：旧原生下载模块缺少 pauseSpace 时使用旧连接实现；有 journal 时始终选择协调器恢复，事务开始后禁止混用旧写入。内部子页、键盘和返回容器继续复用共享实现及 248ms 对称动画，根替换是应用身份重置例外。

测试以 `scripts/app-session.src-test.mjs` 的故障注入/可控 Promise 和原有 data-spaces、download、together、auth、路由脚本为准。真机仍须核实通知/耳机/车载、WorkManager 实际取消、杀进程重启、导入/冲突弹窗、键盘与硬件返回。PR3 实现 L1 统一视觉及全入口收敛；PR4 实现能力说明/白名单任务续接；PR5 退役兼容旧壳。PR2 不宣称这些后续交付已完成。

一起听成员首次接管临时列表前，在同空间现有 @play_info 中保存 personalQueue 检查点；房间进度不覆盖该个人检查点。切换保存前恢复个人临时列表、来源及进度并保持暂停，再保存源空间；目标恢复清空旧原生/JS track tail、已播放与临时插队快照，仅载入目标保存队列。以上不新增数据空间目录或命名布局。

## 统一登录门 L1 与入口收敛（LoginGate PR3）

本节覆盖上文 PR1/PR2 的过渡界面说明。`SyncLogin` 默认导出 L1，旧 ServerStep、LegacySyncLoginHost、LegacySyncLogin、设置输入弹窗代码保留供 PR5 清理，正式身份入口不再打开它们。能力说明/任务 TTL/横竖屏 host 属于 PR4，E21 的现有登录适配仍保留。

| 入口 | 当前行为与预选 |
| --- | --- |
| E01–E03 首启/未完成 | Welcome 只确认协议与安全提示；不标记登录完成，`requestLogin(boot, initialHost=null)` → L1 主态；已有完成用户沿 PR2 恢复，不重走协议。 |
| E04–E05 头像/资料 | 保留 AccountPage 资料、头像、设备、密码；不因收敛移动头像入口。 |
| E06 切换账号 | AccountPage 切换按钮直接 `requestLogin(switch)` → L1 主态；账号空间列表/数据管理另有入口，保持可达。 |
| E07–E08 空间切换/添加 | 空间切换携带 provider、host、username，已知会话携带真实 targetIdentity；需要 Gate 明确继续。添加 `reason=add, initialHost=null`，不借上一台服务器。 |
| E09 退出/数据选择 | 保留 15C 保留或移除数据确认；PR2 暂停、清当前凭据、可选删数据 → Gate，不自动 local Main，不显示取消退出。 |
| E10 状态胶囊 | 保留当前状态、时间、账号与地址复制、重试、版本诊断；查看不改身份。连接详情新增显式「暂停同步」，与点历史地址分开。 |
| E11–E14 地址格式/格式/新地址/历史 | 地址格式行及搜索直接 requestLogin 主态；格式行预选该 provider 且 null host；新地址预选当前 provider 且 null host；历史行预选当前 provider 与选中 host。只预填，不立即写有效 mode/host。 |
| E15 删除地址记录 | 非当前只删历史；当前先确认删除并断开，经事务暂停进入 Gate，再移除历史，不清凭据/空间。Gate 历史也保留同一范围说明。 |
| E16 LX 缺码/认证失败 | 自动失败只更新状态与提示，不自动弹码框；用户修复经 E17/E18 预选 LX、目标 host，仅显示码。 |
| E17–E18 检查地址/重新登录 | 状态页 CTA 直接 requestLogin，显式 provider、host、username；协议不由 username 是否为空决定。 |
| E19 本地/离线 | 「本地」进入 Gate 本地确认；原账号「离线查看」保留原空间/身份、sync disabled，不记录成功、不远端激活，重新启动也不自动连回。 |
| E20 明确失效 | PR2 暂停后一次性进 reauth Gate，显示失效标题、原 host/username、重新登录和原账号离线查看；旧延后弹窗不再叠在 Gate 上。短暂网络失败不抢根。 |
| E21 一起听旧登录入口 | 仍经 pushSyncLoginScreen → requestLogin；资格说明和续接在 PR4，当前不宣称已实现。 |
| E22–E24 方式/无同步/换服务器与返回 | 三方式全部可见；方式/地址只改草稿；本地必须确认，不做服务器探测；返回先回内部表单/主态。 |
| E25 注册/帮助 | Lux server-info 允许时进入注册；邀请码校验、用户名/昵称/密码确认保留；帮助保留管理员/其他设备选项及复制文案。均走共享转场及协调器激活。 |
| E26 清保存登录信息 | 管理登录记录内分别清 Lux/LX 的全部保存凭据与草稿（包括最近列表外账号）；确认说明范围与数量，保留所有空间与最近 metadata；清原方式时撤销在线取消返回资格。 |

L1 页面规则：

- 参考 360×800 的 L1-recent/lux/lx/local/expired/switch-paused；纸面刊头、40/44 标题、最近首字母方框/身份/服务器/真实时间、28 状态标签、44 主按钮、下划线链接、62 三方式行与底注。全新样式通过 createStyle/Text 缩放，颜色仅 useLuxTheme + magazineRoles，继承六主题；不改默认主题色。无最近成功记录时整块最近区撤去。
- 只在成功提交后写 recent 时间；运行时重查 credentialRef 可用性，无凭据时原主按钮改为重新登录并预填原身份。单条移除只 removeRecentLogin，不清凭据/数据。按方式清理过滤安全仓库的归属，不影响另一个协议。
- Lux 字段含地址/历史、用户名、可显示密码、兼容性/注册状态、HTTP 提醒；LX 只用 hello/id/连接码认证，不用 Lux server-info 阻挡。密码/新连接码只在内存使用，提交结束清空，不进入 recent；不预取带认证头像。
- LoginGate 根替换卸载 Main/Dock，背景全程纸色，不留 Dock 空洞。内部表单/确认/管理/历史/注册/帮助复用 SettingsSubpage 与唯一 useSettingsTransition 的 248ms 对称转场；无新 Animated.timing。普通设置与 Dock 按原设置隐藏规则保留。
- 页面按钮与 Android 返回共用同一回调：IME 先收起 → 原生确认/导入等弹层 → 历史/管理/注册/帮助子页 → 表单/本地确认 → 主态。主态返回不隐式激活账号；主动切换用明确的「取消切换，返回账号」。失效/退出/清原凭据无在线取消资格；离线查看与本地使用分别显示。
- 认证阶段可显式取消，迟到响应不得准备空间/提交身份；空间准备与提交临界区不可取消。失败保留 Gate 与原数据，不跳 Main。成功、取消和离线查看均保持暂停，不自动播放/入房/恢复下载。
- 全部输入使用 FocusVisibleScrollView/Action；Android 只用系统 resize，不重复减键盘高度；iOS 沿 KeyboardAvoidingView padding。返回期间保持祖先不透明，隐藏页不抢系统返回。注册提交也参与焦点动作可见性。

竖屏播放 Tab 唱片下方的歌词预览（`components/lyric/LyricPreview.tsx`）为上一句 / 居中当前句 / 下一句三行；首尾缺句留空，当前句附加文字按翻译 / 罗马音开关预留固定槽位。active 与 before.active 均为 true、同一歌词数组引用、index 恰为 before.index+1 且前后两句存在时，Animated native driver 以 280ms、`Easing.out(Easing.cubic)` 做上移与透明度交叉过渡，只动画 transform / opacity；不满足该条件（含倒退、跨多句、歌词数组替换、active=false 或此前 inactive、句子不存在）则直接定位并停止旧动画。**已知现状（v0.5.3，June 接受）：向前拖动刚好跨一句时会播动画；从后台返回若只前进一句也可能播动画。** LyricPreview 没有 seek / AppState 抑制条件；active 来自详情页 visible 与播放 Tab 选中状态，AppState 仅管理常亮，nativeActive 只用于 backActive，不能视为系统前台标志。有歌词时整块与「进入歌词」仍切到歌词 Tab，两个胶囊独立切换；歌词 Tab、共享控制行及播放详情整页进出动画保持原实现。June 于 **2026-11-10** 已批准「歌词预览区恒定占位，切歌时布局不跳」：`Pic.tsx` 的唱片预算无条件包含历史 `PLAYER_RESERVED_LYRIC=124`，不随歌词加载状态改变；实际 `lyricPreviewSlot` 恒定保留完整 160 设计高度（含两种附加文字和译 / 音操作行），flexShrink=0，有歌词时底部对齐，确保操作行位置稳定。加载中 / 无歌词时保留同高空白，不渲染歌词点击入口及译 / 音控件；歌词到达后在原容器内显示内容。June 于 **2026-11-11** 已确认按真机反馈「歌词偏下，只缩小歌名/歌手与歌词间距」：`Pic.tsx` 的 `flexGapTitle.minHeight` 从 18 降到 8 设计单位（375 基准下为 dp），`lyricPreviewSlot.marginBottom` 从 0 增至 10 设计单位；歌词整体上移 10，总占位不变，唱片及歌名位置、进度条和控制区不变，恒高 160 及空歌词占位规则保持。预览实际高度独立于预算，播放页歌词末尾 spacer 为 0；仅播放页传 `PlayerTransport.seekOverlapTop=21`（默认 0），面板以负 marginTop 21 与滚动区相叠，375 基准下，当前紧凑 SecondaryButton 高 28（不是旧描述假设的 36），44 高操作行下沿至胶囊底为 8，可见胶囊底边到轨道约 `8 + 10 + 0 + 8 + 21 − 21 = 26`（含预览底部 margin 10，原为 16）（源码布局推算，非真机像素实测；胶囊内联高度不走 createStyle，其他屏宽按实际布局计算）。SeekBar 保持 44 高与原拖动逻辑；滚动区 zIndex 2 高于上叠面板的 1，交叠顶部约 13 优先响应译 / 音胶囊和进入歌词提示，避免误 seek；轨道及其下方仍可点拖，交叠部分无法同时作为 seek 命中区，这是 June 接受的取舍。歌词 Tab 不传参数，进度条位置、外观和命中区不变。唱片间距预算由 66 减到 48，播放滚动视口增加 21，唱片不会比 dev.22 缩小；剩余高度只按 2:1 分给唱片上 / 下空隙；不足时保持各块完整并沿用 ScrollView 滚动，PlayerTransport 固定在滚动区外。源码回归见 `scripts/player-lyric-3lines.src-test.mjs`、`player-vertical-spacing.src-test.mjs`。

以上播放详情相关交互按 2026-11-03（北京时间）核对的 v0.5.3 源码锁定，改动前须先经 June 确认；完整数值、#158 / #162 / #164–#169 来源及已知现状见 [播放详情页定稿规则](design-system-magazine.md#播放详情页定稿规则以-v053-为准不可回退)，统一守护见 `scripts/player-locked-rules.src-test.mjs`。
