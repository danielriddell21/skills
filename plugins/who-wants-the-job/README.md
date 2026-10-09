# who-wants-the-job

Hire the cheapest worker that can do the job.

- Agents (TF2): `scout` (haiku, read-only search), `engineer` (sonnet, implements), `spy` (opus, design and plans), `sniper` (opus, read-only review).
- Skill `hey-you-do-it`: the single routing table (which agent, or inline) and when to delegate.
- `/whats-the-damage [n]`: token usage by model and tool from the last n session transcripts (`scripts/cost-report.sh`, needs `jq`).
- Mod `/crew`: a live pane of every subagent (model, progress, context %, estimated cost, time) with each run as a row: its animated pixel crab on the left, then who it is, what it does, stats and a progress bar (SVG on desktop and VS Code, a glyph beside each line in the terminal; reduced-motion stops the animation), plus a `♟ crew` chip in the shared chip row with a **Crew** button. Agents report their own steps through the `step` tool (`mcp__who-wants-the-job__step`); without it the bar shows context fill. Cost is a rough estimate from token counts (`PRICES` in `hooks/crew.ts`), not a bill. The pane opens by itself when a crew agent (scout, engineer, spy, sniper) starts, whether `matchmaker` routed to it or you did; option `autoOpen: false` turns that off.
