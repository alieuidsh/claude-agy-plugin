# agy — Claude Code에서 Google Antigravity 사용하기

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

**agy CLI**(Google Antigravity)를 Claude Code 안에서 두 번째 모델로 사용하세요 — `codex` 플러그인에 대응하는 `agy` 버전입니다. Claude Code를 벗어나지 않고 질문하고, 의견을 한 번 더 받고, diff를 리뷰하고, 쓰기 권한이 필요한 작업을 위임할 수 있습니다.

흥미로운 점: **agy는 하나의 CLI와 계정 뒤에서 Gemini, Claude, *그리고* GPT-OSS 모델을 실행할 수 있습니다.** 이 플러그인이 그 기능을 드러내 줍니다 — 호출마다 원하는 모델을 고르거나, 기본값을 설정할 수 있으며, 모두 Claude Code에서 바로 처리됩니다.

> ⚠️ **비공식.** 이것은 커뮤니티 플러그인이며, Google이나 Anthropic과 제휴하거나 그들의 승인을 받은 것이 아닙니다. "Antigravity", "Gemini", "Claude", "Codex"는 각각의 소유자에게 귀속됩니다.

---

## 제공 기능

| 명령어 | 기능 |
|---|---|
| `/agy:ask` | agy에게 일회성 질문하기(기본값은 읽기 전용) |
| `/agy:research` | agy에게 조사하여 답변을 종합하도록 요청 |
| `/agy:rescue` | 작업/수정 위임 — **agy가 파일을 편집할 수 있음** |
| `/agy:review` | agy가 로컬 git diff를 리뷰(읽기 전용) |
| `/agy:adversarial-review` | diff에 대한 가차 없는 적대적 리뷰(읽기 전용) |
| `/agy:model` | **기본** 모델 표시 또는 설정 |
| `/agy:models` | 계정에서 사용 가능한 **모든** 모델 나열(Gemini / Claude / GPT-OSS) |
| `/agy:update` | agy CLI 업데이트; 모델 목록 새로 고침 |
| `/agy:setup` | 통합 상태 점검 |
| `/agy:install` | agy CLI 설치(먼저 확인함) |
| `/agy:status` `/agy:result` `/agy:cancel` | 백그라운드 작업 관리 |

---

## 요구 사항

- **Claude Code** (이것은 그 플러그인입니다)
- **Node.js 18+** (런타임은 Node이며, `node-pty`는 최초 실행 시 자동 설치됩니다)
- **agy CLI** (Google Antigravity). 없으신가요? `/agy:install`을 실행하거나(먼저 확인함), <https://antigravity.google> 에서 수동으로 설치하세요. 설치 후 `agy`를 한 번 대화형으로 실행하여 로그인하세요.

**Windows**와 **Linux**(x86_64)에서 테스트되었습니다. macOS도 동작할 것으로 보이지만(동일한 코드 경로) 테스트되지 않았습니다. Linux/SSH 관련 주의 사항은 아래 *플랫폼 참고 사항*을 확인하세요.

---

## 설치

> **`/plugin` 명령어가 보이지 않나요?** Claude Code가 너무 오래되었습니다 — `/plugin`은 최신 버전(2.1.143+)이 필요합니다. 먼저 Claude Code를 업데이트하고(Store 앱: Microsoft Store / App store를 통해 업데이트, CLI: `claude update`) 다시 시작하세요. Opus 4.8 같은 새 *모델*을 사용할 수 있다고 해서 앱이 최신이라는 뜻은 **아닙니다** — 모델은 서버에서 오고, `/plugin` 기능은 앱에서 옵니다.

**1단계 — 마켓플레이스 추가 및 설치**(Claude Code에서):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**2단계 — 명령어가 나타나게 하기. ⚠️ 이 단계는 필수이며, 사람들이 막히는 지점입니다.** 새로 설치된 명령어는 다시 로드하거나 재시작하기 전까지는 **나타나지 않습니다**:

- **`/reload-plugins`**를 실행하고, **그리고**
- 그래도 `/agy:*` 명령어가 나타나지 않으면(또는 플러그인 *업데이트* 후에는) **Claude Code를 완전히 종료했다가 다시 여세요**(탭만 닫지 말고 창/앱을 완전히 닫으세요). 새로 추가된 명령어 파일에는 다시 로드만으로는 충분하지 않을 때가 있습니다.

**3단계 — 상태 점검:**

```bash
/agy:setup     # agy + node-pty + 인증 확인; 최초 실행 시 node-pty 자동 설치
```

맨 처음 `/agy:*` 호출은 약 15~20초 걸립니다(일회성 node-pty 설치 + 최초 모델 목록 스크랩). 이는 정상이며 — 이후에는 캐시되어 나중 호출은 빠릅니다.

agy를 구동하는 첫 명령어는 약 15~20초 걸릴 수 있습니다(일회성 node-pty 설치 + 모델 목록 스크랩, 둘 다 이후에는 캐시됨).

---

## 동작 방식(그리고 그 이유)

agy 1.0.x는 **실제 콘솔(TTY)을 감지할 때만 출력을 생성합니다** — 단순한 헤드리스 `spawn()`은 아무것도 내놓지 않습니다. 그래서 이 플러그인은 agy를 **`node-pty`를 통한 합성 콘솔(ConPTY)** 안에서 구동하고, 출력을 읽고, ANSI/BOM을 제거한 뒤 답변을 반환합니다. `node-pty`는 일반적인 Node/OS 조합에 대해 사전 빌드된 바이너리를 제공하며 최초 사용 시 자동으로 설치됩니다(일반적인 경우 C++ 툴체인이 필요 없음).

모델 목록은 agy의 대화형 `/model` 메뉴에서 실시간으로 스크랩되어 agy 바이너리의 지문(fingerprint)을 키로 하여 캐시되며 — agy가 업데이트되면 자동으로 다시 스크랩합니다.

