# are-you-sure-bro

Mod. Asks before:
- **Risky Bash:** `rm -r`, force or main-branch pushes and remote deletes, `git reset --hard`, `git clean -f`, `git branch -D`, `git restore .`, `git stash drop`, `find -delete`, `xargs rm`, `curl | sh`, `sudo`, `chmod -R`, `shred`, SQL `DROP`/`TRUNCATE`/bare `DELETE FROM`, `terraform destroy|apply`, `kubectl delete`, `docker system prune`, `npm publish`.
- **Sensitive writes:** Write/Edit on `.env*`, SSH/AWS/GnuPG files, credentials, `.npmrc`, `.git/config|hooks`, `/etc`.
- **Noisy output:** offers to cap `cat`, `ls -R`, test runs, logs at N lines.

Options: `capLines` (200), `guardWrites` (true), `extraRisky` (a regex). If the question can't be asked (non-interactive), risky commands are blocked. The patterns are heuristics, not a sandbox.
