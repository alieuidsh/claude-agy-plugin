# claude-agy-plugin — Google Antigravity (Gemini) per Claude Code

**Lingue:** [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · **Italiano**

Un plugin per Claude Code che consente a Claude di chiamare la CLI locale **`agy`**
(Google Antigravity, basata su Gemini) per revisionare codice, delegare attività e
ottenere una seconda opinione — l'**equivalente agy del plugin ufficiale `codex`**.

Multipiattaforma: **Windows, Linux, macOS** (companion Node puro, senza wrapper di shell).

## Comandi

| Comando | Funzione | Permessi predefiniti | Equivalente codex |
|---|---|---|---|
| `/agy:ask` | Domanda singola a Gemini | sola lettura | — |
| `/agy:rescue` | Delegare attività/fix (agy può **modificare file**) | **scrittura** | `/codex:rescue` |
| `/agy:research` | Domanda di ricerca | sola lettura | — |
| `/agy:review` | Revisione del diff git locale | sola lettura | `/codex:review` |
| `/agy:adversarial-review` | Revisione avversariale del diff | sola lettura | `/codex:adversarial-review` |
| `/agy:setup` | Controllo: installato e autenticato? | — | `/codex:setup` |
| `/agy:status` | Elenca i job agy recenti | — | `/codex:status` |
| `/agy:result` | Mostra l'output di un job | — | `/codex:result` |
| `/agy:cancel` | Annulla i job agy in corso | — | `/codex:cancel` |

Puoi anche dire semplicemente «chiedi ad agy / dammi una seconda opinione / chiedi a
Gemini» e lo skill incluso si attiva automaticamente.

### Permessi: default sicuro, decidi tu

Come codex, ogni comando ha un **default sicuro** che puoi sovrascrivere:

- `--write` — consenti ad agy di modificare i file (sovrascrive un default in sola lettura)
- `--read-only` — vieta le modifiche, solo consigli (sovrascrive un default in scrittura)

Quindi `/agy:ask --write` consente le modifiche e `/agy:rescue --read-only` lo limita
ai consigli senza toccare i file.

## Prerequisiti

1. **Node.js** (v18+). Verifica: `node --version`.
2. **La CLI `agy`** (Google Antigravity), installata e con accesso effettuato una volta.
   - Predefinito Windows: `%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS: `~/.agy/bin/agy` oppure nel `PATH`
   - Se è altrove, imposta la variabile d'ambiente `AGY_BIN` con il percorso completo.
   - L'autenticazione avviene in modo silenzioso tramite il keyring del sistema. In
     caso di timeout, esegui `agy` una volta in modalità interattiva per accedere.

Dopo l'installazione, verifica tutto con `/agy:setup`.

## Installazione

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

Poi riavvia Claude Code ed esegui `/agy:setup`.

## Come funziona

`scripts/agy-companion.mjs` esegue `agy --print` con il corretto ordine dei flag,
attende con un timeout e poi estrae la risposta di Gemini dal transcript che agy
scrive su disco (`agy --print` scrive sul TTY, non su stdout). Ogni esecuzione riceve
un nonce specifico del job per leggere il transcript giusto anche con esecuzioni
parallele, e tutti i segmenti della risposta vengono uniti (agy spezza le risposte
lunghe). Il prompt dell'utente viene passato tramite **stdin**, perciò nessun testo
utente raggiunge la riga di comando della shell (niente injection). I job sono tracciati
con il loro PID in `~/.agy-jobs` così che `/agy:status`, `/agy:result` e `/agy:cancel`
funzionino tra esecuzioni in background e annullino solo il job indicato.

## Sicurezza e privacy (da leggere)

- **Il tuo codice/prompt vengono inviati a Google (Gemini).** Attenzione a dati
  sensibili, medici o non pubblicati — la stessa considerazione di qualsiasi modello cloud.
- **I comandi con scrittura modificano i file in autonomia.** `/agy:rescue` può cambiare
  i file senza chiedere. Fai prima `git commit` per poter verificare/annullare con `git diff`.
- agy è un agente autonomo: anche in sola lettura può eseguire comandi shell per
  esplorare. La sola lettura blocca la *modifica dei file*, non ogni attività.

## Note / limitazioni

- agy condivide un unico eseguibile tra i job; `/agy:cancel` senza id termina tutti i
  job in corso (con un id, solo l'albero dei processi di quel job).
- Il modello backend dipende dalla configurazione di agy (predefinito Gemini),
  in `~/.gemini/antigravity-cli/settings.json`.

## Licenza

MIT — vedi [LICENSE](LICENSE).
