<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 非一级页动画盘点（2026-11-01）

基线为 #155、#156 已合入的 dev。首页、歌单、设置三个 Tab 为一级；同一内容因入口不同可以更深。除下文底部弹出页例外外，所有非一级页面共用 `common/overlaySlideTransition.ts`：248ms、同一 bezier(0.22, 0.84, 0.22, 1)、opacity 0.92↔1、当前窗口宽度↔0、native driver；`SettingsPage` / `useSettingsTransition` / `useSettingsSubpage` 为宿主及状态路由入口。退出完成才释放内容；快速重复返回合并，重开/卸载取消旧回调。

| 页面 | 层级 | 原动画实现 | 处理 |
| --- | --- | --- | --- |
| 设置语言、主题、统计样式、默认搜索源、自定义音源、一起听布局、同步服务、缓存/数据、更新日志 | 二级 | SettingsPage：248ms 对称 | 保留，作为全应用公共契约 |
| AI 助手令牌/操作状态、账户主页、同步状态、管理员主页 | 二级 | SettingsPage | 保留 |
| 账户→编辑资料 | 三级 | useSettingsSubpage，248ms | 保留公共过渡；保存入口见下文；修复共享硬件返回监听被父页重新注册抢占 |
| 账户→已登录设备 | 三级 | useSettingsSubpage | 同上，保留退出后恢复账户 |
| 账户→数据空间 | 三级 | useSettingsSubpage | 同上；选择/预览为临时 sheet |
| 账户→修改密码 | 三级 | 账户子页动画面；ChangePassword 处理提交保护 | 保留；提交保护不变 |
| 音效/均衡器→响度与无缝播放详情 | 二/三级 | useSettingsTransition + useSettingsSubpage | 保留；横竖屏宿主共用 |
| 管理员→用户 / 邀请码 / 我的歌单 / 服务 | 三级 | useSettingsTransition + routeStack | 保留；统一硬件监听顺序；创建/重置等仍为临时对话框 |
| 同步状态→地址检查 | 三级或更深 | SettingsPage | 保留 |
| 同步服务/状态→SyncLogin→服务器检查 | 三级或更深 | SettingsPage + useSettingsSubpage | 保留；地址检查成功进入下一层 |
| 服务器→Lux 登录 / LX 登录 / 旧 Lux 凭据 | 四级或更深 | useSettingsSubpage | 保留；独立启动与引导属于根流程 |
| Lux 登录→注册 / 忘记密码 | 五级或更深（入口不同可为四级） | AuthFlow useSettingsSubpage | 保留；阻塞提交不允许返回 |
| 全局搜索（首页、歌单、一起听点歌入口） | 二/三级或更深 | 自写 268/220ms，opacity 0.86 | 改共享过渡；按钮/系统返回先退出再通知父层，外部 visible=false 同样保留内容 |
| 歌单在线搜索 | 二级 | 条件替换，无过渡 | useSettingsSubpage；回歌单库前等待退出 |
| 本地/在线歌单详情（库内） | 二级，搜索等入口可更深 | 外层 318/304ms 横移+底页视差+shade；内层 280/200ms 上浮24/淡入，重复过渡 | 去掉父层重复动画、视差与shade；详情的兼容 adapter 委托共享过渡 |
| 通用歌单/排行榜详情 overlay | 二/三级或更深 | 自写 268/220ms，不同 bezier | useSettingsTransition；保留数据请求失效、拖动清理及 InteractionManager 释放 |
| 本地歌曲 | 二级 | overlaySlideTransition 248/220ms | 公共默认返回改为248ms、同一曲线 |
| 听歌统计主页（杂志/Replay） | 二级 | overlaySlideTransition 248/220ms | 同上 |
| 统计→回忆卡片/时间线、月报、年度回放；回忆→指定月份 | 三级及更深 | 布尔状态直接替换，无页面过渡 | 单一路由 useSettingsSubpage，退出后恢复统计；默认布局就是月报/回忆时，返回关闭统计主页 |
| 月报/播放器→分享卡片预览 | 四级或更深 / 三级 | 原生 Modal slide | 底部弹出例外：按原 RN Modal slide 参数恢复纵移，设备 config_shortAnimTime / 默认 cosine easing，0.5 背景压暗；复用 #162 抽取的 bottomPopupTransition，完成/返回先退出再卸载 |
| 歌单库/详情→智能歌单新建/规则编辑 | 二/三级及更深 | 原生 Modal slide | 同上底部弹出例外；保留 SubpageSurface coversDock、FocusVisibleScrollView、上方保存的 FocusVisibleAction |
| 歌单库/详情→导入 Lux / 文本 / CSV / 平台，匹配审核 | 二/三级及更深 | 原生 Modal slide | 同上底部弹出例外；页内标签/匹配状态不另建层级，保留提交/取消保护、焦点滚动 |
| 一起听 | 二级；其他入口可更深 | overlaySlideTransition 248/220ms | 公共默认对称；点歌搜索单独使用 SearchPage；邀请/点歌队列/成员为 sheet |
| 每日推荐 | 二级 | 直接挂载/卸载 | useSettingsTransition，按钮和硬件返回同回调 |
| 白噪音混音器 | 二级；播放详情入口可更深 | 直接挂载/卸载 | useSettingsTransition；保留 Dock、音量及播放逻辑 |
| 播放详情（竖屏持久 overlay） | 二级 | 纵向420ms back easing进、300ms cubic退，独立遮罩 | 底部弹出例外：恢复 translateY 高度→0 的420ms Easing.out(Easing.back(1.05))进入、300ms Easing.out(Easing.cubic)下退、colors.scrim.mask 跟随进度遮罩；保留懒挂载、背景恢复，退出完成才隐藏，支持退出中重开 |
| 播放详情（原生 stack，含横屏/启动打开） | 二级 | 原生纵移420/300ms | 底部弹出例外：不包 SubpageScreen；显式启用原生 translationY push 420ms spring / pop 300ms默认插值、alpha 0.92↔1；skipAnimation 禁用两侧；黑底防白闪，pop 注册表仅合并原生返回，无 JS 等待 |
| 独立评论（热评/最新） | 播放详情下级，三级或更深 | 原生横移300ms | SubpageScreen；按钮与系统返回共用退出 |
| 原生排行榜详情 | 二级或更深 | 原生横移300ms | 同上 |
| 协议文档（push 路径） | 二级或更深 | 原生默认过渡 | 同上；首次启动根流程、协议临时 overlay 不套页面过渡 |

