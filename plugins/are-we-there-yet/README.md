# are-we-there-yet

Mod. Shows `ctx 63%` in the status line and toasts as context fills.

Options: `notice` (50), `warn` (70), `urgent` (85), all in percent. Toasts fire once per level and reset when use drops well below the lowest.

At the urgent level a **Compact** button appears above the prompt; it runs `/compact` with the same focus text `/squish` prints (`compactButton: false` turns it off). It uses `$.command.run`, which I have not seen run a built-in command in a live session.
