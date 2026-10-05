---
description: Token usage by model/tool from recent session transcripts
argument-hint: "[number of sessions, default 5]"
---
Run `${CLAUDE_PLUGIN_ROOT}/scripts/cost-report.sh $ARGUMENTS` and show its output as-is. Then add at most 3 savings suggestions grounded in the numbers (e.g. high opus input on light turns -> route to sonnet/haiku; many large tool results -> cap output; low cache_read vs cache_write -> stop changing tools/model mid-session). If it reports no transcripts, say transcripts are not stored here and stop.
