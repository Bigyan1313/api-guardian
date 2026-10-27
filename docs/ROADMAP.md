# Roadmap: every week, every task

This is the working breakdown of the twelve-week plan in
[BUILD_PLAN.md](BUILD_PLAN.md) §10. Each plan week has a goal, a "done means"
(copied from the plan, and the only test that counts), an owner, what it depends
on, a task checklist, and the traps worth knowing before you start.

**How to use it.** Pick an unticked task in the current week that matches your
role, put your name on it in [STATUS.md](STATUS.md), do it on a branch, and tick
it here in the same PR that lands the work. Tick a box only when the work is
merged and its check passes. Adding a task you discover along the way is fine;
put it under the week it belongs to.

**Two kinds of "week".** *Plan weeks* (W1–W12) are milestones from the build
plan. *Calendar weeks* are dates. They no longer line up; see the next section.
Code comments and the database say "week 4" and "section 7" meaning plan weeks
and plan sections.

---

## Schedule: where the calendar is versus where the build is

> **Assumption to confirm:** plan week 1 began **Mon 2026-09-14**. The plan PDF is
> dated September 2026 and week 1 was committed on 2026-09-17. If the course
> started on another date, or the final deadline is not Sun 2026-12-06, fix the
> dates below and in [STATUS.md](STATUS.md).

| Cal. week | Dates | Original plan | Status |
| --- | --- | --- | --- |
| 1 | Sep 14 – Sep 20 | W1 Setup | **Done** (+ W11 dashboard pulled forward) |
| 2 | Sep 21 – Sep 27 | W2 Demo API | not started |
| 3 | Sep 28 – Oct 04 | W3 Detection | not started |
| 4 | Oct 05 – Oct 11 | W4 Code locator | not started |
| 5 | Oct 12 – Oct 18 | W5 Validator, **checkpoint** | not started, **we are here (Fri Oct 16)** |
| 6 | Oct 19 – Oct 25 | W6 Repair agent | Tue Oct 20: progress presentation |
| 7 | Oct 26 – Nov 01 | W7 Repair agent | |
| 8 | Nov 02 – Nov 08 | W8 PR writer | |
| 9 | Nov 09 – Nov 15 | W9 Test set | |
| 10 | Nov 16 – Nov 22 | W10 Evaluation | |
| 11 | Nov 23 – Nov 29 | W11 Dashboard | |
| 12 | Nov 30 – Dec 06 | W12 Write-up and demo | |

**We are about four plan weeks behind.** That can be recovered for two reasons:

1. **W11 is mostly done already.** The dashboard was built in week 1, which frees
   a calendar week at the end.
2. **W2–W5 were scheduled one after another, but they barely depend on each
   other.** Only W2 blocks the rest, and only partly. Run in parallel by three
   people, they fit into two calendar weeks.

### Proposed recovery schedule (team to agree Tue Oct 20)

| Cal. week | Dates | Member 1 (frontend → validator) | Member 2 (backend, specs, GitHub) | Member 3 (analysis, agent) |
| --- | --- | --- | --- | --- |
| 6 | Oct 19 – 25 | Install Docker everywhere. W5 validator: runner + parsing | **W2 demo API, done by Wed Oct 21** (blocks the others), then W3 detection | W4 locator against v1 code; `model.ts` wrapper |
| 7 | Oct 26 – Nov 01 | W5 cheat guards. **Checkpoint Sun Nov 1** | W3 done; server write endpoints | W4 done for all five types |
| 8 | Nov 02 – 08 | W9 scenario harness and first scenarios | W8 PR writer | W6 repair loop: **rename end to end by Sun Nov 8** |
| 9 | Nov 09 – 15 | W9 scenarios | W8 done; W9 scenarios | W7 agent across all five types |
| 10 | Nov 16 – 22 | W10 eval harness and baselines 1–2 | W10 baseline 3 (codemods) | W10 baselines 4–5, second model |
| 11 | Nov 23 – 29 | W10 results tables; W11 dashboard over real data | W10 detection precision/recall | W10 human review of every patch |
| 12 | Nov 30 – Dec 06 | W12 report, slides, demo rehearsal (all three) | | |

**Cut triggers, decided now so nobody argues about them later.** The cut order
comes from the plan, §10.

- **Validator not reliable by Sun Nov 1:** freeze the dashboard as it is (no
  polish), and fall back to manual spec upload with no scheduler.
