#!/usr/bin/env bash
# Tests for the shell hooks/scripts (do-you-need-all-that, who-wants-the-job). Needs jq.
set -u; root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$root"
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT; err=0
ok(){ echo "ok: $1"; }; bad(){ echo "FAIL: $1"; err=1; }
g=plugins/do-you-need-all-that/hooks/guard-big-read.sh
head -c 50000 /dev/zero | tr '\0' a > "$t/big.txt"; cp "$t/big.txt" "$t/shot.PNG"; echo hi > "$t/small.txt"
rd(){ jq -nc --arg f "$1" --argjson x "${2:-{\}}" '{tool_input:({file_path:$f}+$x)}' | $g; }
rd "$t/big.txt" | grep -q deny && ok "big text denied" || bad "big text denied"
[ -z "$(rd "$t/big.txt" '{"limit":10}')" ] && ok "big text with limit allowed" || bad "limit"
[ -z "$(rd "$t/shot.PNG")" ] && ok "image allowed" || bad "image"
[ -z "$(rd "$t/small.txt")" ] && ok "small allowed" || bad "small"
# pre-compact -> session-start round trip
export TMPDIR="$t"
echo '{"session_id":"s1"}' | plugins/do-you-need-all-that/hooks/pre-compact.sh
echo '{"session_id":"s1"}' | plugins/do-you-need-all-that/hooks/session-start-compact.sh | jq -e '.hookSpecificOutput.additionalContext|contains("compaction")' >/dev/null && ok "snapshot re-injected" || bad "snapshot"
[ ! -e "$t/ch-compact-s1.md" ] && ok "snapshot consumed" || bad "snapshot cleanup"
[ -z "$(echo '{"session_id":"none"}' | plugins/do-you-need-all-that/hooks/session-start-compact.sh)" ] && ok "no snapshot, no output" || bad "empty"
# cost report
mkdir "$t/p"; cat > "$t/p/a.jsonl" <<'J'
{"message":{"model":"m1","usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":100,"cache_creation_input_tokens":20},"content":[{"type":"tool_use","name":"Read"}]}}
{"message":{"model":"m2","usage":{"input_tokens":3,"output_tokens":2},"content":[{"type":"tool_use","name":"Read"}]}}
J
out=$(plugins/who-wants-the-job/scripts/cost-report.sh 5 "$t/p")
echo "$out" | grep -q "^m1 | 10 | 5 | 100 | 20" && ok "cost by model" || bad "cost by model"
echo "$out" | grep -q "^Read | 2" && ok "cost by tool" || bad "cost by tool"
exit $err
