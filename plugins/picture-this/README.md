# picture-this

Mod + skill. Visualise complexity and big ideas: Claude judges whether something is complex enough for a picture, tells you why ("9 services, 14 calls, a retry cycle"), offers 2-3 picture options (a native AskUserQuestion with a text preview of each), and draws only the one you pick.

```
/plugin install picture-this --marketplace danielriddell21/skills
```

- **The gate:** draw only past a threshold: 6+ linked parts, a cycle or hub, 5+ steps with branches or 3+ actors, 4+ states, 3+ options on 3+ criteria, a change across 5+ dependent files, or an idea that needs stages. Below it, text. Asking for a picture skips the offer.
- **Three modes, for one idea or several options:**

  | Mode | One idea | Options |
  |---|---|---|
  | Static: the shape | `graph` (`hot`, `heat`), `sequence`, `flow`, `swimlane`, `tree`, `treemap`, `matrix`, `sankey` | `radar`, `scatter`/`quadrant`, markdown table |
  | Before / after: what changes | `compare` (Today / After), `graph` with `change` marks | `compare` (Today / A / B) |
  | Guided: step by step | `tour` (Back / Next), `storyboard`, animated `sequence`, zoomable `graph` (`inside`), `timeline` | a `tour` across the options |

- **Local controls, no model call:** tour Back / Next, zoom ⊕ and back, sequence replay (↻, desktop and mobile).
- **Written as** a fenced ```ui block, one JSON per line (finished lines draw while the rest streams), or the `mcp__picture-this__show` tool. Every component has a terminal form (text, shade blocks, `+ − ~` diff marks, `●` focus, `⊕` zoom).
- **Too big for the thread** (over 24 nodes or 30 messages): a Mermaid file in the side panel, which the app draws itself with pan and zoom.
- **Hooks for other plugins:** `too-long-didnt-read` publishes summary charts in its `cards` state; picture-this draws each under its answer and sets `picture-this.ready`.

**Skill:** `show-dont-tell`: the gate, the offer, and which route draws it.

## What Claude Code can draw (why it looks like this)

Claude Code is not HTML. A mod returns a tree of the host's own elements, and each surface draws them its own way:

| Surface | Elements a mod gets | Pictures |
|---|---|---|
| terminal | Box, Text, Button, Input, Select, Link, Code, Markdown, Client, Raster, Image | no `Svg`. `Raster` is a coloured cell grid; `Image` shows pixels only in kitty, Ghostty and iTerm2 3.5+. So: text diagrams |
| desktop | the six shared + Input, Select, Svg, Client | `Svg` as an image, or a script-less sandboxed frame with `isInteractive` (hover, `<title>` tooltips) |
| VS Code | as desktop, no Client | `Svg` always an image: no hover or tooltips |
| mobile | as VS Code | `Svg` in a web view |

Limits that shaped this version:

- **No HTML or script in the thread.** SVG markup is isolated (≤128 KB, scripts and handlers stripped). Rich, zoomable pages belong in the side panel (`SendUserFile`) or an Artifact, not the thread.
- **No theme keys inside an SVG.** An SVG cannot read Claude's theme, so the plugin reads your theme from `/config` (and again when you change it) and writes that theme's colours into each drawing: the `claude` accent for hot parts and the lit path, `subtle` lines, diff colours that turn blue and orange in colour-blind themes. An unknown theme falls back to the OS light/dark preference. The colour values approximate Claude Code's own; the host offers no way to look them up.
- **Markdown is the most native form.** Every surface draws a markdown table as it draws a reply, so tables, matrices and cards are plain markdown now, not components.
- **Mermaid is not drawn in the thread.** Markdown fences show as code. The side panel draws `.mmd` files, so big diagrams go there.
- **Choices are better native.** AskUserQuestion (with option previews) and `your-call` replace the old `choice` / `send` buttons.

## Looking like Claude, not the OS

- Your reply stays Claude's: prose around a picture goes back through the host's own message drawing (the reply bullet included); only the picture is the plugin's.
- The `show` tool's row is the host's own row (running, error, interrupted, ctrl+o); only its input is cut to the title.
- Titles, legends and notes are host text, in the reply's own type, selectable; the drawing sits in a rounded `subtle` frame (a card on mobile).
- Terminal colours are theme keys: `claude` for ●, `success` / `error` / `warning` for `+ − ~`.
- Buttons are plain host buttons; captions are host markdown; the offer is AskUserQuestion.

## What changed in 0.7.0

Removed: the per-prompt classifier (a model call on every prompt; the skill's gate replaces it, and its `classify` option), `table`, `card`, `stat` (now markdown), `choice`, `send` (now AskUserQuestion / your-call), `calc` and its slider, `line`, `pie`, and the schematic `map` (now the side panel, for real maps and data charts). Added: before/after `compare` and diff marks, `heat`, zoomable `inside` parts, `tour` and `storyboard`, animated `sequence` replay, `swimlane`, `timeline`, `matrix`, `sankey`, `radar`, `treemap`, edges that route under the columns they skip, `hot` and `note` on graph nodes, cycle detection, a barycentre layout that crosses fewer edges, boxes that grow and wrap to fit labels instead of cutting them at 14 characters, theme-aware colours, interactive SVG (hover tooltips on desktop and mobile), and an `alt` that says what each picture holds. Fixed: a labelled edge set `font-size` twice, so the whole graph failed to load on desktop.
