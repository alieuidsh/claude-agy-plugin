# agy — Google Antigravity voor Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Gebruik de **agy CLI** (Google Antigravity) als tweede model binnen Claude Code — de
`agy`-tegenhanger van de `codex`-plugin. Stel vragen, vraag een second opinion, laat je
diff reviewen of delegeer taken met schrijfrechten, allemaal zonder Claude Code te verlaten.

Wat het interessant maakt: **agy kan Gemini-, Claude- *en* GPT-OSS-modellen draaien** achter
één CLI en account. Deze plugin maakt dat zichtbaar — kies er per oproep een, of stel een
standaard in, rechtstreeks vanuit Claude Code.

> ⚠️ **Niet-officieel.** Dit is een communityplugin, niet verbonden met of onderschreven door
> Google of Anthropic. "Antigravity", "Gemini", "Claude" en "Codex" behoren toe aan hun
> respectieve eigenaren.

---

## Wat je krijgt

| Commando | Wat het doet |
|---|---|
| `/agy:ask` | Stel agy een eenmalige vraag (standaard alleen-lezen) |
| `/agy:research` | Vraag agy om onderzoek te doen en een antwoord samen te stellen |
| `/agy:rescue` | Delegeer een taak/fix — **agy mag bestanden bewerken** |
| `/agy:review` | agy reviewt je lokale git-diff (alleen-lezen) |
| `/agy:adversarial-review` | Meedogenloze adversariële review van je diff (alleen-lezen) |
| `/agy:model` | Toon of stel het **standaardmodel** in |
| `/agy:models` | Lijst **alle** modellen die je account kan gebruiken (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Werk de agy CLI bij; vernieuwt de modellijst |
| `/agy:setup` | Controleer de gezondheid van de integratie |
| `/agy:install` | Installeer de agy CLI (vraagt eerst) |
| `/agy:status` `/agy:result` `/agy:cancel` | Beheer achtergrondtaken |

---

## Vereisten

- **Claude Code** (dit is een plugin daarvoor)
- **Node.js 18+** (de runtime is Node; `node-pty` wordt bij de eerste run automatisch geïnstalleerd)
- De **agy CLI** (Google Antigravity). Heb je die niet? Voer `/agy:install` uit (vraagt
  eerst), of installeer handmatig vanaf <https://antigravity.google>. Voer na de installatie
  `agy` één keer interactief uit om in te loggen.

Getest op **Windows** en **Linux** (x86_64). macOS zou moeten werken (dezelfde codepaden) maar
is ongetest. Zie *Platformnotities* hieronder voor het Linux/SSH-voorbehoud.

---

## Installatie

> **Zie je het `/plugin`-commando niet?** Je Claude Code is te oud — `/plugin` vereist een
> recente versie (2.1.143+). Werk eerst Claude Code bij (Store-app: bijwerken via Microsoft
> Store / App Store; CLI: `claude update`) en herstart het. Een nieuw *model* zoals Opus 4.8
> kunnen gebruiken betekent **niet** dat je app up-to-date is — modellen komen van de server,
> de `/plugin`-functie komt van de app.

**Stap 1 — voeg de marketplace toe en installeer** (in Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Stap 2 — laat de commando's verschijnen. ⚠️ Deze stap is vereist, en hier lopen mensen vast.**
Nieuw geïnstalleerde commando's verschijnen **niet** totdat je herlaadt of herstart:

- Voer **`/reload-plugins`** uit, **en**
- als de `/agy:*`-commando's nog steeds niet verschijnen (of na een plugin-*update*),
  **sluit Claude Code volledig af en open het opnieuw** (sluit het venster/de app helemaal,
  niet alleen het tabblad). Een herlaad alleen is soms niet genoeg voor gloednieuwe
  commandobestanden.

**Stap 3 — gezondheidscontrole:**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

De allereerste `/agy:*`-oproep duurt ~15–20s (eenmalige node-pty-installatie + eerste scrape
van de modellijst). Dat is normaal — het wordt daarna gecachet, latere oproepen zijn snel.

Het eerste commando dat agy aanstuurt kan ~15–20s duren (eenmalige node-pty-installatie + een
scrape van de modellijst, beide daarna gecachet).

---

## Hoe het werkt (en waarom)

agy 1.0.x **produceert alleen output wanneer het een echte console (TTY) detecteert** — een
gewone headless `spawn()` levert niets op. Daarom stuurt deze plugin agy aan binnen een
**gesynthetiseerde console (ConPTY) via `node-pty`**, leest de output uit, verwijdert ANSI/BOM,
en geeft het antwoord terug. `node-pty` levert voorgebouwde binaries voor gangbare Node/OS-
combinaties en wordt bij het eerste gebruik automatisch geïnstalleerd (in het normale geval is
geen C++-toolchain nodig).

De modellijst wordt live gescrapet uit agy's interactieve `/model`-menu en gecachet, met als
sleutel de vingerafdruk van de agy-binary — het scrapet automatisch opnieuw wanneer agy bijwerkt.

---

## Een model kiezen

agy heeft **geen `--model` CLI-vlag**, dus deze plugin selecteert een model door kort en veilig
`~/.gemini/antigravity-cli/settings.json` te herschrijven en het daarna te herstellen. Dit
gebeurt onder een lock en is **crash-veilig** — je instellingen blijven nooit corrupt achter,
zelfs als een run halverwege wordt afgebroken (het origineel wordt bewaard en door de volgende
run hersteld).

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- **Aliassen** (`pro`, `flash`, plus `pro-low`, `flash-medium`, …) zijn **alleen voor Gemini**
  en volgen de live lijst, dus `pro`/`flash` volgen automatisch de nieuwste Gemini-tier.
- **Claude / GPT-OSS**-modellen vereisen het **volledige label** — kopieer het uit `/agy:models`.
- De standaard wordt opgeslagen in `~/.agy-jobs/config.json` — direct, blijft behouden tussen
  sessies, geen herstart van de terminal nodig. Een `--model` per oproep wint altijd van de
  standaard.
- Elke run rapporteert het model dat **daadwerkelijk werd gebruikt** (uitgelezen uit agy's eigen
  log, niet uit wat het model zelf rapporteert — modellen zijn onbetrouwbaar in het benoemen van
  zichzelf).

---

## Rechten

- `ask` / `research` zijn standaard **alleen-lezen**; voeg `--write` toe om bewerkingen toe te staan.
- `rescue` heeft standaard **schrijfrechten**; voeg `--read-only` toe voor alleen advies.
- `review` / `adversarial-review` zijn **altijd alleen-lezen** — gebruik `/agy:rescue` om naar
  aanleiding van bevindingen te handelen.
- Alleen-lezen runs geven agy's `--sandbox` mee (terminalbeperkingen): agy kan nog steeds
  bestanden lezen en analyseren, maar systeem-/terminal-neveneffecten worden geblokkeerd.

---

## Platformnotities

- **Windows / Linux** — volledig getest (modellen wisselen, scrape, crash-veilig herstel werken allemaal).
- **Linux + SSH-valkuil**: agy slaat je login op in de desktop-keyring wanneer je inlogt in een
  grafische sessie, maar schakelt over op bestandsgebaseerde tokens wanneer het een SSH-sessie
  detecteert (`SSH_CONNECTION`). Die twee delen geen status, dus het draaien van de plugin **over
  een kale SSH-verbinding** kan op "Authentication required" stuiten, ook al ben je op de desktop
  ingelogd. Oplossingen: log in *binnen* de SSH-sessie, **of** draai binnen een `tmux`/`screen`-
  sessie die vanaf de desktop is gestart (zonder `SSH_CONNECTION` in zijn omgeving) — dan leest
  agy de desktop-login normaal uit. Dit is gedrag van de agy CLI, geen bug in de plugin.

---

## ⚠️ Privacy — lees dit

agy stuurt je prompts (en, voor `review`, je code-diff) naar **Google's servers**. Gebruik het
**niet** voor geheimen, inloggegevens, privésleutels, of vertrouwelijk / ongepubliceerd werk dat
je niet met een derde partij mag delen. Behandel het zoals elke andere cloud-AI-dienst.

---

## Problemen oplossen

- **`/plugin`-commando niet gevonden** → je Claude Code is te oud (onder 2.1.143). Werk de app
  bij en herstart het (zie [Installatie](#installatie)). Een nieuw *model* kunnen gebruiken
  betekent niet dat de app up-to-date is.
- **Geïnstalleerd, maar de `/agy:*`-commando's verschijnen niet** → voer **`/reload-plugins`**
  uit; als ze nog steeds niet verschijnen, **sluit Claude Code volledig af en open het opnieuw**.
  Nieuwe commandobestanden hebben een herlaad/herstart nodig om te laden.
- **`/agy:setup` zegt `agy binary: NOT FOUND`** → voer `/agy:install` uit, of stel de
  `AGY_BIN`-omgevingsvariabele in op het pad van het agy-uitvoerbare bestand.
- **`node-pty: UNAVAILABLE`** → de eenmalige automatische installatie is mislukt; zorg dat
  Node.js + npm op het PATH staan en je netwerk hebt, en voer dan `/agy:setup` opnieuw uit.
- **Geen antwoord / authenticatiefout** → voer `agy` één keer interactief in een terminal uit om
  in te loggen.
- **Modellijst lijkt verouderd na een agy-update** → `/agy:models --refresh` of `/agy:update`.

Blijf bij een fout niet in een lus opnieuw proberen — los de onderliggende oorzaak op (auth,
installatie, netwerk).

---

## Licentie

MIT. Niet-officieel; niet verbonden met Google of Anthropic.
