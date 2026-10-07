# looks-good-to-me

Your auto-approval gate. `/lgtm` pre-approves the questions Claude would otherwise ask you, for **the next turn only**.

| Variant | Approves |
|---|---|
| `/lgtm` (same as `/lgtm safe`) | picks the recommended option on `your-call` questions; low/medium-risk plan items (no commit/push, no deletes) |
| `/lgtm decide` | recommended options only |
| `/lgtm plan` | plan items only |
| `/lgtm push` | safe, plus commit/push plan items |
| `/lgtm yolo` (or `/lgtm fuck it`) | everything, dangerous commands and sensitive writes included |

`/lgtm off` closes it, `/lgtm log` lists what it approved, `/lgtm status` says where it stands. A bare `/lgtm` arms the `defaultVariant` option (safe).

How it behaves:
- **Armed, then active.** `/lgtm` arms it; it opens when your next prompt starts the turn and closes when the turn ends. Nothing is approved before that.
- **Visible.** A chip above the prompt (`✓ lgtm safe · 3 auto-approved`, `⚠` for yolo) with an **Off** button; a toast at the end of the turn; `/lgtm log` lists every approval.
- **Hooks into** `your-call` (picks, and plan items from its approve tool) and `are-you-sure-bro` (dangerous commands, sensitive writes) through shared state: the gate publishes what it allows, they read it and record what they approved. Without this plugin they simply ask.
- **Never approved**, even by yolo: with nothing recommended there is nothing to pick for you, and catastrophic commands (`rm -rf /` or `~`, `mkfs`, `dd` onto a device, `DROP DATABASE`) always ask.

The `lgtm` skill covers the other meaning: you typing "lgtm" about something just shown approves exactly that.
