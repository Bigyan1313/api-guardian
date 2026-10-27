# Build Log

What has been built, in order, and why it was built that way. Updated every time
something lands. The twelve-week plan is in the build plan document; this file
is the record of what actually happened against it.

| Week | Goal | Status |
| --- | --- | --- |
| 1 | Setup | **Done** |
| 2 | Demo API | **Done** |
| 3 | Detection | **Done** (core; see gaps) |
| 4 | Code locator | **Done** |
| 5 | Validator | Not started |
| 6–7 | Repair agent | Not started |
| 8 | PR writer | Not started |
| 9 | Test set | Not started |
| 10 | Evaluation | Not started |
| 11 | Dashboard | **Brought forward to week 1**; realigned to the SRS 2026-10-27 |
| 12 | Write-up and demo | Not started |

---

## Week 4 — Code locator

**Done means:** ts-morph finds the exact call sites for every change type.

**Result:** all four categories, with exact file and line assertions in the
tests. 12 locator tests pass.

### What landed

`packages/locator`: `project.ts` (load the repository, decide what to read),
`endpoints.ts` (the three call patterns), `fields.ts` (find-references on the
property symbol), `locate.ts` (one behaviour per category), `store.ts`.
`npm run locate` runs every demo change against the sample app.

Migration `003_run_locations.sql` settles decision **D3**: a `run_locations`
table rather than JSONB on `runs`, because the dashboard lists and counts these
rows, the agent reads them file by file, and week 9 compares them against
hand-written expectations. All three want rows. Coverage, which belongs to the
run rather than to any one location, is a new `runs.coverage` column.

### Decisions worth recording

**ts-morph 27, not 28.** ts-morph bundles its own TypeScript, and 28 bundles
6.0.2 while this repository pins 5.9. AGENTS.md says TypeScript stays on 5.9
*because* ts-morph is tied to it, so the locator parsing with a different
compiler than the validator type-checks with would quietly undermine that.
ts-morph 27 bundles 5.9.2, which matches. Verified rather than assumed.

**The locator must not point the agent at test files.** Find-references
correctly reports `test/clients.test.ts` and `test/support/fake-api.ts` as
readers of `customer_name` — they are. But the validator's cheat guards reject
any patch that edits a test, and the fixture in `test/support/` is the thing
serving the old contract: editing it to match v2 would erase the breakage the
evaluation measures. Handing either to the agent is a guaranteed wasted attempt.
They are recorded in coverage as skipped, with the reason, rather than dropped.
The exclusion has to be applied twice, because find-references searches the
whole program regardless of which files were loaded for scanning.

**"Not affected" is computed from coverage, not from the count.** An empty
result only means not affected when every call site could be read. A URL built
at run time (`base + route`) is unreadable, so the honest answer becomes "needs
review". There is a fixture for exactly this, and a test that the locator
refuses to call it not-affected.

**A field change locates the type and the reads, not just the call.**
`customer_name` resolves to `src/types.ts:12`, the three clients, and four reads
in `src/reporting.ts` — two layers above the HTTP call. That walk is the whole
reason the locator uses the type checker rather than a text search.

### Verified, not assumed

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean, all six workspaces |
| `npm test` with Postgres and oasdiff | 73 passed (14 db + 16 detector + 12 locator + 23 sample-app + 8 server) |
| `npm run locate` | all four categories resolve to `src/` only |
| ts-morph bundled TypeScript | 5.9.2, against the project's 5.9.3 |
| `npm run db:reset` | 001, 002 and 003 applied |
| `npm audit` | 0 vulnerabilities |

### Known gaps

- **Nothing joins detection to location yet.** Both run from their own CLI; no
  code reads a `changes` row, locates it, and writes a `runs` row with its
  locations. That join is small and belongs with the server write endpoints
  still owed from week 3.
- The locator has only met the sample app. Wrappers, re-exported aliases and
  deeply indirect clients are reported as coverage limits by design, but none
  have been tried on a real third-party codebase.
- `required_parameter_added` returns call sites only. Whether the caller *has* a
  workspace id to pass is a question for the agent, not the locator.

---

## Week 3 — Detection

**Done means:** oasdiff wired in, changes classified, stored in the database.

**Result:** all three. Running the demo API's v1 against v2 produces 19 oasdiff
findings, 9 classified changes across all four supported categories, and 8
findings accounted for as out of scope. 16 detector tests pass.

### What landed

