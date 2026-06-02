---
name: commit
description: Use when the user asks to commit, create a commit, write a commit message, stage files, or use /commit. Guides conventional commit formatting and git workflow.
---

# Commit conventions

## Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation only
- `style` — formatting, missing semicolons, etc. (no production code change)
- `refactor` — code change that neither fixes a bug nor adds a feature
- `perf` — performance improvement
- `test` — adding or correcting tests
- `build` — build system or external dependencies
- `ci` — CI configuration
- `chore` — maintenance, tooling, minor tasks
- `revert` — revert a previous commit

## Scope
Optional noun describing the affected module (e.g., `auth`, `db`, `ui`).

## Rules
- Description is imperative, present tense, lowercase, no period.
- Max 72 chars for the subject line.
- Body explains *why* and *what*, not *how*.
- Footer may reference issues: `Closes #123`, `Refs #456`.

## Workflow
1. Run `git status` and `git diff` to inspect changes.
2. If nothing is staged, ask the user before running `git add`.
3. Generate a candidate message and show it for confirmation.
4. On confirmation, execute `git commit`.