- **Rename case not repaired end to end by Sun Nov 8:** cut from five change
  types to three. The team picks which three; the suggestion is to keep
  `field_renamed`, `field_type_changed` and `endpoint_removed`.
- **Never cut the evaluation (W9 + W10).** A project with numbers and an ugly UI
  beats a pretty UI with no numbers.

---

## How the pieces depend on each other

```
W1 setup ──► W2 demo API ──┬──► W3 detection ──┐
                           ├──► W4 locator ────┼──► W6–7 repair agent ──► W8 PR writer
W1 setup ──► W5 validator ─┴───────────────────┘            │
                                                            ▼
                               W9 test set (needs W2–W5 shapes) ──► W10 evaluation ──► W12
W11 dashboard: built in W1 over seed data; switches to real rows as W3–W8 write them
```

- W5 does **not** need W2 to start: the runner can be built against today's v1
  tests. It needs W2 only to have a failing case to check.
- W4 does **not** need W2 to start: finding every use of `customer_name` is
  possible today. It needs W2's v2 spec to turn a change into the query.
- `src/agent/model.ts` needs nothing and can be written on day one.

---

## W1 — Setup ✅ Done 2026-09-17

**Done means:** repo, Postgres, CI, one sample TypeScript app with passing tests.

- [x] npm workspaces monorepo, Node 22, TypeScript 5.9 strict (`tsconfig.base.json`)
- [x] `db/migrations/001_init.sql`: the six tables, with constraints that enforce the plan
- [x] Migration runner (`packages/db`): checksummed, transactional, append-only
- [x] `docker-compose.yml` Postgres 16; CI with Postgres service container
- [x] Sample app (`packages/sample-app`): `fetch`, `axios`, generated client; `reporting.ts` two layers up
- [x] v1 spec at `packages/sample-app/openapi/contacts-v1.json`
- [x] Fake v1 API as a real HTTP server (`test/support/fake-api.ts`), not a mocked `fetch`
- [x] *(W11 pulled forward)* React + Vite dashboard over the Express read API, with seed data and an on-screen banner

**Carried over (still open from W1):**

- [ ] **Confirm CI actually runs on GitHub.** The workflow triggers on push to
      `main` and on pull requests, but the repo has **no `main` branch** (the only
      branch is `claude/beautiful-faraday-948xah`). Create `main`, make it the
      default, open one PR, and confirm the run is green, including the Postgres
      service container.
- [ ] Install Docker on every member's machine and run `npm run db:up`, which
      has never been run. W5 depends on Docker, so check it first.

---

## W2 — Demo API · Owner: Member 2 · Target: Wed Oct 21

**Done means:** old and new versions running, tests that break on the new one.

The five v2 changes, already fixed by the build log and the seed data:

| # | Change type | What changes in v2 | Where the sample app breaks |
| --- | --- | --- | --- |
| 1 | `field_renamed` | `customer_name` → `full_name` (a migration note **confirms** it) | `reporting.ts`, all three clients |
| 2 | `field_type_changed` | `lifetime_value`: number → decimal string (`"8420.50"`) | `formatUsd`, `rankByValue`, `totalLifetimeValue` |
| 3 | `endpoint_removed` | `GET /v1/contacts/{id}/activity` removed, nothing replaces it | `axios-client.ts` `getActivity` |
| 4 | `required_parameter_added` | `GET /v1/contacts` requires a `workspace_id` query parameter | every `listContacts` / `getV1Contacts` |
| ~~5~~ | ~~`response_shape_changed`~~ | **Deferred** by the SRS (section 7.4) and removed from the `change_type` enum by migration `002`. Re-adding it is a new migration, not an edit. See decision D10. | — |

**Proposed sixth change, for demo step 7 (the refusal):** `email` → `contact_email`
with **no** migration note. The seed data already has this row. Without it in
the real v2, the "we refused to patch" moment in the demo would be fake.

Tasks:

