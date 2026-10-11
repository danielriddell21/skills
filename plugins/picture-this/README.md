# picture-this

Mod. Intelligent UI for Claude Code, after Open Intelligent UI and ChatGPT's Intelligent UI: Claude answers with native components instead of prose when a picture is clearer, and you can work them without another model call.

- **How Claude draws:** a fenced ```ui block in the reply, one JSON component per line (finished lines draw while the rest streams; the unfinished part shows `drawing…`), or the `mcp__picture-this__show` tool with `{title, components}` when the picture is the whole answer. Older ```viz blocks still draw.
- **Components:** `bars`, `line`, `scatter` (or `quadrant`), `pie`, `table`, `tree`, `flow`, `graph`, `card`, `stat`, `map` (schematic: numbered stops, no tiles), `calc`, `choice`, `send`. On desktop, VS Code and mobile charts, flows, graphs and maps are SVG and tables are markdown; the terminal gets text forms of everything.
- **Live controls, no model call:** `calc` inputs move with a slider (terminal and desktop; drag it, or click and use ←/→, PgUp/PgDn, Home/End) and with − / + (every surface); outputs recompute from their formulas (a small safe evaluator: numbers, input ids, `+ - * / % ^`, `min max abs round floor ceil sqrt pow log exp`; no eval). `choice` buttons pick an option; tables sort by a column.
- **Send back:** a `send` button fills `{id}`s from the block's controls and puts the prompt in your input box. It never submits; you press Enter.
- **Picking a picture:** each prompt goes through a cheap classifier that suggests a component (table, chart, diagram, calculator, map, choice). While `matchmaker` is on it skips this, since matchmaker already classifies the prompt and its hint points here: one call per prompt either way. Option `classify: false` turns it off.
- **Rules Claude is given:** one idea per block, short labels, say when numbers are estimates or sample data, never invent live data, every control must change an output, and the answer must stand without the picture.
- **Hooks for other plugins:** `too-long-didnt-read` publishes summary charts in its own `cards` state and picture-this draws each under the answer it belongs to. It reads `picture-this.ready` to know the charts will be drawn.

Not possible in a mod: real map tiles, 3D, or HTML and JavaScript written by Claude (a mod draws only the host's own elements). For those, the `show-dont-tell` skill falls back to a file in the side panel.

**Skill:** `show-dont-tell`, which says when and how to show instead of tell.
