---
name: phone-a-friend
description: Get an independent second opinion from a fresh subagent before a risky or contested decision. Use when confidence is low, the stakes are high, you're stuck, or the user says "phone a friend" or "get a second opinion". Skip for trivial or clearly-specified work.
---
A friend who hasn't seen your reasoning can't inherit your blind spots. Ask one, then weigh the answer; don't just obey it.

1. **Write a self-contained question**: situation, constraints, the options, what "good" means. Do NOT include which option you lean toward (anchoring). Say what you want back: a pick, a critique, or "what am I missing".
2. **Pick the friend** (see `hey-you-do-it` for the table): `spy` for design and tradeoffs, `sniper` for code or diff critique, `scout` for facts about the codebase. Use the cheapest that fits.
3. **Keep it read-only.** The friend investigates and advises; it does not edit.
4. **One call, short answer** (ask for 200 words max, reasons included).
5. **Report back** as: `Friend says: <gist>. I agree / disagree because <reason>.`
6. **Disagreement is the user's call.** If you and the friend split, don't silently pick: put both views to the user via `your-call` (`mcp__your-call__ask`), your recommendation first.

Cost: one extra subagent run. Don't use it for decisions the user already made or for anything reversible and cheap to retry.

Pairs with: `ask-the-audience` (when one opinion isn't enough), `ask-dont-guess`, `your-call`.
