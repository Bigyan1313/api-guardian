# 2026-10-27 · Bigyan (with Claude) · W3 detector

**Plan week / task:** [W3 — Detection](../ROADMAP.md). Core done; server write
endpoints, real spec histories, scheduled checking and ESLint are still open.
**Branch / PR:** `claude/beautiful-faraday-948xah`. No PR yet — `main` is still
not the GitHub default.

## Done

- **oasdiff pinned at v1.34.1**, installed with `go install`, plus a CI step
  (`actions/setup-go`, then `go install`, then a check that it is on PATH).
  Without it the detector tests skip themselves, which would be a green build
  that tested nothing.
- **`packages/detector`**: `oasdiff.ts` (run and parse), `classify.ts` (rule
  identifiers → our four categories, with per-rule confidence), `renames.ts`
  (the rule below), `migration-note.ts` (the only source of confirmation), and
  `spec-store.ts` (canonicalise, sha256, store with `ON CONFLICT DO NOTHING`).
- **`npm run detect`** prints the classification and, with `DATABASE_URL` set,
  stores the rows. On v1 → v2: 19 oasdiff findings, 9 classified, 8 unmapped.
- **16 detector tests**, run against the real binary and the real specs.
- Dependencies: bumped vitest 5.0.5, express 5.3.0, vite 8.3.5 to clear
  advisories published since the last install. `npm audit` is back to zero.

## Verified

- `npm run typecheck`: clean, all five workspaces.
- `npm test` with Postgres and oasdiff: **61 passed** (14 db + 16 detector +
  23 sample-app + 8 server).
- `npm run detect`: 19 findings, 9 classified across all four categories, 8
  accounted for as out of scope.
- `npm run check:v2-breaks`: passes, 11 failures.
- `npm audit`: **0 vulnerabilities**.
- **CI: green.** The first run ever succeeded on `main` (run #1). The oasdiff
  step was added after that run, so it has not been exercised on a runner yet.
- `docker compose up`: **not run** (B2).

## Decisions made

- **Renames are paired only by the migration note.** oasdiff reports a removal
  plus an addition; which two are the same field is not something a diff knows.
  Unconfirmed pairs are stored `unknown`, `mapping_confirmed_by` NULL, with the
  unexplained additions under `detail.candidates` — candidates, never a mapping.
  A test asserts an unconfirmed rename has no `detail.to`, since that is the
  field the repair stage will read.
- **An unknown oasdiff rule is reported, not assumed safe.** There is an explicit
  list of rules judged harmless; anything in neither list comes back unmapped
  with a reason.
- **Spec JSON is canonicalised before hashing**, so a provider reordering keys
  does not look like a new version.

## Not done / next

- **Server write endpoints** (`POST /api/apis/:id/specs`, `POST /api/apis/:id/check`).
  Until they exist the dashboard still shows seed data rather than detector
  output, and demo step 4 ("click check for changes") cannot work. This is the
  obvious next piece and it is small.
- **Real spec histories** (Stripe, GitHub, Twilio) for W10's detection precision
  and recall. The classifier has only ever seen our own demo API.
- Scheduled checking (cut #2, deliberately last) and ESLint.
- W4 (locator) is unblocked and independent of all of the above.

## Blockers / questions for the team

- **B2 (Docker) is now the critical path.** W5 cannot start without it, and the
  plan is explicit that nothing after W5 is trustworthy without a validator.
  If nobody can install Docker locally, the fallback worth discussing is running
  the validator only in CI, where a container runtime already exists.
- **D10 still open** (SRS vs build plan). This session assumed the SRS again:
  four categories, and the two kinds of endpoint removal.
- Somebody with repo admin needs to **make `main` the default branch**.
