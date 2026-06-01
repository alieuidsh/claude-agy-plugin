# agy — 在 Claude Code 中使用 Google Antigravity

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

在 Claude Code 中把 **agy CLI**（Google Antigravity）当作第二个模型来用——它是 `codex` 插件的
`agy` 对应版本。提问、获取第二意见、审查你的
diff，或委派具备写入能力的任务，全部都不必离开 Claude Code。

它有意思的地方在于：**agy 可以在单一 CLI 和账户背后运行 Gemini、Claude *以及* GPT-OSS 模型**。
本插件把这一点呈现出来——每次调用都能挑选其中任意一个，或者直接在 Claude Code 里设定一个
默认模型。

> ⚠️ **非官方。** 这是一个社区插件，与
> Google 或 Anthropic 无关，也未获其背书。“Antigravity”、“Gemini”、“Claude”和“Codex”均归各自
> 所有者所有。

---

## 你能得到什么

| 命令 | 作用 |
|---|---|
| `/agy:ask` | 向 agy 提出一次性问题（默认只读） |
| `/agy:research` | 让 agy 研究并综合出一个答案 |
| `/agy:rescue` | 委派一个任务／修复——**agy 可能会编辑文件** |
| `/agy:review` | agy 审查你本地的 git diff（只读） |
| `/agy:adversarial-review` | 对你的 diff 进行无情的对抗式审查（只读） |
| `/agy:model` | 显示或设定**默认**模型 |
| `/agy:models` | 列出你账户可用的**所有**模型（Gemini / Claude / GPT-OSS） |
| `/agy:update` | 更新 agy CLI；并刷新模型列表 |
| `/agy:setup` | 对集成做健康检查 |
| `/agy:install` | 安装 agy CLI（会先询问） |
| `/agy:status` `/agy:result` `/agy:cancel` | 管理后台任务 |

---

## 系统要求

- **Claude Code**（这是给它用的插件）
- **Node.js 18+**（运行时是 Node；`node-pty` 会在首次运行时自动安装）
- **agy CLI**（Google Antigravity）。还没有？运行 `/agy:install`（它会先
  询问），或从 <https://antigravity.google> 手动安装。安装后，先
  以交互方式运行一次 `agy` 来登录。

已在 **Windows** 和 **Linux**（x86_64）上测试。macOS 应该也能用（代码路径相同）但
未经测试。Linux/SSH 相关的注意事项见下方的 *平台说明*。

---

## 安装

> **看不到 `/plugin` 命令？** 你的 Claude Code 太旧了——`/plugin` 需要
> 较新的版本（2.1.143+）。请先更新 Claude Code（Store 应用：通过 Microsoft
> Store / App store 更新；CLI：`claude update`），然后重启它。能够使用像
> Opus 4.8 这样的新*模型*并**不**代表你的应用是最新的——模型来自
> 服务器，而 `/plugin` 功能来自应用本身。

**第 1 步——添加 marketplace 并安装**（在 Claude Code 中）：

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**第 2 步——让命令出现。⚠️ 这一步是必需的，也是大家最容易卡住的地方。**
新安装的命令在你重新加载或重启之前**不会**显示出来：

- 运行 **`/reload-plugins`**，**并且**
- 如果 `/agy:*` 命令仍然没有出现（或在插件*更新*之后），
  **完全退出并重新打开 Claude Code**（彻底关闭窗口／应用，而不只是
  标签页）。对于全新的命令文件，单靠重新加载有时并不够。

**第 3 步——健康检查：**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

第一次调用 `/agy:*` 大约需要 15–20 秒（一次性的 node-pty 安装 + 首次模型列表
抓取）。这是正常的——之后会被缓存，后续调用就很快了。

第一个驱动 agy 的命令可能需要约 15–20 秒（一次性的 node-pty 安装 + 一次模型
列表抓取，两者之后都会被缓存）。

---

## 工作原理（以及为什么这么做）

agy 1.0.x **只有在检测到真实控制台（TTY）时才会产生输出**——纯粹的
无头 `spawn()` 什么都得不到。所以本插件在一个**经由 `node-pty` 合成的
控制台（ConPTY）**中驱动 agy，读取它的输出，剥离 ANSI/BOM，再返回
答案。`node-pty` 为常见的 Node/OS 组合提供了预编译的二进制文件，并会在首次使用时
自动安装（通常情况下无需 C++ 工具链）。

