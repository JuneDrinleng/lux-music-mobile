<!-- Lux Repository Notice: instructions for coding agents working in this repository. -->

# Agent 说明

改 UI、加页面、或调整现有界面的样式之前，先读 [docs/design-system.md](docs/design-system.md)，并按其中的颜色、字号、圆角、间距、布局、组件、图标、封面和文案实现。那份文档描述的是当前竖屏美化页的现状，不是一份待实现的新视觉。新代码的颜色从 `useLuxTheme()` 读取，不要再写十六进制色值。默认黄绿主题的色值不可改。

删除、隐藏或移动任何已经存在的界面时，在 PR 描述里单独列出每一处被删掉、被藏起来或被挪走的入口、按钮、文案或区域，并写上原因。不要只写在 commit message 里。

界面文案同时写入 `src/lang/zh-cn.json`、`src/lang/zh-tw.json`、`src/lang/en-us.json`。不要在这类改动里修改 `package.json` 的版本号。

新增或修改任何交互时，遵循并同步更新 [docs/interaction-spec.md](docs/interaction-spec.md)（软件交互规范）；页面过渡与返回行为复用其中指定的共享实现。

改播放详情页相关实现（PlayDetail、PlayerTransport、SeekBar、LyricPreview、顶栏、底部弹出页转场）前，先读 [播放详情页定稿规则（以 v0.5.3 为准，不可回退）](docs/design-system-magazine.md#播放详情页定稿规则以-v053-为准不可回退)。不得改回旧值；确需改动须先经 June 确认，并在 PR 描述中单独列出每项改动及原因，明确说明 June 已确认。

June 于 2026-11-10 已批准「歌词预览区恒定占位，切歌时布局不跳」：`Pic.tsx` 唱片预算无条件包含 `PLAYER_RESERVED_LYRIC=124`；实际歌词预览容器恒定保留完整 160 设计高度（含译 / 音操作行），无歌词 / 加载中留空且不可点击，有歌词时底部对齐。其它播放页定稿数值及断言不变。
