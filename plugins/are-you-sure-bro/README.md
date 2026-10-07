# are-you-sure-bro

Mod. Asks before commands that lose work or cannot be undone, and before writes to sensitive files. Ordinary work, including `git merge` and pushing to `main`, is never flagged.

**Dangerous (default level)**
- `rm -r` aimed at `/`, home, `.`/`..`, a glob, or an absolute path outside `/tmp` (so `rm -rf node_modules` is fine)
- force pushes (`--force`, `-f`; `--force-with-lease` is fine), remote deletes
- `git reset --hard`, `git clean -f`, `git branch -D`, `git restore .`, `git checkout -- .`
- `curl | sh`, `chmod -R 777`, `shred`, `mkfs`, `dd if=`
- SQL `DROP`/`TRUNCATE TABLE`/bare `DELETE FROM`, `terraform destroy`, `kubectl delete namespace|node|pv|--all`, `docker system prune`, `npm publish`

**Sensitive writes:** Write/Edit on `.env*` (not `.env.example`), SSH/AWS/GnuPG files, credentials, `.npmrc`, `.git/config|hooks`, `/etc`.

Options:
- `level`: `dangerous` (default) or `careful`, which also asks about pushes to main/master, `sudo`, `find -delete`, `xargs rm`, `chmod -R`, `truncate`, `terraform apply`, any `kubectl delete`.
- `guardWrites` (true), `extraRisky` (a regex of your own), `capNoisy` (false; offers to cap `cat`, `ls -R`, test runs and logs at `capLines`, 200).

If the question can't be asked (non-interactive), dangerous commands are blocked. The patterns are heuristics, not a sandbox.
