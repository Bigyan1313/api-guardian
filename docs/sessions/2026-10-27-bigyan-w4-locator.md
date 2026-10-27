# 2026-10-27 · Bigyan (with Claude) · W4 locator

**Plan week / task:** [W4 — Code locator](../ROADMAP.md). Done.
**Branch / PR:** `claude/beautiful-faraday-948xah`. No PR yet — `main` is still
not the GitHub default.

## Done

- **`packages/locator`** on ts-morph: `project.ts`, `endpoints.ts`,
  `fields.ts`, `locate.ts`, `store.ts`, plus `npm run locate`.
- **Migration `003_run_locations.sql`** settles **D3**: a `run_locations` table
  and a `runs.coverage` column. (002 was already taken by the scope change, so
  the table arrives as 003.)
- All three call patterns match: `fetch` with a template-literal URL, axios
  instance methods, and generated-client functions by operationId.
- Field changes resolve the property declaration and use the type checker's
  find-references, so `customer_name` reaches `src/reporting.ts` — two layers
  above the HTTP call.
- 12 tests with **exact file:line assertions**, not counts.

## Verified

- `npm run typecheck`: clean, all six workspaces.
- `npm test` with Postgres and oasdiff: **73 passed** (14 db + 16 detector +
  12 locator + 23 sample-app + 8 server).
- `npm run locate`: all four categories resolve, to `src/` files only.
- ts-morph bundles TypeScript **5.9.2**; the project typechecks with 5.9.3.
  Checked by printing both, not assumed.
- `npm run db:reset`: 001, 002, 003 all applied.
- `npm audit`: 0 vulnerabilities.
- `docker compose up`: **not run** (B2).
- CI with the new oasdiff step: **not yet seen on a runner.**

## Decisions made

- **ts-morph 27, not 28.** 28 bundles TypeScript 6.0.2; this repo pins 5.9, and
  AGENTS.md says TypeScript stays there *because* ts-morph is tied to it. 27
  bundles 5.9.2.
- **Test files are never offered for repair.** Find-references correctly reports
  the tests and the fixture as readers of the changed fields, but the validator
  rejects any patch that edits a test, and editing `test/support/fake-api.ts`
  would erase the very breakage the evaluation measures. They go to
  `coverage.skipped` with a reason. The exclusion has to be applied twice:
  find-references searches the whole program, not just the loaded files.
- **"Not affected" comes from coverage, not from the count.** A URL built at run
  time is unreadable, so an empty result becomes needs-review. There is a
  fixture and a test for it.

## Not done / next

- **Join detection to location.** Nothing yet reads a `changes` row, locates it,
  and writes a `runs` row with its locations and coverage. Small, and it belongs
  with the W3 server write endpoints that are still owed. Until both exist the
  dashboard shows seed data rather than real pipeline output.
- Real spec histories (Stripe, GitHub, Twilio) for W10 precision and recall.
- Scheduled checking (cut #2) and ESLint.

## Blockers / questions for the team

- **B2 (Docker) is the critical path and has not moved.** W5 is the checkpoint
  week and cannot start. If nobody can install Docker locally, the fallback to
  discuss is running the validator only in CI, where a container runtime exists.
- **D10 still open** (SRS vs build plan).
- `main` still needs to be made the GitHub default by someone with admin.
