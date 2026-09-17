# Build Log

What has been built, in order, and why it was built that way. Updated every time
something lands. The twelve-week plan is in the build plan document; this file
is the record of what actually happened against it.

| Week | Goal | Status |
| --- | --- | --- |
| 1 | Setup | **Done** |
| 2 | Demo API | Not started |
| 3 | Detection | Not started |
| 4 | Code locator | Not started |
| 5 | Validator | Not started |
| 6–7 | Repair agent | Not started |
| 8 | PR writer | Not started |
| 9 | Test set | Not started |
| 10 | Evaluation | Not started |
| 11 | Dashboard | **Brought forward to week 1** |
| 12 | Write-up and demo | Not started |

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
