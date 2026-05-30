# claude-agy-plugin — Google Antigravity (Gemini) für Claude Code

**Sprachen:** [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · **Deutsch** · [Français](README.fr.md) · [Español](README.es.md) · [Italiano](README.it.md)

Ein Claude-Code-Plugin, mit dem Claude die lokale **`agy`**-CLI (Google Antigravity,
auf Gemini-Basis) aufruft, um Code zu reviewen, Aufgaben zu delegieren und eine
Zweitmeinung einzuholen — das **agy-Gegenstück zum offiziellen `codex`-Plugin**.

Plattformübergreifend: **Windows, Linux, macOS** (reiner Node-Companion, keine Shell-Wrapper).

## Befehle

| Befehl | Funktion | Standardrechte | codex-Entsprechung |
|---|---|---|---|
| `/agy:ask` | Einzelfrage an Gemini | nur lesen | — |
| `/agy:rescue` | Aufgabe/Fix delegieren (agy darf **Dateien ändern**) | **schreiben** | `/codex:rescue` |
| `/agy:research` | Recherchefrage | nur lesen | — |
| `/agy:review` | Lokalen git-diff reviewen | nur lesen | `/codex:review` |
| `/agy:adversarial-review` | Adversariales Review des diff | nur lesen | `/codex:adversarial-review` |
| `/agy:setup` | Health-Check: installiert + angemeldet? | — | `/codex:setup` |
| `/agy:status` | Aktuelle agy-Jobs auflisten | — | `/codex:status` |
| `/agy:result` | Ausgabe eines Jobs anzeigen | — | `/codex:result` |
| `/agy:cancel` | Laufende agy-Jobs abbrechen | — | `/codex:cancel` |

Du kannst auch einfach sagen „frag agy / gib mir eine Zweitmeinung / frag Gemini“ —
der mitgelieferte Skill wird automatisch ausgelöst.

### Rechte: sicherer Standard, du entscheidest

Wie bei codex hat jeder Befehl einen **sicheren Standard**, den du überschreiben kannst:

- `--write` — agy darf Dateien ändern (überschreibt einen Nur-Lesen-Standard)
- `--read-only` — keine Änderungen, nur Beratung (überschreibt einen Schreib-Standard)

So erlaubt `/agy:ask --write` Änderungen, und `/agy:rescue --read-only` lässt agy
nur beraten, ohne Dateien anzufassen.

## Voraussetzungen

1. **Node.js** (v18+). Prüfen: `node --version`.
2. **Die `agy`-CLI** (Google Antigravity), installiert und einmal angemeldet.
   - Windows-Standard: `%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS: `~/.agy/bin/agy` oder im `PATH`
   - Bei abweichendem Pfad die Umgebungsvariable `AGY_BIN` auf den vollen Pfad setzen.
   - Die Authentifizierung erfolgt still über den OS-Keyring. Bei Timeouts `agy`
     einmal interaktiv ausführen, um dich anzumelden.

Nach der Installation alles mit `/agy:setup` prüfen.

## Installation

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

Danach Claude Code neu starten und `/agy:setup` ausführen.

## Funktionsweise

`scripts/agy-companion.mjs` ruft `agy --print` mit der korrekten Flag-Reihenfolge auf,
wartet mit Timeout und extrahiert Geminis Antwort aus dem Transkript, das agy auf die
Festplatte schreibt (`agy --print` schreibt ins TTY, nicht nach stdout). Jeder Lauf
erhält einen Job-spezifischen Nonce, damit auch bei parallelen Läufen das richtige
Transkript gelesen wird, und alle Antwortsegmente werden zusammengefügt (agy stückelt
lange Antworten). Der Prompt wird über **stdin** übergeben, sodass kein Benutzertext
in die Shell-Befehlszeile gelangt (keine Injection). Jobs werden samt PID unter
`~/.agy-jobs` verfolgt, damit `/agy:status`, `/agy:result` und `/agy:cancel` über
Hintergrundläufe hinweg funktionieren und nur den gezielten Job abbrechen.

## Sicherheit & Datenschutz (bitte lesen)

- **Dein Code/deine Prompts werden an Google (Gemini) gesendet.** Achte auf sensible,
  medizinische oder unveröffentlichte Daten — dieselbe Überlegung wie bei jedem Cloud-Modell.
- **Schreibfähige Befehle ändern Dateien autonom.** `/agy:rescue` kann Dateien ohne
  Rückfrage ändern. Vorher `git commit`, damit du per `git diff` prüfen/zurücksetzen kannst.
- agy ist ein autonomer Agent: auch im Nur-Lesen-Modus kann er Shell-Befehle zur
  Erkundung ausführen. Nur-Lesen verhindert *Datei-Änderungen*, nicht jede Aktivität.

## Hinweise / Einschränkungen

- agy teilt sich eine ausführbare Datei über alle Jobs; `/agy:cancel` ohne id beendet
  alle laufenden Jobs (mit id nur den Prozessbaum dieses Jobs).
- Das Backend-Modell hängt von der agy-Konfiguration ab (Standard: Gemini),
  in `~/.gemini/antigravity-cli/settings.json`.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
