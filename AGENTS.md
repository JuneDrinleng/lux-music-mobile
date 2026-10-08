<!-- Lux Repository Notice: instructions for coding agents working in this repository. -->

# Agent 说明

改 UI、加页面、或调整现有界面的样式之前，先读 [docs/design-system.md](docs/design-system.md)，并按其中的颜色、字号、圆角、间距、布局、组件、图标、封面和文案实现。那份文档描述的是当前竖屏美化页的现状，不是一份待实现的新视觉。

删除、隐藏或移动任何已经存在的界面时，在 PR 描述里单独列出每一处被删掉、被藏起来或被挪走的入口、按钮、文案或区域，并写上原因。不要只写在 commit message 里。

界面文案同时写入 `src/lang/zh-cn.json`、`src/lang/zh-tw.json`、`src/lang/en-us.json`。不要在这类改动里修改 `package.json` 的版本号。
