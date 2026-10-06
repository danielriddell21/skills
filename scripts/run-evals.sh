#!/usr/bin/env bash
# Runs evals/triggers.json: for each prompt, does headless Claude invoke the skill?
# Usage: scripts/run-evals.sh [parallel=4]   (spends tokens; needs the claude CLI)
set -u; root="$(git rev-parse --show-toplevel)"; cd "$root"
par=${1:-4}; out=$(mktemp -d); work=$(mktemp -d); (cd "$work" && git init -q)
dirs=$(for d in plugins/*/; do printf -- "--plugin-dir %s " "$root/$d"; done)
jq -r '.skills | to_entries[] | .key as $k | (.value.should[]? | [$k,"should",.]), (.value.should_not[]? | [$k,"should_not",.]) | @tsv' evals/triggers.json > "$out/cases.tsv"
run(){ IFS=$'\t' read -r skill kind prompt <<<"$1"; id=$(echo "$skill-$kind-$RANDOM")
  hit=$(cd "$work" && timeout 180 claude -p "$prompt" $dirs --output-format stream-json --verbose --max-turns 3 --permission-mode plan 2>/dev/null \
    | jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use" and .name=="Skill") | .input.skill' 2>/dev/null | tr '\n' ' ')
  echo -e "$skill\t$kind\t$prompt\t$hit" >> "$out/results.tsv"; }
export -f run; export out work dirs
tr '\n' '\0' < "$out/cases.tsv" | xargs -0 -P "$par" -I{} bash -c 'run "$1"' _ {}
python3 - "$out/results.tsv" <<'P'
import sys,collections
ok=bad=0
for l in sorted(open(sys.argv[1])):
    skill,kind,prompt,hit=(l.rstrip('\n').split('\t')+[''])[:4]
    fired=any(skill in h for h in hit.split())
    good=fired if kind=='should' else not fired
    ok+=good; bad+=not good
    print(('PASS ' if good else 'FAIL ')+f'{skill:24} {kind:10} fired=[{hit.strip()}]  {prompt[:60]}')
print(f'{ok} pass, {bad} fail')
P