`packages/detector`, in five small files:

- `oasdiff.ts` runs the pinned binary (v1.34.1) and parses its JSON. Thin on
  purpose: detection is the part oasdiff already does well (plan §12, risk 1).
- `classify.ts` maps oasdiff rule identifiers onto the four categories, with a
  confidence per rule.
- `renames.ts` is the rule the project rests on, below.
- `migration-note.ts` reads the structured half of the note. It is the only
  thing that may turn a guess into a confirmed mapping.
- `spec-store.ts` canonicalises, hashes and stores a spec version.

`npm run detect` runs the whole thing and prints the classification; with
`DATABASE_URL` set it also writes the rows.

### Decisions worth recording

**oasdiff does not report renames, and we do not infer them.** It reports a
property removed and a property added. Whether those are the same field under a
new name is not something a diff can know. `renames.ts` pairs them *only* where
the migration note says so. Everything left over is stored as `field_renamed`
with classification `unknown`, `mapping_confirmed_by` NULL, confidence 0.42, and
the unexplained additions recorded under `detail.candidates` — candidates, never
a mapping. A test asserts that an unconfirmed rename has no `detail.to`, because
that field is what a confirmed one carries and the repair stage will read it.

With the note, `customer_name` → `full_name` is confirmed and `email` →
`contact_email` is flagged. With the note removed, *both* are flagged. That
second case is a test: no authority, no confirmation.

**An unknown oasdiff rule is reported, not assumed safe.** `classify.ts` keeps an
explicit list of rules judged harmless. Anything not in either list comes back as
unmapped with a reason. Treating "not in the breaking list" as safe is how a
breaking change gets missed after an oasdiff upgrade.

**Endpoint removals are split by whether the note names a replacement.**
`/activity` has one, so it is confirmed and repairable; `/notes` does not, so it
is flagged. oasdiff reports both identically — the difference comes from the
note alone.

**Canonicalise before hashing.** A provider that reorders its JSON keys has not
changed its API. Without canonical key order a scheduled check would record a new
version every morning and bury the real changes.

### Verified, not assumed

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean, all five workspaces |
| `npm test` with Postgres and oasdiff | 61 passed (14 db + 16 detector + 23 sample-app + 8 server) |
| `npm run detect` on v1 → v2 | 19 findings, 9 classified, 8 unmapped |
| `npm run check:v2-breaks` | passes, 11 failures |
| `npm audit` | 0 vulnerabilities |

### Known gaps

- **No server write endpoints yet.** `POST /api/apis/:id/specs` and
  `POST /api/apis/:id/check` are still to do, so the dashboard's "check for
  changes" button has nothing to call and the dashboard still shows seed data.
- **Scheduled checking is not built.** It is cut #2 in the cut order, so it was
  left for last deliberately.
- **No real spec histories yet** (Stripe, GitHub, Twilio), which W10's detection
  precision and recall need. The classifier has only met our own demo API, and
  rules it has never seen come back unmapped rather than classified.
- **ESLint still not added**, deferred again.
- oasdiff reports the same logical change once per path, so one rename produces
  two rows. That is deliberate — the locator works per path — but any count of
  "changes" is a count of path-level changes, not of distinct field edits.

---

## Week 2 — Demo API

**Done means:** old and new versions running, tests that break on the new one.

**Result:** both. 23 tests pass against v1 and 11 of them fail against v2, and
CI fails the build if that ever stops being true.

### What landed

`packages/sample-app/openapi/contacts-v2.json`, plus the migration note in the
two-part format decision D2 proposed: `contacts-v2.migration.md` reads like a
provider changelog for the agent, and `contacts-v2.migration.json` carries the
structured mappings the detector needs to set `mapping_confirmed_by`.

The fixture now serves either version. `startFakeApi()` reads
`CONTACTS_API_VERSION`, so the same suite runs against both — v1 by default,
`npm run test:v2` against the new contract.

v1 gained `GET /v1/contacts/{id}/notes` and the sample app gained a caller for
it, so that v2 can withdraw an endpoint with **nothing** to replace it. The
activity endpoint is the other kind: removed, but with `/events` documented as
its replacement. One is repairable and the other must be refused, which is the
distinction SRS section 6.2 asks the scenario set to make.

### Which test fails for which change

Week 4's locator has to walk from each spec change to this code, and week 9
reuses the mapping when building scenarios.

