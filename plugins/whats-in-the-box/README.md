# whats-in-the-box

Mod. Everything about context use, in one place.

- **Bar above the prompt:** one colored segment per category (messages, MCP tools, skills...), a legend of the top four, the percent, and a **Details** button.
- **Status line:** `■ ctx 63%`.
- **Toasts** at 50 / 70 / 85% (once per level).
- **Compact chip** from the urgent level: `■ context 90% [Compact]`, on the shared chip row above the prompt. It runs `/compact` with the same focus text `/squish` prints, through `$.command.run`, which I have not seen run a built-in command in a live session.
- **`/whats-in-the-box`** opens a pane: a header colored by how full you are, one row per category with its own bar and share, and the free space.

Options: `band` (true), `minPercent` (0), `notice` (50), `warn` (70), `urgent` (85), `compactButton` (true).
