#!/usr/bin/env bash
# Validate marketplace + plugin manifests, frontmatter, hook scripts.
set -u; root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$root"; err=0
bad(){ echo "FAIL: $*"; err=1; }
jq empty .claude-plugin/marketplace.json 2>/dev/null || bad "marketplace.json invalid"
while read -r n s; do
  [ -d "$s" ] || { bad "$n: source $s missing"; continue; }
  jq -e --arg n "$n" '.name==$n' "$s/.claude-plugin/plugin.json" >/dev/null 2>&1 || bad "$n: plugin.json missing/name mismatch"
done < <(jq -r '.plugins[]|"\(.name) \(.source)"' .claude-plugin/marketplace.json)
for f in $(find plugins -name SKILL.md -o -path '*/agents/*.md' -o -path '*/commands/*.md'); do
  head -1 "$f" | grep -q '^---$' || bad "$f: no frontmatter"
  grep -q '^description:' "$f" || bad "$f: no description"
done
for f in $(find plugins -name hooks.json); do jq empty "$f" || bad "$f invalid"; done
for f in $(find plugins -name '*.sh'); do [ -x "$f" ] || bad "$f not executable"; bash -n "$f" || bad "$f syntax"; done
[ $err = 0 ] && echo OK
exit $err
