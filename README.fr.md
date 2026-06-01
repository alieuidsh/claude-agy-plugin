# agy — Google Antigravity pour Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Utilisez le **agy CLI** (Google Antigravity) comme second modèle au sein de Claude Code — l'équivalent
`agy` du plugin `codex`. Posez des questions, obtenez un second avis, faites relire votre
diff ou déléguez des tâches avec accès en écriture, le tout sans quitter Claude Code.

Ce qui le rend intéressant : **agy peut faire tourner des modèles Gemini, Claude *et* GPT-OSS** derrière une
seule CLI et un seul compte. Ce plugin met cela en avant — choisissez n'importe lequel d'entre eux à chaque appel, ou définissez un
modèle par défaut, directement depuis Claude Code.

> ⚠️ **Non officiel.** Il s'agit d'un plugin communautaire, sans affiliation ni approbation de
> Google ou Anthropic. « Antigravity », « Gemini », « Claude » et « Codex » appartiennent à leurs
> propriétaires respectifs.

---

## Ce que vous obtenez

| Commande | Ce qu'elle fait |
|---|---|
| `/agy:ask` | Poser à agy une question ponctuelle (lecture seule par défaut) |
| `/agy:research` | Demander à agy de rechercher et de synthétiser une réponse |
| `/agy:rescue` | Déléguer une tâche/correction — **agy peut modifier des fichiers** |
| `/agy:review` | agy relit votre diff git local (lecture seule) |
| `/agy:adversarial-review` | Relecture contradictoire et impitoyable de votre diff (lecture seule) |
| `/agy:model` | Afficher ou définir le modèle **par défaut** |
| `/agy:models` | Lister **tous** les modèles utilisables par votre compte (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Mettre à jour le agy CLI ; rafraîchit la liste des modèles |
| `/agy:setup` | Vérifier l'état de l'intégration |
| `/agy:install` | Installer le agy CLI (demande confirmation d'abord) |
| `/agy:status` `/agy:result` `/agy:cancel` | Gérer les tâches en arrière-plan |

---

## Prérequis

- **Claude Code** (ceci est un plugin pour lui)
- **Node.js 18+** (le runtime est Node ; `node-pty` est installé automatiquement au premier lancement)
- Le **agy CLI** (Google Antigravity). Vous ne l'avez pas ? Exécutez `/agy:install` (qui demande
  confirmation d'abord), ou installez-le manuellement depuis <https://antigravity.google>. Après l'installation, exécutez
  `agy` une fois en mode interactif pour vous connecter.

Testé sur **Windows** et **Linux** (x86_64). macOS devrait fonctionner (mêmes chemins de code) mais n'est
pas testé. Voir *Notes sur les plateformes* ci-dessous pour la mise en garde concernant Linux/SSH.

---

## Installation

> **La commande `/plugin` n'apparaît pas ?** Votre Claude Code est trop ancien — `/plugin` nécessite une
> version récente (2.1.143+). Mettez d'abord Claude Code à jour (application Store : mise à jour via le Microsoft
> Store / App Store ; CLI : `claude update`), puis redémarrez-le. Pouvoir utiliser un nouveau
> *modèle* comme Opus 4.8 ne signifie **pas** que votre application est à jour — les modèles proviennent du
> serveur, la fonctionnalité `/plugin` provient de l'application.

**Étape 1 — ajouter la marketplace et installer** (dans Claude Code) :

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Étape 2 — faire apparaître les commandes. ⚠️ Cette étape est obligatoire, et c'est là que les gens
restent bloqués.** Les commandes nouvellement installées n'apparaissent **pas** tant que vous ne rechargez ou ne redémarrez pas :

- Exécutez **`/reload-plugins`**, **et**
- si les commandes `/agy:*` n'apparaissent toujours pas (ou après une *mise à jour* de plugin),
  **quittez complètement et rouvrez Claude Code** (fermez entièrement la fenêtre/l'application, pas seulement
  l'onglet). Un simple rechargement ne suffit parfois pas pour des fichiers de commandes flambant neufs.

**Étape 3 — vérification de l'état :**

```bash
/agy:setup     # vérifie agy + node-pty + auth ; installe automatiquement node-pty au premier lancement
```

Le tout premier appel `/agy:*` prend ~15–20 s (installation unique de node-pty + premier récupération
de la liste des modèles). C'est normal — c'est mis en cache ensuite, les appels suivants sont rapides.

La première commande qui pilote agy peut prendre ~15–20 s (installation unique de node-pty + une récupération
de la liste des modèles, toutes deux mises en cache par la suite).

---

## Comment ça marche (et pourquoi)

agy 1.0.x **ne produit de sortie que lorsqu'il détecte une vraie console (TTY)** — un simple
`spawn()` headless ne renvoie rien. Ce plugin pilote donc agy à l'intérieur d'une **console
synthétisée (ConPTY) via `node-pty`**, lit sa sortie, retire l'ANSI/BOM et renvoie la
réponse. `node-pty` fournit des binaires précompilés pour les combinaisons Node/OS courantes et est installé
automatiquement à la première utilisation (aucune chaîne d'outils C++ nécessaire dans le cas normal).

La liste des modèles est récupérée en direct depuis le menu interactif `/model` de agy et mise en cache, indexée sur
l'empreinte du binaire agy — elle est re-récupérée automatiquement lorsque agy se met à jour.

---

## Choisir un modèle

agy **n'a pas de flag CLI `--model`**, ce plugin sélectionne donc un modèle en réécrivant brièvement et en toute sécurité
`~/.gemini/antigravity-cli/settings.json`, puis en le restaurant. Cela se fait
sous verrou et est **résistant aux plantages** — vos paramètres ne sont jamais laissés corrompus, même si une
exécution est tuée en plein vol (l'original est conservé et récupéré par l'exécution suivante).

```bash
/agy:models                                  # voir tout ce que votre compte peut exécuter
/agy:model                                   # afficher le modèle par défaut actuel
/agy:model pro                               # définir par défaut le plus puissant, Gemini Pro
/agy:model flash                             # définir par défaut Gemini Flash (rapide, économique)
/agy:model "Claude Opus 4.6 (Thinking)"      # définir par défaut un modèle Claude
/agy:ask --model flash  votre question       # remplacement ponctuel (ne change pas le modèle par défaut)
```

- Les **alias** (`pro`, `flash`, ainsi que `pro-low`, `flash-medium`, …) sont **réservés à Gemini** et
  suivent la liste en direct, donc `pro`/`flash` suivent automatiquement le niveau Gemini le plus récent.
- Les modèles **Claude / GPT-OSS** nécessitent le **libellé complet** — copiez-le depuis `/agy:models`.
- Le modèle par défaut est enregistré dans `~/.agy-jobs/config.json` — instantané, persiste d'une session à l'autre,
  sans redémarrage du terminal. Un `--model` par appel l'emporte toujours sur le modèle par défaut.
- Chaque exécution rapporte le modèle **réellement utilisé** (lu depuis le propre journal de agy, et non d'après ce que le modèle
  déclare lui-même — les modèles ne sont pas fiables pour se nommer eux-mêmes).

---

## Permissions

- `ask` / `research` sont en **lecture seule** par défaut ; ajoutez `--write` pour autoriser les modifications.
- `rescue` dispose d'un **accès en écriture** par défaut ; ajoutez `--read-only` pour des conseils uniquement.
- `review` / `adversarial-review` sont **toujours en lecture seule** — utilisez `/agy:rescue` pour agir sur les
  constatations.
- Les exécutions en lecture seule passent le `--sandbox` de agy (restrictions du terminal) : agy peut toujours lire et
  analyser des fichiers, mais les effets de bord système/terminal sont bloqués.

---

## Notes sur les plateformes

- **Windows / Linux** — entièrement testés (changement de modèle, récupération, restauration résistante aux plantages, tout fonctionne).
- **Piège Linux + SSH** : agy stocke ses identifiants de connexion dans le keyring du bureau lorsque vous vous connectez dans
  une session graphique, mais bascule sur des tokens basés sur fichier lorsqu'il détecte une session SSH
  (`SSH_CONNECTION`). Les deux ne partagent pas d'état, donc lancer le plugin **via une simple connexion SSH**
  peut provoquer « Authentication required » alors même que vous êtes connecté sur le
  bureau. Solutions : connectez-vous *au sein* de la session SSH, **ou** lancez-le à l'intérieur d'une session `tmux`/`screen`
  démarrée depuis le bureau (sans `SSH_CONNECTION` dans son environnement) —
  agy lit alors normalement la connexion du bureau. Il s'agit d'un comportement du agy CLI, pas d'un bug du plugin.

---

## ⚠️ Confidentialité — à lire

agy envoie vos prompts (et, pour `review`, votre diff de code) aux **serveurs de Google**.
N'utilisez **pas** agy sur des secrets, des identifiants, des clés privées ou des travaux confidentiels / non publiés
que vous ne pouvez pas partager avec un tiers. Traitez-le comme n'importe quel autre service d'IA dans le cloud.

---

## Dépannage

- **Commande `/plugin` introuvable** → votre Claude Code est trop ancien (en dessous de 2.1.143). Mettez
  l'application à jour et redémarrez-la (voir [Installation](#installation)). Pouvoir utiliser un nouveau *modèle* ne
  signifie pas que l'application est à jour.
- **Installé, mais les commandes `/agy:*` n'apparaissent pas** → exécutez **`/reload-plugins`** ; si
  elles n'apparaissent toujours pas, **quittez complètement et rouvrez** Claude Code. Les nouveaux fichiers de commandes nécessitent un
  rechargement/redémarrage pour se charger.
- **`/agy:setup` indique `agy binary: NOT FOUND`** → exécutez `/agy:install`, ou définissez la
  variable d'environnement `AGY_BIN` sur le chemin de l'exécutable agy.
- **`node-pty: UNAVAILABLE`** → l'installation automatique unique a échoué ; assurez-vous que Node.js + npm
  sont dans le PATH et que vous avez accès au réseau, puis relancez `/agy:setup`.
- **Aucune réponse / erreur d'authentification** → exécutez `agy` une fois en mode interactif dans un terminal pour vous connecter.
- **La liste des modèles semble obsolète après une mise à jour de agy** → `/agy:models --refresh` ou `/agy:update`.

Ne relancez pas en boucle en cas d'échec — corrigez la cause sous-jacente (authentification, installation, réseau).

---

## Licence

MIT. Non officiel ; sans affiliation avec Google ou Anthropic.