模型列表是从 agy 交互式的 `/model` 菜单实时抓取并缓存的，以 agy
二进制文件的指纹作为键——当 agy 更新时，它会自动重新抓取。

---

## 选择模型

agy **没有 `--model` CLI 旗标**，所以本插件是通过短暂且安全地
改写 `~/.gemini/antigravity-cli/settings.json` 再将其还原来选择模型。这是
在锁的保护下进行的，并且是**崩溃安全的**——即使某次运行在中途被
杀掉，你的设置也绝不会被损坏（原始内容会被持久化，并由下一次运行恢复）。

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- **别名**（`pro`、`flash`，外加 `pro-low`、`flash-medium`……）**仅适用于 Gemini**，
  并会跟随实时列表，因此 `pro`/`flash` 会自动跟进最新的 Gemini 层级。
- **Claude / GPT-OSS** 模型需要**完整标签**——请从 `/agy:models` 复制。
- 默认值会保存到 `~/.agy-jobs/config.json`——即时生效，跨会话保留，
  无需重启终端。单次调用的 `--model` 始终优先于默认值。
- 每次运行都会报告**实际使用**的模型（读取自 agy 自己的日志，而非模型的
  自我报告——模型在为自己命名这件事上并不可靠）。

---

## 权限

- `ask` / `research` 默认是**只读**的；加上 `--write` 即可允许编辑。
- `rescue` 默认**具备写入能力**；加上 `--read-only` 则只提供建议。
- `review` / `adversarial-review` **始终只读**——若要据审查结果采取行动，请使用
  `/agy:rescue`。
- 只读运行会传入 agy 的 `--sandbox`（终端限制）：agy 仍可读取并
  分析文件，但系统／终端层面的副作用会被阻止。

---

## 平台说明

- **Windows / Linux**——已完整测试（模型切换、抓取、崩溃安全还原全都可用）。
- **Linux + SSH 的坑**：当你在图形界面会话中登录时，agy 会把登录信息存进桌面
  keyring，但当它检测到 SSH 会话（`SSH_CONNECTION`）时则会改用基于文件的令牌。
  两者并不共享状态，因此**在裸 SSH 连接上**运行本插件可能会遇到
  “Authentication required”，即便你在桌面上已经登录。解决办法：在 SSH 会话*内部*
  登录，**或者**在一个从桌面启动的 `tmux`/`screen`
  会话中运行（其环境里没有 `SSH_CONNECTION`）——这样 agy 就能正常读取桌面登录信息。
  这是 agy CLI 的行为，并非插件的 bug。

---

## ⚠️ 隐私——请务必阅读

agy 会把你的提示词（以及在 `review` 时，你的代码 diff）发送到 **Google 的服务器**。
**不要**在涉及机密、凭证、私钥，或你无法与第三方共享的保密／未公开工作上使用它。
请把它当作任何其他云端 AI 服务来对待。

---

## 故障排除

- **找不到 `/plugin` 命令** → 你的 Claude Code 太旧（低于 2.1.143）。更新
  应用并重启它（见 [安装](#安装)）。能够使用新*模型*并不
  代表应用是最新的。
- **已安装，但 `/agy:*` 命令没有显示出来** → 运行 **`/reload-plugins`**；如果
  仍未出现，则**完全退出并重新打开** Claude Code。新的命令文件需要一次
  重新加载／重启才能加载。
- **`/agy:setup` 提示 `agy binary: NOT FOUND`** → 运行 `/agy:install`，或将
  `AGY_BIN` 环境变量设为 agy 可执行文件的路径。
- **`node-pty: UNAVAILABLE`** → 一次性的自动安装失败了；请确保 Node.js + npm
  在 PATH 上且有网络，然后重新运行 `/agy:setup`。
- **没有答案／认证错误** → 在终端里以交互方式运行一次 `agy` 来登录。
- **agy 更新后模型列表看起来过时了** → `/agy:models --refresh` 或 `/agy:update`。

不要在失败时循环重试——请解决根本原因（认证、安装、网络）。

---

## 许可证

MIT。非官方；与 Google 或 Anthropic 无关。