`navigation/registerScreens.tsx` 默认把新注册页面包进 `SubpageScreen`；根屏、播放详情和临时 overlay 显式排除。`navigation/index.ts` 默认关闭平台 push/pop 及平台独立 pop 手势，防止与 JS 动画叠加。Android 系统边缘手势仍从 hardwareBackPress 进入同一回调；没有新增随手指拖动进度的 App 内返回手势。`useBackHandler` 固定监听注册顺序，父组件重渲染只更新回调，不抢深层页面优先级。

播放详情内部评论/播放/歌词 Pager、统计风格/时段、搜索类型、导入标签、智能规则选择等是页内切换；临时 MagDialog / MagazineSheet、下载/去重/播放队列、系统文件选择/图库裁切不是页面，保留自身动效。切一级 Tab、退出登录、切空间等主动重置不属于返回。

## 底部类页面历史复核（#158–#161）

依据 `git show 6dc3b7d3` 与 `git log -p 6dc3b7d3~1..HEAD -- <path>` 逐项核对：

| 页面 / 文件 | 历史结果与决定 |
| --- | --- |
| `Home/Vertical/PlayQueueSheet.tsx` | 无变更；原 MagazineSheet 底部纵移仍在，无需恢复 |
| `PlayDetail/Vertical/Lyric.tsx`、`PlayDetail/Horizontal/Lyric.tsx`、`components/lyric/LyricPreview.tsx` | 无变更；歌词为页内/Pager内容或原预览，未被套共享横向整页动画 |
| `PlayDetail/Vertical/index.tsx` 评论/播放/歌词 Pager | 无历史变更；原有横向页内切换保留，本次仅避免不活跃播放器消费系统返回 |
| `components/magazine/MagazineSheet.tsx` | 无变更；220/220ms cubic-out 纵移与遮罩保留 |
| `components/download/PlaylistDownloadSheet.tsx` | 无变更；原 MagazineSheet 保留 |
| `components/playlist/PlaylistDedupeSheet.tsx` | 无变更；原 MagazineSheet 保留 |
| `components/shareCard/LyricSelectionSheet.tsx`、`PlayDetail/Vertical/SleepTimerSheet.tsx` | 无变更；原 MagazineSheet 保留 |
| `components/recommend/SimilarSongsSheet.tsx`、`Home/Vertical/ListenTogether/InviteSheet.tsx`、`RequestSheet.tsx` | 无变更；原临时 sheet 保留 |
| `components/shareCard/ShareCardPage.tsx` | #158 从不透明 Modal slide 改共享横向；June 2026-11-01 决定恢复，月报与播放器歌词生成入口均走同一底部例外 |
| `components/playlist/SmartPlaylistEditor.tsx` | #158 从不透明 Modal slide 改共享横向；June 2026-11-01 决定恢复，复用同一底部例外 |
| `components/playlist/PlaylistImportFlow.tsx` | #158 从不透明 Modal slide 改共享横向；June 2026-11-01 决定恢复，复用同一底部例外 |
| 独立评论、白噪音、歌单/排行榜详情 | 原横向子页或直接挂载内容；不属于原底部弹出播放器覆盖页，保持公共248ms |

