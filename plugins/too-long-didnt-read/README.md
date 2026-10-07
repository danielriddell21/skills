# too-long-didnt-read

Mod. The command is still `/tldr`. **Depends on `your-call`**, which draws the charts (installing this plugin installs it).

- `/tldr` summarizes Claude's last answer as Verdict / Why / Next (one small model call). It answers in the thread as text.
- **Big answers get a chart.** In `auto` and `smart` mode, after a long answer this plugin publishes a small chart and `your-call` draws it above the prompt (`≡ TL;DR`, with **Hide**; SVG on desktop, VS Code and mobile). The shape is chosen by what the answer says:
  - it compares options with numbers or scores: **bars**
  - it is an ordered plan or procedure: **flow** (`plan ──▶ build ──▶ ship`)
  - anything else: a **tree** (Verdict, Why with its reasons, Next)

  If the model's chart can't be used, it falls back to the same Verdict / Why / Next tree built from a plain summary. The chart clears when you send your next prompt.
- If `your-call` is not loaded, it says so once ("TL;DR charts need the your-call plugin") and falls back to a toast. With the option `widget: false` the summary is always a toast. A toast shows as at most three lines of 40 columns, so it is requested and trimmed to that.

`/tldr off|on|auto|smart` sets the mode, remembered across sessions:
- **off**: nothing automatic.
- **on**: every answer uses the short shape (system prompt section).
- **auto**: a summary after any answer over 400 characters.
- **smart** (default): short shape for substantive answers, plus a summary only for big turns (1,200+ characters, 15+ lines, or 5+ tool calls).

Options: `defaultMode`, `widget`. The status line shows the mode as `tldr smart`.
