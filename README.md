# danielriddell21-skills

Claude Code plugins for context hygiene, cheap model use, better decisions and TL;DRs.

```
/plugin marketplace add danielriddell21/skills
/plugin install your-call@danielriddell21-skills
```

*Mods* hot-reload; Claude Code asks once per session to enable them.

| Plugin | What it does |
|---|---|
| `do-you-need-all-that` | `/squish` (focused `/compact` line); `where-did-my-tokens-go` audit skill; hooks block whole reads of big files and re-inject git state after compaction |
| `are-we-there-yet` | Mod. `ctx 63%` in the status line, toasts at 50/70/85% |
| `whats-in-the-box` | Mod. `/whats-in-the-box`: tokens per category |
| `who-wants-the-job` | Agents `scout` (haiku), `engineer` (sonnet), `spy` and `sniper` (opus); `/who-does-this`, `/whats-the-damage` (token report); `hey-you-do-it` routing skill |
| `matchmaker` | Mod. Classifies each prompt and hints which agent to use |
| `stop-you-violated-the-law` | Mod. "STOP! You violated the law!" toast when opus handles a light turn |
| `your-call` | Mod. Choice tool: dialog, select, rank, compare matrix, wizard, "none fit?" regenerate. Draws fenced `viz` blocks (bars, quadrant, tree, flow) as in-thread charts. Skills: `ask-dont-guess`, `show-dont-tell`, `phone-a-friend` (second opinion), `ask-the-audience` (subagent vote) |
| `tldr` | Mod. `/tldr` = Verdict / Why / Next of the last answer; `/tldr off\|on\|auto\|smart` |
| `are-you-sure-bro` | Mod. Confirms risky commands, offers to cap noisy output |
| `sticky-notes` | Mod. `/sticky` checklist Claude edits via a tool |

## Development

```
scripts/validate.sh && scripts/test-shell.sh
claude plugin validate plugins/<mod> && claude plugin test plugins/<mod>
```

Early: unit-tested and validated, but nothing has run in a live session yet and `evals/triggers.json` is unrun. MIT, see `LICENSE`.
