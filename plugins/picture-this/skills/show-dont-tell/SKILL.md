---
name: show-dont-tell
description: Visualise complexity and big ideas. Use when an answer involves many connected parts (services, modules, call chains, dependencies), a multi-step or multi-actor flow, a cycle or fan-out, a state machine, or several options weighed on several criteria; a big idea or design to explain in stages; also when the user asks for a diagram, walkthrough, demo or picture. Judge whether it is complex enough, offer picture options, draw the one picked. Skip for simple answers.
---
A picture earns its place only when the thing is too complex to hold in your head from prose. Work through four steps.

## 1. Is it complex enough?
Count what the answer has to convey. Draw only if **one** of these holds:

| Signal | Threshold |
|---|---|
| Parts with links between them (services, modules, tables, classes) | 6+ parts and 6+ links |
| Shape that prose hides | any cycle, a hub with 4+ links, a fan-out/fan-in |
| Steps | 5+ with a branch, retry or loop, or 3+ actors handing off |
| States | 4+ states with transitions |
| Options weighed | 3+ options on 3+ criteria |
| Size of a change | touches 5+ files or modules that depend on each other |
| A big idea | an architecture, design or concept that only makes sense built up in 3+ stages |

Below that, answer in text and stop: no offer, no picture. Never offer for a fact, a fix, a single step, or two options.

## 2. Tell the user and offer options (skip if they already asked for a picture)
Answer first in text. Then one line saying what makes it complex, with the numbers: "This is 9 services, 14 calls, and a retry cycle between Cart and Queue."

Offer 2–3 pictures that fit, plus "Text is fine". Use **AskUserQuestion** when you have it: one question, header `Picture`, each option a picture with a `preview` that is a 3–6 line text sketch of it (`API ─▶ Auth, Cart`, `1. Client → API: login`), the best fit first and marked `(Recommended)`. Without AskUserQuestion, end the answer with one line naming the options and wait.

Pick from three **modes**, for **one idea** or **several options**:

| Mode | One idea | Several options |
|---|---|---|
| **Static**: the shape | `graph` (+ `hot`, `heat`), `sequence`, `flow`, `swimlane`, `tree`, `treemap`, `matrix`, `sankey` | `radar`, `scatter` with `quadrant`, a markdown table |
| **Before / after**: what changes | `compare` with Today and After; a `graph` with `change` marks (a diff, a PR's blast radius) | `compare` with Today, Option A, Option B |
| **Guided**: step by step | `tour` (Back / Next), `storyboard` (every step at once), `sequence` with `animate`, `graph` with `inside` (zoom in), `timeline` | a `tour` that walks each option and ends on the comparison |

| The complexity is in… | Offer |
|---|---|
| how parts connect, where the coupling is | `graph` (hubs and cycles `hot`), `matrix` (who imports whom) |
| where the risk or load lives | `graph` with `heat` (churn, bugs, load), `treemap` (size, with changed files `hot`) |
| what a change does | `compare` (Today / After), or a `graph` with `change` marks |
| which option | `compare` (each option against Today), `radar` (4–6 criteria), `scatter` with `quadrant` (two axes) |
| a system or idea too big to take in at once | `tour`, `storyboard`, or a `graph` with `inside` parts to zoom into |
| who calls whom, in order | `sequence` (`animate` to replay it) |
| who owns which step | `swimlane` |
| what happened when | `timeline` (spans and moments; `hot` the one that matters) |
| how much goes where | `sankey` |
| steps, a pipeline | `flow` · a hierarchy: `tree` · a ranking: `bars` |

## 3. Draw the one picked
Use the first route that works:

1. **In the thread** (the `picture-this` mod is loaded, and the picture fits: ≤24 nodes, ≤30 messages). A fenced `ui` block, one JSON component per line, inside a prose answer:
   ````
   ```ui
   {"type":"graph","title":"Checkout services","nodes":[{"id":"gw","label":"API gateway","hot":true,"note":"every call passes here"},{"id":"cart","label":"Cart"},{"id":"q","label":"Event queue"}],"edges":[["gw","cart"],["cart","q","paid"],["q","cart","retry"]]}
   ```
   ````
   One JSON per line; every component takes `title`. Graph-shaped ones share `nodes` (`"id"` or `{id, label, hot?, note?, heat?: 0-1, change?: "added"|"removed"|"changed", inside?: {nodes, edges}}`) and `edges` (`[from, to, label?]` or `{from, to, label?, change?}`):
   - `graph` {nodes, edges, heatLabel?}: with `inside`, the user zooms in (⊕) and back, locally.
   - `compare` {panels: [{label, nodes, edges}, …]}: 2–3 panels; the first is the baseline; the same ids across panels; added parts green, removed ones red and dashed, all on one layout so only the changes move.
   - `tour` {nodes, edges, steps: [{focus: [ids], text}]}: Back / Next light each step's parts and dim the rest. Order the steps the way you would at a whiteboard: the entry point, the main path, the hard part (the cycle, the hub), what it means. 2–12 steps, a sentence each.
   - `storyboard`: a tour's fields, every step drawn at once as small frames (it suits screenshots and PRs).
   - `sequence` {steps: [[from, to, label]], animate?}: `animate` replays the messages in order, with a ↻ control (desktop and mobile).
   - `swimlane` {steps: [[lane, label]]} · `timeline` {items: [{label, start, end?, hot?}]} (start/end as numbers, `"HH:MM"` or dates; one kind per timeline) · `flow` {lanes: [[a, b, c]]}
   - `tree` {nodes: [{label, children}]} · `treemap` {values: {"src/a.ts": 120}, hot?: [paths], unit?} · `matrix` {rows, cols, values: [[n]]} · `sankey` {links: [[from, to, value]], unit?}
   - `bars` {values} · `scatter` {x, y, points: [{label, x, y}], quadrant?} · `radar` {axes: [3–8], series: {name: [n…]}, max?}

   The `mcp__picture-this__show` tool takes the same components as `{title, components}` when the picture is the whole answer. If the JSON shows as a code block, the mod is not loaded: say so once and use route 2 or 3.
2. **Side panel** (`SendUserFile` exists: cloud and desktop apps), for pictures too big for the thread or when the mod is missing. Write a Mermaid file (`.mmd`: `flowchart LR`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`) to your scratchpad and send it with `display: "render"` and a one-line caption; the app draws Mermaid itself, with pan and zoom. Use `.html` only for something Mermaid cannot do: a guided demo of a big idea that needs more than a lit graph (stages that add parts, animation, a toy you can poke), as one self-contained page with Back / Next and a step caption, light and dark safe. Load `dataviz` first for data charts.
3. **Text**: a markdown table, or a text diagram (`A ──▶ B`, `├─ x`, `1. A → B: msg`).

Matrices are always a plain markdown table: every surface draws it natively, and it copies cleanly.

## 4. Rules
- The text answer must stand without the picture; the picture shows the shape, the text says what it means.
- Same names in the picture as in the text; short labels; one idea per picture.
- `hot` only the 1–3 places the complexity lives, and say why in `note`. `heat` only from a real measure (git log, coverage, metrics), named in `heatLabel`.
- In `compare`, keep ids stable across panels; that is what makes the diff.
- Put the title in `title`, never as a text node: the host draws it, in the reply's own type. Colours come from the user's Claude theme; never name colours in labels ("the orange box"), name the part.
- Say when it is your reading or an estimate ("my reading of the code", "scores are my estimates"); never invent data.
- Built from code you read: name what you left out ("tests and config not shown").

Pairs with: `your-call` (a decision with pros, cons or ranking), `too-long-didnt-read` (its summary charts are drawn by picture-this).
