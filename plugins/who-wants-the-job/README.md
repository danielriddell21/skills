# who-wants-the-job

Hire the cheapest worker that can do the job.

- Agents (TF2): `scout` (haiku, read-only search), `engineer` (sonnet, implements), `spy` (opus, design and plans), `sniper` (opus, read-only review).
- Skill `hey-you-do-it`: the single routing table (which agent, or inline) and when to delegate.
- `/whats-the-damage [n]`: token usage by model and tool from the last n session transcripts (`scripts/cost-report.sh`, needs `jq`).
