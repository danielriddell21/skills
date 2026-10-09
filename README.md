# danielriddell21-skills

Claude Code plugins for context hygiene, cheap model use, better decisions and TL;DRs.

```
/plugin marketplace add danielriddell21/skills
/plugin install your-call@danielriddell21-skills
```

*Mods* hot-reload; Claude Code asks once per session to enable them.

### `do-you-need-all-that`

*Keep the context window small*

| Part | Type | What it does |
|---|---|---|
| /squish | command | Prints a focused `/compact` line to run |
| where-did-my-tokens-go | skill | Audits what is eating context |
| big-read guard | hook | Blocks whole reads of big text files |
| compaction reminder | hook | Hands git state back after compaction |

### `whats-in-the-box`

*Know how full the window is*

| Part | Type | What it does |
|---|---|---|
| context bar | mod | Bar, status line, toasts, Compact chip |
| /whats-in-the-box | command | Opens the per-category context pane |

### `who-wants-the-job`

*Cheapest worker that can do the job*

| Part | Type | What it does |
|---|---|---|
| scout, engineer, spy, sniper | agent | Search, build, plan, review (haiku, sonnet, opus, opus) |
| hey-you-do-it | skill | The routing table: who does what |
| /whats-the-damage | command | Token usage by model and tool |
| /crew | mod | Live subagent pane: animated characters, progress, context, cost; a chip opens it |

### `matchmaker`

*mod* — Tags each prompt, hints the agent or skill

### `stop-you-violated-the-law`

*mod* — Toast when opus does a light job

### `your-call`

*Decisions Claude asks you to make*

| Part | Type | What it does |
|---|---|---|
| ask | tool | Choice UI: select, rank, compare, wizard |
| approve | tool | Tick which planned actions may go ahead |
| charts | mod | Draws `viz` blocks as in-thread charts |
| /decisions | command | Lists this session's decisions |
| ask-dont-guess | skill | List assumptions, confirm before acting |
| show-dont-tell | skill | Chart or diagram for complex answers |
| phone-a-friend | skill | Second opinion from a fresh subagent |
| ask-the-audience | skill | Poll 3-5 subagents and tally |

### `looks-good-to-me`

*Your auto-approval gate*

| Part | Type | What it does |
|---|---|---|
| /lgtm | command | Pre-approve for one turn: safe, decide, plan, push, yolo |
| lgtm | skill | Your "lgtm" approves what was just shown |

### `are-you-sure-bro`

*mod* — Asks before dangerous commands and writes

### `too-long-didnt-read`

*mod* — `/tldr` summary; a small summary is a toast, a bigger one a chart (bars, flow or tree) under the answer, drawn by `your-call` (a dependency); modes off, on, auto, smart

### `tell-me-the-damage`

*mod* — Chip after each turn: files, tests, time, cost

Each plugin has its own README with the details.

The small status chips (route `✦`, context `■`, turn result `✓`/`✗`) share one row above the prompt; decisions use `◆`, notes `◌`.

## Development

```
scripts/validate.sh && scripts/test-shell.sh
scripts/check-mods.sh                  # claude plugin validate + test for every plugin
scripts/run-evals.sh                   # skill trigger evals (spends tokens)
```

Early: validated, unit-tested, and hook-level tested with the plugin test kit (panes, wizard, context bar), but not yet used in a live interactive session. Skill trigger evals (`scripts/run-evals.sh`, results in `evals/results.md`): 15 of 24 pass; skills fire when named but rarely on implicit requests. Static overhead is roughly 1k tokens per turn (cached). MIT, see `LICENSE`.