| Change | Category | Tests that fail against v2 |
| --- | --- | --- |
| `customer_name` → `full_name` | `field_renamed`, confirmed | `end-to-end`: ranks contacts, builds initials; `clients`: fetch/generated fetch one contact |
| `lifetime_value` number → decimal string | `field_type_changed`, confirmed | `end-to-end`: formats currency, totals lifetime values, ranks contacts |
| `workspace_id` now required | `required_parameter_added`, confirmed | `clients`: lists contacts in all three call patterns; every `end-to-end` test |
| `/activity` → `/events` | `endpoint_removed`, replacement documented | `clients`: reads a contact activity feed |
| `/notes` withdrawn | `endpoint_removed`, no replacement | `clients`: reads a contact's notes |
| `email` → `contact_email` | `field_renamed`, **undocumented** | No test fails. Nothing reads the field yet — which is the point: it has to be found by classification, not by a red test |

### Decisions worth recording

**The reporting layer had to be reachable from the API, and wasn't.** The
existing tests stopped at the client, and the reporting tests fed the functions a
fixed v1 array, so both stayed green through a rename that ruins every rendered
row. `end-to-end.test.ts` fetches over HTTP and renders the result, so a field
renamed in the spec now fails two layers above the HTTP call. Without it, week 4
would have had no failing test to aim the locator at.

**A build that passes against v2 is a broken build.** `npm run check:v2-breaks`
runs the suite against v2 and inverts the exit code: it fails if the app
*survives*. CI runs it on every push. The admission rule in SRS section 6.2 is
the foundation the repair rate stands on, and the usual way to violate it is for
somebody to helpfully "fix" `src/types.ts`.

**`src/types.ts` still describes v1, deliberately.** `tsc` is clean against v2
because the types are hand-written and nothing regenerates them. That drift is
the bug the project exists to repair, and the failure surfacing at runtime
instead of compile time is the realistic case.

### Verified, not assumed

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean, all four workspaces |
| `npm test` (v1) with Postgres | 45 passed |
| `npm run test:v2` | 11 failed, 12 passed — the required outcome |
| `npm run check:v2-breaks` | passes, reporting 11 failures |
| `npm run db:reset` + `db:seed` | 001 and 002 applied; 7 changes, 7 runs, 6 patches |
| Both specs and the migration JSON | parse; `email` absent from the documented renames |

### Known gaps

- `email` → `contact_email` breaks no test, because nothing in the sample app
  reads the field. It is still the refusal case: week 3 has to flag it from the
  spec diff alone. Worth a caller later so the refusal has visible consequences.
- Docker remains unverified here (blocker B2), so the week 5 validator path is
  still untested.

---

## 2026-10-27 — Scope aligned with the submitted SRS

**What changed.** The code followed the build plan PDF; the SRS submitted for the
course on 2026-09-24 had narrowed the scope, and nobody had reconciled the two.
The dashboard was the visible symptom — it advertised five change types, 25
scenarios and five baselines, none of which the spec still says.

- `db/migrations/002_scope_change_types_to_four.sql` drops
  `response_shape_changed` from the `change_type` enum. Postgres cannot remove an
  enum value in place, so the type is recreated and the column re-typed; rows in
  that category are deleted first, and at the time of writing the only such rows
  came from `npm run db:seed`.
- The seed now covers four categories, and models the endpoint-removal case the
  way SRS section 6.2 requires: one removal **with** a documented replacement
  (repair attempted, hits the four-attempt cap, flagged) and one **without**
  (located, affected, and refused). The refusal is the result worth showing.
- `BuildProgress.tsx` mirrors the SRS milestone table: 20 scenarios, three
  baselines, and the section 7.2 wording for weeks 2, 4, 8, 11 and 12.
- `ChangesByType.tsx` says four change types rather than five.
- ROADMAP W2/W9/W10, README, and the plan-change log record the narrowing.

**Decisions worth recording.**

*Deferred is not forbidden, but it is enforced.* The SRS moves response-shape
migrations to section 7.4 rather than ruling them out forever. The enum still
rejects them, because a scope boundary that lives only in prose is one nobody
notices crossing. Putting the category back is a new migration — which is a
thirty-second job and a visible decision, exactly the trade we want.

*The refusal case got stronger, not weaker.* Cutting a change type could have
left one flagged row. Instead the seed now has two refusals for two different
reasons: a rename no note confirms, and a removal with nothing to migrate to.
A new test asserts both, so a future seed cannot quietly drop them.

