---
description: Stage changes and create a conventional commit
---

Git status:
!`git status`

Staged diff:
!`git diff --cached`

Unstaged diff:
!`git diff`

Recent 10 commits for context:
!`git log --oneline -10`

Based on the changes above, generate a commit message following conventional commits format: `<type>(<scope>): <description>`

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.

First ask me to confirm or customize the message, then run `git commit -m "<message>"` or `git commit -m "<title>" -m "<body>"` for multi-line commits. If nothing is staged, run `git add -A` first after confirming with me.