三个任务页的原生参数已从 RN 0.73 源码复核：`catalyst_slide_up/down.xml` 为 100%p↔0%p、`config_shortAnimTime`，默认 `AccelerateDecelerateInterpolator`；无自定义 easing/时长，无内容 alpha。原非透明 Modal 窗口 dimAmount=0.5。现在从 UtilsModule 读取同一设备时长，以 #162 抽取的底部 hook 复现纵移及默认 cosine easing，主题黑色进度压暗 0↔0.5；平台动画关闭，避免叠加，退出 finished 后通知父层卸载。分享仍保留 statusBarTranslucent。原生播放器 stack 与既有 MagazineSheet 不变。

## 界面移动、删除

- 编辑资料：从播放栏上方的固定底部保存区移到「编辑资料」标题右侧；文字按钮替换为 28 图标 / 44 点击区的公共 IconButton 勾按钮，沿用 `account_save` 三语无障碍标签和 saveEditedProfile。无修改/保存中禁用，保存中显示加载。底部保存区连同主线、留白删除，避免继续占用输入视口。
- 编辑资料：原随表单滚动的返回、刊头及标题移到滚动区域外，以保持标题行勾按钮可见；其他账户页面保留原位置。共享焦点滚动只测量输入，不把固定标题按钮标成 FocusVisibleAction。
- 歌单详情：删除父层装饰性 shade、底页视差和重复横移，避免与子页动画叠加；入口/内容不删除。
- 播放详情 overlay：#158 曾删除独立渐暗遮罩；本次恢复遮罩及原有纵向进出。没有删除、隐藏或移动入口、按钮、文案或内容区域。

- 本次三个任务页仅把共享横向过渡恢复为原底部纵移与背景压暗；未删除、隐藏或移动任何功能、入口、按钮、文案或内容区域。

## 逐页真机检查（尚未执行）

每行分别测试左上返回、Android 三键返回和系统边缘返回；快连点、返回中重开、旋转、大字体/小屏/长列表也需检查。输入页同时分别测试 Dock 自动隐藏开/关：背景铺到键盘上沿，焦点输入可见，勾按钮/提交可点，关闭键盘后 Dock 与草稿恢复；系统返回先收键盘，再返回一层。

- [ ] 逐一打开语言、主题、统计样式、搜索源、音源管理、一起听布局、同步服务、缓存、更新日志、AI 状态。
- [ ] 账户主页→编辑资料（昵称/签名/头像/性别逐项修改及还原；无改动禁用、保存加载、成功/失败/重试）、设备、空间、密码（每个输入与提交保护）。
- [ ] 音效→响度/无缝详情，横竖屏逐层返回，Dock 可点。
- [ ] 管理员→用户搜索、邀请、歌单、服务；临时弹窗先返回，不越级关闭管理员。
- [ ] 同步成功/错误详情→地址检查→Lux 登录→注册/忘记密码；LX/旧 Lux 登录；逐层返回，提交期间拦截。
- [ ] 全局搜索音乐/歌单→详情→导入；点歌搜索→返回一起听；无闪白、没有双退出。
- [ ] 歌单在线搜索→歌单库；库内与通用详情→返回；导入四个标签/审核、智能编辑/预览/保存。
- [ ] 本地歌曲→返回，异步数字和首屏歌曲出现动效仍正常。
- [ ] 统计两种主页→回忆卡片/时间线/月报→指定月份/年度回放→分享卡片，完成/系统返回均正常；默认月报/回忆布局的根返回能关闭统计。
- [ ] 一起听邀请码/聊天/邀请/点歌队列→点歌搜索，返回先退出最深表面，草稿及 Dock 保留。
- [ ] 每日推荐、白噪音（含播放详情入口），退出后音乐与噪音行为保持。
- [ ] 播放详情 overlay / 原生 stack、独立评论、排行榜、协议 push；原生窗口没有第二段动画，底页恢复正常。

模拟时钟/源码测试不能证明设备渲染和系统输入法行为；以上未打勾项不视为验收通过。
