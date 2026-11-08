# Changelog

## 0.7.0

- `picture-this` is now about visualising complexity and big ideas. The `show-dont-tell` skill gates on it (6+ linked parts, a cycle or hub, 5+ branching steps or 3+ actors, 4+ states, 3+ options on 3+ criteria, 5+ dependent files), says in one line what makes it complex, offers 2-3 picture options through AskUserQuestion with a text preview each, and draws only the one picked. Diagrams too big for the thread go to the side panel as Mermaid.
- `picture-this` hands back to the host what it draws better: tables, cards and stats are markdown; choices are AskUserQuestion or `your-call`; data charts and real maps go to the side panel. Removed `table`, `card`, `stat`, `choice`, `send`, `calc` (and its slider), `line`, `pie`, `map`, and the per-prompt classifier with its `classify` option.
- `picture-this` draws in three modes, for one idea or several options: static, before/after and guided. New components: `compare` (Today / After, or Today / A / B on one shared layout; added in green, removed in red), diff marks on any graph (`change`), `heat` shading (churn, bugs, load), zoomable parts (`inside`, ⊕ and back), `tour` (Back / Next light each step's parts; local, no model call), `storyboard` (every step at once), animated `sequence` replay (SMIL, no script), `swimlane`, `timeline`, `matrix`, `sankey`, `radar` and `treemap`, each with a terminal form. Also: `sequence` diagrams; `hot` and `note` on graph nodes; cycles found and drawn as dashed edges under the boxes; fewer crossings; boxes that fit and wrap their labels; colours that follow light and dark; interactive SVG with hover tooltips on desktop and mobile; an `alt` that says what each picture holds. Fixed a labelled edge that made the whole graph fail to load.
- `picture-this` looks like Claude, not the OS: pictures take your `/config` theme (colour-blind themes included) instead of the OS light/dark setting; the `claude` accent marks hot parts and the lit path; prose around a picture and the `show` tool row are drawn by the host itself; titles, legends and notes are host text; pictures sit in a rounded frame (a card on mobile); terminal lines use theme keys.
- Theme keys instead of raw colours in every plugin: `your-call` (`claude` headers, `success` / `warning` / `error`), `whats-in-the-box` (each category in the colour `/context` itself uses), `looks-good-to-me` (`autoAccept`, `error` for yolo), `matchmaker` (`suggestion`), `tell-me-the-damage` (`success` / `error`).
- `matchmaker`: the comparison/structure hint points at the gate-and-offer flow.
- Every plugin is now at 0.7.0.

## 0.6.0

Overlap with [claude-kit](https://github.com/johnnyvizz/claude-kit):

- `who-wants-the-job`: removed the `/crew` mod (the pane, the `♟ crew` chip, the `step` tool and the `autoOpen` option). It was based on `savvy-progress`, which does the same job and more; with `autoOpen: any` it also opens for our agents. The plugin is skills, agents and a command again.
- `hey-you-do-it`: new row: send large multi-step builds to `/savvy-flow` when it is installed.
- `tell-me-the-damage`: `showCost` is now off by default (`session-band` already shows cost). Set it to true to bring cost back.
- Every plugin is now at 0.6.0.

## 0.5.0

- New `picture-this`: Open Intelligent UI for Claude Code. Claude writes a ```ui block (one JSON component per line, so finished lines draw while the rest streams) or calls the `show` tool; the mod draws it natively in the thread: bars, line, scatter/quadrant, pie, table (sortable), tree, flow, graph, card, stat and a schematic map (SVG on desktop, VS Code and mobile; text in the terminal). Live controls run locally with no model call: `calc` inputs with a slider (terminal and desktop) and − / + (everywhere) recompute formula outputs (a safe evaluator, no eval); `choice` picks; `send` puts the filled prompt in your input box and never submits. A cheap classifier suggests a component per prompt, skipped while `matchmaker` is on (its hint points here instead).
- `your-call` no longer draws charts in replies, and the `show-dont-tell` skill moved to `picture-this`. Charts in the ask pane (`viz` on a step, audience tallies) stay in `your-call`.
- `too-long-didnt-read` depends on `picture-this` instead of `your-call`; its summary charts are drawn by `picture-this` under the answer.
- Every plugin's version is now the release version (0.5.0), so `plugin.json` matches the tag.

## 0.4.3

- `too-long-didnt-read`: summaries no longer go above the prompt (next to the context bar). A small one (3 lines of 40 columns) is a toast; a bigger one is a chart drawn by `your-call` in the thread under the answer it summarises, and stays there. Smart is still the default mode.
- `who-wants-the-job`: the `/crew` pane now opens by itself when a crew agent (scout, engineer, spy, sniper) starts, whether `matchmaker` routed to it or not. Option `autoOpen: false` turns it off.
- `who-wants-the-job`: in the `/crew` pane each run is a row with its crab on the left (then who, what, stats, progress bar) instead of a strip of crabs on top.

## 0.4.2

- `who-wants-the-job` is now also a mod: `/crew` pane of every subagent (model, step progress, context %, estimated cost, time) with an animated pixel crab per run, in the Claude clay colour with a TF2 costume each (SVG; glyph row in the terminal), and a `♟ crew` chip with a Crew button in the shared chip row. Agents report steps through the new `step` tool. Idea from `savvy-progress`; code is new.

## 0.4.1

- `how-did-that-go` is now `tell-me-the-damage`.
- Removed `sticky-notes`.
- README: a separate heading and table per plugin.
- SonarCloud: copied `chips.ts` and test files are excluded from duplication checks (`.sonarcloud.properties`; plugins cannot share code).

## 0.4.0

- `too-long-didnt-read` depends on `your-call`: it publishes the summary chart and `your-call` draws it (text, SVG on desktop surfaces) with the same chart code as `viz` blocks. Without `your-call` it says so once and falls back to a toast.
- `tldr` is now `too-long-didnt-read` (the command is still `/tldr`). Auto summaries are a small chart above the prompt (bars, flow or tree, chosen by content) instead of a toast; the toast remains with `widget: false` or when no chart can be made.

- `your-call`: new approve-plan tool (tick which of the things Claude is about to do may go ahead); honours `/lgtm`; works on mobile (no text inputs there) and is tested on terminal, desktop, VS Code and mobile.

- New `looks-good-to-me`: `/lgtm` variants (safe, decide, plan, push, yolo) are your auto-approval gate for one turn, with a chip and a log. `are-you-sure-bro` honours it (catastrophic commands always ask).

- Merged `are-we-there-yet` into `whats-in-the-box`: the status line, toasts and Compact chip now live next to the bar, so context % is shown once. Options moved with it.
- Removed `/who-does-this`; the `hey-you-do-it` skill is the routing table and `matchmaker` applies it to every prompt.

- Chip row: chips sort by rank (context, route, result) so the order is stable whichever plugin draws first, and the row wraps on a narrow terminal instead of cutting off buttons.
- `your-call`: shorthand for simple asks (`{question, options, recommended, why}` or `{question, yesno: true}`).

- Polish across the other plugins: one shared glyph set (`◆` decisions, `✦` routing, `■` context, `✓`/`✗` results, `◌` notes); the route, Compact and turn-result chips share a single row above the prompt instead of stacking; the route chip says who gets the work (`✦ design → spy`).
- `whats-in-the-box` pane: colored per-category bars with shares and free space. `sticky-notes` pane: add notes yourself, ☑/☐ markers, Clear done, empty state.

- Toasts no longer get cut off. The engine's toast box is at most 44 columns wide (40 for text), keeps 3 lines and joins everything after line 2 into line 3, so longer text is clipped. `tldr` now asks for a 3-line, 40-column summary and fits whatever comes back; the other toasts (`are-we-there-yet`, `stop-you-violated-the-law`, `your-call`) are tested against the same limit.

- `are-you-sure-bro` only asks about dangerous commands by default: `git merge` and pushes to main are never flagged, `rm -rf` is flagged only for `/`, home, `.`, globs and absolute paths outside /tmp, `--force-with-lease` is allowed. A `careful` level restores the broader list; noisy-output capping is opt-in.

- `your-call`: the spec is cleaned up before use (missing ids, string options, duplicates, over 8 options, bad criteria) and the model gets a clear error when it cannot be used.
- `your-call`: conditional steps (`showIf` picked/notPicked) with dependents reset when an earlier answer changes; review lines are buttons that jump back; compare steps have live 0-10 criterion weights, a weighted leader star, and weights/leader in the result.
- `your-call` features: veto options + Propose others, explain an option (re-ask with `resume` state), Decide later, Undo/Redo, how-sure row, up to 12 options (Show more), `/decisions` log with reopen, optional recommended-on-timeout.
- `your-call` fix: the ask tool no longer triggers the default permission prompt on top of its own pane; the rule also says to use it instead of the built-in AskUserQuestion, never both.
- `your-call` looks round 2: airy layout (blank line between options), ◉/○ and ☑/☐ markers, rule lines under the header and above the buttons, recommended options listed first.
- `your-call` pane: colors (recommended and pros green, cons red, review and warnings yellow), a progress strip for wizards, a key-hint footer.
- `your-call` thread: the ask row and the raw JSON result are replaced by a compact card (`◆ your call  Cache?  →  Redis`).
- `your-call` fewer clicks: recommended option preselected with a one-line why; picks remembered ("last time"); type your own answer; single-step panes confirm on pick (option `autoConfirm`).
- `your-call` trust: audience tally shown in the pane, compare scores labelled as estimates unless `measured`, reminder toast after 5 min and a "no answer" result after 30 (options `idleMinutes`, `giveUpMinutes`).
- `your-call`: simultaneous asks queue instead of hanging; wizard shows a hint until something is picked.

## 0.3.0 (unreleased)

- `matchmaker` also classifies destructive/ambiguous requests, comparisons and second-opinion requests and attaches the matching skill hint, so skills fire on implicit requests.
- New `how-did-that-go`: turn summary band (files, tests, time, cost).
- `are-we-there-yet`: Compact button above the prompt at the urgent level. It uses `$.command.run`; the host refuses `$.prompt.submit` with a leading `/`.
- Bands (`whats-in-the-box`, `matchmaker`, `are-we-there-yet`, `how-did-that-go`) now compose with each other instead of hiding one another.

## 0.2.0

- `whats-in-the-box`: colored context bar above the prompt (per-category segments, legend, Details button).
- Options for thresholds and defaults on `are-we-there-yet`, `stop-you-violated-the-law`, `matchmaker`, `tldr`, `are-you-sure-bro`, `whats-in-the-box`; `matchmaker` Off switch and `tldr` mode persist.
- `are-you-sure-bro`: many more risky patterns, sensitive-file write guard, fail-closed prompts.
- `your-call`: chart SVGs get a proper font, better contrast and label clamping.
- Hook-level tests (context bar, your-call pane and wizard, sticky-notes) alongside the pure-logic tests; CI workflow; per-plugin READMEs; `scripts/run-evals.sh`.

## 0.1.0

First release: ten plugins covering context, model routing, decisions, TL;DR and guardrails.
