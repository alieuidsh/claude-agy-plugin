# agy — 在 Claude Code 裡用 Google Antigravity

*[English](README.md)*

把 **agy CLI**(Google Antigravity)當成 Claude Code 裡的「第二個模型」來用 —— 它是
`codex` plugin 的 agy 版。你可以問問題、徵詢第二意見、審查 git diff,或把任務委派給
agy 處理(可允許它改檔),全程不用離開 Claude Code。

最值得一提的是:**agy 一個 CLI、一個帳號,就能呼叫 Gemini、Claude、GPT-OSS 三家的
模型**。這個 plugin 把這個能力整合進來 —— 每次呼叫都能自由選擇要用哪個模型,或設定
一個預設值。

> ⚠️ **非官方。** 這是社群 plugin,與 Google、Anthropic 無任何隸屬或背書關係。
> 「Antigravity」「Gemini」「Claude」「Codex」皆為各自所有者的商標。

---

## 你會得到什麼

| 指令 | 功能 |
|---|---|
| `/agy:ask` | 問 agy 一個問題(預設唯讀) |
| `/agy:research` | 請 agy 研究並綜整答案 |
| `/agy:rescue` | 將任務委派給 agy —— **agy 可以改檔案** |
| `/agy:review` | agy 審查你本機的 git diff(唯讀) |
| `/agy:adversarial-review` | 對 diff 做嚴格的對抗式審查(唯讀) |
| `/agy:model` | 看 / 設**預設**模型 |
| `/agy:models` | 列出帳號**所有**可用模型(Gemini / Claude / GPT-OSS) |
| `/agy:update` | 更新 agy CLI;順便刷新模型清單 |
| `/agy:setup` | 健康檢查 |
| `/agy:install` | 安裝 agy CLI(會先問) |
| `/agy:status` `/agy:result` `/agy:cancel` | 管理背景工作 |

---

## 需求

- **Claude Code**(這是它的 plugin)
- **Node.js 18+**(runtime 是 Node;`node-pty` 第一次執行時會自動安裝)
- **agy CLI**(Google Antigravity)。尚未安裝?執行 `/agy:install`(會先詢問),或至
  <https://antigravity.google> 手動安裝。安裝後請先在終端機執行一次 `agy` 完成登入。

---

## 安裝

```bash
# 在 Claude Code 裡:
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

接著:

```bash
/agy:setup     # 驗證 agy + node-pty + 登入;node-pty 第一次執行時會自動安裝
```

第一次驅動 agy 的指令可能需要等待 ~15–20 秒(一次性裝 node-pty + 抓一次模型清單,之後都有快取)。

---

## 運作原理(以及為什麼這樣做)

agy 1.0.x **只有在偵測到真實 console(TTY)時才會產生輸出** —— 直接以 headless 方式
呼叫 `spawn()` 不會得到任何輸出。所以這個 plugin 用 **`node-pty` 模擬一個 console
(ConPTY)** 來驅動 agy,讀取它的輸出、去除 ANSI/BOM 後再回傳答案。`node-pty` 在常見
的 Node/OS 組合上有預編譯 binary,第一次使用時會自動安裝(正常情況下不需要 C++
工具鏈)。

模型清單是即時從 agy 的互動 `/model` 選單抓出來快取的,key 用 agy 執行檔的指紋 ——
agy 更新後會自動重抓。

---

## 選模型

agy **沒有 `--model` 旗標**,所以這個 plugin 是透過暫時且安全地改寫
`~/.gemini/antigravity-cli/settings.json`、用完再還原,來達成選擇模型。整個過程有鎖
保護,而且是 **crash-safe** 的 —— 就算執行到一半被強制中斷,你的設定也不會損毀
(原值會被持久化保存,下次執行時自動還原)。

```bash
/agy:models                                  # 列出帳號可用的所有模型
/agy:model                                   # 看目前預設
/agy:model pro                               # 預設設成最強的 Gemini Pro
/agy:model flash                             # 預設設成 Gemini Flash(快、省)
/agy:model "Claude Opus 4.6 (Thinking)"      # 預設設成 Claude
/agy:ask --model flash  你的問題             # 單次覆寫(不改預設)
```

- **別名**(`pro`、`flash`,還有 `pro-low`、`flash-medium`…)**只給 Gemini**,而且
  追蹤即時清單,所以 `pro`/`flash` 會自動跟上最新的 Gemini 版本。
- **Claude / GPT-OSS** 需使用**完整 label** —— 從 `/agy:models` 複製。
- 預設存在 `~/.agy-jobs/config.json` —— 立即生效、跨 session、無需重啟終端機。單次
  `--model` 永遠優先於預設。
- 每次都會回報**實際使用的模型**(從 agy 自己的 log 讀取,而非依賴模型自己的回答
  —— 模型自述名稱通常不可靠)。

---

## 權限

- `ask` / `research` 預設**唯讀**;加 `--write` 才能改檔。
- `rescue` 預設**可寫**;加 `--read-only` 變成只給建議。
- `review` / `adversarial-review` **永遠唯讀** —— 要動手就用 `/agy:rescue`。
- 唯讀模式會帶 agy 的 `--sandbox`(終端機限制):agy 還能讀檔分析,但系統/終端副作用被擋住。

---

## ⚠️ 隱私 —— 請務必讀

agy 會把你的 prompt(以及 `review` 時的程式碼 diff)送到 **Google 的伺服器**。
**不要**拿來處理機密、憑證、私鑰、或不能給第三方看的未發表內容。把它當成任何雲端 AI
服務看待。

---

## 疑難排解

- **`/agy:setup` 顯示 `agy binary: NOT FOUND`** → 執行 `/agy:install`,或設環境變數
  `AGY_BIN` 指向 agy 執行檔。
- **`node-pty: UNAVAILABLE`** → 一次性自動安裝失敗;確認 Node.js + npm 在 PATH、有
  網路,再次執行 `/agy:setup`。
- **沒答案 / 認證錯誤** → 在終端機執行一次 `agy` 完成登入。
- **agy 更新後清單顯示為舊資料** → `/agy:models --refresh` 或 `/agy:update`。

失敗時請勿不斷重試 —— 先解決根因(登入、安裝、網路)。

---

## 授權

MIT。非官方;與 Google、Anthropic 無隸屬關係。
