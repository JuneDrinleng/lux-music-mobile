<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->
# `src/components` 组件说明

本文件按要求放在 `src/component/instruction.md`，但实际要说明的源码目录是 `src/components/`。

这份说明的目标是帮助后续维护时快速判断：

- 每个文件是不是 React 组件；
- 它处在组件树里的哪一层；
- 它主要负责“容器 / 展示 / 交互 / 弹层 / 工具辅助”中的哪一种职责。

## 根目录组件

- `src/components/AppDialogHost.tsx`：全局应用对话框宿主，统一监听弹窗事件并渲染 `PromptDialog`，让业务侧可以用统一入口发起确认、提示等对话框。
- `src/components/DesktopLyricEnable.tsx`：桌面歌词能力开关组件，负责把开关 UI、权限申请和设置写入串起来。
- `src/components/PageContent.tsx`：页面内容外层容器，统一处理页面背景、尺寸约束、内容包裹和部分通用布局逻辑。
- `src/components/PermissionPromptHost.tsx`：全局权限提示宿主，专门承接权限申请前后的提示弹窗和用户确认流程。
- `src/components/SizeView.tsx`：尺寸测量辅助组件，用来感知窗口尺寸、状态栏高度等信息，并把这些布局数据同步给全局状态。
- `src/components/SourceSelector.tsx`：音源选择器组件，用下拉选择的方式切换当前使用的在线音源。
- `src/components/TimeoutExitEditModal.tsx`：定时退出/睡眠定时编辑弹窗，用于设置退出时间、确认启停等操作。

## `common/` 通用基础组件

- `src/components/common/Badge.tsx`：轻量徽标文本组件，用于显示“小标签”状态，例如主次标记、辅助说明等。
- `src/components/common/Button.tsx`：基础按钮封装，统一按压反馈、禁用态和测量能力，是很多交互组件的底座。
- `src/components/common/ButtonPrimary.tsx`：主按钮样式封装，在基础按钮上提供更明确的主操作视觉样式。
- `src/components/common/ConfirmAlert.tsx`：确认弹窗组件，封装标题、正文、取消/确认按钮和反向按钮排列等常见确认场景。
- `src/components/common/Dialog.tsx`：通用对话框容器，在 `Modal` 之上提供居中弹窗结构、标题栏和关闭行为。
- `src/components/common/DorpDownMenu.tsx`：下拉菜单触发器组件，把按钮测量、菜单定位和菜单项展示组合到一起。
- `src/components/common/DrawerLayoutFixed.tsx`：抽屉布局兼容封装，用于修正或统一原生 `Drawer` 在当前项目里的行为。
- `src/components/common/FileSelect.tsx`：文件/目录选择入口组件，通常以方法调用方式打开路径选择器并把结果回传给业务层。
- `src/components/common/Icon.tsx`：项目图标组件，统一图标来源、尺寸、颜色和调用方式。
- `src/components/common/Image.tsx`：项目图片组件，统一处理本地/远程图片、缓存、失败占位图和请求头等能力。
- `src/components/common/ImageBackground.tsx`：背景图组件，在项目自定义 `Image` 能力上提供背景层渲染。
- `src/components/common/Input.tsx`：输入框组件，封装主题样式、输入态和常用输入行为。
- `src/components/common/Loading.tsx`：加载指示组件，用于显示圆形加载、转圈或基础等待状态。
- `src/components/common/LoadingMask.tsx`：全屏加载遮罩，在页面或弹层之上覆盖一层“不可操作 + 加载中”的状态。
- `src/components/common/Menu.tsx`：菜单浮层组件，负责锚点定位、菜单面板展示和点击关闭等行为。
- `src/components/common/Modal.tsx`：最底层弹层容器，对接 React Native `Modal`，统一遮罩、关闭方式和层级行为。
- `src/components/common/Popup.tsx`：弹出层/抽屉式容器，适合从底部、顶部或侧边弹出的内容面板。
- `src/components/common/PromptDialog.tsx`：项目内统一的提示对话框组件，供全局宿主或业务侧直接复用。
- `src/components/common/ScaledImage.tsx`：按原图尺寸自动缩放的图片组件，适合需要在固定区域内保持比例展示图片的场景。
- `src/components/common/SegmentedIconSwitch.tsx`：带图标的分段切换器，提供分段选项、滑块动画和状态切换。
- `src/components/common/Slider.tsx`：滑杆组件，用于音量、进度、阈值等可拖动数值选择。
- `src/components/common/StatusBar.tsx`：状态栏封装，统一亮暗色、背景色和页面级状态栏配置。
- `src/components/common/Text.tsx`：项目文本组件，统一主题文字色、字号和常用排版属性。

