# Status: where we are right now

**Read this first, every session.** This is the live state of the project: who
is doing what, what is blocked, and which decisions are still open. It is short
on purpose. The history lives in [sessions/](sessions/) and
[../BUILD_LOG.md](../BUILD_LOG.md), and the full task list lives in
[ROADMAP.md](ROADMAP.md).

**Updating it:** at the end of every working session, by hand or by your AI. Edit
only your own row in the team table, plus any decision or blocker you changed.
Keeping to your own row is what stops three people's edits from conflicting.
The full checklist is in [../AGENTS.md](../AGENTS.md#end-of-session-checklist).

---

**Last updated:** 2026-10-27 by Bigyan (with Claude), aligning the code with the submitted SRS

## In one paragraph

Plan week 1 is done: monorepo, Postgres schema, CI workflow, a sample TypeScript
app with 18 passing tests, and a dashboard running on seed data. **No part of the
pipeline exists yet** (detection, locator, validator, agent, PR writer). On the
calendar we are at the end of week 5 of 12, so about four plan weeks behind. A
recovery schedule that runs weeks 2–5 in parallel is proposed in
[ROADMAP.md](ROADMAP.md#proposed-recovery-schedule-team-to-agree-tue-oct-20), and
the team decides on it at the Tuesday meeting.

## Key dates

| Date | What |
| --- | --- |
| Tue 2026-10-20 | Progress presentation (outline: [PRESENTATION.md](PRESENTATION.md)) |
| Wed 2026-10-21 | W2 demo API v2 done; it unblocks the others |
| Sun 2026-11-01 | **Checkpoint:** W3 detection, W4 locator, W5 validator done |
| Sun 2026-11-08 | Rename case repaired end to end |
| Sun 2026-11-22 | 25 scenarios frozen |
| Sun 2026-11-29 | Evaluation numbers in a table |
| Sun 2026-12-06 | Final report and demo *(assumed; confirm the real deadline)* |

## Team

Fill in names and roles at the Tuesday meeting. Roles follow
[BUILD_PLAN.md](BUILD_PLAN.md) §11.

| Member | Name | Owns | Working on now | Branch | Blocked by |
| --- | --- | --- | --- | --- | --- |
| Member 1 | *TBD* | Frontend and reporting; leads the W5 validator | — | — | Docker not installed |
| Member 2 | *TBD* | Backend, specs, GitHub | — | — | — |
| Member 3 | *TBD* | Code analysis and agent | — | — | — |

Bigyan is one of the three; assign the roles on Tuesday.

## Verified state of the code (2026-10-16)

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean, all workspaces |
| `npm test` with no database running | 20 passed, 20 skipped, re-run 2026-10-27 (DB and API tests skip themselves without `DATABASE_URL`) |
| `npm test` with Postgres | 40 passed, re-run 2026-10-27 |
| CI on GitHub | **Never confirmed.** See blocker B1. |
| `docker compose up` | **Never run.** Docker is not installed on Bigyan's Mac. |

## Blockers and risks right now

| # | Blocker | Effect | Next step | Owner |
| --- | --- | --- | --- | --- |
| B1 | The repo has **no `main` branch**. CI triggers on push to `main` and on PRs, and the only branch is `claude/beautiful-faraday-948xah`. | CI may never have run | Create `main` from the current branch, make it the GitHub default, open a PR, and watch CI go green | *TBD* |
| B2 | Docker isn't installed (at least on Bigyan's Mac) | `npm run db:up` and the whole W5 validator depend on it | Everyone installs Docker Desktop, OrbStack or colima, then runs `npm run db:up` | everyone |
| B3 | Four plan weeks behind | Pushes against the evaluation, which can never be cut | Agree on the recovery schedule Tuesday | team |
| B4 | The final deadline and week-1 start date are assumed, not confirmed | Every date here could be off | Confirm against the course schedule | *TBD* |

## Open decisions

Record each answer here with the date, then move it into
[BUILD_PLAN.md](BUILD_PLAN.md#changes-to-the-plan) if it changes the plan.

| # | Decision | Suggestion | Needed by | Decided |
| --- | --- | --- | --- | --- |
| D1 | Adopt the recovery schedule and cut triggers? | Yes | Tue Oct 20 | |
| D2 | Migration-note format | Prose note + small JSON (`renames: [{schema, from, to}]`) | Wed Oct 21 (W2) | |
| D3 | Where the locator stores call sites | New migration `002`: a `run_locations` table | W4 | |
| D4 | Agent: plain SDK calls or eve | Plain SDKs behind `model.ts` | W6 | |
| D5 | Patch format from the model | Full file contents of the located files; we compute the diff | W6 | |
| D6 | How eval runs record their baseline | New migration adding `runs.baseline` | W10 | |
| D7 | Add the unconfirmed `email` → `contact_email` rename to v2 so the refusal demo is real? | Yes | Wed Oct 21 (W2) | |
| D8 | Which GitHub repo the PR writer opens PRs against | A team demo repo with a copy of the sample app | W8 | |
| D9 | Git workflow: PR per task, one reviewer, squash-merge to `main` | Yes | Tue Oct 20 | |
| D10 | **Which document is authoritative: the build plan PDF or the submitted SRS v1.0?** The code now follows the SRS (4 change types, 20 scenarios, 3 baselines, 1 model); these docs still describe the plan (5, 25, 5, 2) | The SRS — it is what was submitted on Sep 24 | Next meeting | |

## Uncommitted local changes

- `package-lock.json` (Bigyan's machine): drops some `"peer": true` flags, which
  is npm-version noise. Commit or discard it; it's harmless either way.
