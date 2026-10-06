# matchmaker

Mod. A cheap classifier tags each prompt (search / implement / design / review / trivial) and adds a hidden hint naming the agent to use. Shows `route: <label>` in the status line and an **Off** button above the prompt (remembered across sessions).

Options: `enabled` (true), `minChars` (40). Costs one small model call per prompt; routing rules live in the `hey-you-do-it` skill.