## `common/CheckBox/` 复选框

- `src/components/common/CheckBox/Checkbox.tsx`：基础复选框本体，负责勾选图形、点击态和选中状态表现。
- `src/components/common/CheckBox/index.tsx`：复选框对外入口，通常把文本、布局和复选框本体组合成可直接使用的组件。

## `common/ChoosePath/` 路径选择器

- `src/components/common/ChoosePath/index.tsx`：路径选择模块入口，负责打开路径选择弹层并组织整体状态。
- `src/components/common/ChoosePath/List.tsx`：路径列表组件，渲染当前目录下的文件夹/文件集合。
- `src/components/common/ChoosePath/components/Footer.tsx`：底部操作栏，承载确认、返回上级、新建目录等动作入口。
- `src/components/common/ChoosePath/components/Header.tsx`：顶部标题和路径栏，用来显示当前位置及导航信息。
- `src/components/common/ChoosePath/components/ListItem.tsx`：单个文件/目录列表项，负责图标、名称和点击进入/选中行为。
- `src/components/common/ChoosePath/components/Main.tsx`：路径选择器主体布局，把头部、列表、底部动作等区域拼起来。
- `src/components/common/ChoosePath/components/NewFolderModal.tsx`：新建文件夹弹窗，负责输入目录名并提交创建。
- `src/components/common/ChoosePath/components/OpenStorageModal.tsx`：打开存储访问弹窗，用于引导用户授予文件系统访问权限。

## `common/DorpDownPanel/` 下拉面板

- `src/components/common/DorpDownPanel/index.tsx`：下拉面板入口组件，负责控制展开/收起并把触发器和面板串联起来。
- `src/components/common/DorpDownPanel/Panel.tsx`：下拉面板本体，负责面板内容区的定位、样式和展示。

## `MetadataEditModal/` 元数据编辑弹窗

- `src/components/MetadataEditModal/index.tsx`：元数据编辑弹窗入口，负责读取歌曲元数据、提交修改和控制弹层显隐。
- `src/components/MetadataEditModal/InputItem.tsx`：单行表单项，用于标题、歌手、专辑等短文本字段输入。
- `src/components/MetadataEditModal/MetadataForm.tsx`：完整表单区域，组合所有字段并承接校验/提交前的数据整理。
- `src/components/MetadataEditModal/ParseName.tsx`：文件名解析辅助组件，尝试从文件名中拆出歌名、歌手等信息填入表单。
- `src/components/MetadataEditModal/PicItem.tsx`：封面图片表单项，用于展示、替换或清除歌曲封面。
- `src/components/MetadataEditModal/TextAreaItem.tsx`：多行文本表单项，适合备注、歌词片段或较长文本字段。

## `modern/` 现代化视觉组件

- `src/components/modern/SearchBar.tsx`：现代风格搜索框，主要用于新版页面中的搜索输入入口。
- `src/components/modern/SectionHeader.tsx`：现代风格分区标题组件，用于列表区块标题和右侧动作入口。
- `src/components/modern/Surface.tsx`：现代风格卡片容器，为内容块提供统一的圆角、边框和表面层样式。

## `MusicAddModal/` 单曲加入歌单弹窗

