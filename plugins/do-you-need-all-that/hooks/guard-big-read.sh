#!/usr/bin/env bash
# Deny full Read of big files (>MAX_BYTES, default 40KB) unless offset/limit given.
command -v jq >/dev/null || exit 0
in=$(cat)
f=$(jq -r '.tool_input.file_path // empty' <<<"$in")
lim=$(jq -r '.tool_input.limit // empty' <<<"$in")
off=$(jq -r '.tool_input.offset // empty' <<<"$in")
[[ -n "$lim$off" ]] && exit 0
[[ -f "$f" ]] || exit 0
# Images, PDFs and notebooks have their own Read modes; never block them.
case "${f,,}" in
  *.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.ipynb|*.svg) exit 0 ;;
  *) ;;
esac
sz=$(wc -c <"$f")
if [[ "$sz" -gt "${CH_MAX_READ_BYTES:-40000}" ]]; then
  jq -n --arg r "File is ${sz} bytes. Grep for what you need, then Read with offset+limit." \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
fi
exit 0
