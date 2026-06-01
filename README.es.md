# agy — Google Antigravity para Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Usa la **CLI de agy** (Google Antigravity) como un segundo modelo dentro de Claude Code — la
contraparte `agy` del plugin `codex`. Haz preguntas, obtén segundas opiniones, revisa tu
diff o delega tareas con capacidad de escritura, todo sin salir de Claude Code.

Lo que lo hace interesante: **agy puede ejecutar modelos Gemini, Claude *y* GPT-OSS** detrás de
una sola CLI y cuenta. Este plugin lo expone — elige cualquiera de ellos en cada llamada, o establece un
valor predeterminado, directamente desde Claude Code.

> ⚠️ **No oficial.** Este es un plugin comunitario, no afiliado ni respaldado por
> Google o Anthropic. "Antigravity", "Gemini", "Claude" y "Codex" pertenecen a sus
> respectivos propietarios.

---

## Qué obtienes

| Comando | Qué hace |
|---|---|
| `/agy:ask` | Hacer a agy una pregunta puntual (de solo lectura por defecto) |
| `/agy:research` | Pedir a agy que investigue y sintetice una respuesta |
| `/agy:rescue` | Delegar una tarea/corrección — **agy puede editar archivos** |
| `/agy:review` | agy revisa tu diff local de git (solo lectura) |
| `/agy:adversarial-review` | Revisión adversarial implacable de tu diff (solo lectura) |
| `/agy:model` | Mostrar o establecer el modelo **predeterminado** |
| `/agy:models` | Listar **todos** los modelos que tu cuenta puede usar (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Actualizar la CLI de agy; refresca la lista de modelos |
| `/agy:setup` | Verificar el estado de la integración |
| `/agy:install` | Instalar la CLI de agy (pregunta primero) |
| `/agy:status` `/agy:result` `/agy:cancel` | Gestionar trabajos en segundo plano |

---

## Requisitos

- **Claude Code** (este es un plugin para él)
- **Node.js 18+** (el runtime es Node; `node-pty` se instala automáticamente en la primera ejecución)
- La **CLI de agy** (Google Antigravity). ¿No la tienes? Ejecuta `/agy:install` (pregunta
  primero), o instálala manualmente desde <https://antigravity.google>. Después de instalar, ejecuta
  `agy` una vez de forma interactiva para iniciar sesión.

Probado en **Windows** y **Linux** (x86_64). macOS debería funcionar (mismas rutas de código) pero
no está probado. Consulta *Notas de plataforma* más abajo para conocer la advertencia sobre Linux/SSH.

---

## Instalación

> **¿No ves el comando `/plugin`?** Tu Claude Code es demasiado antiguo — `/plugin` necesita una
> versión reciente (2.1.143+). Actualiza Claude Code primero (app Store: actualiza vía Microsoft
> Store / App store; CLI: `claude update`), luego reinícialo. Poder usar un nuevo
> *modelo* como Opus 4.8 **no** significa que tu app esté actualizada — los modelos vienen del
> servidor, la función `/plugin` viene de la app.

**Paso 1 — añade el marketplace e instala** (en Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Paso 2 — haz que aparezcan los comandos. ⚠️ Este paso es obligatorio, y es donde la gente se
queda atascada.** Los comandos recién instalados **no** aparecen hasta que recargues o reinicies:

- Ejecuta **`/reload-plugins`**, **y**
- si los comandos `/agy:*` siguen sin aparecer (o después de una *actualización* del plugin),
  **cierra y vuelve a abrir Claude Code por completo** (cierra la ventana/app completamente, no solo la
  pestaña). Una recarga por sí sola a veces no basta para archivos de comandos completamente nuevos.

**Paso 3 — verificación de estado:**

```bash
/agy:setup     # verifica agy + node-pty + autenticación; instala node-pty automáticamente en la primera ejecución
```

La primerísima llamada `/agy:*` tarda ~15–20s (instalación única de node-pty + primer scrape de la lista
de modelos). Eso es normal — queda en caché después de eso, las llamadas posteriores son rápidas.

El primer comando que ejecuta agy puede tardar ~15–20s (instalación única de node-pty + un scrape de la
lista de modelos, ambos quedan en caché después).

---

## Cómo funciona (y por qué)

agy 1.0.x **solo produce salida cuando detecta una consola real (TTY)** — un simple
`spawn()` sin interfaz no produce nada. Por eso este plugin ejecuta agy dentro de una **consola
sintetizada (ConPTY) mediante `node-pty`**, lee su salida, elimina ANSI/BOM y devuelve la
respuesta. `node-pty` incluye binarios precompilados para combinaciones comunes de Node/SO y se instala
automáticamente en el primer uso (sin necesidad de un toolchain de C++ en el caso normal).

La lista de modelos se extrae en vivo del menú interactivo `/model` de agy y se almacena en caché, indexada por
la huella digital del binario de agy — se vuelve a extraer automáticamente cuando agy se actualiza.

---

## Elegir un modelo

agy **no tiene un flag de CLI `--model`**, así que este plugin selecciona un modelo reescribiendo breve y
seguramente `~/.gemini/antigravity-cli/settings.json`, y luego lo restaura. Esto se hace
bajo un bloqueo y es **a prueba de fallos** — tus ajustes nunca quedan corruptos, incluso si una
ejecución se interrumpe a mitad de camino (el original se persiste y lo recupera la siguiente ejecución).

```bash
/agy:models                                  # ver todo lo que tu cuenta puede ejecutar
/agy:model                                   # mostrar el predeterminado actual
/agy:model pro                               # establecer el predeterminado al Gemini Pro más potente
/agy:model flash                             # establecer el predeterminado a Gemini Flash (rápido, económico)
/agy:model "Claude Opus 4.6 (Thinking)"      # predeterminado a un modelo Claude
/agy:ask --model flash  your question        # anulación puntual (no cambia el predeterminado)
```

- Los **alias** (`pro`, `flash`, más `pro-low`, `flash-medium`, …) son **solo para Gemini** y
  siguen la lista en vivo, así que `pro`/`flash` siguen automáticamente el nivel de Gemini más reciente.
- Los modelos **Claude / GPT-OSS** necesitan la **etiqueta completa** — cópiala de `/agy:models`.
- El predeterminado se guarda en `~/.agy-jobs/config.json` — instantáneo, persiste entre sesiones,
  sin reiniciar la terminal. Un `--model` por llamada siempre gana sobre el predeterminado.
- Cada ejecución informa el modelo **realmente usado** (leído del propio log de agy, no de lo que el modelo
  reporta de sí mismo — los modelos no son fiables al nombrarse a sí mismos).

---

## Permisos

- `ask` / `research` son de **solo lectura** por defecto; añade `--write` para permitir ediciones.
- `rescue` tiene **capacidad de escritura** por defecto; añade `--read-only` solo para consejos.
- `review` / `adversarial-review` son **siempre de solo lectura** — usa `/agy:rescue` para actuar sobre los
  hallazgos.
- Las ejecuciones de solo lectura pasan el `--sandbox` de agy (restricciones de terminal): agy todavía puede leer y
  analizar archivos, pero los efectos secundarios de sistema/terminal están bloqueados.

---

## Notas de plataforma

- **Windows / Linux** — totalmente probado (el cambio de modelo, el scrape y la restauración a prueba de fallos funcionan todos).
- **Advertencia de Linux + SSH**: agy guarda su sesión en el keyring del escritorio cuando inicias sesión en
  una sesión gráfica, pero cambia a tokens basados en archivos cuando detecta una sesión SSH
  (`SSH_CONNECTION`). Los dos no comparten estado, así que ejecutar el plugin **sobre una conexión SSH
  pura** puede dar "Authentication required" aunque hayas iniciado sesión en el
  escritorio. Soluciones: inicia sesión *dentro* de la sesión SSH, **o** ejecuta dentro de una sesión `tmux`/`screen`
  que se haya iniciado desde el escritorio (sin `SSH_CONNECTION` en su entorno) —
  entonces agy lee la sesión del escritorio normalmente. Esto es un comportamiento de la CLI de agy, no un fallo del plugin.

---

## ⚠️ Privacidad — lee esto

agy envía tus prompts (y, para `review`, tu diff de código) a **los servidores de Google**. **No**
lo uses con secretos, credenciales, claves privadas, ni trabajo confidencial / no publicado
que no puedas compartir con un tercero. Trátalo como cualquier otro servicio de IA en la nube.

---

## Resolución de problemas

- **Comando `/plugin` no encontrado** → tu Claude Code es demasiado antiguo (por debajo de 2.1.143). Actualiza
  la app y reiníciala (consulta [Instalación](#install)). Poder usar un nuevo *modelo* no
  significa que la app esté actualizada.
- **Instalado, pero los comandos `/agy:*` no aparecen** → ejecuta **`/reload-plugins`**; si
  todavía no aparecen, **cierra y vuelve a abrir** Claude Code por completo. Los archivos de comandos nuevos necesitan una
  recarga/reinicio para cargarse.
- **`/agy:setup` dice `agy binary: NOT FOUND`** → ejecuta `/agy:install`, o establece la
  variable de entorno `AGY_BIN` con la ruta del ejecutable de agy.
- **`node-pty: UNAVAILABLE`** → la instalación automática única falló; asegúrate de que Node.js + npm
  estén en el PATH y tengas red, luego vuelve a ejecutar `/agy:setup`.
- **Sin respuesta / error de autenticación** → ejecuta `agy` una vez de forma interactiva en una terminal para iniciar sesión.
- **La lista de modelos parece desactualizada tras una actualización de agy** → `/agy:models --refresh` o `/agy:update`.

No reintentes en bucle ante un fallo — corrige la causa subyacente (autenticación, instalación, red).

---

## Licencia

MIT. No oficial; no afiliado a Google o Anthropic.
