#!/usr/bin/env bash
# Validate every plugin and run every plugin's tests with the claude CLI.
set -u; root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$root"; err=0
for d in plugins/*/; do
  m=$(basename "$d")
  out=$(claude plugin validate "plugins/$m" 2>&1) || true
  echo "$out" | grep -q "Validation passed" && echo "ok: validate $m" || { echo "FAIL: validate $m"; echo "$out" | tail -5; err=1; }
  if ls "plugins/$m"/hooks/*.test.ts >/dev/null 2>&1; then
    out=$(claude plugin test "plugins/$m" 2>&1) || true
    echo "$out" | grep -q " 0 fail" && echo "ok: test $m" || { echo "FAIL: test $m"; echo "$out" | tail -15; err=1; }
  fi
done
exit $err
