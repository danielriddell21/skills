# your-call

Mod + skills for decisions.

**Tool** `mcp__your-call__ask` (Claude calls it instead of guessing; a system rule tells it when):
- 4 or fewer plain options: the built-in question dialog.
- Otherwise a focused pane: select or multi-select with detail and pros/cons, rank (Up/Down), compare matrix, multi-step wizard with Back and review. Each option can take a tweak note; a "none fit?" box makes Claude regenerate; Skip cancels.
- A step may carry `viz`: bars, quadrant, tree or flow, drawn as text charts that mark your pick.

**In-thread charts:** fenced `viz` JSON blocks in Claude's replies are drawn as charts in the thread (text in the terminal, SVG on desktop, VS Code and mobile).

**Skills**
- `ask-dont-guess`: list assumptions, ask before non-trivial or irreversible actions, show what will run, report what happened.
- `show-dont-tell`: picks a visual route (in-thread chart, side-panel file, text fallback) for complex answers.
- `phone-a-friend`: independent second opinion from a fresh subagent; disagreements go to you.
- `ask-the-audience`: 3-5 independent subagents vote; split votes go to you.
