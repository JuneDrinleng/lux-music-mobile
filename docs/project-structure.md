# 项目结构说明

本文用于快速梳理 `lux-music-mobile` 当前目录结构，以及各核心模块的职责边界。

## 1. 根目录结构

```text
lux-music-mobile
├─ android/                Android 原生工程
├─ ios/                    iOS 原生工程
├─ assets/                 README 等对外展示资源
├─ doc/                    历史文档资源目录，当前主要放图片素材
├─ docs/                   当前补充的项目文档目录
├─ publish/                发布脚本相关
├─ src/                    React Native 主业务代码
├─ index.js                RN 入口文件
├─ app.json                应用配置
├─ package.json            依赖与脚本
├─ babel.config.js         Babel 配置
├─ metro.config.js         Metro 配置
├─ tsconfig.json           TypeScript 配置
└─ README.md               项目说明
```

补充说明：

- `doc/` 和 `docs/` 目前并存
- `doc/` 更像历史资源目录
- `docs/` 适合继续沉淀架构、开发约定、页面说明等文档

## 2. src 目录总览

`src/` 是项目核心，建议优先按下面的方式理解：

```text
src
├─ app.ts                  应用启动与初始化入口
├─ components/             通用组件、弹窗、播放器组件
├─ config/                 常量、默认设置、迁移配置
├─ core/                   核心业务逻辑
├─ event/                  全局事件系统
├─ lang/                   国际化资源
├─ navigation/             页面注册、导航封装、导航事件
├─ plugins/                播放器/同步等插件层能力
├─ resources/              字体、图片、媒体资源
├─ screens/                页面级组件
├─ store/                  状态管理
├─ theme/                  主题系统
├─ types/                  全局类型定义
└─ utils/                  通用工具、SDK、Native 封装
```

## 3. 各核心目录职责

### 3.1 `src/app.ts`

应用启动总入口，负责：

- 初始化日志与基础环境
- 加载字体大小、窗口尺寸等全局信息
- 调用 `src/core/init`
- 初始化导航并推入 `Home`

### 3.2 `src/navigation`

负责页面注册与导航行为封装。

关键文件：

- `registerScreens.tsx`
  统一注册所有 screen，并注入全局 `Provider`
- `navigation.ts`
  封装 `pushHomeScreen`、`pushPlayDetailScreen` 等导航函数
- `screenNames.ts`
  统一管理 screen name 常量
- `index.ts`
  导航初始化入口

适合放这里的内容：

- 页面注册
- 页面跳转
- 导航生命周期封装
- 导航动画

### 3.3 `src/screens`

页面级组件目录，按页面拆分。

当前主要页面：

```text
src/screens
├─ Home/
├─ PlayDetail/
├─ SonglistDetail/
├─ Comment/
└─ LeaderboardDetail/
```

其中：

- `Home/` 是项目主容器页面
- 其他目录基本属于二级页面或详情页

### 3.4 `src/components`

公共组件与跨页面复用组件。

大致可分为：

- `common/`
  最基础的通用 UI 组件，比如按钮、输入框、弹窗、图标、文本等
- `player/`
  播放器相关组件，如 `PlayerBar`、进度条等
- 业务组件
  如 `MusicAddModal`、`OnlineList`、`SearchTipList`、`MetadataEditModal`
- 全局宿主组件
  如 `AppDialogHost`、`PermissionPromptHost`

适合放这里的内容：

- 多页面复用组件
- 与页面解耦的业务组件
- 全局挂载组件

### 3.5 `src/core`

核心业务逻辑层，是页面与底层能力之间的主要桥梁。

主要能力包括：

- 初始化：`init/`
- 音乐数据：`music/`
- 播放控制：`player/`
- 搜索：`search/`
- 歌单：`songlist.ts`
- 榜单：`leaderboard.ts`
- 歌词：`lyric.ts`
- 同步：`sync.ts`
- 用户脚本接口：`userApi.ts`

适合放这里的内容：

- 页面无关的业务逻辑
- 数据读写和业务编排
- 对 store / utils / plugin 的组合调用

### 3.6 `src/store`

状态管理目录，按照业务域拆分。

当前能看到的状态域包括：

- `common`
- `list`
- `player`
- `search`
- `setting`
- `songlist`
- `leaderboard`
- `sync`
- `theme`
- `userApi`
- `version`

每个状态域通常包含：

- `state.ts`
- `action.ts`
- `hook.ts`
- 个别模块还会有 `event.ts`、`index.ts`

