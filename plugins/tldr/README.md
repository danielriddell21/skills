# tldr

Mod. `/tldr` summarizes Claude's last answer as Verdict / Why / Next (one small model call).

`/tldr off|on|auto|smart` sets the mode, remembered across sessions:
- **off**: nothing automatic.
- **on**: every answer uses the short shape (system prompt section).
- **auto**: a summary toast after any answer over 400 characters.
- **smart** (default): short shape for substantive answers, plus a toast only for big turns (1,200+ characters, 15+ lines, or 5+ tool calls).

Option: `defaultMode`.
