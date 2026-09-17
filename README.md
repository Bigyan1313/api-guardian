# API Guardian

Self-maintaining API integrations.

When a provider changes its API, the code that calls it breaks. Someone has to
notice the change, find the broken code, fix it, and test it. API Guardian does
that loop automatically and stops at the pull request, where a human reviews and
merges. We never merge our own changes.

```
  Spec source (URL or upload)
            |
            v
  [ Spec Watcher ]  -- saves versions -->  Postgres
            |
            v
  [ Diff Engine: oasdiff ]            -->  list of changes
            |
            v
  [ Breaking-change classifier ]      -->  breaking / safe / unknown
            |
            v
  [ Code Locator: ts-morph ]          -->  files + exact call sites
            |
            v
  [ Repair Agent: LLM + retry loop ]  -->  patch
            |
            v
  [ Validator: tsc + Vitest in Docker ] -> pass / fail / cheated
            |
            v
  [ PR Writer: GitHub API ]           -->  pull request
            |
            v
  [ Dashboard: React ]                <--  reads everything from Postgres
```

Every stage writes its result to the database, so a run can be replayed and a
failure can be traced to the stage that caused it.

## The rule we do not break

A spec difference is not proof that two fields mean the same thing. If
`customer_name` disappears and `full_name` appears, that is a guess until a
migration note or a human confirms it. Guessing here is how you corrupt
someone's data. **Unconfirmed mappings get flagged, not patched.**

## What this is, and is not

Dependabot bumps the version number but does not fix the code. OpenRewrite and
ast-grep apply recipes reliably, but someone must write the recipe first.
CodeRabbit runs oasdiff on the API you *publish*, not the ones you *consume*.

Two gaps are open: nobody links a provider's spec history to a consumer's
codebase end to end, and nobody has published a number for what percent of
breaking API changes an agent can fix correctly. The contribution here is a
working end-to-end system **plus real numbers on where it succeeds and fails**.

## Scope for v1

**In:** TypeScript only; three documented call patterns (`fetch`, `axios`, a
generated client); one demo API we control, at two versions; five change types
(removed endpoint, renamed field, field type changed, new required parameter,
response shape changed); repair only where a migration note gives the mapping.

**Out:** other languages, GraphQL and gRPC, guessing field mappings without a
migration note, auto-merging anything.

## Getting started

Requires Node 22 (see `.nvmrc`) and Docker for the database.

```bash
npm install
cp .env.example .env

npm run db:up        # Postgres 16
npm run db:migrate
npm run db:seed      # demo rows, so the dashboard has something to show

npm run typecheck
npm test
```

`npm test` runs without a database — the schema and API tests skip themselves —
but CI always provides one, so neither is ever unverified on a pull request.

### Seeing the dashboard

```bash
npm run build        # build the dashboard once
npm start            # http://localhost:3001 — API and dashboard on one port
```

For live reload while working on the UI, run `npm run dev:server` and `npm run
dev` in two terminals; Vite serves the dashboard on 5173 and proxies `/api` to
the server.

The dashboard is week 11's deliverable, pulled forward so the shapes can be
judged early. Until the pipeline exists, `npm run db:seed` writes demo rows in
the shapes weeks 2–8 will produce, **and the page says on screen that it is
looking at seed data.** Every number is a live SQL query; only the contents are
staged.

## Layout

| Path | What lives there |
| --- | --- |
| `db/migrations/` | The schema. Append-only; see `db/README.md`. |
| `packages/db/` | Migration runner and schema tests. |
| `packages/server/` | Express read API over Postgres, and the seed script. |
| `packages/dashboard/` | The React dashboard. |
| `packages/sample-app/` | The TypeScript consumer API Guardian repairs, plus the v1 spec. |
| `BUILD_LOG.md` | What has been built, week by week, and why. |

## Where we are

Week 1 of 12 is done: repo, Postgres, CI, and a sample TypeScript app with
passing tests — plus a working dashboard, pulled forward from week 11.
39 tests pass across three workspaces. `BUILD_LOG.md` has the detail and the
decisions.
