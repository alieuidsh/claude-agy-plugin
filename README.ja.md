# agy — Claude Code で Google Antigravity を使う

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

**agy CLI**（Google Antigravity）を Claude Code 内で 2 つめのモデルとして使えます。これは `codex` プラグインに対応する `agy` 版です。Claude Code を離れることなく、質問したり、セカンドオピニオンを得たり、diff をレビューしたり、書き込み権限のあるタスクを委譲したりできます。

何が面白いかというと、**agy は Gemini、Claude、*そして* GPT-OSS の各モデルを** 単一の CLI とアカウントで動かせる点です。このプラグインはその機能を引き出します。Claude Code からそのまま、呼び出しごとに任意のモデルを選んだり、デフォルトを設定したりできます。

> ⚠️ **非公式。** これはコミュニティ製プラグインであり、Google や Anthropic と提携している、またはそれらに承認されているものではありません。「Antigravity」「Gemini」「Claude」「Codex」はそれぞれの所有者に帰属します。

---

## 何ができるか

| コマンド | 機能 |
|---|---|
| `/agy:ask` | agy に単発の質問をする（デフォルトは読み取り専用） |
| `/agy:research` | agy に調査と回答の統合を依頼する |
| `/agy:rescue` | タスク／修正を委譲する — **agy がファイルを編集する場合があります** |
| `/agy:review` | agy がローカルの git diff をレビューする（読み取り専用） |
| `/agy:adversarial-review` | あなたの diff を容赦なく敵対的にレビューする（読み取り専用） |
| `/agy:model` | **デフォルト** モデルを表示または設定する |
| `/agy:models` | アカウントで使える **すべて** のモデルを一覧表示する（Gemini / Claude / GPT-OSS） |
| `/agy:update` | agy CLI を更新する。モデル一覧も更新される |
| `/agy:setup` | 連携のヘルスチェックを行う |
| `/agy:install` | agy CLI をインストールする（事前に確認します） |
| `/agy:status` `/agy:result` `/agy:cancel` | バックグラウンドジョブを管理する |

---

## 必要条件

- **Claude Code**（本プラグインはその拡張です）
- **Node.js 18+**（ランタイムは Node です。`node-pty` は初回実行時に自動インストールされます）
- **agy CLI**（Google Antigravity）。お持ちでない場合は `/agy:install` を実行する（事前に確認します）か、<https://antigravity.google> から手動でインストールしてください。インストール後、一度 `agy` を対話的に実行してサインインしてください。

**Windows** と **Linux**（x86_64）でテスト済みです。macOS も動作するはずですが（同じコードパスを通ります）、未テストです。Linux/SSH に関する注意点は後述の *プラットフォームに関する注意* を参照してください。

---

## インストール

> **`/plugin` コマンドが見当たらない？** お使いの Claude Code が古すぎます。`/plugin` には新しいバージョン（2.1.143+）が必要です。まず Claude Code を更新し（ストアアプリ: Microsoft Store / App Store から更新、CLI: `claude update`）、再起動してください。Opus 4.8 のような新しい *モデル* が使えるからといって、アプリが最新であるとは限りません。モデルはサーバーから提供され、`/plugin` 機能はアプリから提供されます。

**ステップ 1 — マーケットプレイスを追加してインストールする**（Claude Code 内で）:

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**ステップ 2 — コマンドを表示させる。⚠️ このステップは必須で、多くの人がつまずくところです。** 新しくインストールしたコマンドは、リロードまたは再起動するまで **表示されません**:

- **`/reload-plugins`** を実行する。**さらに**
- それでも `/agy:*` コマンドが表示されない場合（またはプラグインの *更新* 後）は、**Claude Code を完全に終了して再度開いてください**（タブだけでなく、ウィンドウ／アプリを完全に閉じてください）。リロードだけでは、できたばかりのコマンドファイルには不十分なことがあります。

**ステップ 3 — ヘルスチェック:**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

ごく最初の `/agy:*` 呼び出しには約 15〜20 秒かかります（node-pty の一度きりのインストールと、最初のモデル一覧の取得）。これは正常です。その後はキャッシュされ、以降の呼び出しは高速です。

agy を動かす最初のコマンドは約 15〜20 秒かかることがあります（node-pty の一度きりのインストールとモデル一覧の取得。どちらも以降はキャッシュされます）。

---

## 仕組み（とその理由）

agy 1.0.x は **本物のコンソール（TTY）を検出したときのみ出力を生成します** — 素のヘッドレスな `spawn()` では何も得られません。そこで本プラグインは、agy を **`node-pty` 経由で合成したコンソール（ConPTY）** 内で動かし、その出力を読み取り、ANSI/BOM を取り除いて回答を返します。`node-pty` は一般的な Node/OS の組み合わせ向けにビルド済みバイナリを同梱しており、初回使用時に自動でインストールされます（通常のケースでは C++ ツールチェーンは不要です）。

