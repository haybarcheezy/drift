<!--
Thanks for the pull request. A few things worth checking before this goes out for review.
Delete anything that doesn't apply.
-->

## What this changes

<!-- One or two sentences. Which half: backend, frontend, or both? -->

## Why

<!-- The bug, or the use case the change enables. Link the issue if there is one. -->

## Checks

- [ ] `cd backend && python -m pytest tests/ -v`
- [ ] `cd frontend && npx tsc --noEmit && npx vitest run`
- [ ] Commit messages follow Conventional Commits (`feat:`, `fix(scope):`, `docs:`)
- [ ] If this touches ingest, `--delay` was left at the default

## Screenshots

<!-- Required for anything that changes the theater, heat strip, or rails. Before/after if you have it. -->

## Notes for the reviewer

<!-- Anything you're unsure about, or parts you'd like a second opinion on. -->
