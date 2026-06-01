# agy — Google Antigravity per Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Usa la **CLI agy** (Google Antigravity) come secondo modello all'interno di Claude Code — la
controparte `agy` del plugin `codex`. Fai domande, ottieni una seconda opinione, esamina il tuo
diff o delega attività con capacità di scrittura, tutto senza uscire da Claude Code.

Ciò che lo rende interessante: **agy può eseguire modelli Gemini, Claude *e* GPT-OSS** dietro una
singola CLI e un singolo account. Questo plugin lo mette in evidenza — scegline uno qualsiasi a ogni chiamata, oppure imposta un
default, direttamente da Claude Code.

> ⚠️ **Non ufficiale.** Questo è un plugin della community, non affiliato né approvato da
> Google o Anthropic. "Antigravity", "Gemini", "Claude" e "Codex" appartengono ai rispettivi
> proprietari.

---

## Cosa ottieni

| Comando | Cosa fa |
|---|---|
| `/agy:ask` | Fai ad agy una domanda one-shot (read-only per impostazione predefinita) |
| `/agy:research` | Chiedi ad agy di fare ricerca e sintetizzare una risposta |
| `/agy:rescue` | Delega un'attività/correzione — **agy può modificare i file** |
| `/agy:review` | agy esamina il tuo git diff locale (read-only) |
| `/agy:adversarial-review` | Revisione avversariale spietata del tuo diff (read-only) |
| `/agy:model` | Mostra o imposta il modello **predefinito** |
| `/agy:models` | Elenca **tutti** i modelli utilizzabili dal tuo account (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Aggiorna la CLI agy; rigenera l'elenco dei modelli |
| `/agy:setup` | Verifica lo stato dell'integrazione |
| `/agy:install` | Installa la CLI agy (chiede prima conferma) |
| `/agy:status` `/agy:result` `/agy:cancel` | Gestisci i job in background |

---

## Requisiti

- **Claude Code** (questo è un plugin per esso)
- **Node.js 18+** (il runtime è Node; `node-pty` viene installato automaticamente alla prima esecuzione)
- La **CLI agy** (Google Antigravity). Non la hai? Esegui `/agy:install` (chiede
  prima conferma), oppure installala manualmente da <https://antigravity.google>. Dopo l'installazione, esegui
  `agy` una volta in modalità interattiva per accedere.

Testato su **Windows** e **Linux** (x86_64). macOS dovrebbe funzionare (stessi percorsi di codice) ma non è
testato. Vedi *Note sulle piattaforme* più sotto per l'avvertenza su Linux/SSH.

---

## Installazione

> **Non vedi il comando `/plugin`?** Il tuo Claude Code è troppo vecchio — `/plugin` richiede una
> versione recente (2.1.143+). Aggiorna prima Claude Code (app Store: aggiorna tramite Microsoft
> Store / App store; CLI: `claude update`), poi riavvialo. Poter usare un nuovo
> *modello* come Opus 4.8 **non** significa che la tua app sia aggiornata — i modelli provengono dal
> server, la funzionalità `/plugin` proviene dall'app.

**Passo 1 — aggiungi il marketplace e installa** (in Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Passo 2 — fai apparire i comandi. ⚠️ Questo passo è obbligatorio, ed è qui che la gente si
blocca.** I comandi appena installati **non** compaiono finché non ricarichi o riavvii:

- Esegui **`/reload-plugins`**, **e**
- se i comandi `/agy:*` continuano a non apparire (o dopo un *aggiornamento* del plugin),
  **chiudi completamente e riapri Claude Code** (chiudi del tutto la finestra/app, non solo la
  scheda). Talvolta un semplice ricaricamento non basta per i file di comando appena creati.

**Passo 3 — verifica dello stato:**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

La primissima chiamata `/agy:*` richiede ~15–20s (installazione una tantum di node-pty + primo scraping
dell'elenco dei modelli). È normale — dopo viene messo in cache, le chiamate successive sono veloci.

Il primo comando che pilota agy può richiedere ~15–20s (installazione una tantum di node-pty + uno scraping
dell'elenco dei modelli, entrambi poi messi in cache).

---

## Come funziona (e perché)

agy 1.0.x **produce output solo quando rileva una console reale (TTY)** — un semplice
`spawn()` headless non restituisce nulla. Perciò questo plugin pilota agy all'interno di una **console
sintetizzata (ConPTY) tramite `node-pty`**, ne legge l'output, rimuove ANSI/BOM e restituisce la
risposta. `node-pty` distribuisce binari precompilati per le combinazioni Node/OS più comuni ed è installato
automaticamente al primo utilizzo (nessun toolchain C++ necessario nel caso normale).

L'elenco dei modelli viene estratto in tempo reale dal menu interattivo `/model` di agy e messo in cache, indicizzato
sull'impronta del binario agy — viene riestratto automaticamente quando agy si aggiorna.

---

## Scegliere un modello

agy **non ha un flag CLI `--model`**, quindi questo plugin seleziona un modello riscrivendo brevemente e in modo sicuro
`~/.gemini/antigravity-cli/settings.json`, per poi ripristinarlo. Questo avviene
sotto lock ed è **a prova di crash** — le tue impostazioni non rimangono mai corrotte, anche se un'esecuzione
viene interrotta a metà (l'originale viene reso persistente e recuperato dall'esecuzione successiva).

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- Gli **alias** (`pro`, `flash`, più `pro-low`, `flash-medium`, …) sono **solo per Gemini** e
  seguono l'elenco in tempo reale, quindi `pro`/`flash` seguono automaticamente il più recente livello Gemini.
- I modelli **Claude / GPT-OSS** richiedono l'**etichetta completa** — copiala da `/agy:models`.
- Il default viene salvato in `~/.agy-jobs/config.json` — istantaneo, persiste tra le sessioni,
  nessun riavvio del terminale. Un `--model` per singola chiamata prevale sempre sul default.
- Ogni esecuzione riporta il modello **effettivamente usato** (letto dal log di agy stesso, non dall'autodichiarazione
  del modello — i modelli sono inaffidabili nel dare un nome a se stessi).

---

## Permessi

- `ask` / `research` sono **read-only** per impostazione predefinita; aggiungi `--write` per consentire modifiche.
- `rescue` è **abilitato alla scrittura** per impostazione predefinita; aggiungi `--read-only` per ottenere solo consigli.
- `review` / `adversarial-review` sono **sempre read-only** — usa `/agy:rescue` per agire sulle
  conclusioni.
- Le esecuzioni read-only passano il `--sandbox` di agy (restrizioni del terminale): agy può comunque leggere e
  analizzare i file, ma gli effetti collaterali su sistema/terminale sono bloccati.

---

## Note sulle piattaforme

- **Windows / Linux** — completamente testati (cambio modello, scraping e ripristino a prova di crash funzionano tutti).
- **Inconveniente Linux + SSH**: agy memorizza il login nel keyring del desktop quando accedi in
  una sessione grafica, ma passa a token su file quando rileva una sessione SSH
  (`SSH_CONNECTION`). I due non condividono lo stato, quindi eseguire il plugin **su una semplice connessione SSH**
  può generare "Authentication required" anche se hai effettuato l'accesso sul
  desktop. Soluzioni: accedi *all'interno* della sessione SSH, **oppure** esegui dentro una sessione `tmux`/`screen`
  avviata dal desktop (senza `SSH_CONNECTION` nel suo ambiente) —
  allora agy legge normalmente il login del desktop. Questo è un comportamento della CLI agy, non un bug del plugin.

---

## ⚠️ Privacy — leggi questo

agy invia i tuoi prompt (e, per `review`, il tuo code diff) ai **server di Google**. **Non**
usarlo su segreti, credenziali, chiavi private o lavoro riservato / non pubblicato
che non puoi condividere con terze parti. Trattalo come qualsiasi altro servizio AI cloud.

---

## Risoluzione dei problemi

- **Comando `/plugin` non trovato** → il tuo Claude Code è troppo vecchio (inferiore a 2.1.143). Aggiorna
  l'app e riavviala (vedi [Installazione](#installazione)). Poter usare un nuovo *modello* non
  significa che l'app sia aggiornata.
- **Installato, ma i comandi `/agy:*` non compaiono** → esegui **`/reload-plugins`**; se
  continuano a non apparire, **chiudi completamente e riapri** Claude Code. I nuovi file di comando hanno bisogno di un
  ricaricamento/riavvio per caricarsi.
- **`/agy:setup` dice `agy binary: NOT FOUND`** → esegui `/agy:install`, oppure imposta la variabile
  d'ambiente `AGY_BIN` sul percorso dell'eseguibile agy.
- **`node-pty: UNAVAILABLE`** → l'installazione automatica una tantum è fallita; assicurati che Node.js + npm
  siano nel PATH e di avere rete, poi riesegui `/agy:setup`.
- **Nessuna risposta / errore di autenticazione** → esegui `agy` una volta in modalità interattiva in un terminale per accedere.
- **L'elenco dei modelli sembra obsoleto dopo un aggiornamento di agy** → `/agy:models --refresh` oppure `/agy:update`.

Non riprovare in loop in caso di errore — risolvi la causa di fondo (autenticazione, installazione, rete).

---

## Licenza

MIT. Non ufficiale; non affiliato a Google o Anthropic.
