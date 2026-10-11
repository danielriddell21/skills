---
name: show-dont-tell
description: Use a chart, table, diagram, map or live calculator instead of prose when asked to compare 2+ options, weigh tradeoffs, show a trend or share, explain a flow, architecture or how parts connect, plan a route, or work through a what-if calculation. Skip for simple answers.
---
Use a visual only when it clearly beats prose. Work down this list and use the first route that is available.

## 1. Native UI in the thread (needs the `picture-this` plugin's mod loaded)
Put a fenced `ui` block in the reply, **one JSON component per line**, with a line of prose around it. `picture-this` draws it natively: text in a terminal, SVG on desktop, VS Code and mobile. When the picture is the whole answer, the `mcp__picture-this__show` tool takes the same components as `{title, components: [...]}`.

````
```ui
{"type":"bars","title":"Overall (my estimates)","values":{"Redis":21,"In-memory":16,"CDN":18}}
{"type":"stat","label":"Best fit","value":"Redis","note":"lowest p95 at our load"}
```
````

| Job | Component |
|---|---|
| Magnitudes, ranking | `bars` {values:{label:n}, max?, unit?} |
| Change over time | `line` {x:[labels], series:{name:[n…]}, unit?} (≤ 4 series, one axis) |
| Two measures, effort/impact | `scatter` {x, y, points:[{label,x,y}], quadrant?} (quadrant: 0-10 with midlines) |
| Shares of a whole | `pie` {values} (folded to 4 slices) |
| Exact values, records | `table` {columns, rows} (user can sort) |
| Hierarchy | `tree` {nodes:[{label, children}]} |
| Ordered steps | `flow` {lanes:[[a,b,c]]} |
| Parts and how they connect | `graph` {nodes:[{id,label}], edges:[[from,to,label?]]} |
| One option, a place, a result | `card` {title, body?, fields?, tags?} · `stat` {label, value, delta?, note?} |
| Places, a route | `map` {stops:[{label, lat?, lon?, note?}]} (schematic: numbered stops, no tiles) |
| What-if numbers | `calc` {inputs:[{id,label,value,min,max,step,unit?}], outputs:[{id?,label,formula,unit?,digits?}]} |
| The user picks | `choice` {id, label, options} |
| Hand the answer back | `send` {label, prompt:"Go with {plan} at {rate}%"} |

Live controls run locally with no model call: the user drags a slider or presses − / +, and outputs recompute. Formulas use numbers, input ids, `+ - * / % ^`, and `min max abs round floor ceil sqrt pow log exp`; an output with an `id` can feed later ones. A `send` button fills `{id}`s from the block's controls and puts the prompt in the user's input box. It never sends by itself, so the user reviews and presses Enter.

If the mod is not loaded, the JSON shows as a code block: say so once and use route 2 or 3. Older ```viz blocks (bars, quadrant, tree, flow) still draw.

## 2. Rich visual in the side panel (needs `SendUserFile`)
Only if the `SendUserFile` tool exists in this session (cloud/desktop apps; not the plain CLI), and only for what route 1 cannot do (a real map, 3D, a dense interactive page).

1. Write a small, self-contained file to your scratchpad (`.mmd`, `.svg` or `.html` with inline CSS/JS), light and dark safe, readable at narrow width.
2. Send it with `SendUserFile`, `display: "render"`, with a one-line caption.
3. Keep a short text TL;DR in the thread so the answer stands without the visual.
4. If a `dataviz` skill is available, load it before building data charts.

## 3. Text fallback
Plain terminal, no mod: a markdown table or a unicode diagram (`A ──▶ B`, `├─ x`, `████░░ 6/10`).

## Collecting a decision
A `choice` plus `send` hands values back. For a real decision with pros, cons, ranking or several steps, ask through the `your-call` tool (`mcp__your-call__ask`) with the same labels as the picture, and mark your recommended option in both.

## Design rules
- One idea per block; label every axis, node and option with the names used in the text.
- Show tradeoffs, not decoration. No picture if two bullets say it.
- Colour never carries meaning alone (labels and legends are drawn); keep one axis per chart.
- Say when numbers are estimates or sample data ("scores are my estimates"); never invent live data.
- Every control must change an output; validate in the formula rather than showing nonsense (outputs that cannot be computed show "—").

Pairs with: `your-call` (collect the choice), `ask-dont-guess` (flag guessed numbers), `too-long-didnt-read` (its summary charts are drawn by picture-this).
