# tell-me-the-damage

Mod. After a turn that used tools, a one-line band above the prompt: `✓ 3 files · tests pass · 41s`.

- Red `✗` when a test command (`go test`, `pytest`, `npm test`, `make test`, ...) failed, `⏹` when the turn was stopped.
- **Details** lists the changed files; **Hide** dismisses it. It clears on your next prompt.
- Options: `minTools` (1), `showCost` (false; adds the turn cost, e.g. `· $0.12`, when the session reports one. Off by default because [session-band](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/session-band) already shows cost).
- Composes with the other bands (context bar, route chip, Compact button) instead of replacing them.

It is a chip: it joins the one shared chip row with the route and Compact chips instead of taking its own line; the file list opens below the bands.
