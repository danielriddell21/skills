# Skill trigger eval results

Run with `scripts/run-evals.sh` (headless `claude -p`, plan mode, 3 turns, all plugins loaded). 2026-10-06: **15 of 24 pass**, before and after tightening the skill descriptions.

- Fires reliably when the skill is named or the request matches it closely ("ask the audience", "phone a friend", "audit my context usage"); never fires on the should-not prompts.
- Does not fire on implicit prompts ("clean up the old branches", "compare Redis, Memcached and in-memory", "get a second opinion on this plan"): the model usually answers directly. Rewording the descriptions changed nothing, so treat those skills as explicit-use, or move the rule into the always-on `your-call` system section.
- Headless plan mode is a rough proxy; real sessions may differ.

```
FAIL ask-dont-guess           should     fired=[]  clean up the old branches
FAIL ask-dont-guess           should     fired=[]  make the API faster
FAIL ask-dont-guess           should     fired=[]  migrate the database to the new schema
PASS ask-dont-guess           should_not fired=[]  rename the variable foo to bar in utils.go as I said
PASS ask-the-audience         should     fired=[your-call:ask-the-audience]  ask the audience: Redis, Memcached or in-memory?
FAIL ask-the-audience         should     fired=[]  poll a few agents on which approach is safest
PASS ask-the-audience         should_not fired=[]  fix this typo
PASS ask-the-audience         should_not fired=[]  run the tests
FAIL hey-you-do-it            should     fired=[]  investigate how auth works across the codebase then fix the 
FAIL hey-you-do-it            should     fired=[]  which agent should do this refactor
PASS hey-you-do-it            should_not fired=[]  change the port in config.yml to 8080
FAIL phone-a-friend           should     fired=[]  get a second opinion on this migration plan
PASS phone-a-friend           should     fired=[your-call:phone-a-friend]  phone a friend: monolith or microservices?
PASS phone-a-friend           should_not fired=[]  rename this variable
PASS phone-a-friend           should_not fired=[]  what does this function do
FAIL show-dont-tell           should     fired=[]  compare Redis, Memcached and in-memory caching for us
FAIL show-dont-tell           should     fired=[]  explain the request flow through these 5 services
PASS show-dont-tell           should_not fired=[]  fix this typo
PASS show-dont-tell           should_not fired=[]  what is 2+2
PASS where-did-my-tokens-go   should     fired=[do-you-need-all-that:where-did-my-tokens-go]  audit my context usage
PASS where-did-my-tokens-go   should     fired=[do-you-need-all-that:where-did-my-tokens-go]  what is using all my tokens
PASS where-did-my-tokens-go   should     fired=[do-you-need-all-that:where-did-my-tokens-go]  why is my context filling up so fast
PASS where-did-my-tokens-go   should_not fired=[claude-api]  explain how prompt caching works
PASS where-did-my-tokens-go   should_not fired=[]  fix the failing test
15 pass, 9 fail
```
