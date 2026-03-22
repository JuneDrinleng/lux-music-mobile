<p align="center">
  <img width="180" src="./assets/img/whitebg.png" alt="Lux Music logo" />
</p>

<h1 align="center">Lux Music</h1>

<p align="center">基于 LX Music 构建的 UI 重构版音乐 App</p>

## 项目简介

`Lux Music` 是在 `LX Music Mobile` 基础上演进的一个 UI 重构版本。

命名里的 `Lux`，可以理解为“比 LX 多一点 UI”：
- 保留 LX Music 的核心能力与技术栈
- 在界面表现、交互细节、视觉体验上持续打磨

如果你是从 LX Music 迁移过来，可以把它理解为一个更偏重体验升级的分支项目。

## 与上游项目关系

- 上游项目：`LX Music Mobile`
- 本项目定位：基于上游代码进行 UI 重构与体验优化
- 感谢原作者及社区贡献者

上游仓库地址：<https://github.com/lyswhut/lx-music-mobile>

## 技术栈

- React Native `0.73.11`
- React `18.2.0`
- Redux（沿用上游架构）

## 平台支持

当前以 Android 平台为主。

## 开发环境

- Node.js `>= 18`
- npm `>= 8.5.2`
- React Native Android 开发环境（Android SDK / JDK 等）

建议先完成 React Native 官方环境配置：
<https://reactnative.dev/docs/set-up-your-environment>

## 快速开始

```bash
npm install
npm run dev
```

常用命令：

```bash
# 启动 Metro
npm run start

# 清理 Metro 缓存
npm run sc

# Android Release 打包
npm run pack:android

# Android 工程清理
npm run clear

# 代码检查
npm run lint
```

## 项目目标

本项目专注于在不偏离原有能力边界的前提下，持续推进以下方向：

- 更统一、现代的界面视觉
- 更顺滑、直观的交互体验
- 更清晰、易维护的 UI 代码结构

## 免责声明

本项目基于开源项目二次开发，仅用于技术学习与交流，请在遵守所在地法律法规与版权规则的前提下使用。

## 授权说明

- 本仓库主许可证为 [Apache-2.0](./LICENSE)。
- 上游及其派生部分可按 Apache-2.0 自由使用（包含商业使用）。
- 对于本项目可独立分离且明确标注为 `Lux Proprietary` 的原创内容，未经授权不得商用或再分发。
- 具体边界请查看 [LICENSE-NOTICE.md](./LICENSE-NOTICE.md)。
- 具体文件清单请查看 [PROPRIETARY_FILES.md](./PROPRIETARY_FILES.md)。

## License

本项目遵循 [Apache-2.0](./LICENSE) 开源协议。
