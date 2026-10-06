# whats-in-the-box

Mod. A colored context bar above the prompt: one segment per category (messages, MCP tools, skills...), a legend of the top four, the percent, and a **Details** button.

- `/whats-in-the-box` opens a pane with tokens per category.
- Options: `band` (true) turns the bar off; `minPercent` (0) hides it until context use reaches that percent.

Data comes from `$.session.usage` (summary breakdown), refreshed whenever the context fill changes.