- `src/components/MusicAddModal/CreateUserList.tsx`：在“加入歌单”流程里新建用户歌单的子组件。
- `src/components/MusicAddModal/index.tsx`：单曲加入歌单弹窗入口，负责按需加载和对外暴露打开能力。
- `src/components/MusicAddModal/List.tsx`：歌单列表区域，展示当前可加入的歌单集合。
- `src/components/MusicAddModal/ListItem.tsx`：单个歌单行项，负责显示歌单信息并响应“加入此歌单”操作。
- `src/components/MusicAddModal/MusicAddModal.tsx`：单曲加入歌单弹窗主体，负责完整的交互流程和状态控制。
- `src/components/MusicAddModal/Title.tsx`：弹窗标题区域，展示标题文案和可能的辅助操作。

## `MusicMultiAddModal/` 多曲加入歌单弹窗

- `src/components/MusicMultiAddModal/index.tsx`：多曲批量加入歌单弹窗入口，负责对外暴露打开能力。
- `src/components/MusicMultiAddModal/List.tsx`：批量加入场景下的目标歌单列表。
- `src/components/MusicMultiAddModal/ListItem.tsx`：批量加入场景中的单个歌单项。
- `src/components/MusicMultiAddModal/MusicMultiAddModal.tsx`：多曲批量加入歌单的主体弹窗，统一处理批量写入流程。
- `src/components/MusicMultiAddModal/Title.tsx`：批量加入弹窗的标题区域。

## `OnlineList/` 在线列表组件

- `src/components/OnlineList/index.tsx`：在线歌曲列表模块总入口，负责组合列表、菜单、多选条和加歌单弹窗等能力。
- `src/components/OnlineList/List.tsx`：在线歌曲列表主体，负责渲染在线歌曲集合。
- `src/components/OnlineList/listAction.ts`：在线列表动作辅助模块，封装播放、菜单、分享、查看详情等列表相关操作。
- `src/components/OnlineList/ListItem.tsx`：在线歌曲列表的单行项，负责歌曲信息展示与点击交互。
- `src/components/OnlineList/ListMenu.tsx`：在线歌曲的右键/长按菜单，用于承载更多操作项。
- `src/components/OnlineList/MultipleModeBar.tsx`：在线列表多选模式底部操作栏，用于批量播放、收藏、加入歌单等操作。

## `player/` 播放控制组件

- `src/components/player/Progress.tsx`：播放进度组件，负责展示当前播放进度并处理拖动跳转。
- `src/components/player/ProgressBar.tsx`：进度条基础实现，偏向通用的条形进度展示和拖拽能力。
- `src/components/player/PlayerBar/index.tsx`：底部迷你播放条总入口，组合封面、标题、状态、控制按钮和跳转播放详情页的行为。
- `src/components/player/PlayerBar/components/ControlBtn.tsx`：播放条里的控制按钮区域，例如播放/暂停、上一首、下一首等。
- `src/components/player/PlayerBar/components/Pic.tsx`：播放条封面组件，显示当前歌曲封面图。
- `src/components/player/PlayerBar/components/PlayInfo.tsx`：播放信息区域，组合歌曲名、歌手等文字信息。
- `src/components/player/PlayerBar/components/Status.tsx`：播放状态显示组件，用于承接加载中、播放中或其他状态提示。
- `src/components/player/PlayerBar/components/Title.tsx`：播放条标题组件，专门渲染歌曲标题文本和裁切逻辑。

## `SearchTipList/` 搜索提示列表

- `src/components/SearchTipList/index.tsx`：搜索提示下拉区域入口，负责整体显隐和动画过渡。
- `src/components/SearchTipList/List.tsx`：搜索建议列表本体，负责渲染提示词并处理点击填充搜索词。

## 维护建议

- 新增 `src/components` 文件后，建议同步更新本说明，避免后续维护时只能靠文件名猜职责。
- 如果某个文件已经不再是“组件”而更像“状态编排器”或“工具模块”，也建议在这里明确写出，减少误用。
- 像 `listAction.ts` 这类文件虽然不是 React 组件，但它位于组件目录内、直接服务于组件交互，因此也一并登记。
