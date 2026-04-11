# Lux Music 授权与使用声明

<!-- Lux Repository Notice: repository-specific licensing and compliance documentation. See this file for scope. -->

最后更新：2026-04-11

本仓库基于上游项目 `LX Music Mobile`（Apache-2.0）进行二次开发。为避免歧义，授权边界说明如下：

## 1. 上游及其派生部分

- 凡是来自上游项目的代码、文件，及其修改/派生内容，继续遵循 `Apache-2.0`。
- 对该部分内容，任何人可在满足 Apache-2.0 条款前提下使用、修改、分发与商业使用。
- 本声明不试图撤销或限制 Apache-2.0 已授予的权利。

## 2. Lux Music 独立原创部分

- 仅对可独立分离、且不构成上游代码派生的原创内容，Lux Music 维护者保留全部权利。
- 该类内容若未经书面授权，不得用于商业用途，不得二次分发或用于闭源再发布。
- 该类内容需在文件头、目录说明或提交说明中被明确标注为 `Lux Proprietary`（或同等含义标记）。
- 已声明为 `Lux Proprietary` 的文件路径，以 `PROPRIETARY_FILES.md` 为准。

## 3. 文件标记约定

- 对于与上游同路径文件相比已在本仓库修改的源码、配置或文档文件，可在文件头使用类似如下标记：
  `Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0.`
- 上述“Modified by Lux Music ... Apache-2.0”标记仅用于说明文件来源与许可证状态，不表示该文件为 `Lux Proprietary`，也不应登记到 `PROPRIETARY_FILES.md`。
- 对于本仓库可独立分离的原创源码、配置或文档文件，可在文件头使用类似如下标记：
  `Lux Proprietary: repository-original source file.`
- 标记为 `Lux Proprietary` 的原创文件，应同时登记到 `PROPRIETARY_FILES.md`。
- 对于仓库级授权/合规说明文档（例如本文件与 `PROPRIETARY_FILES.md`），可在文件头使用类似 `Lux Repository Notice` 的说明性标记。除非另行登记到 `PROPRIETARY_FILES.md`，否则不视为 `Lux Proprietary`。
- 对于本仓库维护的第三方依赖补丁文件，可在文件头使用类似如下标记：
  `Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license.`
- 上述 `Lux Third-Party Patch Notice` 仅用于说明这类文件由本仓库维护，但其权利边界仍受对应第三方许可证约束，不视为 `Lux Proprietary`，也不登记到 `PROPRIETARY_FILES.md`。

## 4. 无法内嵌文件头标记的机器文件

- 对于 `json` 等不适合直接内嵌注释的机器文件，可通过本节按路径登记其等效标记状态。

| 路径 | 等效标记 | 说明 |
| --- | --- | --- |
| `app.json` | `Modified by Lux Music ... Apache-2.0` | 上游应用配置文件的派生修改版 |
| `package.json` | `Modified by Lux Music ... Apache-2.0` | 上游项目配置文件的派生修改版 |
| `package-lock.json` | `Modified by Lux Music ... Apache-2.0` | 上游锁文件的派生修改版 |
| `publish/version.json` | `Modified by Lux Music ... Apache-2.0` | 上游发布配置文件的派生修改版 |
| `src/lang/en-us.json` | `Modified by Lux Music ... Apache-2.0` | 上游多语言文件的派生修改版 |
| `src/lang/zh-cn.json` | `Modified by Lux Music ... Apache-2.0` | 上游多语言文件的派生修改版 |
| `src/lang/zh-tw.json` | `Modified by Lux Music ... Apache-2.0` | 上游多语言文件的派生修改版 |

## 5. 未标注内容的默认规则

- 若文件/目录未被明确标注为 `Lux Proprietary`，默认按仓库主许可证 `Apache-2.0` 处理。

## 6. 第三方依赖

- 仓库中第三方依赖与资源（包括 `node_modules`、SDK、字体、图片等）按其各自许可证执行。

## 7. 冲突处理

- 如本声明与适用开源许可证发生冲突，以对应开源许可证条款为准。

---

如需商业授权，请联系本项目维护者。
