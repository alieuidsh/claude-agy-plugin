# claude-agy-plugin — Claude Code で Google Antigravity (Gemini) を使う

**言語：** [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · **日本語** · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Italiano](README.it.md)

ローカルの **`agy`** CLI（Google Antigravity、Gemini ベース）を Claude から呼び出し、
コードレビュー・タスク委譲・セカンドオピニオンを得るための Claude Code プラグイン。
**公式 `codex` プラグインの agy 版**です。

クロスプラットフォーム：**Windows、Linux、macOS**（純粋な Node コンパニオン、シェル依存なし）。

## コマンド

| コマンド | 機能 | 既定の権限 | codex 相当 |
|---|---|---|---|
| `/agy:ask` | Gemini への単発質問 | 読み取り専用 | — |
| `/agy:rescue` | タスク/修正の委譲（agy が**ファイル編集**可） | **書き込み** | `/codex:rescue` |
| `/agy:research` | 調査型の質問 | 読み取り専用 | — |
| `/agy:review` | ローカル git diff のレビュー | 読み取り専用 | `/codex:review` |
| `/agy:adversarial-review` | diff の敵対的レビュー | 読み取り専用 | `/codex:adversarial-review` |
| `/agy:setup` | ヘルスチェック：導入・認証済みか | — | `/codex:setup` |
| `/agy:status` | 最近の agy ジョブ一覧 | — | `/codex:status` |
| `/agy:result` | ジョブの保存済み出力を表示 | — | `/codex:result` |
| `/agy:cancel` | 実行中の agy をキャンセル | — | `/codex:cancel` |

「agy に聞いて / セカンドオピニオンをくれ / Gemini に聞いて」と言うだけで、
同梱の skill が自動的に起動します。

### 権限：安全な既定値、選択はあなた

codex と同様、各コマンドには**安全な既定値**があり、いつでも上書きできます：

- `--write` — agy にファイル編集を許可（読み取り専用の既定を上書き）
- `--read-only` — 編集を禁止し助言のみ（書き込みの既定を上書き）

つまり `/agy:ask --write` で編集を許可し、`/agy:rescue --read-only` で編集せず助言のみにできます。

## 前提条件

1. **Node.js**（v18+）。確認：`node --version`。
2. **`agy` CLI**（Google Antigravity）がインストール済みで、一度サインインしていること。
   - **未インストール？** **`/agy:install`** を実行 —— プラグインが未インストールを検出し、
     （確認後）インストールします。または手動で：
     - Windows：`irm https://antigravity.google/cli/install.ps1 | iex`
     - macOS/Linux：`curl -fsSL https://antigravity.google/cli/install.sh | bash`
   - 別の場所にある場合は、環境変数 `AGY_BIN` にフルパスを設定。
   - インストール後、対話的に `agy` を一度実行して Google アカウントでサインイン。
   - Windows 既定：`%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS：`~/.agy/bin/agy` または `PATH` 上
   - 別の場所にある場合は、環境変数 `AGY_BIN` にフルパスを設定。
   - 認証は OS のキーリング経由でサイレントに行われます。呼び出しがタイムアウトする
     場合は、対話的に `agy` を一度実行してサインインしてください。

インストール後、`/agy:setup` ですべて整っているか確認します。

## インストール

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

その後 Claude Code を再起動し、`/agy:setup` を実行します。

## 更新

このプラグインは GitHub 経由で自動配布されるため、誰でも最新の修正を取得できます：

```
/plugin update agy
```

その後 Claude Code を再起動してください。（CLI 相当：`claude plugin update agy`。）
あるコマンドが「agy の transcript 形式を認識できない」と報告した場合、基盤の `agy`
CLI が変更されたことを意味します。上記の更新を実行すれば修正済みプラグインが入ります。

## 仕組み

`scripts/agy-companion.mjs` は正しいフラグ順序で `agy --print` を実行し、タイムアウト
付きで待機して、agy がディスクに書き出す transcript から Gemini の回答を抽出します
（`agy --print` は stdout ではなく TTY に書き込むため）。各実行にはジョブごとの nonce
が付与され、並行実行でも正しい transcript を読み取り、すべての回答セグメントを結合します
（agy は長い回答を分割します）。ユーザーのプロンプトは **stdin** で渡されるため、ユーザー
テキストがシェルのコマンドラインに到達することはありません（インジェクションなし）。
ジョブは PID とともに `~/.agy-jobs` に記録され、`/agy:status`・`/agy:result`・`/agy:cancel`
がバックグラウンド実行をまたいで機能し、対象ジョブのみをキャンセルします。

## セキュリティとプライバシー（必ずお読みください）

- **あなたのコード/プロンプトは Google（Gemini）に送信されます。** 機密・医療・未公開
  データには注意してください。クラウドモデル利用と同等の配慮が必要です。
- **書き込み可能なコマンドは自律的にファイルを編集します。** `/agy:rescue` は確認なしに
  ファイルを変更することがあります。先に `git commit` しておけば `git diff` で確認・復元できます。
- agy は自律エージェントです。読み取り専用でもシェルコマンドを実行して探索する場合が
  あります。読み取り専用はファイル「編集」を防ぐもので、すべての動作を防ぐものではありません。

## 注意・制限

- agy は全ジョブで単一の実行ファイルを共有します。`/agy:cancel` を id なしで実行すると
  実行中の全ジョブを終了します（id 付きなら対象ジョブのプロセスツリーのみ）。
- バックエンドモデルは agy の設定（既定は Gemini、`~/.gemini/antigravity-cli/settings.json`）に依存します。

## ライセンス

MIT —— [LICENSE](LICENSE) を参照。
