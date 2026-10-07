# matchmaker

Mod. A cheap classifier tags each prompt (search / implement / design / review / trivial) and adds a hidden hint naming the agent to use. Shows `route: <label>` in the status line and an **Off** button above the prompt (remembered across sessions).

Options: `enabled` (true), `minChars` (40). Costs one small model call per prompt; routing rules live in the `hey-you-do-it` skill.

Besides agent routes, three labels attach skill hints: `destructive-or-ambiguous` (follow `ask-dont-guess`), `compare-or-explain-flow` (follow `show-dont-tell`), `second-opinion` (follow `phone-a-friend` / `ask-the-audience`). This is how skills get triggered on implicit requests.

The chip reads `✦ design → spy [Off]` (label, then who gets the work). Small chips from different plugins share one row above the prompt instead of stacking.
