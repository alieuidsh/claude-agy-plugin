# agy — Google Antigravity dla Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Używaj **agy CLI** (Google Antigravity) jako drugiego modelu wewnątrz Claude Code — to
odpowiednik `agy` dla wtyczki `codex`. Zadawaj pytania, zasięgaj drugiej opinii, recenzuj swój
diff lub deleguj zadania z możliwością zapisu, a wszystko to bez opuszczania Claude Code.

Co czyni to interesującym: **agy potrafi uruchamiać modele Gemini, Claude *oraz* GPT-OSS** za
pomocą jednego CLI i jednego konta. Ta wtyczka to udostępnia — wybierz dowolny z nich dla
każdego wywołania lub ustaw domyślny, prosto z Claude Code.

> ⚠️ **Nieoficjalne.** To jest wtyczka społecznościowa, niepowiązana ani niewspierana przez
> Google ani Anthropic. „Antigravity”, „Gemini”, „Claude” i „Codex” należą do ich
> odpowiednich właścicieli.

---

## Co otrzymujesz

| Polecenie | Co robi |
|---|---|
| `/agy:ask` | Zadaj agy jednorazowe pytanie (domyślnie tylko do odczytu) |
| `/agy:research` | Poproś agy o zbadanie tematu i zsyntetyzowanie odpowiedzi |
| `/agy:rescue` | Deleguj zadanie/poprawkę — **agy może edytować pliki** |
| `/agy:review` | agy recenzuje Twój lokalny diff git (tylko do odczytu) |
| `/agy:adversarial-review` | Bezwzględna, kontradyktoryjna recenzja Twojego diffa (tylko do odczytu) |
| `/agy:model` | Pokaż lub ustaw model **domyślny** |
| `/agy:models` | Wyświetl **wszystkie** modele dostępne dla Twojego konta (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Zaktualizuj agy CLI; odświeża listę modeli |
| `/agy:setup` | Kontrola stanu integracji |
| `/agy:install` | Zainstaluj agy CLI (najpierw pyta) |
| `/agy:status` `/agy:result` `/agy:cancel` | Zarządzaj zadaniami w tle |

---

## Wymagania

- **Claude Code** (to jest wtyczka do niego)
- **Node.js 18+** (środowiskiem uruchomieniowym jest Node; `node-pty` jest instalowany automatycznie przy pierwszym uruchomieniu)
- **agy CLI** (Google Antigravity). Nie masz go? Uruchom `/agy:install` (najpierw pyta),
  albo zainstaluj ręcznie ze strony <https://antigravity.google>. Po instalacji uruchom
  `agy` raz interaktywnie, aby się zalogować.

Przetestowane na **Windows** i **Linux** (x86_64). macOS powinien działać (te same ścieżki kodu),
ale nie był testowany. Zobacz *Uwagi dotyczące platform* poniżej, aby poznać zastrzeżenie dla Linux/SSH.

---

## Instalacja

> **Nie widzisz polecenia `/plugin`?** Twój Claude Code jest zbyt stary — `/plugin` wymaga
> nowszej wersji (2.1.143+). Najpierw zaktualizuj Claude Code (aplikacja Store: aktualizacja przez Microsoft
> Store / App store; CLI: `claude update`), a następnie uruchom go ponownie. Możliwość użycia nowego
> *modelu*, takiego jak Opus 4.8, **nie** oznacza, że Twoja aplikacja jest aktualna — modele pochodzą z
> serwera, a funkcja `/plugin` pochodzi z aplikacji.

**Krok 1 — dodaj marketplace i zainstaluj** (w Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Krok 2 — spraw, by polecenia się pojawiły. ⚠️ Ten krok jest wymagany i to właśnie tutaj ludzie
utykają.** Nowo zainstalowane polecenia **nie** pojawią się, dopóki nie przeładujesz lub nie uruchomisz ponownie:

- Uruchom **`/reload-plugins`**, **oraz**
- jeśli polecenia `/agy:*` nadal się nie pojawiają (lub po *aktualizacji* wtyczki),
  **całkowicie zamknij i ponownie otwórz Claude Code** (zamknij okno/aplikację w pełni, nie tylko
  zakładkę). Samo przeładowanie czasami nie wystarcza dla zupełnie nowych plików poleceń.

**Krok 3 — kontrola stanu:**

```bash
/agy:setup     # weryfikuje agy + node-pty + uwierzytelnianie; automatycznie instaluje node-pty przy pierwszym uruchomieniu
```

Pierwsze wywołanie `/agy:*` trwa ~15–20 s (jednorazowa instalacja node-pty + pierwsze pobranie
listy modeli). To normalne — później jest buforowane, a kolejne wywołania są szybkie.

Pierwsze polecenie sterujące agy może potrwać ~15–20 s (jednorazowa instalacja node-pty + pobranie
listy modeli, oba buforowane później).

---

## Jak to działa (i dlaczego)

agy 1.0.x **tworzy wynik tylko wtedy, gdy wykryje prawdziwą konsolę (TTY)** — zwykły,
bezgłowy `spawn()` nie daje nic. Dlatego ta wtyczka steruje agy wewnątrz **zsyntetyzowanej
konsoli (ConPTY) przez `node-pty`**, odczytuje jego wyjście, usuwa ANSI/BOM i zwraca
odpowiedź. `node-pty` dostarcza prekompilowane pliki binarne dla popularnych kombinacji Node/OS i jest instalowany
automatycznie przy pierwszym użyciu (w normalnym przypadku nie jest potrzebny żaden zestaw narzędzi C++).

Lista modeli jest pobierana na żywo z interaktywnego menu `/model` agy i buforowana, z kluczem
opartym na sygnaturze pliku binarnego agy — pobiera się ponownie automatycznie, gdy agy się zaktualizuje.

---

## Wybór modelu

agy **nie ma flagi `--model` w CLI**, więc ta wtyczka wybiera model, krótko i bezpiecznie
przepisując `~/.gemini/antigravity-cli/settings.json`, a następnie go przywracając. Odbywa się to
pod blokadą i jest **odporne na awarie** — Twoje ustawienia nigdy nie zostają uszkodzone, nawet jeśli
uruchomienie zostanie przerwane w trakcie (oryginał jest zachowywany i odzyskiwany przy następnym uruchomieniu).

```bash
/agy:models                                  # zobacz wszystko, co Twoje konto może uruchomić
/agy:model                                   # pokaż obecny domyślny model
/agy:model pro                               # ustaw domyślnie najmocniejszy Gemini Pro
/agy:model flash                             # ustaw domyślnie Gemini Flash (szybki, tani)
/agy:model "Claude Opus 4.6 (Thinking)"      # domyślnie model Claude
/agy:ask --model flash  twoje pytanie        # jednorazowe nadpisanie (nie zmienia domyślnego)
```

- **Aliasy** (`pro`, `flash`, plus `pro-low`, `flash-medium`, …) są **tylko dla Gemini** i
  śledzą listę na żywo, więc `pro`/`flash` automatycznie podążają za najnowszym poziomem Gemini.
- Modele **Claude / GPT-OSS** wymagają **pełnej etykiety** — skopiuj ją z `/agy:models`.
- Domyślny model jest zapisywany w `~/.agy-jobs/config.json` — natychmiastowo, utrzymuje się między sesjami,
  bez ponownego uruchamiania terminala. `--model` dla pojedynczego wywołania zawsze ma pierwszeństwo przed domyślnym.
- Każde uruchomienie raportuje model **faktycznie użyty** (odczytany z własnego dziennika agy, a nie z
  autoraportu modelu — modele są zawodne w nazywaniu samych siebie).

---

## Uprawnienia

- `ask` / `research` są domyślnie **tylko do odczytu**; dodaj `--write`, aby zezwolić na edycje.
- `rescue` jest domyślnie **z możliwością zapisu**; dodaj `--read-only`, aby otrzymać tylko poradę.
- `review` / `adversarial-review` są **zawsze tylko do odczytu** — użyj `/agy:rescue`, aby zadziałać na
  ustaleniach.
- Uruchomienia tylko do odczytu przekazują agy flagę `--sandbox` (ograniczenia terminala): agy nadal może odczytywać i
  analizować pliki, ale skutki uboczne dla systemu/terminala są zablokowane.

---

## Uwagi dotyczące platform

- **Windows / Linux** — w pełni przetestowane (przełączanie modeli, pobieranie, odporne na awarie przywracanie — wszystko działa).
- **Pułapka Linux + SSH**: agy przechowuje swój login w keyring pulpitu, gdy logujesz się w
  sesji graficznej, ale przełącza się na tokeny oparte na plikach, gdy wykryje sesję SSH
  (`SSH_CONNECTION`). Te dwa stany nie współdzielą się, więc uruchomienie wtyczki **przez gołe połączenie SSH**
  może napotkać „Authentication required”, mimo że jesteś zalogowany na
  pulpicie. Rozwiązania: zaloguj się *wewnątrz* sesji SSH **lub** uruchom wewnątrz sesji `tmux`/`screen`,
  która została rozpoczęta z pulpitu (bez `SSH_CONNECTION` w jej środowisku) —
  wtedy agy odczyta login pulpitu normalnie. To zachowanie agy CLI, a nie błąd wtyczki.

---

## ⚠️ Prywatność — przeczytaj to

agy wysyła Twoje prompty (a w przypadku `review` Twój diff kodu) na **serwery Google**. **Nie**
używaj go na sekretach, danych uwierzytelniających, kluczach prywatnych ani na poufnej / niepublikowanej pracy,
której nie możesz udostępnić stronie trzeciej. Traktuj go jak każdą inną chmurową usługę AI.

---

## Rozwiązywanie problemów

- **Nie znaleziono polecenia `/plugin`** → Twój Claude Code jest zbyt stary (poniżej 2.1.143). Zaktualizuj
  aplikację i uruchom ją ponownie (zobacz [Instalacja](#instalacja)). Możliwość użycia nowego *modelu* nie
  oznacza, że aplikacja jest aktualna.
- **Zainstalowane, ale polecenia `/agy:*` się nie pojawiają** → uruchom **`/reload-plugins`**; jeśli
  nadal się nie pojawiają, **całkowicie zamknij i ponownie otwórz** Claude Code. Nowe pliki poleceń wymagają
  przeładowania/ponownego uruchomienia, aby się załadować.
- **`/agy:setup` zgłasza `agy binary: NOT FOUND`** → uruchom `/agy:install` lub ustaw zmienną
  środowiskową `AGY_BIN` na ścieżkę do pliku wykonywalnego agy.
- **`node-pty: UNAVAILABLE`** → jednorazowa automatyczna instalacja nie powiodła się; upewnij się, że Node.js + npm
  są na PATH oraz że masz sieć, a następnie ponownie uruchom `/agy:setup`.
- **Brak odpowiedzi / błąd uwierzytelniania** → uruchom `agy` raz interaktywnie w terminalu, aby się zalogować.
- **Lista modeli wygląda na nieaktualną po aktualizacji agy** → `/agy:models --refresh` lub `/agy:update`.

Nie ponawiaj w pętli po niepowodzeniu — usuń przyczynę źródłową (uwierzytelnianie, instalacja, sieć).

---

## Licencja

MIT. Nieoficjalne; niepowiązane z Google ani Anthropic.
