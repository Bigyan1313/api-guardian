# 2026-10-16 · Bigyan · project docs for the team

**Plan week / task:** none (documentation, ahead of the Tue Oct 20 progress presentation)
**Branch / PR:** `claude/beautiful-faraday-948xah`, not yet committed

## Done

- Reviewed everything so far: both commits, BUILD_LOG.md, the schema, the sample
  app, the server and the dashboard, and the build plan PDF
  (`API-Guardian-Build-Plan.pdf`, which is not in the repo).
- Wrote the shared docs so each member's AI starts from the same picture:
  - `AGENTS.md` (+ `CLAUDE.md` importing it): entry point, non-negotiable rules, repo map, end-of-session checklist
  - `docs/BUILD_PLAN.md`: the PDF in Markdown, with the section numbers unchanged
  - `docs/ROADMAP.md`: every plan week as a task checklist, plus a proposed recovery schedule
  - `docs/STATUS.md`: live state, team table, blockers, open decisions
  - `docs/PRESENTATION.md`: Tuesday's outline and speaker notes
  - `docs/sessions/`: this note and the template

## Verified

- `npm run typecheck`: clean.
- `npm test` with no database running: 20 passed, 19 skipped (expected; the DB and API suites skip without `DATABASE_URL`).
- Not run: tests against Postgres, `docker compose`, CI on GitHub.

## Decisions made

- None final. Proposals are listed as D1–D9 in STATUS.md for Tuesday.

## Not done / next

- At Tuesday's meeting: assign Member 1/2/3 names, agree on D1 (recovery schedule) and D9 (git workflow), and confirm the final deadline.
- Create the `main` branch and confirm CI runs (blocker B1).
- Member 2 starts W2 (demo API v2) right away; it unblocks everyone else.

## Blockers / questions for the team

- What is the real final deadline? The docs assume Sun 2026-12-06.
- Docker has to be installed on every machine before W5 can start.
