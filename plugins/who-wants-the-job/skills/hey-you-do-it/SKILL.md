---
name: hey-you-do-it
description: Routing table for which agent or model should do a task (scout, engineer, spy, sniper, or inline). Use when asked which agent/model to use, when a task mixes investigation and implementation, or before reading many files yourself.
---
Single source for routing (the `matchmaker` mod applies this table to each prompt).

| Task | Agent (model) |
|---|---|
| Find, read, grep, map, summarize | `scout` (haiku) |
| Clear spec, local or mechanical edit, tests | `engineer` (sonnet) |
| Ambiguous, cross-cutting or risky design | `spy` (opus), then `engineer` |
| Pre-merge check of a non-trivial diff | `sniper` (opus) |
| Under ~3 lines, or needs back-and-forth | inline, no agent |

Rules:
- Pick the cheapest agent that fits the task type. Escalate a model only after a failed attempt; the exception is design/review rows, which start on opus.
- Delegate when: many files to read, noisy output, independent subtasks (run in parallel), you only need a conclusion. Stay inline when the result needs your full context.
- Brief the agent fully (goal, paths, output format and length cap); it starts cold. Ask for a summary, not dumps.
- Never use opus for a config-line edit.
