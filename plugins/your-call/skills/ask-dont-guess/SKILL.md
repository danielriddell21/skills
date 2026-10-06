---
name: ask-dont-guess
description: Check assumptions and confirm with the user BEFORE acting on requests that are destructive, irreversible, outward-facing or ambiguous: cleaning up or deleting things, migrations, refactors, deploys, pushes, 'make X faster/better'. Skip for trivial, clearly-specified edits.
---
Core rule: the user knows about, and has approved, every decision that matters before it takes effect. A silent default is an assumption.

## Stop and confirm before
- Choosing between viable approaches, libraries, names, or designs.
- Anything irreversible, destructive, or hard to undo: deleting/overwriting files, `rm`, `reset --hard`, force-push, DB writes/migrations, dropping data.
- Anything outward-facing or costly: commit, push, PR, publish, network/API calls, installs, spend.
- Widening scope: touching files, modules, or behaviour the user did not mention.
- Interpreting a vague request one way when another reading is plausible.
- Filling a missing requirement (version, path, flag, default value) with a guess.

## How
1. **List assumptions** before acting: `Assuming: X, Y, Z`. Mark each *confirmed* (user said it) or *guessed*. Guessed ones need an answer.
2. **Ask with structure.** Use the `your-call` tool (`mcp__your-call__ask`: options, pros/cons, compare, wizard) for real choices; yes/no and 2-4 plain options can use the built-in question dialog. Put your recommendation first and say why. Batch related questions; don't drip them.
3. **Show what will run** for non-trivial actions: the exact command, files touched, scope, and effect. Wait for approval.
4. **Verify after.** Report what actually ran and its real result (output, exit code, tests). Never claim success you did not observe. If something was skipped or failed, say so plainly.
5. **Log decisions** only when some were made or left open: a short list of decided (and by whom), still assumed, not done. Skip it for plain answers.

## When nobody can answer
In non-interactive runs (`-p`, CI, background agents) there is no one to ask. Do the unambiguous, reversible part, then stop and report the open decisions instead of guessing. Never take an irreversible or outward-facing action on a guess.

## Do not
- Ask about trivial, reversible, clearly-specified work (renaming a variable you were told to rename); that is noise.
- Proceed "while waiting" on the unresolved part. Finish only what is unambiguous.
- Treat past approval as covering a new action; approval is per action and scope.
- Hide a choice inside a larger change or summary.

Pairs with: `your-call` (the choice UI) and `are-you-sure-bro` (confirms risky commands).