モデル一覧は agy の対話的な `/model` メニューからライブで取得され、agy バイナリのフィンガープリントをキーにキャッシュされます。agy が更新されると自動的に再取得されます。

---

## モデルを選ぶ

agy には **`--model` という CLI フラグがありません**。そこで本プラグインは、`~/.gemini/antigravity-cli/settings.json` を短時間かつ安全に書き換えてモデルを選択し、その後に元へ復元します。これはロックの下で行われ、**クラッシュに強い** 設計です。実行が途中で強制終了されても、設定が壊れたまま残ることはありません（元の内容は永続化され、次回の実行で復元されます）。

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- **エイリアス**（`pro`、`flash`、さらに `pro-low`、`flash-medium` など）は **Gemini 専用** で、ライブの一覧に追従します。そのため `pro`/`flash` は最新の Gemini ティアを自動的に追いかけます。
- **Claude / GPT-OSS** モデルには **完全なラベル** が必要です。`/agy:models` からコピーしてください。
- デフォルトは `~/.agy-jobs/config.json` に保存されます。即時に反映され、セッションをまたいで保持され、ターミナルの再起動も不要です。呼び出しごとの `--model` は常にデフォルトより優先されます。
- 各実行は **実際に使用された** モデルを報告します（モデル自身の申告ではなく、agy 自身のログから読み取ります。モデルは自分の名前を正しく言えないことが多いためです）。

---

## 権限

- `ask` / `research` はデフォルトで **読み取り専用** です。編集を許可するには `--write` を付けてください。
- `rescue` はデフォルトで **書き込み可能** です。助言のみにするには `--read-only` を付けてください。
- `review` / `adversarial-review` は **常に読み取り専用** です。指摘事項に対処するには `/agy:rescue` を使ってください。
- 読み取り専用の実行では agy の `--sandbox`（ターミナル制限）が渡されます。agy はファイルの読み取りと解析は引き続き行えますが、システム／ターミナルへの副作用はブロックされます。

---

## プラットフォームに関する注意

- **Windows / Linux** — 完全にテスト済みです（モデル切り替え、取得、クラッシュ耐性のある復元、すべて動作します）。
- **Linux + SSH の落とし穴**: agy は、グラフィカルセッションでサインインするとログイン情報をデスクトップの keyring に保存しますが、SSH セッション（`SSH_CONNECTION`）を検出するとファイルベースのトークンに切り替えます。この 2 つは状態を共有しないため、**素の SSH 接続上で** プラグインを実行すると、デスクトップ側ではログイン済みであっても「Authentication required」になることがあります。対処法: SSH セッション *内で* サインインする、**または** デスクトップから起動した `tmux`/`screen` セッション内で実行する（その環境には `SSH_CONNECTION` がありません）。そうすれば agy はデスクトップのログイン情報を正常に読み取ります。これは agy CLI の挙動であり、プラグインのバグではありません。

---

## ⚠️ プライバシー — 必ずお読みください

agy はあなたのプロンプト（および `review` の場合はコードの diff）を **Google のサーバー** に送信します。第三者と共有できない秘密情報、認証情報、秘密鍵、機密／未公開の作業物に対しては、**使用しないでください**。ほかのクラウド AI サービスと同様に扱ってください。

---

## トラブルシューティング

- **`/plugin` コマンドが見つからない** → お使いの Claude Code が古すぎます（2.1.143 未満）。アプリを更新して再起動してください（[インストール](#インストール) を参照）。新しい *モデル* が使えても、アプリが最新であるとは限りません。
- **インストールしたのに `/agy:*` コマンドが表示されない** → **`/reload-plugins`** を実行してください。それでも表示されない場合は、Claude Code を **完全に終了して再度開いて** ください。新しいコマンドファイルを読み込むにはリロード／再起動が必要です。
- **`/agy:setup` が `agy binary: NOT FOUND` と表示する** → `/agy:install` を実行するか、`AGY_BIN` 環境変数に agy 実行ファイルのパスを設定してください。
- **`node-pty: UNAVAILABLE`** → 一度きりの自動インストールが失敗しています。Node.js + npm が PATH 上にあり、ネットワークに接続できることを確認してから、`/agy:setup` を再実行してください。
- **回答がない／認証エラー** → ターミナルで一度 `agy` を対話的に実行してサインインしてください。
- **agy の更新後にモデル一覧が古く見える** → `/agy:models --refresh` または `/agy:update` を実行してください。

失敗してもループでリトライしないでください。根本原因（認証、インストール、ネットワーク）を解消してください。

---

## ライセンス

MIT。非公式であり、Google や Anthropic と提携していません。
