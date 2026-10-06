# Changelog

## 0.2.0

- `whats-in-the-box`: colored context bar above the prompt (per-category segments, legend, Details button).
- Options for thresholds and defaults on `are-we-there-yet`, `stop-you-violated-the-law`, `matchmaker`, `tldr`, `are-you-sure-bro`, `whats-in-the-box`; `matchmaker` Off switch and `tldr` mode persist.
- `are-you-sure-bro`: many more risky patterns, sensitive-file write guard, fail-closed prompts.
- `your-call`: chart SVGs get a proper font, better contrast and label clamping.
- Hook-level tests (context bar, your-call pane and wizard, sticky-notes) alongside the pure-logic tests; CI workflow; per-plugin READMEs; `scripts/run-evals.sh`.

## 0.1.0

First release: ten plugins covering context, model routing, decisions, TL;DR and guardrails.