**Verified, not assumed.**

| Check | Result |
| --- | --- |
| `npm run db:reset` (001 + 002 from scratch) | both applied |
| `npm run typecheck` | clean, all four workspaces |
| `npm test` with Postgres | 40 passed |
| `npm test` with no database | 20 passed, 20 skipped |
| `npm run db:seed` | 7 changes, 7 runs, 6 patches |
| Dashboard rendered in Chromium | four bars, two refusals, SRS milestones |

**Known gaps.**

- **The team has not agreed to this.** AGENTS.md and BUILD_PLAN.md sections 1–14
  still describe the plan's numbers, and they are deliberately left alone. The
  question is open decision **D10** in STATUS.md.
- Docker still unverified here (blocker B2), so the W5 validator path remains
  untested.

---

## Week 1 — Setup

**Done means:** repo, Postgres, CI, one sample TypeScript app with passing tests.

**Result:** all four, plus a working dashboard pulled forward from week 11.
39 tests pass across three workspaces, typecheck is clean, and the migration was
applied against a real PostgreSQL 16 rather than only written.

### What landed

**The repo.** An npm workspaces monorepo on Node 22, TypeScript 5.9 in strict
mode. `tsconfig.base.json` turns on the settings that make the later weeks
honest: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
`verbatimModuleSyntax`. A loose config would let a generated patch compile when
it should not, and week 5's validator is only as good as the compiler settings
underneath it.

**Postgres.** The six tables from section 6 of the plan, as one append-only
migration in `db/migrations/001_init.sql`, with a runner in `packages/db`. The
runner applies each migration in its own transaction, records a sha256, and
refuses to continue if an already-applied file has changed. `docker-compose.yml`
brings up Postgres 16 locally; CI uses a service container.

**CI.** `.github/workflows/ci.yml` runs on every push to `main` and every pull
request: install, typecheck, migrate, migrate *again* to prove idempotence, then
the full test suite — all against a live Postgres service.

**The sample app.** `packages/sample-app` is a TypeScript consumer of a
"Contacts API", written to be repaired later. It calls the API three ways —
`fetch`, `axios`, and a checked-in generated client — because the locator in
week 4 has to find call sites in all three, and a shared helper would have made
that job artificially easy. `src/reporting.ts` sits two layers above the HTTP
call and reads the API's fields directly, so a rename breaks more than the
client file. The v1 OpenAPI spec is checked in at
`packages/sample-app/openapi/contacts-v1.json` as the baseline week 3 diffs
against.

**The dashboard, early.** Week 11 in the plan, built in week 1 because a
foundation nobody can look at is hard to trust and hard to steer. It is React +
Vite over an Express read API (`packages/server`), which reads Postgres and
nothing else. In development Vite proxies `/api` to the server; once built, the
server serves the dashboard too, so the demo is one command on one port instead
of two that have to agree.

### Decisions worth recording

**The schema encodes the method, not just the data.** Several constraints
enforce decisions from the plan directly, so a run that contradicts the method
is rejected by the database instead of quietly polluting the evaluation:

- `runs_attempts_capped` — four attempts, then give up (section 7).
- `patches_cheat_reason_matches_outcome` — a cheating verdict must name which
  guard fired; a clean patch must not carry a reason (section 8).
- `patches_test_counts` — never more passing tests than there are tests.
- `changes.mapping_confirmed_by` — nullable, and null means flagged, never
  patched. This is section 1's rule, in the schema.

`runs` also carries `model`, so section 9's two-model comparison is a query
rather than a spreadsheet someone keeps by hand.

**Tests hit a real HTTP server, not a mocked `fetch`.** `test/support/fake-api.ts`
starts a `node:http` server on an ephemeral port and serves v1 responses. A
mocked `fetch` would be edited by hand whenever the spec moved, which would keep
the tests green straight through the breakage we exist to measure. Section 9
only admits a scenario whose tests fail before the fix; that is only trustworthy
if the tests talk to something that actually serves the old contract. Week 2's
v2 server drops in beside this one and these same tests go red.

**The schema tests skip without a database, and CI refuses to let that pass.**
`npm test` works on a laptop with no Postgres — the schema file skips itself.
The risk is a CI run that reports green while testing nothing, so the workflow
ends by asserting the public schema really holds seven tables. A skipped test
suite cannot masquerade as a passing one.