- [ ] `packages/sample-app/openapi/contacts-v2.json`: copy of v1 with the changes above; `info.version: "2.0.0"`
- [ ] **Decide the migration-note format** (open decision D2 in STATUS.md). Suggestion: a prose note like a real provider's changelog, *plus* a small machine-readable file such as `contacts-v2.migration.json` (`{ "renames": [{ "schema": "Contact", "from": "customer_name", "to": "full_name" }] }`). The detector needs the structured part to set `mapping_confirmed_by = 'migration_note'`; the agent reads the prose.
- [ ] `startFakeApiV2()` in `test/support/fake-api.ts`: serves v2 for real. It returns 400 without `workspace_id`, uses the envelope and `full_name`, returns `lifetime_value` as a string, and 404s the activity route.
- [ ] A way to run the same tests against v2, e.g. `CONTACTS_API_VERSION=v2` read by the fixture, plus a script `npm run test:v2 -w @api-guardian/sample-app`
- [ ] A check that **v2 must fail**: a script (and a CI step) that runs `test:v2` and fails the build if it passes. That gives the §9 "fail before the fix" rule a test of its own.
- [ ] Write down which test fails for which change (a table in BUILD_LOG.md). W4 and W9 both use it.
- [ ] Do **not** edit `src/types.ts`. It mirrors v1 by hand on purpose; that drift is the bug we exist to fix.

**Traps:** `tsc` still passes at v2, because the types are hand-written. The
failure shows up at runtime in tests, which is the realistic case, so don't
"fix" it.

---

## W3 — Detection · Owner: Member 2 · Target: Sun Nov 1

**Done means:** oasdiff wired in, changes classified, stored in the database.

- [ ] Install oasdiff and **pin the version**. It's a Go binary: use Homebrew or the `tufin/oasdiff` Docker image locally, and add an install step to CI.
- [ ] New package `packages/detector`:
  - [ ] `watcher.ts`: get a spec from a URL or file upload. Convert YAML to JSON, canonicalise the JSON, sha256 it, then `INSERT … ON CONFLICT (api_id, content_hash) DO NOTHING` into `spec_versions` (`source` = `fetch` / `upload` / `fixture`)
  - [ ] `diff.ts`: run oasdiff with JSON output between two `spec_versions` and parse the result
  - [ ] `classify.ts`: map oasdiff's findings to our five `change_type`s and to `breaking` / `safe` / `unknown` with a `confidence`, keeping oasdiff's own text verbatim in `changes.detail` (and `detail.summary` for the dashboard). Check the exact rule IDs against the pinned oasdiff version (it can list its checks) rather than trusting memory.
  - [ ] `renames.ts`: oasdiff reports a rename as "property removed" plus "property added". Pair them as a *candidate* rename. Set `mapping_confirmed_by = 'migration_note'` **only** when the migration note says so; otherwise leave it NULL, and the change gets flagged.
