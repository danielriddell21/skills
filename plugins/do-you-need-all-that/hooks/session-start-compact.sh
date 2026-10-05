#!/usr/bin/env bash
# After compaction, hand the pre-compact snapshot back to Claude, then delete it.
command -v jq >/dev/null || exit 0
sid=$(jq -r '.session_id // empty')
f="${TMPDIR:-/tmp}/ch-compact-$sid.md"
[ -n "$sid" ] && [ -f "$f" ] || exit 0
jq -n --rawfile c "$f" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'
rm -f "$f"
exit 0
