# claude-agy-plugin — Google Antigravity (Gemini) pour Claude Code

**Langues :** [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · **Français** · [Español](README.es.md) · [Italiano](README.it.md)

Un plugin Claude Code qui permet à Claude d'appeler la CLI locale **`agy`** (Google
Antigravity, basé sur Gemini) pour relire du code, déléguer des tâches et obtenir un
deuxième avis — l'**équivalent agy du plugin officiel `codex`**.

Multiplateforme : **Windows, Linux, macOS** (companion Node pur, sans wrapper shell).

## Commandes

| Commande | Rôle | Droits par défaut | Équivalent codex |
|---|---|---|---|
| `/agy:ask` | Question ponctuelle à Gemini | lecture seule | — |
| `/agy:rescue` | Déléguer une tâche/correction (agy peut **modifier des fichiers**) | **écriture** | `/codex:rescue` |
| `/agy:research` | Question de recherche | lecture seule | — |
| `/agy:review` | Relire le diff git local | lecture seule | `/codex:review` |
| `/agy:adversarial-review` | Revue adversariale du diff | lecture seule | `/codex:adversarial-review` |
| `/agy:setup` | Vérification : installé + authentifié ? | — | `/codex:setup` |
| `/agy:status` | Lister les tâches agy récentes | — | `/codex:status` |
| `/agy:result` | Afficher la sortie d'une tâche | — | `/codex:result` |
| `/agy:cancel` | Annuler les tâches agy en cours | — | `/codex:cancel` |

Vous pouvez aussi simplement dire « demande à agy / donne-moi un deuxième avis /
demande à Gemini » — le skill intégré se déclenche automatiquement.

### Droits : valeur sûre par défaut, vous décidez

Comme codex, chaque commande a une **valeur sûre par défaut** que vous pouvez remplacer :

- `--write` — autoriser agy à modifier des fichiers (remplace un défaut en lecture seule)
- `--read-only` — interdire les modifications, conseils uniquement (remplace un défaut en écriture)

Ainsi `/agy:ask --write` autorise les modifications, et `/agy:rescue --read-only` le
limite aux conseils sans toucher aux fichiers.

## Prérequis

1. **Node.js** (v18+). Vérifier : `node --version`.
2. **La CLI `agy`** (Google Antigravity), installée et connectée une fois.
   - Défaut Windows : `%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS : `~/.agy/bin/agy` ou dans le `PATH`
   - Si elle est ailleurs, définissez la variable d'environnement `AGY_BIN` avec
     son chemin complet.
   - L'authentification se fait silencieusement via le trousseau du système. En cas
     de timeout, lancez `agy` une fois en interactif pour vous connecter.

Après l'installation, vérifiez tout avec `/agy:setup`.

## Installation

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

Puis redémarrez Claude Code et exécutez `/agy:setup`.

## Fonctionnement

`scripts/agy-companion.mjs` lance `agy --print` avec le bon ordre des drapeaux,
attend avec un timeout, puis extrait la réponse de Gemini du transcript qu'agy écrit
sur le disque (`agy --print` écrit dans le TTY, pas dans stdout). Chaque exécution
reçoit un nonce propre à la tâche pour lire le bon transcript même en exécution
parallèle, et tous les segments de réponse sont assemblés (agy découpe les longues
réponses). Le prompt de l'utilisateur passe par **stdin**, de sorte qu'aucun texte
utilisateur n'atteint la ligne de commande shell (pas d'injection). Les tâches sont
suivies avec leur PID sous `~/.agy-jobs` pour que `/agy:status`, `/agy:result` et
`/agy:cancel` fonctionnent entre exécutions en arrière-plan et n'annulent que la
tâche ciblée.

## Sécurité et confidentialité (à lire)

- **Votre code/vos prompts sont envoyés à Google (Gemini).** Attention aux données
  sensibles, médicales ou non publiées — même considération que pour tout modèle cloud.
- **Les commandes en écriture modifient les fichiers de façon autonome.** `/agy:rescue`
  peut modifier des fichiers sans demander. Faites d'abord `git commit` pour pouvoir
  vérifier/annuler via `git diff`.
- agy est un agent autonome : même en lecture seule, il peut exécuter des commandes
  shell pour explorer. La lecture seule bloque la *modification de fichiers*, pas toute activité.

## Notes / limites

- agy partage un seul exécutable entre les tâches ; `/agy:cancel` sans id arrête toutes
  les tâches en cours (avec un id, seulement l'arbre de processus de cette tâche).
- Le modèle backend dépend de la configuration d'agy (par défaut Gemini),
  dans `~/.gemini/antigravity-cli/settings.json`.

## Licence

MIT — voir [LICENSE](LICENSE).
