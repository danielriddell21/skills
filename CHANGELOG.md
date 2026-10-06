# Changelog

## 0.3.0 (unreleased)

- `matchmaker` also classifies destructive/ambiguous requests, comparisons and second-opinion requests and attaches the matching skill hint, so skills fire on implicit requests.
- New `how-did-that-go`: turn summary band (files, tests, time, cost).
- `are-we-there-yet`: Compact button above the prompt at the urgent level. It uses `$.command.run`; the host refuses `$.prompt.submit` with a leading `/`.
- Bands (`whats-in-the-box`, `matchmaker`, `are-we-there-yet`, `how-did-that-go`) now compose with each other instead of hiding one another.

## 0.2.0

- `whats-in-the-box`: colored context bar above the prompt (per-category segments, legend, Details button).
- Options for thresholds and defaults on `are-we-there-yet`, `stop-you-violated-the-law`, `matchmaker`, `tldr`, `are-you-sure-bro`, `whats-in-the-box`; `matchmaker` Off switch and `tldr` mode persist.
- `are-you-sure-bro`: many more risky patterns, sensitive-file write guard, fail-closed prompts.
- `your-call`: chart SVGs get a proper font, better contrast and label clamping.
- Hook-level tests (context bar, your-call pane and wizard, sticky-notes) alongside the pure-logic tests; CI workflow; per-plugin READMEs; `scripts/run-evals.sh`.

## 0.1.0

First release: ten plugins covering context, model routing, decisions, TL;DR and guardrails.
