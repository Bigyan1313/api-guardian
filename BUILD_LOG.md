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
| 11 | Dashboard | Not started |
| 12 | Write-up and demo | Not started |

---

## Week 1 — Setup

**Done means:** repo, Postgres, CI, one sample TypeScript app with passing tests.

**Result:** all four, verified. 31 tests pass, typecheck is clean, and the
migration was applied against a real PostgreSQL 16 rather than only written.

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
| CI's seven-table guard, run locally | passes |

### Known gaps

- **Docker is not available in the environment this was built in**, so
  `docker compose up` and the CI service container are written but unproven
  here. The migration and every test were instead verified against a PostgreSQL
  16 server started directly. The first CI run on GitHub is what confirms the
  container path, and week 5's validator depends on Docker working, so that is
  the thing to check first, not last.
- No linter yet. Typecheck covers the errors that matter most for now; ESLint
  arrives with the backend in week 3, where its rules can be set against real
  code rather than a scaffold.
- `packages/sample-app/src/types.ts` mirrors the OpenAPI spec by hand. That is
  deliberate — it is how a real consumer drifts from its provider — but it means
  the types do not move when the spec does.

### Next: week 2 — Demo API

Publish v2 of the Contacts API with the five in-scope changes: `customer_name`
renamed, `lifetime_value` retyped from number to decimal string, the activity
endpoint removed, a required `workspace_id` parameter added to the list
endpoint, and the list response wrapped in a paged envelope. Done means both
versions run, and the sample app's tests pass against v1 and fail against v2.
