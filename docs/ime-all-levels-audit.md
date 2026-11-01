<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 非一级页输入与键盘盘点（2026-11-01）

以仓库实际 JSX 和路由为准，检索所有 TextInput、UnderlineInput、common/Input 的定义及调用，并沿宿主核对。层级按首页/歌单/设置三个 Tab 为一级；同一表面从不同入口进入时深度可能不同。原状态指 #155 后、本次修改前。

## 页面清单

| 页面/输入 | 层级 | 文件（src/ 下） | 原状态 | 处理 |
| --- | --- | --- | --- | --- |
| 账户资料：昵称、个性签名（含只读用户名） | 设置→账户→编辑，三级 | screens/Account/AccountPage.tsx | SettingsPage + FocusVisibleScrollView，保存固定 footer，已接入 | 保存移到滚动区外标题行勾按钮，删除底部 footer；保留共享焦点滚动，固定按钮不参与滚动测量；共享宿主消费 Dock 后向子树提供 0，避免深层重复留位 |
| 账户修改密码：旧密码、新密码、确认密码 | 三级 | screens/Login/ChangePassword.tsx | 同上，固定提交 footer | 保留 |
| 同步服务器地址检查 | 设置同步流程，三级或更深；首次启动另有入口 | screens/Login/ServerStep.tsx | 共享焦点滚动，固定检查按钮 | 保留；不改独立引导导航 |
| Lux 登录：用户名、密码 | 同步流程三级或更深 | screens/Login/AuthFlow.tsx | 共享焦点滚动 + FocusVisibleAction | 保留 |
| Lux 注册：邀请码、用户名、昵称、密码、确认密码 | 登录下一级，四级或更深 | screens/Login/AuthFlow.tsx | 共享焦点滚动，固定注册 footer | 保留 |
| LX 登录：授权码；旧同步 Lux 凭据分支 | 同步流程三级或更深；兼容独立登录入口 | screens/SyncLogin/index.tsx | 共享焦点滚动 + FocusVisibleAction | 保留 |
| 管理员→用户搜索 | 设置→管理员→用户，三级 | screens/AdminConsole/AdminConsoleLayer.tsx | SettingsPage + FocusVisibleScrollView | 保留；创建、重置等输入属于下表弹窗 |
| 一起听→加入房间邀请码 | 二级，歌曲入口也可更深 | screens/Home/Vertical/ListenTogether/ListenTogetherPage.tsx | 可见 Dock 高度 + 共享焦点滚动/操作标记 | 保留 |
| 一起听→房间聊天（经典/流式） | 二级的房间状态；邀请/点歌可更深 | screens/Home/Vertical/ListenTogether/RoomFeedView.tsx | 宿主传入实时 Dock 高度；输入/发送同一固定底栏，窗口 resize 后随底部抬起 | 保留；邀请、成员、点歌列表本身无文本输入 |
| 全局搜索：音乐/歌单、建议/结果 | 二级；一起听点歌等入口可更深 | screens/Home/Vertical/SearchPage.tsx | 固定顶部输入，列表固定 Dock padding；强制保留 Dock | SubpageSurface 统一纸底及实时 Dock 留位；顶栏原位接入有界 FocusVisibleScrollView / FocusVisibleInput，小视口可滚；键盘搜索提交保留；取消强制保留 Dock |
| 歌单在线搜索 | 歌单 Tab 内的二级搜索场景 | components/playlist/PlaylistSearchScene.tsx；screens/Home/Vertical/Tabs/PlaylistTab.tsx | 表头原生 TextInput；固定 padding，活跃搜索强制保留 Dock | 共享 SubpageSurface、FocusVisibleInput、renderFocusVisibleScroll；取消强制保留 Dock |
| 导入→Lux：歌单名/歌曲/歌手搜索 | 二级，详情导入为三级或更深 | components/playlist/PlaylistImportPanel.tsx | FlatList 表头输入；固定导入 footer；外层 Android KAV height | 列表接共享焦点滚动；外层统一 SubpageSurface coversDock，Android 只用原生 resize |
| 导入→文本粘贴 | 二级或三级及更深 | components/playlist/PlaylistImportFlow.tsx | 多行输入在 FlatList 表头；同上 | 共享列表焦点滚动，保留固定开始/导入 footer |
| 导入→平台链接 | 二级或三级及更深 | components/playlist/PlaylistImportFlow.tsx | 链接输入在表头；同上 | 同上 |
| 导入→CSV | 二级或三级及更深 | components/playlist/PlaylistImportFlow.tsx | 此标签自身无文本输入，文件选择是临时面板 | 共用全屏容器；文件选择面板不改 |
| 智能歌单新建/编辑：名称 | 二级或从详情进入的三级 | components/playlist/SmartPlaylistEditor.tsx | 普通 ScrollView；保存位于滚动顶部 | SubpageSurface coversDock + FocusVisibleScrollView；原位保存用 FocusVisibleAction 标记；共享数学同时考虑上方按钮的上沿 |
| 普通歌单详情/编辑/新建 | 二级/三级及更深 | components/playlist/PlaylistDetailOverlay.tsx、PlaylistDetailView.tsx、PlaylistDetailScene.tsx、PlaylistLibraryScene.tsx | 页面内无直接输入；新建/重命名走 PromptDialog，导入进入上述全屏页 | PromptDialog 留待后续；Overlay 原固定 164 底部留白改为实际 Dock + 42 内容留白 |
| AI 助手入口 | 二级 | screens/AiTokenStatus/index.tsx | 实际为令牌/操作记录状态页，没有对话输入 | 无需改动；仓库没有 AI 对话页 |
| 评论（热评/最新评论/楼中楼） | 播放详情下级 | screens/Comment/ | 只读列表及图片，没有评论编辑框 | 无需改动 |
| 账户设备/数据空间、管理员邀请/歌单/服务、忘记密码 | 三级或更深 | screens/Account/AccountPage.tsx、screens/AdminConsole/AdminConsoleLayer.tsx、screens/Login/AuthFlow.tsx | 无直接文本输入（管理员临时输入见下表）；忘记密码仅方案/帮助操作 | 无需改动 |
| 设置各选项、自定义源管理、同步状态、音效及音效详情 | 二级/三级及更深 | screens/Home/Vertical/Tabs/SettingsTab.tsx、screens/Home/Views/Setting/settings/Basic/Source.tsx、screens/SyncStatus/、screens/AudioEffects/ | 除下表弹窗外无直接文本输入 | 保留 SettingsPage 宿主及逐层返回 |

