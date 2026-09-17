# Database

Six tables, one migration, no ORM. The schema is in `migrations/001_init.sql`
and the runner is `packages/db/src/migrate.ts`.

## Running it

```bash
npm run db:up        # Postgres 16 in Docker
npm run db:migrate   # apply anything not yet applied
npm run db:reset     # drop the schema and re-apply from scratch
```

`DATABASE_URL` overrides the connection string; without it the runner uses the
credentials in `docker-compose.yml`.

## Rules

**Migrations are append-only.** The runner stores a sha256 of each migration
and refuses to continue if an applied file has changed, because the alternative
is a teammate whose database silently disagrees with yours. Fix a mistake in
`001` by writing `002`.

**Every stage writes its result.** `runs` holds one row per attempt to carry one
change through one repo, with the stage it reached, the tokens and cost it
spent, and the model that produced it. `patches` holds what the agent wrote and
what happened when it was tested. Section 9's numbers — repair rate by change
type, attempts needed, cheat attempts caught, cost per repair — are queries over
those two tables. That is why they are designed before the agent, not after it.

**The constraints are load-bearing.** A few of them encode decisions from the
build plan directly, so the database rejects a run that contradicts the method:

| Constraint | What it enforces |
| --- | --- |
| `runs_attempts_capped` | Four attempts, then give up (section 7) |
| `patches_cheat_reason_matches_outcome` | A cheating verdict must name the guard that fired (section 8) |
| `patches_test_counts` | Never more passing tests than there are tests |
| `changes_versions_differ` | A diff needs two different spec versions |
| `apis_schedule_needs_url` | Nothing to fetch on a schedule without a spec URL |
| `spec_versions_unique_per_api` | The same spec bytes are one version, not two |

`changes.mapping_confirmed_by` is the one from section 1: a field mapping is a
guess until a migration note or a human confirms it. It is nullable on purpose —
a null there means the change gets flagged, never patched.
