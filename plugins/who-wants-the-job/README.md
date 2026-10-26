# who-wants-the-job

Hire the cheapest worker that can do the job.

- Agents (TF2): `scout` (haiku, read-only search), `engineer` (sonnet, implements), `spy` (opus, design and plans), `sniper` (opus, read-only review).
- Skill `hey-you-do-it`: the single routing table (which agent, or inline) and when to delegate.
- `/whats-the-damage [n]`: token usage by model and tool from the last n session transcripts (`scripts/cost-report.sh`, needs `jq`).
- Live panel: install [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) from `claude-kit` and set its `autoOpen` option to `any`, so the panel also opens for scout, engineer, spy and sniper. They do not report steps, so their bars show context fill (in grey).
