<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# 播放详情页定稿规则核对：第 6 条存在差异

核对日期：2026-11-02（北京时间）。基线：`origin/dev`，`a8005421`（v0.5.3-dev.23，含 #169）。

June 要求先逐条核对源码；若现有代码与定稿规则不符，停止并在 PR 中列出，不修改业务代码。本次发现第 6 条的两个边界未被实现保证，因此停止 A–D 的规则落地，不将预期行为写成已经实现的守护规则。下列数值只是本次核对记录。改动定稿值必须先经 June 确认。

## 六条核对结果

1. **底部弹出页：符合。** 播放详情、分享卡片预览、智能歌单编辑、导入流程从下往上进、向下退，不用二级页右进转场。`PlayDetailOverlay.tsx` 使用 `useBottomPopupTransition(screenHeight, 'player')`；三个任务页使用 `useBottomPopupTransition(height, 'modal', true)`。共享 `bottomPopupTransition.ts` 用 `[height, 0]` 的 translateY 插值，player 进入 420ms、退出 300ms；原生播放详情使用 translationY。来源：#158 曾误改，#162 起恢复；已有 `player-enter-animation` / `bottom-popup-pages` 测试保留。
2. **22A-v4 顶栏：符合。** `PlayerChrome.tsx` 的独立绝对定位 Tabs 层 left/right 为 0、居中，不受右侧按钮宽度影响；`TextTabs.tsx` 读取 `magType.tab.size=15`，播放顶栏 gap 20。`playerChromeLayout.ts` 比较半屏可用宽度与完整定时胶囊预算；`SleepTimerBtn.tsx` 在碰撞时只显示 `weather-night` 月亮，宽屏保留倒计时胶囊，`SleepTimerSheet.tsx` 保留倒计时。来源：#164；已有 `player-tabs-center` 测试保留。
3. **竖屏间距：符合。** `src/screens/PlayDetail/Vertical/Pic.tsx`：`flexGapSm` minHeight 24 / flexGrow 2；`flexGapRecord` minHeight 30 / flexGrow 1；`flexGapTitle` minHeight 18 / flexGrow 0；`flexGapLyric` minHeight 0 / flexGrow 0；四者 flexShrink 均为 0。剩余高度只分给唱片上下。来源：#165 / #168 / #169；已有 `player-vertical-spacing` 测试保留。
4. **唱片尺寸：符合。** 同一 `Pic.tsx` 的 `PLAYER_RESERVED_LYRIC=124`、`PLAYER_DISC_MIN=200`；歌词实际高度与唱片历史预留预算独立，三行歌词不再压缩唱片。来源：#167。
5. **进度条重叠：符合。** 仅 `Pic.tsx` 向 `PlayerTransport` 传 `seekOverlapTop={21}`，`Lyric.tsx` 不传；transport 默认 0，启用时 marginTop 为负参数值。SeekBar 触摸区高 44，轨道高 2，播放页滚动区 zIndex 2 高于 transport 的 1。设计基准下胶囊底到细线约 12，触摸区顶部约 13 优先让给胶囊/提示，这一条带不能拖动是 June 认可的取舍；歌词页保持原位置与外观。来源：#169。
6. **三行迷你歌词：主体符合，但“拖进度、从后台回来直接跳不动画”未被完整保证。** `LyricPreview.tsx` 保留上一句 / 当前句 / 下一句，邻句 14 号浅色、单行省略；当前句在中间固定槽位，19 号、800 字重、KaraokeLine 逐字高亮。邻句槽位 22 / 当前 28 / 邻句 22，缺行保留空字符串；翻译和罗马音按可用性各预留 18，行切换不改变高度。正常换句为 280ms cubic 缓出上滚与交叉淡入淡出、useNativeDriver=true；倒退、跨多句、替换歌词数组、active=false 时直接定位。来源：#166；已有 `player-lyric-3lines` 测试保留。两个差异见下文。

## 第 6 条的源码证据与复现

### 向前拖动恰好一句仍会动画

`src/components/lyric/LyricPreview.tsx:42` 的 shouldAnimate 只判断 active、before.active、歌词数组引用相同、`index === before.index + 1` 及两句存在。组件没有 seek 标志或拖动代次输入；`Pic.tsx:490` 只传 lines、index、active、onPress。`src/plugins/lyric.ts:121` 的歌词回调只提供 line/text，不区分换句来源。

复用现有 `scripts/player-lyric-3lines.src-test.mjs` 的内存 harness，在同一歌词数组、active=true 下先 render index=0，再 render index=1，观察到一个 `{ toValue: 1, duration: 280, easing: 'cubic', useNativeDriver: true }` 动画。自然换句与向前拖到相邻一句提供相同输入，组件无法区分。现有测试验证的是跨多句跳转，不是全部拖动场景。

### 从 App 后台返回没有独立的动画抑制条件

`src/screens/PlayDetail/index.tsx:87` 将 visible 传给 Vertical 的 active；`Vertical/index.tsx:130` 将 `active && pageIndex === 1` 传给 Pic；Pic 原样传给 LyricPreview。`Vertical/index.tsx:101` 的 AppState 监听只管理屏幕常亮，不更新 active 或重置动画。原生 appear/disappear 更新的 nativeActive 仅传给 backActive，用于返回处理。

因此组件内 before.active 不等于 App 前台状态。若后台期间索引恰好前进一句，仍满足 280ms 动画条件，不能保证“从后台回来直接跳不动画”。这是源码和输入层面的缺口，尚未进行手机后台切换实测。

## 后续范围

本次无业务代码改动，无界面入口、按钮、文案或区域的删除、隐藏或移动。没有新增或注册 `player-locked-rules.src-test.mjs`，没有修改 AGENTS.md、设计规范或交互规范的定稿条款；应先由 June 确认如何处理上述差异，再继续原定文档与守护测试任务。不能通过只检查 `useNativeDriver` / 三行结构便宣称第 6 条全部成立。
