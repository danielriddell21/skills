# who-wants-the-job

Hire the cheapest worker that can do the job.

- Agents (TF2): `scout` (haiku, read-only search), `engineer` (sonnet, implements), `spy` (opus, design and plans), `sniper` (opus, read-only review).
- Skill `hey-you-do-it`: the single routing table (which agent, or inline) and when to delegate.
- `/whats-the-damage [n]`: token usage by model and tool from the last n session transcripts (`scripts/cost-report.sh`, needs `jq`).
- Mod `/crew`: a live pane of every subagent (model, progress, context %, estimated cost, time) with an animated little character per run (SVG on desktop and VS Code, glyph row in the terminal; reduced-motion stops the animation), plus a `♟ crew` chip in the shared chip row with a **Crew** button. Agents report their own steps through the `step` tool (`mcp__who-wants-the-job__step`); without it the bar shows context fill. Cost is a rough estimate from token counts (`PRICES` in `hooks/crew.ts`), not a bill. Option `autoOpen` opens the pane when the first agent starts.