---

## 모델 선택

agy에는 **`--model` CLI 플래그가 없으므로**, 이 플러그인은 `~/.gemini/antigravity-cli/settings.json`을 짧고 안전하게 다시 쓴 다음 복원하는 방식으로 모델을 선택합니다. 이 작업은 잠금(lock) 아래에서 수행되며 **크래시에 안전합니다** — 실행이 도중에 강제 종료되더라도 설정이 손상된 채로 남지 않습니다(원본이 보존되며 다음 실행에서 복구됩니다).

```bash
/agy:models                                  # 계정에서 실행 가능한 모든 것 보기
/agy:model                                   # 현재 기본값 표시
/agy:model pro                               # 기본값을 가장 강력한 Gemini Pro로 설정
/agy:model flash                             # 기본값을 Gemini Flash로 설정(빠르고 저렴)
/agy:model "Claude Opus 4.6 (Thinking)"      # 기본값을 Claude 모델로 설정
/agy:ask --model flash  your question        # 일회성 재정의(기본값을 바꾸지 않음)
```

- **별칭**(`pro`, `flash`, 그리고 `pro-low`, `flash-medium`, …)은 **Gemini 전용**이며 실시간 목록을 따라가므로, `pro`/`flash`는 가장 최신 Gemini 등급을 자동으로 따라갑니다.
- **Claude / GPT-OSS** 모델은 **전체 레이블**이 필요합니다 — `/agy:models`에서 복사하세요.
- 기본값은 `~/.agy-jobs/config.json`에 저장됩니다 — 즉시 적용되고, 세션 간에 유지되며, 터미널 재시작이 필요 없습니다. 호출별 `--model`은 항상 기본값보다 우선합니다.
- 매 실행은 **실제로 사용된** 모델을 보고합니다(모델의 자체 보고가 아니라 agy 자체 로그에서 읽음 — 모델은 자기 이름을 대는 데 신뢰할 수 없습니다).

---

## 권한

- `ask` / `research`는 기본값이 **읽기 전용**입니다; 편집을 허용하려면 `--write`를 추가하세요.
- `rescue`는 기본값이 **쓰기 가능**입니다; 조언만 받으려면 `--read-only`를 추가하세요.
- `review` / `adversarial-review`는 **항상 읽기 전용**입니다 — 발견된 사항에 따라 조치하려면 `/agy:rescue`를 사용하세요.
- 읽기 전용 실행은 agy의 `--sandbox`(터미널 제한)를 전달합니다: agy는 여전히 파일을 읽고 분석할 수 있지만, 시스템/터미널 부수 효과는 차단됩니다.

---

## 플랫폼 참고 사항

- **Windows / Linux** — 완전히 테스트됨(모델 전환, 스크랩, 크래시 안전 복원 모두 동작).
- **Linux + SSH 함정**: agy는 그래픽 세션에서 로그인하면 로그인 정보를 데스크톱 keyring에 저장하지만, SSH 세션을 감지하면(`SSH_CONNECTION`) 파일 기반 토큰으로 전환합니다. 둘은 상태를 공유하지 않으므로, **순수한 SSH 연결로** 플러그인을 실행하면 데스크톱에서 로그인되어 있어도 "Authentication required"가 발생할 수 있습니다. 해결책: SSH 세션 *안에서* 로그인하거나, **또는** 데스크톱에서 시작된 `tmux`/`screen` 세션 안에서 실행하세요(그 환경에는 `SSH_CONNECTION`이 없음) — 그러면 agy가 데스크톱 로그인을 정상적으로 읽습니다. 이것은 agy CLI의 동작이지 플러그인 버그가 아닙니다.

---

## ⚠️ 개인정보 — 반드시 읽어 주세요

agy는 여러분의 프롬프트(그리고 `review`의 경우 코드 diff)를 **Google 서버**로 전송합니다. 제3자와 공유할 수 없는 비밀 정보, 자격 증명, 개인 키, 또는 기밀/미공개 작업에는 사용하지 **마세요**. 다른 클라우드 AI 서비스와 똑같이 취급하세요.

---

## 문제 해결

- **`/plugin` 명령어를 찾을 수 없음** → Claude Code가 너무 오래되었습니다(2.1.143 미만). 앱을 업데이트하고 재시작하세요([설치](#설치) 참조). 새 *모델*을 사용할 수 있다고 해서 앱이 최신이라는 뜻은 아닙니다.
- **설치했지만 `/agy:*` 명령어가 나타나지 않음** → **`/reload-plugins`**를 실행하세요; 그래도 나타나지 않으면 Claude Code를 **완전히 종료했다가 다시 여세요**. 새 명령어 파일은 로드를 위해 다시 로드/재시작이 필요합니다.
- **`/agy:setup`이 `agy binary: NOT FOUND`라고 표시함** → `/agy:install`을 실행하거나, `AGY_BIN` 환경 변수를 agy 실행 파일 경로로 설정하세요.
- **`node-pty: UNAVAILABLE`** → 일회성 자동 설치가 실패했습니다; Node.js + npm이 PATH에 있고 네트워크가 연결되어 있는지 확인한 다음 `/agy:setup`을 다시 실행하세요.
- **답변 없음 / 인증 오류** → 터미널에서 `agy`를 한 번 대화형으로 실행하여 로그인하세요.
- **agy 업데이트 후 모델 목록이 오래된 것처럼 보임** → `/agy:models --refresh` 또는 `/agy:update`.

실패 시 반복 재시도하지 마세요 — 근본 원인(인증, 설치, 네트워크)을 해결하세요.

---

## 라이선스

MIT. 비공식이며, Google이나 Anthropic과 제휴하지 않았습니다.