- [ ] Server write endpoints, a deliberate change from the read-only W1 server:
  `POST /api/apis/:id/specs` (upload) and `POST /api/apis/:id/check` (the "check
  for changes" button in demo step 4)
- [ ] Scheduled checking from `apis.check_schedule` (cron). **This is cut #2 in the cut order**, so build it last.
- [ ] Real spec histories for **detection only** (§3): two or three historical versions each of Stripe, GitHub and Twilio. Their OpenAPI specs are public on GitHub. Store them as fixtures or fetch them with a script. Hand-label the breaking changes for W10's precision/recall.
- [ ] ESLint (deferred from W1 to here in the build log)
- [ ] Test: running detection v1 → v2 produces exactly the expected `changes` rows, with the right type, classification and `mapping_confirmed_by`; the unconfirmed `email` rename has NULL

**Traps:** detection is the part oasdiff already does (§12 risk 1). Keep it thin
and spend the effort on the classifier and the rename rule.

---

## W4 — Code locator · Owner: Member 3 · Target: Sun Nov 1

**Done means:** ts-morph finds the exact call sites for all five change types.

- [ ] New package `packages/locator` using `ts-morph` (pin the version; it is tied to the TypeScript version, which is why TS stays on 5.9)
- [ ] Input: one `changes` row (type, path, method, pointer). Output: a list of `{ file, line, column, kind, snippet }`, where kind is e.g. `call_site`, `field_read`, `type_decl`
- [ ] Endpoint-level matching for all three call patterns:
  - [ ] `fetch`: a template literal URL `` `${base}/v1/contacts/${id}` `` matches the OpenAPI path `/v1/contacts/{id}`
  - [ ] `axios`: an instance from `axios.create`, then `.get('/v1/…')`
  - [ ] generated client: function name = `operationId` (`getV1Contacts`, `getV1ContactsById`)
- [ ] Field-level matching: resolve the TS type that mirrors the schema (`Contact` in `types.ts`), then use the type checker's *find references* on the property symbol. This walks from the spec field to `reporting.ts`, two layers up from the HTTP call. Text search is not enough and does not count.
- [ ] One behaviour per change type (removed endpoint → call sites of that path; rename/type change → every read of the property; required param → call sites of that operation; shape change → call sites plus everything that treats the result as an array)
- [ ] **Decide where located sites are stored** (open decision D3). The schema has no column for them. Suggestion: a new migration `002_locations.sql` (a `run_locations` table, or a JSONB column on `runs`). Never edit `001`.
- [ ] Tests: for each of the five changes, assert the **exact** set of file:line results on the sample app (the W2 table says what to expect). No false negatives on the sample app.
- [ ] Empty result → the run ends as `not_affected` (§7)

---

## W5 — Validator · Owner: Shared (lead Member 1 + one other) · Target: Sun Nov 1 · **Checkpoint**

**Done means:** tsc + Vitest run inside Docker, results parsed, cheat guards working.

> **Checkpoint (§10):** nothing after this works without a trustworthy
> validator. If it isn't reliable by the target date, apply the cut triggers at
> the top of this file.

- [ ] Docker installed and working on all three machines (it is **not** installed on Bigyan's Mac today)
- [ ] New package `packages/validator`:
  - [ ] `Dockerfile` based on `node:22-slim`, with pinned versions
  - [ ] Two phases: **install** with network (`npm ci`), then **test** with `--network none`. No secrets and no env file are mounted, and CPU, memory and wall-clock limits are set (§12: running generated code is unsafe). The sample-app tests use a server on loopback, which still works without a network; confirm this.
  - [ ] Run `tsc --noEmit` and `vitest run --reporter=json`, then parse the results into `{ tscErrors[], testsPassed, testsTotal, failures[] }`
  - [ ] Keep raw output whole in `patches.test_output`; the PR body quotes it and W10 parses it
- [ ] Cheat guards, `guards.ts`, one per allowed `cheat_reason` in the schema:
  - [ ] `test_file_modified`: the patch touches any test file, including adding `.skip` or `.only`
  - [ ] `passing_tests_decreased` / `test_count_changed`: compare to the v1 baseline count
  - [ ] `type_suppression_added`: `@ts-ignore`, `@ts-expect-error`, `any`, or an empty `catch {}` added near changed lines
  - [ ] `config_modified`: `tsconfig*`, `vitest.config*`, `package.json` scripts
- [ ] Fixtures: one known-good hand patch (must pass), one deliberately broken patch (must fail with parsed tsc errors), and **one cheating patch per guard** (each must be rejected with the right reason)
- [ ] CI runs the validator tests. GitHub's Ubuntu runners have Docker; this is the first real proof of the Docker path.

---

## W6–W7 — Repair agent · Owner: Member 3 (Member 2 assists) · Target: rename by Sun Nov 8, all types by Sun Nov 15

**Done means:** the loop from §7 fixes at least the rename case end to end.

- [ ] `packages/agent/src/model.ts` is the **only** file that talks to a model API (§5). Every other file calls it. It returns `{ text, tokensIn, tokensOut, costUsd, model }`.
  - [ ] Two providers: Anthropic and Google Gemini (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY` in `.env`). Pin exact model IDs and record them in `runs.model`.
  - [ ] Decide plain SDK calls vs eve (open decision D4). The suggestion is plain SDKs: the plan allows eve only behind this file and pinned, and it's still beta.
  - [ ] A price table so `cost_usd` is computed, not guessed
- [ ] `context.ts`: the changed spec section, the migration note, the located files (from W4), and on retries the previous tsc/test errors. **Not the whole repo** (§7).
- [ ] `loop.ts`: §7 exactly. A maximum of 4 attempts (the DB enforces this with `runs_attempts_capped`), a token cap per run, one `patches` row per attempt, and `runs.stage` / `status` updated as it goes
- [ ] **The refusal comes before any model call:** a breaking `field_renamed` with `mapping_confirmed_by IS NULL` → `needs_human`, with no patch and no spend
- [ ] Patch format (open decision D5). Suggestion: ask the model for the full new contents of only the located files and compute the diff ourselves, because model-written unified diffs often fail to apply.
- [ ] Apply each patch to a fresh working copy, never to the real checkout
- [ ] Rename end to end: v2 tests failing → agent → validator passes → a `patches` row with `outcome = 'success'`
- [ ] W7: run the other four types and write down what fails and why. Response-shape changes are expected to go badly (§9); that is a finding, not a bug to hide.

---

## W8 — PR writer · Owner: Member 2 · Target: Sun Nov 15

**Done means:** a real pull request appears with diff, explanation, and test output.

- [ ] A demo consumer repo on GitHub containing a copy of the sample app, which is where the PRs land (a team account or one member's)
- [ ] A personal access token (`GITHUB_TOKEN`, `repo` scope) through `repos.token_ref`, never stored in the DB (§5: the GitHub App comes later)
- [ ] Create branch `api-guardian/<change-id>-<slug>`, commit, open the PR, and save `patches.pr_url`
- [ ] PR body: what changed in the API, the migration note it relied on, the diff, the test output before and after, attempts, model, cost, and **the changes we refused to patch and why**
- [ ] **Never merge.** No code path calls the merge endpoint, and a test greps for it.

---

## W9 — Test set · Owner: Shared (all three) · Target: Sun Nov 22

**Done means:** all 20 scenarios built and frozen. *(SRS section 6.2: five per change type across four types. Was 25 across five types; see decision D10.)*

- [ ] Scenario layout, e.g. `packages/eval/scenarios/<change-type>-<n>/` containing `repo/` (frozen sample), `old.json`, `new.json`, the migration note, and `labels.json` (expected classification, expected locations, whether it *should* be patched or refused)
- [ ] **Admission script:** a scenario is accepted only if its tests pass on old and fail on new (§9, §12). Run it in CI.
- [ ] Five per change type × four types = 20. Of the five endpoint removals, two carry a documented replacement and three do not: the three without one **must be refused**, and a confident patch for them fails the scenario even if its tests pass (SRS section 6.2)
- [ ] Vary them: call pattern (`fetch` / `axios` / generated), how far the field travels from the HTTP call, and one change per scenario versus several
- [ ] Split authoring: about 8–9 each. Each scenario is reviewed by someone who didn't write it.
- [ ] Freeze: tag the commit, and from then on scenarios change only through a recorded entry in BUILD_LOG.md

---

## W10 — Evaluation · Owner: Shared (Member 1 leads reporting) · Target: Sun Nov 29

**Done means:** all three baselines run, numbers in a table. *(SRS section 6.3; was five baselines and two models — see decision D10.)*

- [ ] `npm run eval`: one repeatable command, not a one-off demo (§9)
- [ ] The schema needs to know which baseline produced a run (open decision D6), e.g. a new migration adding a `runs.baseline` column
- [ ] Baselines (SRS section 6.3): **B1** do nothing, **B2** one model call with no validation, retries or guards, **B3** the full pipeline. The gap between B2 and B3 is what this project's engineering actually contributes, which is why those two are the ones that cannot be cut
- [ ] One configured model for the measured study; a second model over the same 20 is a stretch goal (SRS section 7.4), attempted only once B1–B3 are reported
- [ ] Numbers: detection precision/recall (on the hand labels, including Stripe/GitHub/Twilio), repair rate overall and **by change type**, refusal correctness on the scenarios with no documented mapping, attempts (mean and spread), cheats caught, **false confidence** (PRs that a human review found wrong), and cost and time per repair
- [ ] A human reviews every patch the agent produced. Record who reviewed it and the verdict.
- [ ] Results go out as Markdown tables for the report and as SQL queries for the dashboard. The dashboard computes nothing (see AGENTS.md).

---

## W11 — Dashboard · Owner: Member 1 · Mostly done in W1

**Done means:** repos, changes, runs, and PRs visible in the UI.

- [x] Overview tiles, changes table, changes-by-type chart, runs table, build progress, seed banner
- [ ] "Check for changes" button wired to W3's endpoint (demo step 4)
- [ ] Run detail view: located files, each attempt's diff, test output, and the cheat reason
- [ ] Results tables from W10 (by change type, by model, by baseline)
- [ ] Polling or refresh while a run is going (it currently loads once)
- [ ] Component tests (none today)
- [ ] Update `BuildProgress.tsx`'s hard-coded week list as weeks land
- [ ] **Dashboard polish is cut #1.** Do it only after W10.

---

## W12 — Write-up and demo · Owner: all three · Target: Sun Dec 6

**Done means:** report, slides, rehearsed live demo.

- [ ] Report: problem, prior work (§2, honestly), method, the evaluation, results by change type and by model, failures and *why*, cheat findings, limitations
- [ ] Slides
- [ ] The 5-minute demo script from §13, rehearsed at least twice, with a recorded fallback video in case the live run fails
- [ ] Results table on the final slide

---

## Stretch goals (only after everything above works)

See [BUILD_PLAN.md](BUILD_PLAN.md) §14. Don't start any of them before W10's
numbers exist. Publishing the 25 scenarios as an open benchmark is the cheapest
and most valuable of them.
