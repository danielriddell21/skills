#!/usr/bin/env bash
# Snapshot cheap-to-capture state before compaction; session-start-compact.sh re-injects it.
command -v jq >/dev/null || exit 0
sid=$(jq -r '.session_id // empty')
[ -n "$sid" ] || exit 0
dir="${CLAUDE_PROJECT_DIR:-.}"
{
  echo "State captured before compaction:"
  echo "branch: $(git -C "$dir" branch --show-current 2>/dev/null)"
  git -C "$dir" status --short 2>/dev/null | head -30
} > "${TMPDIR:-/tmp}/ch-compact-$sid.md"
exit 0