**The dashboard admits it is looking at seed data.** Week 1 has a schema and no
pipeline, so a dashboard reading the real database would correctly show nothing.
`npm run db:seed` writes one worked example through every table — all five change
types, a repair that succeeded on attempt 2, a cheat caught, a run that hit the
four-attempt cap, and the case we refuse to patch. The page carries a banner
saying these are seed rows and the pipeline arrives in weeks 3–7. A demo that
does not admit it is a demo is how a project loses a reviewer's trust, and the
banner disappears on its own once real rows replace the seeded ones.

**The dashboard computes nothing.** Every number on screen is a SQL query in
`packages/server/src/queries.ts`. "Flagged for a human" is not a count the UI
derives from a list it happens to hold; it is `WHERE classification IN
('breaking','unknown') AND mapping_confirmed_by IS NULL`. A test asserts the tile
and the table agree, so a query that drifts from what the UI claims fails the
build rather than misleading a reader.

**Chart colour was computed, not eyeballed.** The bar chart is one series, so it
is one hue for every bar — colouring bars darker-where-bigger would encode length
twice. The palette ran through the data-viz validator (passes in both modes), and
the status colours used for verdict badges were checked for WCAG text contrast
instead, since they are reserved status tokens rather than a categorical set.
Every badge is a dot **and** a word, so no verdict is carried by colour alone.
One deviation is recorded in `styles.css`: the reference muted grey measures
3.50:1 on the light surface, which is fine for axis chrome but not for the small
table headers it is used for here, so light mode takes a darker neutral at
5.11:1.

**Express 5, not 4.** Express 4 pulls in `path-to-regexp` and `qs` versions with
open DoS advisories. Express 5 clears them: `npm audit` reports zero across the
whole workspace.

**TypeScript 5.9, not 7.** TypeScript 7 is available. Week 4 depends on
ts-morph and week 5 pins `tsc` inside the Docker validator, and neither should
be chasing a compiler rewrite during a twelve-week build. Revisit as a stretch
goal, not now.

**Dependency versions were bumped before the first commit.** The initial pins
(axios 1.7, vitest 2.1) carried seven advisories including a high-severity axios
SSRF and credential-leak pair. Bumped to axios 1.20 and vitest 5.0: `npm audit`
reports zero. A project that runs model-generated code has no business starting
out with known-vulnerable dependencies.

### Verified, not assumed

| Check | Result |
| --- | --- |
| `npm install` | 87 packages, 0 vulnerabilities |
| `npm run typecheck` | clean across both workspaces |
| `npm run db:migrate` against live PostgreSQL 16 | `001_init.sql` applied |
| `npm run db:migrate` a second time | nothing applied; idempotent |
| `@api-guardian/db` tests | 13 passed |
| `@api-guardian/sample-app` tests | 18 passed |
| `@api-guardian/server` tests | 8 passed |
| Dashboard production build | clean, 229 kB / 72 kB gzipped |
| Dashboard rendered in Chromium | light, dark and 420px wide; no horizontal overflow |
| Data-viz palette validator | passes both modes for the chart hue |
| Badge text contrast | AA in both modes |
| CI's seven-table guard, run locally | passes |

### Known gaps

- **Docker is not available in the environment this was built in**, so
  `docker compose up` and the CI service container are written but unproven
  here. The migration and every test were instead verified against a PostgreSQL
  16 server started directly. The first CI run on GitHub is what confirms the
  container path, and week 5's validator depends on Docker working, so that is
  the thing to check first, not last.
- No linter yet. Typecheck covers the errors that matter most for now; ESLint
  arrives in week 3, where its rules can be set against real code rather than a
  scaffold.
- The dashboard has no tests of its own. The server queries behind it are
  tested, and the page was checked by rendering it, but there is no component
  test. Worth adding when the UI stops changing shape every week.
- The dashboard polls nothing: it loads once. Live updates can wait until there
  is a pipeline producing changes to watch.
- `packages/sample-app/src/types.ts` mirrors the OpenAPI spec by hand. That is
  deliberate — it is how a real consumer drifts from its provider — but it means
  the types do not move when the spec does.

### Next: week 2 — Demo API

Publish v2 of the Contacts API with the five in-scope changes: `customer_name`
renamed, `lifetime_value` retyped from number to decimal string, the activity
endpoint removed, a required `workspace_id` parameter added to the list
endpoint, and the list response wrapped in a paged envelope. Done means both
versions run, and the sample app's tests pass against v1 and fail against v2.
