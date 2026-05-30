# claude-agy-plugin — 在 Claude Code 使用 Google Antigravity (Gemini)

**语言：** [English](README.md) · [繁體中文](README.zh-TW.md) · **简体中文** · [日本語](README.ja.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Italiano](README.it.md)

让 Claude 调用本机 **`agy`** CLI（Google Antigravity，Gemini 后端）来审查代码、
委派任务、提供第二意见的 Claude Code 插件 —— **官方 `codex` 插件的 agy 对应版**。

> **非官方社区插件。** 与 Google、Anthropic 无关。它依赖本机安装的 `agy` CLI，
> 并解析它写在磁盘上的 transcript 格式（这不是稳定的公开 API）—— 实际验证过的范围
> 见 [TEST_MATRIX.md](TEST_MATRIX.md)。

跨平台：**Windows、Linux、macOS**（纯 Node companion）。目前主要在 Windows 上测试；
路径检测涵盖常见的 Windows/macOS/Linux 配置，agy 装在别处可设 `AGY_BIN`。

## 命令

| 命令 | 功能 | 默认权限 | codex 对应 |
|---|---|---|---|
| `/agy:ask` | 向 Gemini 提一个问题 | 只读 | — |
| `/agy:rescue` | 委派任务/修复（agy 可**改文件**） | **可写** | `/codex:rescue` |
| `/agy:research` | 研究型问题 | 只读 | — |
| `/agy:review` | 审查本机 git diff | 只读 | `/codex:review` |
| `/agy:adversarial-review` | 对抗式审查 diff | 只读 | `/codex:adversarial-review` |
| `/agy:setup` | 健康检查：是否已装+登录 | — | `/codex:setup` |
| `/agy:status` | 列出近期 agy 任务 | — | `/codex:status` |
| `/agy:result` | 显示某任务的输出 | — | `/codex:result` |
| `/agy:cancel` | 取消运行中的 agy | — | `/codex:cancel` |

你也可以直接说「问问 agy / 给我第二意见 / 问 Gemini」，内置 skill 会自动触发。

### 权限：安全默认，由你决定

和 codex 一样，每个命令都有**安全默认**，你随时可覆盖：

- `--write` — 允许 agy 改文件（覆盖只读默认）
- `--read-only` — 禁止改文件、只给建议（覆盖可写默认）

所以 `/agy:ask --write` 能让 agy 改文件，`/agy:rescue --read-only` 则让它只给建议不动文件。

## 前置需求

1. **Node.js**（v18+）。确认：`node --version`。
2. **`agy` CLI**（Google Antigravity），已安装并登录过一次。
   - **没装？** 运行 **`/agy:install`** —— 插件会检测到没装并（询问后）帮你装。或手动装：
     - Windows：`irm https://antigravity.google/cli/install.ps1 | iex`
     - macOS/Linux：`curl -fsSL https://antigravity.google/cli/install.sh | bash`
   - 装在别处的话，设环境变量 `AGY_BIN` 指向完整路径。
   - 装完后运行一次交互式 `agy` 用 Google 账号登录。
   - Windows 默认：`%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS：`~/.agy/bin/agy` 或在 `PATH` 上
   - 装在别处的话，设环境变量 `AGY_BIN` 指向它的完整路径。
   - 认证通过操作系统 keyring 静默完成；若调用超时，运行一次交互式 `agy` 登录。

安装后用 `/agy:setup` 验证一切就绪。

## 安装

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

然后重启 Claude Code，执行 `/agy:setup`。

## 更新

这个插件通过 GitHub 自动分发，所以大家都能拉到最新修复：

```
/plugin update agy
```

然后重启 Claude Code。（CLI 等效命令：`claude plugin update agy`。）如果某个命令
报告「agy transcript 格式无法识别」，说明底层 `agy` CLI 改版了 —— 运行上面的更新就会
拿到修好的插件。

## 工作原理

`scripts/agy-companion.mjs` 用正确的标志顺序运行 `agy --print`，带超时等待，再从
agy 写到磁盘的 transcript 提取 Gemini 的答案（`agy --print` 写到 TTY 而非 stdout）。
每次运行带一个 per-job nonce，确保并行运行时也读到正确的 transcript，并拼接所有
答案片段（agy 会把长答案切段）。用户的 prompt 通过 **stdin** 传入，所以任何用户
文本都不会进到 shell 命令行（无注入风险）。任务连同 PID 记录在 `~/.agy-jobs`，让
`/agy:status`、`/agy:result`、`/agy:cancel` 跨后台运行也能工作，且只取消指定的任务。

## 安全与隐私（请务必阅读）

- **你的代码/prompt 会发送给 Google（Gemini）。** 涉及敏感、医疗或未发表数据时请留意
  —— 与使用任何云端模型同等级的考量。
- **可写命令会自主改文件。** `/agy:rescue` 可能不问就改文件。先 `git commit`，之后能用
  `git diff` 审查/还原。
- agy 是自主 agent：即使只读模式也可能执行 shell 命令探索。只读只挡「改文件」，不挡所有动作。

## 注意/限制

- agy 所有任务共用同一个可执行文件；`/agy:cancel` 不带 id 会杀掉所有运行中的任务（带 id
  则只杀该任务的进程树）。
- 后端模型取决于 agy 的设置（默认 Gemini），在 `~/.gemini/antigravity-cli/settings.json`。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。
