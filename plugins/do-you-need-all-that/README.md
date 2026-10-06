# do-you-need-all-that

Keeps the context window small.

- `/squish`: prints a focused `/compact` line to paste (the model cannot run `/compact` itself).
- Skill `where-did-my-tokens-go`: audits CLAUDE.md, MCP tools and skills; returns a table with verdicts and at most 5 cuts.
- Hook `PreToolUse` on Read: denies whole reads of text files over 40KB (set `CH_MAX_READ_BYTES` to change); images, PDFs, notebooks and SVGs are never blocked.
- Hooks `PreCompact` + `SessionStart(compact)`: snapshot branch and git status before compaction and hand it back after.

Needs `jq` for the hooks. Tests: `scripts/test-shell.sh`.
