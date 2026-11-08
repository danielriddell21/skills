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

| The complexity is in… | Offer |
|---|---|
| how parts connect, where the coupling is | `graph` (mark hubs and cycles `hot`) |
| a system or idea too big to take in at once | `tour`: a guided walkthrough of the graph, one stage per step |
| who calls whom, in what order | `sequence` |
| steps, a pipeline, a lifecycle | `flow` |
| a hierarchy, a breakdown | `tree` |
| tradeoffs between options | a markdown table (options × criteria), or `scatter` with `quadrant` for two axes |
| sizes, counts, a ranking | `bars` |

## 3. Draw the one picked
Use the first route that works:

1. **In the thread** (the `picture-this` mod is loaded, and the picture fits: ≤24 nodes, ≤30 messages). A fenced `ui` block, one JSON component per line, inside a prose answer:
   ````
   ```ui
   {"type":"graph","title":"Checkout services","nodes":[{"id":"gw","label":"API gateway","hot":true,"note":"every call passes here"},{"id":"cart","label":"Cart"},{"id":"q","label":"Event queue"}],"edges":[["gw","cart"],["cart","q","paid"],["q","cart","retry"]]}
   ```
   ````
   A **tour** walks the user through a graph: Back / Next light each step's parts and dim the rest, with a caption, locally and with no model call. Order steps the way you would explain it at a whiteboard: entry point first, then the main path, then the hard part (the cycle, the hub), then what it means. 2–12 steps, a sentence each:
   `{"type":"tour","title":"Checkout","nodes":[…as graph…],"edges":[…],"steps":[{"focus":["web","gw"],"text":"Every request enters at the gateway"},{"focus":["cart","pay","q"],"text":"A failed payment loops back through the queue"}]}`

   `{"type":"sequence","actors":["Client","API","DB"],"steps":[["Client","API","POST /login"],["API","DB","lookup"],["API","Client","200"]]}` · `{"type":"flow","lanes":[["plan","build","ship"]]}` · `{"type":"tree","nodes":[{"label":"x","children":[{"label":"y"}]}]}` · `{"type":"bars","values":{"A":3},"unit":"ms"}` · `{"type":"scatter","x":"effort","y":"impact","points":[{"label":"A","x":2,"y":8}],"quadrant":true}`. The `mcp__picture-this__show` tool takes the same components as `{title, components}` when the picture is the whole answer. If the JSON shows as a code block, the mod is not loaded: say so once and use route 2 or 3.
2. **Side panel** (`SendUserFile` exists: cloud and desktop apps), for pictures too big for the thread or when the mod is missing. Write a Mermaid file (`.mmd`: `flowchart LR`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`) to your scratchpad and send it with `display: "render"` and a one-line caption; the app draws Mermaid itself, with pan and zoom. Use `.html` only for something Mermaid cannot do: a guided demo of a big idea that needs more than a lit graph (stages that add parts, animation, a toy you can poke), as one self-contained page with Back / Next and a step caption, light and dark safe. Load `dataviz` first for data charts.
3. **Text**: a markdown table, or a text diagram (`A ──▶ B`, `├─ x`, `1. A → B: msg`).

Matrices are always a plain markdown table: every surface draws it natively, and it copies cleanly.

## 4. Rules
- The text answer must stand without the picture; the picture shows the shape, the text says what it means.
- Same names in the picture as in the text; short labels; one idea per picture.
- `hot` only the 1–3 places the complexity lives, and say why in `note`.
- Say when it is your reading or an estimate ("my reading of the code", "scores are my estimates"); never invent data.
- Built from code you read: name what you left out ("tests and config not shown").

Pairs with: `your-call` (a decision with pros, cons or ranking), `too-long-didnt-read` (its summary charts are drawn by picture-this).