一级设置 Tab 的搜索输入（SettingsTab）不属于本次页面范围；其 Dock 高度已有 #155 接入。首页、歌单库根页本身没有文本输入。

## 范围外：含输入的临时弹窗/面板

| 表面 | 文件（src/ 下） | 输入 |
| --- | --- | --- |
| 设置 MagDialog | screens/Home/Vertical/Tabs/SettingsTab.tsx | 同步地址、LX 授权码、Lux 用户名/密码 |
| 管理员 MagDialog | screens/AdminConsole/AdminConsoleLayer.tsx | 新建用户的用户名/密码/昵称、新邀请码次数、重置密码、删除用户名确认 |
| 智能歌单 MagazineSheet | components/playlist/SmartPlaylistEditor.tsx | 规则值/日期/数字、排序数量上限 |
| 导入人工匹配 MagazineSheet | components/playlist/PlaylistImportFlow.tsx | 搜索歌曲 |
| 导入新歌单 PromptDialog | components/playlist/PlaylistImportFlow.tsx | 歌单名 |
| 歌单新建/重命名/删除确认 PromptDialog | components/playlist/PlaylistLibraryScene.tsx、PlaylistDetailScene.tsx、PlaylistDetailView.tsx、PlaylistDetailOverlay.tsx | 名称或确认文字；是否显示输入由调用参数决定 |
| 添加歌曲时新建歌单 | components/MusicAddModal/CreateUserList.tsx | 歌单名（common/Input） |
| 文件选择临时面板 | components/common/ChoosePath/components/NewFolderModal.tsx、OpenStorageModal.tsx | 文件夹名、存储路径（common/Input） |
| 定时退出编辑 | components/TimeoutExitEditModal.tsx | 时间（common/Input） |
| 遗留自定义源在线导入 | screens/Home/Views/Setting/settings/Basic/UserApiEditModal/ScriptImportOnline.tsx | URL（common/Input） |
| 共享弹窗基础设施 | components/common/PromptDialog.tsx、components/AppDialogHost.tsx | PromptDialog 内置输入；ConfirmAlert/确认宿主自身无直接输入 |

MagDialog、PromptDialog、ConfirmAlert、MagazineSheet 的键盘策略均不改。横屏全屏输入法不在范围；独立表单复用共享焦点组件，但不调整横屏主壳/输入法模式。

## 真机逐页检查（尚未执行）

以下每行都要分别在自动隐藏开启/关闭、手势/按钮导航下执行：聚焦、输入、提交、收键盘、再次聚焦；确认纸底无缺口，输入及提交可见或极小视口可滚达，Dock 按设置显隐且可点；系统返回先收键盘，再逐层返回，草稿保留。大字体、小屏、多行长内容也需覆盖。

- [ ] 账户→修改昵称；账户→修改签名；账户→修改密码的每个字段。
- [ ] 同步地址检查；Lux 登录；Lux 注册每个字段；LX 授权码；兼容旧 Lux 登录。
- [ ] 管理员→用户搜索（滚动后重新聚焦）。
- [ ] 一起听→邀请码；经典聊天；流式聊天；从点歌返回聊天后重新输入。
- [ ] 全局搜索音乐/歌单、建议/结果；从首页/歌单/一起听进入及退出。
- [ ] 歌单在线搜索，向下滚动结果后重新编辑；切 Tab 再返回。
- [ ] 导入 Lux 过滤/切换歌单；文本长粘贴；CSV 切标签；平台链接；开始匹配及确认导入。
- [ ] 智能歌单新建/编辑名称，滚动到底部后聚焦名称，原位顶部保存可见；预览返回。
- [ ] 歌单详情、导入返回，确认 Dock 恢复及底部歌曲可点；无输入的 AI 状态/评论入口正常。

弹窗清单单独留作后续真机任务，本次不宣称已经修复或验证。
