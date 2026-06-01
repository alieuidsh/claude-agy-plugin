# agy — Google Antigravity für Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Nutze die **agy CLI** (Google Antigravity) als zweites Modell innerhalb von Claude Code — das
`agy`-Gegenstück zum `codex`-Plugin. Stelle Fragen, hole dir eine zweite Meinung ein, lass deinen
Diff überprüfen oder delegiere schreibfähige Aufgaben, alles ohne Claude Code zu verlassen.

Was es interessant macht: **agy kann Gemini-, Claude- *und* GPT-OSS-Modelle** hinter einer
einzigen CLI und einem einzigen Konto ausführen. Dieses Plugin macht das zugänglich — wähle bei
jedem Aufruf eines davon aus oder lege ein Standardmodell fest, direkt aus Claude Code heraus.

> ⚠️ **Inoffiziell.** Dies ist ein Community-Plugin und steht in keiner Verbindung zu
> Google oder Anthropic und wird von ihnen nicht unterstützt. „Antigravity", „Gemini", „Claude" und „Codex" gehören ihren
> jeweiligen Eigentümern.

---

## Was du bekommst

| Befehl | Was er tut |
|---|---|
| `/agy:ask` | Stelle agy eine einmalige Frage (standardmäßig schreibgeschützt) |
| `/agy:research` | Lass agy recherchieren und eine Antwort zusammenstellen |
| `/agy:rescue` | Delegiere eine Aufgabe/Korrektur — **agy darf Dateien bearbeiten** |
| `/agy:review` | agy überprüft deinen lokalen git-Diff (schreibgeschützt) |
| `/agy:adversarial-review` | Schonungslose, gegnerische Überprüfung deines Diffs (schreibgeschützt) |
| `/agy:model` | Zeige oder setze das **Standard**-Modell |
| `/agy:models` | Liste **alle** Modelle auf, die dein Konto nutzen kann (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Aktualisiere die agy CLI; erneuert die Modellliste |
| `/agy:setup` | Integritätsprüfung der Integration |
| `/agy:install` | Installiere die agy CLI (fragt zuerst nach) |
| `/agy:status` `/agy:result` `/agy:cancel` | Verwalte Hintergrundaufträge |

---

## Voraussetzungen

- **Claude Code** (dies ist ein Plugin dafür)
- **Node.js 18+** (die Laufzeitumgebung ist Node; `node-pty` wird beim ersten Start automatisch installiert)
- Die **agy CLI** (Google Antigravity). Hast du sie nicht? Führe `/agy:install` aus (es fragt
  zuerst nach) oder installiere sie manuell von <https://antigravity.google>. Führe nach der Installation
  einmal `agy` interaktiv aus, um dich anzumelden.

Getestet unter **Windows** und **Linux** (x86_64). macOS sollte funktionieren (gleiche Code-Pfade), ist aber
ungetestet. Siehe *Plattform-Hinweise* unten zum Linux/SSH-Vorbehalt.

---

## Installation

> **Siehst du den Befehl `/plugin` nicht?** Dein Claude Code ist zu alt — `/plugin` benötigt eine
> aktuelle Version (2.1.143+). Aktualisiere zuerst Claude Code (Store-App: Update über Microsoft
> Store / App Store; CLI: `claude update`) und starte es dann neu. Ein neues
> *Modell* wie Opus 4.8 nutzen zu können bedeutet **nicht**, dass deine App aktuell ist — Modelle kommen vom
> Server, das `/plugin`-Feature kommt von der App.

**Schritt 1 — Marketplace hinzufügen und installieren** (in Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Schritt 2 — die Befehle zum Erscheinen bringen. ⚠️ Dieser Schritt ist erforderlich, und genau hier
bleiben Leute stecken.** Neu installierte Befehle erscheinen **erst**, wenn du neu lädst oder neu startest:

- Führe **`/reload-plugins`** aus, **und**
- falls die `/agy:*`-Befehle immer noch nicht erscheinen (oder nach einem Plugin-*Update*),
  **beende Claude Code vollständig und öffne es erneut** (schließe das Fenster/die App komplett, nicht nur den
  Tab). Ein bloßes Neuladen reicht für brandneue Befehlsdateien manchmal nicht aus.

**Schritt 3 — Integritätsprüfung:**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

Der allererste `/agy:*`-Aufruf dauert ~15–20 s (einmalige node-pty-Installation + erstes Auslesen
der Modellliste). Das ist normal — danach ist es zwischengespeichert, spätere Aufrufe sind schnell.

Der erste Befehl, der agy ansteuert, kann ~15–20 s dauern (einmalige node-pty-Installation + ein Auslesen
der Modellliste, beides danach zwischengespeichert).

---

## Wie es funktioniert (und warum)

agy 1.0.x **erzeugt nur dann Ausgabe, wenn es eine echte Konsole (TTY) erkennt** — ein einfaches
headless `spawn()` liefert nichts. Daher steuert dieses Plugin agy innerhalb einer **synthetisierten
Konsole (ConPTY) via `node-pty`** an, liest dessen Ausgabe, entfernt ANSI/BOM und gibt die
Antwort zurück. `node-pty` liefert vorkompilierte Binärdateien für gängige Node/OS-Kombinationen und wird
beim ersten Gebrauch automatisch installiert (im Normalfall ist kein C++-Toolchain nötig).

Die Modellliste wird live aus agys interaktivem `/model`-Menü ausgelesen und zwischengespeichert, gekoppelt an
den Fingerabdruck der agy-Binärdatei — sie wird automatisch neu ausgelesen, wenn agy aktualisiert wird.

---

## Ein Modell auswählen

agy hat **kein `--model`-CLI-Flag**, daher wählt dieses Plugin ein Modell aus, indem es kurz und sicher
`~/.gemini/antigravity-cli/settings.json` umschreibt und anschließend wiederherstellt. Dies geschieht
unter einer Sperre und ist **absturzsicher** — deine Einstellungen bleiben niemals beschädigt zurück, selbst wenn ein
Lauf mittendrin abgebrochen wird (das Original wird gespeichert und vom nächsten Lauf wiederhergestellt).

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- **Aliase** (`pro`, `flash`, plus `pro-low`, `flash-medium`, …) sind **nur für Gemini** und
  folgen der Live-Liste, sodass `pro`/`flash` automatisch der neuesten Gemini-Stufe folgen.
- **Claude- / GPT-OSS**-Modelle benötigen die **vollständige Bezeichnung** — kopiere sie aus `/agy:models`.
- Das Standardmodell wird in `~/.agy-jobs/config.json` gespeichert — sofort, über Sitzungen hinweg beständig,
  kein Terminal-Neustart nötig. Ein `--model` pro Aufruf hat immer Vorrang vor dem Standard.
- Jeder Lauf meldet das **tatsächlich verwendete** Modell (gelesen aus agys eigenem Protokoll, nicht aus der
  Selbstauskunft des Modells — Modelle sind unzuverlässig darin, sich selbst zu benennen).

---

## Berechtigungen

- `ask` / `research` sind standardmäßig **schreibgeschützt**; füge `--write` hinzu, um Bearbeitungen zu erlauben.
- `rescue` ist standardmäßig **schreibfähig**; füge `--read-only` hinzu, nur für Ratschläge.
- `review` / `adversarial-review` sind **immer schreibgeschützt** — nutze `/agy:rescue`, um auf
  Erkenntnisse zu reagieren.
- Schreibgeschützte Läufe übergeben agys `--sandbox` (Terminal-Einschränkungen): agy kann Dateien weiterhin lesen und
  analysieren, aber System-/Terminal-Nebenwirkungen sind blockiert.

---

## Plattform-Hinweise

- **Windows / Linux** — vollständig getestet (Modellwechsel, Auslesen, absturzsichere Wiederherstellung funktionieren alle).
- **Linux + SSH-Falle**: agy speichert deine Anmeldung im Desktop-keyring, wenn du dich in einer
  grafischen Sitzung anmeldest, wechselt aber zu dateibasierten Tokens, sobald es eine SSH-Sitzung erkennt
  (`SSH_CONNECTION`). Die beiden teilen keinen Zustand, sodass das Ausführen des Plugins **über eine reine SSH-
  Verbindung** auf „Authentication required" stoßen kann, obwohl du auf dem
  Desktop angemeldet bist. Lösungen: Melde dich *innerhalb* der SSH-Sitzung an, **oder** führe es innerhalb einer `tmux`-/`screen`-
  Sitzung aus, die vom Desktop aus gestartet wurde (kein `SSH_CONNECTION` in ihrer Umgebung) —
  dann liest agy die Desktop-Anmeldung normal. Dies ist ein Verhalten der agy CLI, kein Plugin-Fehler.

---

## ⚠️ Datenschutz — lies das

agy sendet deine Prompts (und bei `review` deinen Code-Diff) an **Googles Server**. Verwende es
**nicht** für Geheimnisse, Anmeldedaten, private Schlüssel oder vertrauliche / unveröffentlichte Arbeit,
die du nicht mit Dritten teilen kannst. Behandle es wie jeden anderen Cloud-KI-Dienst.

---

## Fehlerbehebung

- **Befehl `/plugin` nicht gefunden** → dein Claude Code ist zu alt (unter 2.1.143). Aktualisiere
  die App und starte sie neu (siehe [Installation](#install)). Ein neues *Modell* nutzen zu können
  bedeutet nicht, dass die App aktuell ist.
- **Installiert, aber die `/agy:*`-Befehle erscheinen nicht** → führe **`/reload-plugins`** aus; falls
  sie immer noch nicht erscheinen, **beende Claude Code vollständig und öffne es erneut**. Neue Befehlsdateien benötigen ein
  Neuladen/einen Neustart, um geladen zu werden.
- **`/agy:setup` sagt `agy binary: NOT FOUND`** → führe `/agy:install` aus oder setze die
  Umgebungsvariable `AGY_BIN` auf den Pfad der agy-Programmdatei.
- **`node-pty: UNAVAILABLE`** → die einmalige automatische Installation ist fehlgeschlagen; stelle sicher, dass Node.js + npm
  im PATH sind und du Netzwerkzugang hast, und führe dann `/agy:setup` erneut aus.
- **Keine Antwort / Authentifizierungsfehler** → führe `agy` einmal interaktiv in einem Terminal aus, um dich anzumelden.
- **Modellliste wirkt nach einem agy-Update veraltet** → `/agy:models --refresh` oder `/agy:update`.

Versuche es bei einem Fehler nicht in einer Schleife erneut — behebe die zugrunde liegende Ursache (Authentifizierung, Installation, Netzwerk).

---

## Lizenz

MIT. Inoffiziell; steht in keiner Verbindung zu Google oder Anthropic.
