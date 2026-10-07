# your-call

Mod + skills for decisions.

**Tool** `mcp__your-call__ask` (Claude calls it instead of guessing; a system rule tells it when):
- 4 or fewer plain options: the built-in question dialog.
- Otherwise a focused pane: select or multi-select with detail and pros/cons, rank (Up/Down), compare matrix, multi-step wizard with Back and review. Each option can take a tweak note; a "none fit?" box makes Claude regenerate; Skip cancels.
- `showIf` makes a step conditional on an earlier answer; changing that answer resets the steps that depended on it. The review screen's lines jump back to a step.
- Compare steps: live 0-10 weights per criterion (Claude may preset them), a ★ on the weighted leader, and weights plus leader in the result.
- Looks: colored options, a progress strip for wizards, a footer of key hints. In the thread the ask row and its result are drawn as a compact card.
- Fewer clicks: `recommended: true` on an option preselects it (with the step's one-line `why`); your last pick for the same question is marked "last time"; a text box takes your own answer; in a single-step pane picking an option confirms it.
- Trust: an `audience` tally from `ask-the-audience` is charted in the pane; compare scores are labelled as estimates unless `measured`; a toast reminds you after `idleMinutes` (5), and Claude is told there was no answer after `giveUpMinutes` (30).
- More: **veto** (✕) options you will never accept and **Propose others**; **?** asks Claude to explain an option (it re-asks with your state); **Decide later** returns "deferred"; Undo/Redo for picks and weights; a low/medium/high **how sure?** row; up to 12 options (6 shown, the rest behind "Show more"); `/decisions` lists this session and `/decisions <n>` puts a reopen request in the prompt box.
- Options: `autoConfirm`, `rememberPicks`, `idleMinutes`, `giveUpMinutes`, `confidence`, `timeoutPick` (use the recommended option if you never answer).
- A step may carry `viz`: bars, quadrant, tree or flow, drawn as text charts that mark your pick.

**In-thread charts:** fenced `viz` JSON blocks in Claude's replies are drawn as charts in the thread (text in the terminal, SVG on desktop, VS Code and mobile).

**Skills**
- `ask-dont-guess`: list assumptions, ask before non-trivial or irreversible actions, show what will run, report what happened.
- `show-dont-tell`: picks a visual route (in-thread chart, side-panel file, text fallback) for complex answers.
- `phone-a-friend`: independent second opinion from a fresh subagent; disagreements go to you.
- `ask-the-audience`: 3-5 independent subagents vote; split votes go to you.

**Approve-plan tool** `mcp__your-call__approve`: before doing several things the user has not seen, Claude lists them (`label`, `command`, `risk` low/medium/high, `action` read/edit/ship/delete/other). A pane shows each with a tick (low and medium start ticked, high-risk and deletes start unticked), an optional note, and **Approve selected / Approve all / Reject all / Skip**. Claude does only what comes back in `approved`.

**Simple asks** need only `{question, options: ["A","B"], recommended: "A", why}` or `{question, yesno: true}`.

**With `/lgtm`** (looks-good-to-me): questions whose options include a recommended one are answered for you, and plan items the variant covers come back pre-approved (shown as "auto-approved" in the pane). Everything it approves is recorded and listed by `/lgtm log`. Without that plugin nothing changes.

Mobile has no text inputs, so the boxes become buttons there (`None fit`).

