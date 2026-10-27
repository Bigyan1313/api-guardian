# AGENTS.md: start here (for AI assistants and humans)

You are working on **API Guardian**, a 3-person, 12-week project. Three people
each work with their own AI assistant, so the files below are the shared memory
that keeps all of you in the same place. **Read them before you change anything,
and update them before you finish** (see the
[end-of-session checklist](#end-of-session-checklist)).

## Read in this order

1. [docs/STATUS.md](docs/STATUS.md): where the project is right now, who is on
   what, blockers, open decisions. About 2 minutes.
2. [docs/ROADMAP.md](docs/ROADMAP.md): every plan week as a task checklist, with
   owners, targets and traps. Read the current week's section closely.
3. [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md): the original plan. Code comments
   cite it as "section N"; those numbers refer to this file.
4. [BUILD_LOG.md](BUILD_LOG.md): what actually landed, and why it was built that way.
5. The latest two or three entries in [docs/sessions/](docs/sessions/): what
   teammates did most recently.

If your tool doesn't load this file automatically, tell it: *"Read AGENTS.md
and follow it."* (Claude Code loads it through `CLAUDE.md`.)

## The project in ten lines

When a provider changes its API, the code calling it breaks. API Guardian
watches an OpenAPI spec and diffs the new version against the old one with
oasdiff. It classifies each change as breaking, safe or unknown, then finds the
affected call sites in a TypeScript repo with ts-morph. An LLM writes a patch in
a loop of at most four attempts, with compiler errors fed back. The patch is
validated with `tsc` and Vitest **inside Docker**, and patches that cheat are
rejected. If it passes, we open a pull request. A human always merges. The
contribution is the end-to-end system **plus measured numbers**: repair rate by
change type, across two models, against five baselines, over 25 frozen scenarios.

## Rules that are not negotiable

Breaking one of these breaks the project's method, not only its code.

1. **Unconfirmed mappings are flagged, never patched.** A rename is a guess until
   a migration note or a human confirms it (`changes.mapping_confirmed_by`;
   NULL means flagged). See plan §1.
2. **We never merge.** No code path may merge a PR.
3. **Generated code runs only in Docker**, with no network and no secrets
   mounted. Never run a model's patch on a laptop (§5, §12).
4. **Every model call goes through one file**, `packages/agent/src/model.ts`
   (§5). Nothing else imports a model SDK.
5. **Four attempts, then stop** (§7). The DB enforces this with `runs_attempts_capped`.
6. **Every pipeline stage writes its result to Postgres**, so runs can be
   replayed and failures traced (§4).
7. **Migrations are append-only.** Never edit `db/migrations/001_init.sql`;
   write `002_…sql`. The runner checksums applied files and refuses to run if
   one changed.
8. **The dashboard computes nothing.** Every number on screen is one SQL query
   in `packages/server/src/queries.ts`.
9. **Don't loosen the compiler or test config** (`tsconfig*`, `vitest.config*`)
   to make something pass. The validator's cheat guards reject exactly that, and
   it applies to us as well.
10. **Tests talk to a real HTTP server, not a mocked `fetch`**
    (`packages/sample-app/test/support/fake-api.ts`). Don't edit
    `packages/sample-app/src/types.ts` to "fix" v2; that drift is the bug the
    project exists to repair.
11. **Out of scope stays out** (§3): no other languages, no GraphQL or gRPC, no
    guessed mappings, no auto-merge.
12. **Never cut the evaluation** (§10). When behind, follow the cut order in
    ROADMAP.md.
13. **Be honest in claims.** Say what you ran and what it printed. The dashboard
    shows a "seed data" banner for this reason, so keep the same standard in
    commits, docs and the report.

## Repo map

| Path | What lives there | Plan week |
| --- | --- | --- |
| `db/migrations/` | The schema (six tables plus constraints). Append-only. | W1 |
| `packages/db/` | Migration runner, schema tests | W1 |
| `packages/server/` | Express API over Postgres (`queries.ts`), seed script | W1, W3 |
| `packages/dashboard/` | React + Vite dashboard | W11, built in W1 |
| `packages/sample-app/` | The TypeScript consumer we repair; v1 spec in `openapi/` | W1, W2 |
| `packages/detector/` | oasdiff wrapper, classifier, rename rule, spec store | W3 |
| `packages/locator/` | *to create:* ts-morph call-site finder | W4 |
| `packages/validator/` | *to create:* Docker runner, result parser, cheat guards | W5 |
| `packages/agent/` | *to create:* `model.ts`, context builder, repair loop | W6–7 |
| `packages/pr-writer/` | *to create:* GitHub REST | W8 |
| `packages/eval/` | *to create:* 25 scenarios, baselines, `npm run eval` | W9–10 |

The names of packages still to be created are suggestions; if you choose a
different name, update this table.

## Commands

```bash
nvm use                 # Node 22
npm install
cp .env.example .env    # never commit .env
npm run db:up           # Postgres 16 in Docker
npm run db:migrate
npm run db:seed         # demo rows for the dashboard
npm run typecheck
npm test                # DB tests skip without DATABASE_URL; CI always has one
npm run build && npm start      # dashboard + API on http://localhost:3001
npm run dev:server & npm run dev  # live-reload UI on :5173
```

## Code conventions

- TypeScript strict, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
  and `verbatimModuleSyntax` on. ES modules, relative imports with the `.ts`
  extension, no ORM (plain `pg`).
- Comments explain **why**, in full sentences, often citing the plan section.
  Match the density you see in `001_init.sql` and `queries.ts`.
- Pin dependency versions exactly, and run `npm audit` before adding a
  dependency. The repo has zero advisories; keep it that way.
- New behaviour comes with a test that fails without it.

## Git workflow

- `main` is the integration branch. *(It has to be created first; see STATUS.md
  blocker B1.)*
- One branch per task: `<name>/w<N>-<topic>`, e.g. `sam/w3-oasdiff`.
- Open a PR into `main`. CI must be green, and one teammate reviews it. Squash-merge.
- Docs updates (STATUS, ROADMAP ticks, the session note) go **in the same PR as
  the work**, so docs and code never disagree on `main`.
- Commit messages say what changed and why, and what you verified.

## End-of-session checklist

Do this **every time** you stop working, whether the task is finished or not.
If you're an AI, do it before your final reply and tell the human which files
you updated.

1. **Write a session note:** `docs/sessions/YYYY-MM-DD-<name>-<topic>.md`, copied
   from [docs/sessions/TEMPLATE.md](docs/sessions/TEMPLATE.md). Creating a new
   file each time means there are never merge conflicts.
2. **Update your row** in the team table in [docs/STATUS.md](docs/STATUS.md):
   what you're on and what blocks you. Update "Last updated". Add or close any
   blocker or decision you touched. Rewrite "In one paragraph" only if the
   overall picture changed.
3. **Tick tasks** in [docs/ROADMAP.md](docs/ROADMAP.md) that are merged and
   verified. Add any tasks you discovered under the right week.
4. **If something landed** (a week's "done means" is met, or a significant piece
   merged), add it to [BUILD_LOG.md](BUILD_LOG.md) in the existing style: what
   landed, decisions worth recording, a verified-not-assumed table, and known gaps.
   Update the status table at its top and `BuildProgress.tsx` when a week is done.
5. **If the plan changed** (scope, dates, owners, a cut), add a row to
   [BUILD_PLAN.md § Changes to the plan](docs/BUILD_PLAN.md#changes-to-the-plan).
   Never rewrite sections 1–14.
6. **Don't claim what you didn't run.** "Tests pass" means you ran them and
   they passed. Otherwise write "not run".
