# 2026-10-27 · Bigyan (with Claude) · W2 demo API, and `main`

**Plan week / task:** [W2 — Demo API](../ROADMAP.md#w2--demo-api--done-2026-10-27);
blocker B1.
**Branch / PR:** `claude/beautiful-faraday-948xah`. `main` now exists; no PR yet
because `main` is not the GitHub default and points at the same commit.

## Done

- **`main` created** from the work branch and pushed, so CI finally has the
  branch its triggers name. Someone still has to make it the default in GitHub
  Settings → Branches — I can't do that from here.
- **`openapi/contacts-v2.json`**: `customer_name` → `full_name`,
  `lifetime_value` number → decimal string, `workspace_id` required on
  `GET /v1/contacts`, `/activity` replaced by `/events` (`kind` → `type`),
  `/notes` withdrawn with no replacement, and `email` → `contact_email`.
- **Migration note in two parts (D2):** `contacts-v2.migration.md` reads like a
  provider changelog, for the agent; `contacts-v2.migration.json` carries the
  structured mappings, for the detector. **`email` is deliberately absent from
  both**, which is what makes the refusal case real rather than staged (D7).
- **v1 gained `GET /v1/contacts/{id}/notes`** and `ContactsAxiosClient.getNotes`,
  so v2 can withdraw an endpoint with nothing to replace it. `/activity` is the
  other kind — removed, but with a documented replacement. One is repairable;
  the other must be refused.
- **`test/support/fake-api.ts` serves either version.** `startFakeApi()` reads
  `CONTACTS_API_VERSION`, so the same suite runs against both.
- **`test/end-to-end.test.ts`** fetches over HTTP and renders through the
  reporting layer. Without it a rename broke nothing: the client tests stop at
  the client, and the reporting tests feed the functions a fixed v1 array.
- **`scripts/check-v2-breaks.mjs`** runs the suite against v2 and inverts the
  exit code, so a build where the app *survives* v2 fails. Wired into CI.
- **BUILD_LOG** has the table of which test fails for which change, which W4 and
  W9 both need.

## Verified

- `npm run typecheck`: clean, all four workspaces.
- `npm test` (v1) with Postgres: **45 passed** (14 db + 23 sample-app + 8 server).
- `npm test` with no `DATABASE_URL`: **25 passed, 20 skipped**.
- `npm run test:v2`: **11 failed, 12 passed** — the required outcome.
- `npm run check:v2-breaks`: passes, reporting 11 failures.
- `npm run db:reset` then `db:seed`: 001 and 002 applied; 7 changes, 7 runs.
- Both specs and the migration JSON parse; `email` is absent from the
  documented renames, asserted rather than eyeballed.
- `docker compose up`: **not run** (B2 still open).
- **CI: not confirmed.** `main` exists now, but I have not seen a run go green.

## Decisions made

- **D2 — migration-note format: adopted as proposed**, with the JSON extended
  beyond renames to cover type changes, added required parameters, and replaced
  and removed endpoints. The detector needs all of them to decide whether a
  mapping is confirmed.
- **D7 — yes**, the undocumented `email` rename is in v2.
- **Two kinds of endpoint removal**, not one as the roadmap table had it. SRS
  section 6.2 wants both, and the seed data already assumed both.

## Not done / next

- **Set `main` as the GitHub default branch**, then confirm the first CI run.
  That finishes B1, and nobody should merge anything before it is green.
- W3 (detection) and W4 (locator) are now unblocked and can run in parallel.
- `email` → `contact_email` breaks no test, because nothing reads the field.
  Week 3 must flag it from the spec diff alone. Giving it a caller later would
  make the refusal visible in the demo.

## Blockers / questions for the team

- **D10 is still open** (SRS vs build plan). This session assumed the SRS again:
  four change types, and the two-kinds-of-removal split.
- **B2, Docker**, is now the critical path. Week 5 cannot start without it, and
  the build plan is explicit that nothing after week 5 is trustworthy without a
  working validator.
