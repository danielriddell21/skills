---
name: show-dont-tell
description: Use a chart or diagram instead of prose when asked to compare 2+ options, weigh tradeoffs, or explain a flow, architecture or how several parts connect. Skip for simple answers.
---
Use a visual only when it clearly beats prose. Work down this list and use the first route that is available.

## 1. In-thread chart (needs the `your-call` plugin's mod loaded)
Put a fenced `viz` block with JSON in the reply; `your-call` draws it in the thread (text chart in a terminal, SVG on desktop/VS Code/mobile). No file, no panel.

````
```viz
{"type":"bars","title":"Overall (my estimates)","values":{"Redis":21,"In-memory":16,"CDN":18}}
```
````

Types:
- `bars` {values:{label:n}, max?}
- `quadrant` {x, y, points:[{label, x:0-10, y:0-10}]}
- `tree` {nodes:[{label, children}]}
- `flow` {lanes:[[a,b,c]]}

One block per idea, short labels, a line of prose around it. If the mod is not loaded, the JSON shows as a code block: say so once and use route 2 or 3.

## 2. Rich visual in the side panel (needs `SendUserFile`)
Only if the `SendUserFile` tool exists in this session (cloud/desktop apps; not the plain CLI).

| Content | Format |
|---|---|
| Flow, sequence, state machine, ER, dependency graph | Mermaid (`.mmd`) |
| Architecture, layout, simple chart | SVG (`.svg`) |
| Scored comparison, sortable table, side-by-side | HTML (`.html`, self-contained: inline CSS/JS, cdnjs only) |

1. Write the file to your scratchpad: small, self-contained, light and dark safe (`prefers-color-scheme`), readable at narrow width.
2. Send it with `SendUserFile`, `display: "render"`, with a one-line caption saying what to look at.
3. Keep a short text TL;DR in the thread so the answer stands without the visual.
4. Use `Artifact` only if the user wants a shareable, persistent page.
5. If a `dataviz` skill is available, load it before building data charts.

## 3. Text fallback
Plain terminal, no mod: a markdown table or a unicode diagram (`A ──▶ B`, `├─ x`, `████░░ 6/10`).

## Visuals don't collect answers
A rendered visual is read-only: clicks never reach the model. After showing it, ask the choice through the `your-call` tool (`mcp__your-call__ask`) or the question dialog, using the same labels as the visual. Mark your recommended option in the visual.

## Design rules
- One idea per visual; label every axis, node and option with the names used in the `your-call` options.
- Show tradeoffs (cost/benefit, effort/impact), not decoration. No chart if two bullets say it.
- Colour never carries meaning alone (add text or shape); keep contrast accessible.
- Say when numbers are estimates ("scores are my estimates").

Pairs with: `your-call` (collect the choice), `ask-dont-guess` (flag guessed numbers), `tldr` (short summary).
