# 2026-10-27 · Bigyan (with Claude) · Align the code with the submitted SRS

**Plan week / task:** Not a plan week. A scope correction touching W1 (schema,
seed, dashboard) and the W9/W10 targets in [ROADMAP.md](../ROADMAP.md).
**Branch / PR:** `claude/beautiful-faraday-948xah`, no PR yet (see B1 — there is
still no `main` to open one against).

## Done

- `db/migrations/002_scope_change_types_to_four.sql`: drops
  `response_shape_changed` from the `change_type` enum, leaving the four
  categories the SRS puts in scope. Postgres can't remove an enum value in
  place, so the type is recreated and `changes.type` re-typed; rows in the
  dropped category are deleted first. Only seed rows existed.
- `packages/server/src/seed.ts`: four categories, and the endpoint-removal case
  split the way SRS §6.2 wants it — one removal **with** a documented
  replacement (repair attempted, exhausts the four attempts, flagged) and one
  **without** (located, affected, refused with no migration proposed).
- `packages/dashboard/src/components/BuildProgress.tsx`: milestones now mirror
  SRS §7.2 — 20 scenarios, three baselines, and the SRS wording for W2/4/8/11/12.
- `packages/dashboard/src/components/ChangesByType.tsx`: "four change types".
- `packages/db/test/schema.test.ts`: asserts the four categories, plus a new
  test that the database rejects `response_shape_changed` outright.
- `packages/server/test/api.test.ts`: counts updated; the refusal test now
  asserts **both** refusals rather than finding one.
- Docs: ROADMAP W2 table / W9 / W10, README scope, BUILD_LOG entry,
  BUILD_PLAN "Changes to the plan" row, STATUS decision **D10**.

## Verified

- `npm run db:reset`: `001_init.sql` and `002_scope_change_types_to_four.sql`
  both applied from an empty schema.
- `npm run typecheck`: clean across all four workspaces.
- `npm test` with Postgres: **40 passed** (14 db + 18 sample-app + 8 server).
- `npm test` with no `DATABASE_URL`: **20 passed, 20 skipped**.
- `npm run db:seed`: 7 changes, 7 runs, 6 patches.
- Dashboard built and loaded in Chromium at `localhost:3001`: four bars in the
  chart, two "needs human" refusals in Runs, SRS milestones in Build progress.
- `docker compose up`: **not run.** Docker is still unavailable here (B2).
- CI on GitHub: **not run.** Still blocked by B1 (no `main`).

## Decisions made

- Where the SRS and the build plan disagree, the code now follows the **SRS**,
  because that is the document submitted on 2026-09-24. This is recorded as open
  decision **D10** and is *not* yet agreed by the team.
- `response_shape_changed` is removed from the enum rather than merely dropped
  from the docs. The SRS defers it (§7.4) rather than forbidding it, so putting
  it back is a new migration — a visible, cheap decision instead of a silent one.
- AGENTS.md's "ten lines" and BUILD_PLAN §§1–14 were **left untouched**. They
  still say 25 scenarios, five baselines, two models. Changing shared memory on
  one person's say-so is exactly what these docs exist to prevent.

## Not done / next

- **Decide D10.** If the team agrees the SRS governs, update AGENTS.md's project
  summary and add a plan-change row for AGENTS.md itself. If the team prefers
  the build plan, revert migration `002` with a `003` that re-adds the category,
  and restore the five milestones in `BuildProgress.tsx`.
- B1 still open: create `main`, make it the GitHub default, open a PR, confirm CI.

## Blockers / questions for the team

- **Sishir and Bibek:** do you accept the SRS as the authoritative scope? That is
  four change types, 20 scenarios, three baselines, one model — a smaller
  evaluation than the plan's, though still a full one. This narrows what W9 and
  W10 have to deliver, which matters given we are four plan weeks behind.
