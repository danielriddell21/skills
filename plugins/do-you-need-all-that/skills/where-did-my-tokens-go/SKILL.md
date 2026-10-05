---
name: where-did-my-tokens-go
description: Audit what is consuming context (CLAUDE.md size, MCP servers/tools, skills, large files in session) and recommend cuts. Use when context fills fast, sessions feel sluggish, or user asks about context usage.
---
1. Run `/context` (or ask user to) for the breakdown.
2. Measure: `wc -c` over `CLAUDE.md`, `~/.claude/CLAUDE.md`, nested `*/CLAUDE.md` (use `find . -name CLAUDE.md -not -path './node_modules/*'`) and `find .claude -name '*.md'` (rules, commands, agents); count MCP servers/tools; list skills + description lengths.
3. Report table: item | est tokens (chars/4) | verdict (keep/trim/lazy-load/remove).
4. Recommend, biggest win first: disable unused MCP servers, shorten skill descriptions, trim CLAUDE.md (move situational sections to docs it links to), subagents for read-heavy work.
Output: table + max 5 actions. No essays.
