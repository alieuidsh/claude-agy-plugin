# claude-agy-plugin — 在 Claude Code 使用 Google Antigravity (Gemini)

**語言：** [English](README.md) · **繁體中文** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Italiano](README.it.md)

讓 Claude 呼叫本機 **`agy`** CLI（Google Antigravity，Gemini 後端）來審查程式碼、
委派任務、提供第二意見的 Claude Code plugin —— **官方 `codex` plugin 的 agy 對應版**。

跨平台：**Windows、Linux、macOS**（純 Node companion，不依賴特定 shell）。

## 指令

| 指令 | 功能 | 預設權限 | codex 對應 |
|---|---|---|---|
| `/agy:ask` | 向 Gemini 提一個問題 | 唯讀 | — |
| `/agy:rescue` | 委派任務/修正（agy 可**改檔**） | **可寫** | `/codex:rescue` |
| `/agy:research` | 研究型問題 | 唯讀 | — |
| `/agy:review` | 審查本機 git diff | 唯讀 | `/codex:review` |
| `/agy:adversarial-review` | 對抗式審查 diff | 唯讀 | `/codex:adversarial-review` |
| `/agy:setup` | 健檢：是否已裝+登入 | — | `/codex:setup` |
| `/agy:status` | 列出近期 agy 工作 | — | `/codex:status` |
| `/agy:result` | 顯示某工作的輸出 | — | `/codex:result` |
| `/agy:cancel` | 取消執行中的 agy | — | `/codex:cancel` |

你也可以直接說「問問 agy / 給我第二意見 / 問 Gemini」，內建 skill 會自動觸發。

### 權限：安全預設，由你決定

跟 codex 一樣，每個指令都有**安全預設**，你隨時可覆蓋：

- `--write` — 允許 agy 改檔（覆蓋唯讀預設）
- `--read-only` — 禁止改檔、只給建議（覆蓋可寫預設）

所以 `/agy:ask --write` 能讓 agy 改檔，`/agy:rescue --read-only` 則讓它只給建議不動檔。

## 前置需求

1. **Node.js**（v18+）。確認：`node --version`。
2. **`agy` CLI**（Google Antigravity），已安裝並登入過一次。
   - Windows 預設：`%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS：`~/.agy/bin/agy` 或在 `PATH` 上
   - 裝在別處的話，設環境變數 `AGY_BIN` 指向它的完整路徑。
   - 認證透過作業系統 keyring 靜默完成；若呼叫逾時，跑一次互動式 `agy` 登入。

安裝後用 `/agy:setup` 驗證一切就緒。

## 安裝

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

然後重啟 Claude Code，執行 `/agy:setup`。

## 更新

這個 plugin 透過 GitHub 自動散佈，所以大家都能拉到最新修正：

```
/plugin update agy
```

然後重啟 Claude Code。（CLI 等效指令：`claude plugin update agy`。）如果某個指令
回報「agy transcript 格式無法辨識」，代表底層 `agy` CLI 改版了 —— 跑上面的更新就會
拿到修好的 plugin。

## 運作原理

`scripts/agy-companion.mjs` 用正確的旗標順序跑 `agy --print`，帶逾時等待，再從
agy 寫到磁碟的 transcript 抽出 Gemini 的答案（`agy --print` 寫到 TTY 而非 stdout）。
每次執行帶一個 per-job nonce，確保平行執行時也讀到正確的 transcript，並串接所有
答案片段（agy 會把長答案切段）。使用者的 prompt 透過 **stdin** 傳入，所以任何使用者
文字都不會進到 shell 指令列（無注入風險）。工作連同 PID 記錄在 `~/.agy-jobs`，讓
`/agy:status`、`/agy:result`、`/agy:cancel` 跨背景執行也能運作，且只取消指定的工作。

## 安全與隱私（請務必閱讀）

- **你的程式碼/prompt 會傳送給 Google（Gemini）。** 涉及敏感、醫療或未發表資料時請留意
  —— 與使用任何雲端模型同等級的考量。
- **可寫指令會自主改檔。** `/agy:rescue` 可能不問就改檔。先 `git commit`，之後能用
  `git diff` 審查/還原。
- agy 是自主 agent：即使唯讀模式也可能執行 shell 指令探索。唯讀只擋「改檔」，不擋所有動作。

## 注意/限制

- agy 全部工作共用同一個執行檔；`/agy:cancel` 不帶 id 會殺掉所有執行中的工作（帶 id
  則只殺該工作的程序樹）。
- 後端模型取決於 agy 的設定（預設 Gemini），在 `~/.gemini/antigravity-cli/settings.json`。

## 授權

MIT —— 見 [LICENSE](LICENSE)。
