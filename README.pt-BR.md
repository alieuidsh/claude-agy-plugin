# agy — Google Antigravity para o Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Use a **agy CLI** (Google Antigravity) como um segundo modelo dentro do Claude Code — o
equivalente `agy` ao plugin `codex`. Faça perguntas, obtenha uma segunda opinião, revise seu
diff ou delegue tarefas com permissão de escrita, tudo sem sair do Claude Code.

O que a torna interessante: **a agy pode rodar modelos Gemini, Claude *e* GPT-OSS** por trás de
uma única CLI e conta. Este plugin expõe isso — escolha qualquer um deles por chamada, ou defina
um padrão, direto do Claude Code.

> ⚠️ **Não oficial.** Este é um plugin da comunidade, não afiliado nem endossado pela
> Google ou Anthropic. "Antigravity", "Gemini", "Claude" e "Codex" pertencem aos seus
> respectivos proprietários.

---

## O que você ganha

| Comando | O que faz |
|---|---|
| `/agy:ask` | Faça à agy uma pergunta única (somente leitura por padrão) |
| `/agy:research` | Peça à agy para pesquisar e sintetizar uma resposta |
| `/agy:rescue` | Delegue uma tarefa/correção — **a agy pode editar arquivos** |
| `/agy:review` | A agy revisa seu diff local do git (somente leitura) |
| `/agy:adversarial-review` | Revisão adversarial impiedosa do seu diff (somente leitura) |
| `/agy:model` | Mostra ou define o modelo **padrão** |
| `/agy:models` | Lista **todos** os modelos que sua conta pode usar (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Atualiza a agy CLI; renova a lista de modelos |
| `/agy:setup` | Verifica a saúde da integração |
| `/agy:install` | Instala a agy CLI (pergunta antes) |
| `/agy:status` `/agy:result` `/agy:cancel` | Gerencia jobs em segundo plano |

---

## Requisitos

- **Claude Code** (este é um plugin para ele)
- **Node.js 18+** (o runtime é Node; o `node-pty` é instalado automaticamente na primeira execução)
- A **agy CLI** (Google Antigravity). Não tem? Rode `/agy:install` (ele pergunta
  antes), ou instale manualmente em <https://antigravity.google>. Após instalar, rode
  `agy` uma vez de forma interativa para fazer login.

Testado em **Windows** e **Linux** (x86_64). O macOS deve funcionar (mesmos caminhos de código), mas
não foi testado. Veja *Notas de plataforma* abaixo para a ressalva sobre Linux/SSH.

---

## Instalação

> **Não vê o comando `/plugin`?** Seu Claude Code está muito desatualizado — `/plugin` precisa de uma
> versão recente (2.1.143+). Atualize o Claude Code primeiro (app da Store: atualize pela Microsoft
> Store / App Store; CLI: `claude update`), depois reinicie-o. Conseguir usar um novo
> *modelo* como o Opus 4.8 **não** significa que seu app está atualizado — os modelos vêm do
> servidor, o recurso `/plugin` vem do app.

**Passo 1 — adicione o marketplace e instale** (no Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Passo 2 — faça os comandos aparecerem. ⚠️ Este passo é obrigatório, e é onde as pessoas
travam.** Comandos recém-instalados **não** aparecem até você recarregar ou reiniciar:

- Rode **`/reload-plugins`**, **e**
- se os comandos `/agy:*` ainda não aparecerem (ou após uma *atualização* de plugin),
  **encerre totalmente e reabra o Claude Code** (feche a janela/app por completo, não apenas a
  aba). Só um reload às vezes não basta para arquivos de comando totalmente novos.

**Passo 3 — verificação de saúde:**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

A primeira chamada `/agy:*` leva ~15–20s (instalação única do node-pty + primeira coleta da
lista de modelos). Isso é normal — depois disso fica em cache, as chamadas seguintes são rápidas.

O primeiro comando que aciona a agy pode levar ~15–20s (instalação única do node-pty + uma coleta
da lista de modelos, ambas em cache depois disso).

---

## Como funciona (e por quê)

A agy 1.0.x **só produz saída quando detecta um console real (TTY)** — um `spawn()`
headless puro não produz nada. Por isso este plugin aciona a agy dentro de um **console
sintetizado (ConPTY) via `node-pty`**, lê sua saída, remove ANSI/BOM e retorna a
resposta. O `node-pty` traz binários pré-compilados para combinações comuns de Node/SO e é instalado
automaticamente no primeiro uso (sem necessidade de toolchain C++ no caso normal).

A lista de modelos é coletada ao vivo do menu interativo `/model` da agy e mantida em cache, indexada
pela impressão digital do binário da agy — ela é recoletada automaticamente quando a agy atualiza.

---

## Escolhendo um modelo

A agy **não tem flag `--model` na CLI**, então este plugin seleciona um modelo reescrevendo
breve e seguramente o `~/.gemini/antigravity-cli/settings.json`, e depois restaurando-o. Isso é feito
sob um lock e é **à prova de falhas** — suas configurações nunca ficam corrompidas, mesmo que uma
execução seja encerrada no meio do caminho (o original é persistido e recuperado pela próxima execução).

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- **Apelidos** (`pro`, `flash`, além de `pro-low`, `flash-medium`, …) são **exclusivos do Gemini** e
  acompanham a lista ao vivo, então `pro`/`flash` seguem automaticamente o tier mais novo do Gemini.
- Modelos **Claude / GPT-OSS** precisam do **rótulo completo** — copie-o de `/agy:models`.
- O padrão é salvo em `~/.agy-jobs/config.json` — instantâneo, persiste entre sessões,
  sem reiniciar o terminal. Um `--model` por chamada sempre prevalece sobre o padrão.
- Toda execução informa o modelo **realmente usado** (lido do próprio log da agy, não do
  autorrelato do modelo — modelos não são confiáveis ao nomear a si mesmos).

---

## Permissões

- `ask` / `research` são **somente leitura** por padrão; adicione `--write` para permitir edições.
- `rescue` tem **permissão de escrita** por padrão; adicione `--read-only` apenas para conselhos.
- `review` / `adversarial-review` são **sempre somente leitura** — use `/agy:rescue` para agir sobre
  os achados.
- Execuções somente leitura passam o `--sandbox` da agy (restrições de terminal): a agy ainda pode ler e
  analisar arquivos, mas efeitos colaterais de sistema/terminal são bloqueados.

---

## Notas de plataforma

- **Windows / Linux** — totalmente testado (troca de modelo, coleta e restauração à prova de falhas funcionam).
- **Pegadinha do Linux + SSH**: a agy guarda seu login no keyring da área de trabalho quando você faz login em
  uma sessão gráfica, mas muda para tokens baseados em arquivo quando detecta uma sessão SSH
  (`SSH_CONNECTION`). Os dois não compartilham estado, então rodar o plugin **por uma conexão SSH
  pura** pode resultar em "Authentication required" mesmo que você esteja logado na
  área de trabalho. Soluções: faça login *dentro* da sessão SSH, **ou** rode dentro de uma sessão `tmux`/`screen`
  que tenha sido iniciada a partir da área de trabalho (sem `SSH_CONNECTION` em seu ambiente) —
  então a agy lê o login da área de trabalho normalmente. Este é um comportamento da agy CLI, não um bug do plugin.

---

## ⚠️ Privacidade — leia isto

A agy envia seus prompts (e, no caso de `review`, seu diff de código) para os **servidores da Google**.
**Não** a use com segredos, credenciais, chaves privadas ou trabalho confidencial / não publicado
que você não possa compartilhar com terceiros. Trate-a como qualquer outro serviço de IA na nuvem.

---

## Solução de problemas

- **Comando `/plugin` não encontrado** → seu Claude Code está muito desatualizado (abaixo de 2.1.143). Atualize
  o app e reinicie-o (veja [Instalação](#install)). Conseguir usar um novo *modelo* não
  significa que o app está atualizado.
- **Instalado, mas os comandos `/agy:*` não aparecem** → rode **`/reload-plugins`**; se
  ainda não aparecerem, **encerre totalmente e reabra** o Claude Code. Arquivos de comando novos precisam de um
  reload/reinício para carregar.
- **`/agy:setup` diz `agy binary: NOT FOUND`** → rode `/agy:install`, ou defina a
  variável de ambiente `AGY_BIN` com o caminho do executável da agy.
- **`node-pty: UNAVAILABLE`** → a instalação automática única falhou; verifique se Node.js + npm
  estão no PATH e se você tem rede, depois rode `/agy:setup` novamente.
- **Sem resposta / erro de autenticação** → rode `agy` uma vez de forma interativa em um terminal para fazer login.
- **A lista de modelos parece desatualizada após uma atualização da agy** → `/agy:models --refresh` ou `/agy:update`.

Não fique repetindo a tentativa em loop após falhas — corrija a causa raiz (autenticação, instalação, rede).

---

## Licença

MIT. Não oficial; não afiliado à Google ou Anthropic.