可以把它理解为：

- `state.ts` 管状态快照
- `action.ts` 改状态
- `hook.ts` 给 React 组件消费

### 3.7 `src/utils`

通用工具层，范围较广。

主要包括：

- 常用工具函数
- 文件与数据处理
- 日志与错误处理
- Hook 工具：`utils/hooks`
- 音源 SDK：`utils/musicSdk`
- Native Modules 封装：`utils/nativeModules`

这里是一个“底层支持目录”，很多模块都会依赖它。

### 3.8 `src/plugins`

插件层能力，目前重点包括：

- `player/`
- `sync/`
- `lyric.ts`
- `storage.ts`

它更像是和原生、后台服务、同步机制衔接的一层。

### 3.9 `src/config`

配置与常量目录。

包括：

- 常量
- 默认设置
- 全局配置
- 迁移逻辑

例如：

- 页面组件 id
- 底部导航菜单定义
- 默认搜索源 / 排行榜源
- 存储 key 前缀

### 3.10 `src/theme`

主题系统目录，负责：

- 色板
- 字体
- 主题生成
- 多主题配置

### 3.11 `src/lang`

国际化目录，包含：

- `zh-cn.json`
- `zh-tw.json`
- `en-us.json`
- i18n 初始化逻辑

### 3.12 `src/resources`

静态资源目录，主要有：

- `fonts/`
- `images/`
- `medias/`

### 3.13 `src/types`

全局类型定义目录，覆盖：

- 音乐
- 列表
- 播放器
- 同步
- 配置
- 主题
- 用户接口

## 4. Home 页面内部结构

`Home` 是项目最复杂的页面，建议单独理解。

```text
src/screens/Home
├─ index.tsx               Home 总入口
├─ Horizontal/             横屏布局
├─ Vertical/               竖屏布局
└─ Views/                  历史业务视图集合
```

### 4.1 `Horizontal/`

横屏布局容器，核心角色：

- `Aside.tsx` 左侧导航
- `Header.tsx` 顶部栏
- `Main.tsx` 主内容区

### 4.2 `Vertical/`

竖屏布局容器，核心角色：

- `Main.tsx` tab 容器
- `BottomNav.tsx` 底部导航
- `PlayQueueSheet.tsx` 播放队列抽屉
- `Tabs/` 当前主 tab（当前包括 `PlaylistTab.tsx`、`SettingsTab.tsx` 等）

### 4.3 `Views/`

保留了旧版核心业务视图：

```text
src/screens/Home/Views
├─ Search/
├─ SongList/
├─ Leaderboard/
├─ Mylist/
└─ Setting/
```

这说明项目当前处于重构过渡期：

- 首页入口已经简化
- 旧业务模块没有直接删除
- 仍可继续复用或逐步迁移

## 5. 推荐的理解顺序

新同学接手时，建议按下面顺序阅读：

1. `README.md`
2. `src/app.ts`
3. `src/navigation/`
4. `src/screens/Home/`
5. `src/screens/PlayDetail/`
6. `src/core/`
7. `src/store/`
8. `src/components/`

这样能先看清入口和页面，再下钻到业务逻辑和状态层。

## 6. 常见改动应该放哪里

如果后续继续开发，可以按这个原则落文件：

| 改动类型 | 推荐位置 |
| --- | --- |
| 新页面 | `src/screens/` |
| 公共 UI 组件 | `src/components/common/` |
| 播放器相关组件 | `src/components/player/` |
| 页面跳转与注册 | `src/navigation/` |
| 核心业务逻辑 | `src/core/` |
| 状态读写 | `src/store/` |
| 常量与默认配置 | `src/config/` |
| 工具方法 / Native 封装 | `src/utils/` |
| 主题与视觉配置 | `src/theme/` |
| 文档 | `docs/` |

## 7. 当前结构特征

从代码现状看，这个项目有几个明显特征：

- 基于 `React Native Navigation`，不是 `react-navigation`
- 页面层、状态层、业务逻辑层拆分得比较明确
- `Home` 页面承担了较多聚合职责
- 新 UI 重构代码和旧业务模块并存
- `core + store + utils + plugins` 共同构成业务底座

## 8. 一句话总结

这个项目的结构可以理解为：

- `screens` 负责页面
- `components` 负责复用 UI
- `navigation` 负责页面组织
- `store` 负责状态
- `core` 负责业务逻辑
- `utils/plugins` 负责底层支撑
- `docs` 负责沉淀文档
