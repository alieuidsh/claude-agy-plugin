# claude-agy-plugin — Google Antigravity (Gemini) para Claude Code

**Idiomas:** [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Español** · [Italiano](README.it.md)

Un plugin de Claude Code que permite a Claude llamar a la CLI local **`agy`** (Google
Antigravity, basada en Gemini) para revisar código, delegar tareas y dar una segunda
opinión — el **equivalente agy del plugin oficial `codex`**.

Multiplataforma: **Windows, Linux, macOS** (companion Node puro, sin wrappers de shell).

## Comandos

| Comando | Función | Permisos por defecto | Equivalente en codex |
|---|---|---|---|
| `/agy:ask` | Pregunta puntual a Gemini | solo lectura | — |
| `/agy:rescue` | Delegar tarea/arreglo (agy puede **editar archivos**) | **escritura** | `/codex:rescue` |
| `/agy:research` | Pregunta de investigación | solo lectura | — |
| `/agy:review` | Revisar el diff git local | solo lectura | `/codex:review` |
| `/agy:adversarial-review` | Revisión adversaria del diff | solo lectura | `/codex:adversarial-review` |
| `/agy:setup` | Comprobación: ¿instalado y autenticado? | — | `/codex:setup` |
| `/agy:status` | Listar tareas agy recientes | — | `/codex:status` |
| `/agy:result` | Mostrar la salida de una tarea | — | `/codex:result` |
| `/agy:cancel` | Cancelar tareas agy en curso | — | `/codex:cancel` |

También puedes decir simplemente «consulta a agy / dame una segunda opinión /
pregunta a Gemini» y el skill incluido se activa automáticamente.

### Permisos: valor seguro por defecto, tú decides

Como codex, cada comando tiene un **valor seguro por defecto** que puedes anular:

- `--write` — permitir que agy edite archivos (anula un valor de solo lectura)
- `--read-only` — prohibir ediciones, solo consejo (anula un valor de escritura)

Así `/agy:ask --write` permite ediciones, y `/agy:rescue --read-only` lo deja solo
en consejo sin tocar archivos.

## Requisitos

1. **Node.js** (v18+). Comprobar: `node --version`.
2. **La CLI `agy`** (Google Antigravity), instalada y con sesión iniciada una vez.
   - Predeterminado en Windows: `%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS: `~/.agy/bin/agy` o en el `PATH`
   - Si está en otro lugar, define la variable de entorno `AGY_BIN` con su ruta completa.
   - La autenticación es silenciosa mediante el llavero del sistema. Si las llamadas
     agotan el tiempo, ejecuta `agy` una vez de forma interactiva para iniciar sesión.

Tras instalar, verifica todo con `/agy:setup`.

## Instalación

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

Luego reinicia Claude Code y ejecuta `/agy:setup`.

## Cómo funciona

`scripts/agy-companion.mjs` ejecuta `agy --print` con el orden correcto de banderas,
espera con un tiempo límite y extrae la respuesta de Gemini del transcript que agy
escribe en disco (`agy --print` escribe en el TTY, no en stdout). Cada ejecución
recibe un nonce propio de la tarea para leer el transcript correcto incluso en
ejecuciones paralelas, y se unen todos los segmentos de respuesta (agy fragmenta las
respuestas largas). El prompt del usuario se pasa por **stdin**, de modo que ningún
texto del usuario llega a la línea de comandos del shell (sin inyección). Las tareas
se rastrean con su PID en `~/.agy-jobs` para que `/agy:status`, `/agy:result` y
`/agy:cancel` funcionen entre ejecuciones en segundo plano y cancelen solo la tarea
indicada.

## Seguridad y privacidad (léelo, por favor)

- **Tu código/prompts se envían a Google (Gemini).** Ten cuidado con datos sensibles,
  médicos o no publicados — la misma consideración que con cualquier modelo en la nube.
- **Los comandos con escritura editan archivos de forma autónoma.** `/agy:rescue` puede
  cambiar archivos sin preguntar. Haz `git commit` primero para revisar/revertir con `git diff`.
- agy es un agente autónomo: incluso en solo lectura puede ejecutar comandos de shell
  para explorar. Solo lectura bloquea la *edición de archivos*, no toda actividad.

## Notas / limitaciones

- agy comparte un único ejecutable entre tareas; `/agy:cancel` sin id detiene todas las
  tareas en curso (con id, solo el árbol de procesos de esa tarea).
- El modelo backend depende de la configuración de agy (por defecto Gemini),
  en `~/.gemini/antigravity-cli/settings.json`.

## Licencia

MIT — consulta [LICENSE](LICENSE).
