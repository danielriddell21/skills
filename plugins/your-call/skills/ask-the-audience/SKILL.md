---
name: ask-the-audience
description: Poll several independent subagents on a contested choice and tally their votes. Use when 2-5 options are genuinely close, a wrong pick is costly, or the user says "ask the audience" or "poll it". Skip for clear-cut or cheap-to-reverse choices.
---
One opinion can be wrong; a spread of independent ones shows how contested the choice is.

1. **Frame one question** with 2-5 labelled options (A, B, C...) plus the shared context. Same text for every voter; no hint of your preference.
2. **Pick 3-5 voters, in parallel, no cross-talk.** Mix models for diversity (haiku, sonnet, opus) and give each a different lens if it helps (cost, risk, simplicity, maintainability). A panel of identical models agreeing is weak evidence.
3. **Each voter returns** one line: `vote: <letter>; confidence: low|med|high; why: <one sentence>`. Read-only; no edits.
4. **Tally and show it** as a chart in the reply:

````
```viz
{"type":"bars","title":"The audience says","values":{"A: Redis":3,"B: In-memory":1,"C: CDN":1}}
```
````

5. **Read the result honestly:**
   - 80%+ agree: report the winner and the main dissent.
   - Split or many low confidences: say it is contested and put the top two to the user via `your-call` (`mcp__your-call__ask`), tally attached.
   - Never present a vote as proof; it is evidence, and the user decides.
6. **Cap at 5 voters, one round.** Don't re-poll until you get the answer you wanted.

Cost: N subagent runs. Use `phone-a-friend` when one opinion is enough.

Pairs with: `phone-a-friend`, `show-dont-tell` (the chart), `ask-dont-guess`.
