#!/usr/bin/env bash
# Token usage by model and tool from the latest N session transcripts of this project.
# Usage: cost-report.sh [N=5] [transcript_dir]
command -v jq >/dev/null || { echo "jq required"; exit 1; }
n=${1:-5}
dir=${2:-$HOME/.claude/projects/$(pwd | sed 's#[/.]#-#g')}
files=$(ls -t "$dir"/*.jsonl 2>/dev/null | head -n "$n")
[[ -n "$files" ]] || { echo "no transcripts in $dir"; exit 1; }
echo "Transcripts: $(echo "$files" | wc -l) from $dir"
echo
echo "model | input | output | cache_read | cache_write"
cat $files | jq -rs '
  [.[] | select(.message.usage?) | {m:(.message.model // "?"), u:.message.usage}]
  | group_by(.m)[]
  | [.[0].m,
     (map(.u.input_tokens // 0) | add),
     (map(.u.output_tokens // 0) | add),
     (map(.u.cache_read_input_tokens // 0) | add),
     (map(.u.cache_creation_input_tokens // 0) | add)]
  | join(" | ")'
echo
echo "tool | calls"
cat $files | jq -rs '
  [.[] | .message.content? | arrays | .[] | select(.type=="tool_use") | .name]
  | group_by(.) | map({t:.[0], c:length}) | sort_by(-.c) | .[:5][] | "\(.t) | \(.c)"'
echo
echo "tool results over 20KB:"
cat $files | jq -rs '
  [.[] | .message.content? | arrays | .[] | select(.type=="tool_result")
   | (.content | if type=="array" then map(.text // "") | join("") else (. // "") | tostring end)
   | length | select(. > 20000)] | length | "\(.) large result(s)"'
