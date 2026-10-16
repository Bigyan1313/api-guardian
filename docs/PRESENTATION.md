# Progress presentation: Tue 2026-10-20

An outline and speaker notes for the work-in-progress presentation. It assumes
about 10 minutes plus questions; trim the slides marked *(optional)* if you have
less time. Speakers are suggestions; split the slides so each person presents
the part they own.

**Tone:** the plan (§2, §9) wins credibility by being honest about what exists,
what doesn't, and where the method will fail. Do the same about the schedule.
Saying "we're behind, here is the recovery plan with dates and cut triggers"
lands better than hoping nobody asks.

---

## Slide 1 · Title (all)

**API Guardian:** self-maintaining API integrations. Team names. "Progress
report, week 6 of 12."

## Slide 2 · The problem (speaker: Member 2)

- A provider changes its API, and your code that calls it breaks.
- Someone has to notice, find the broken code, fix it and test it. It's boring,
  slow and easy to get wrong.
- Concrete example to show: `customer_name` becomes `full_name` in a Contacts
  API, and three files plus a reporting module two layers up all break.

## Slide 3 · What already exists, and the gap (Member 2)

- Dependabot/Renovate bump versions but don't fix code. OpenRewrite and codemods
  need a hand-written recipe per change. CodeRabbit diffs the API you *publish*,
  not the ones you *consume*.
- **Gap 1:** nobody links a provider's spec history to a consumer's code end to end.
- **Gap 2:** nobody has published a number for *what percent of breaking API
  changes an agent can fix correctly*.
- **Our contribution:** a working end-to-end system **plus real numbers** on
  where it succeeds and where it fails.

## Slide 4 · How it works (Member 3)

Show the pipeline diagram from BUILD_PLAN.md §4:
Spec Watcher → oasdiff → classifier → ts-morph locator → LLM repair loop (≤ 4
attempts, compiler errors fed back) → tsc + Vitest in Docker with cheat guards →
GitHub PR → dashboard. Every stage writes to Postgres.

## Slide 5 · The rule we don't break (Member 3)

> A spec difference is not proof two fields mean the same thing. **Unconfirmed
> mappings get flagged, not patched.**

It's enforced in the database: `changes.mapping_confirmed_by` NULL means it can't
be patched. A human always merges, and we never do.

## Slide 6 · Scope (Member 2) *(optional)*

**In:** TypeScript; `fetch`, `axios` and a generated client; five change types
(removed endpoint, renamed field, type changed, new required parameter,
response shape changed); a demo API we control; real Stripe/GitHub/Twilio specs
for detection.
**Out:** other languages, GraphQL/gRPC, guessed mappings, auto-merge.

## Slide 7 · What's done (Member 1 + whoever built week 1)

- Monorepo, strict TypeScript, Postgres schema with **constraints that enforce
  the method**: a four-attempt cap, a cheat verdict must name its guard,
  null mapping means flagged.
- CI: typecheck, migrate twice to prove idempotence, test, and a guard that
  fails if the DB tests silently skipped.
- Sample app that calls the API three ways, with **18 tests against a real HTTP
  server**, not mocks, so a spec change actually breaks them.
- **Dashboard built early** (planned for week 11).

## Slide 8 · Live demo: the dashboard (Member 1)

Before the talk:

```bash
npm run db:up && npm run db:migrate && npm run db:seed
npm run build && npm start        # http://localhost:3001
```

What to show:

1. The **"seed data" banner**. Say it out loud: *these rows are hand-written in
   the shapes the pipeline will produce; the pipeline itself isn't built yet.*
2. Changes table: five change types, one flagged as "needs a human" because no
   migration note confirms `email` → `contact_email`. "This is the case we
   refuse to patch."
3. Runs table: a repair that succeeded on attempt 2, a patch **rejected for
   cheating** (it deleted a failing test), and a run that hit the four-attempt cap.
4. "Every number on this page is a SQL query; the UI computes nothing."

**Backup:** take screenshots beforehand in case Docker or the laptop misbehaves.
Docker isn't installed on every machine yet, so test this setup on the
presenting laptop before Tuesday.

## Slide 9 · Where we are versus the plan (Bigyan or whoever owns the schedule)

Be direct:

- Calendar: end of week 5. Build: week 1 done, plus week 11 done early.
- **About four plan weeks behind.**
- Why it's recoverable: (1) the dashboard week is already done, and (2) weeks
  2–5 (demo API, detection, locator, validator) barely depend on each other, so
  three people can run them **in parallel** instead of one after another.

Show the recovery table from ROADMAP.md (weeks 6–12 by member).

## Slide 10 · Next two weeks and checkpoints (all, each owner states theirs)

| By | What | Owner |
| --- | --- | --- |
| Wed Oct 21 | Demo API v2 with the five breaking changes; v1 tests pass, v2 tests fail | Member 2 |
| Sun Nov 1 | **Checkpoint:** oasdiff detection in the DB, ts-morph locator for all five types, Docker validator + cheat guards | Members 2, 3, 1 |
| Sun Nov 8 | Rename case repaired end to end by the agent | Member 3 |

**Cut triggers** (from the plan's cut order): validator late → freeze the
dashboard and drop the scheduler; rename not working by Nov 8 → five change
types down to three. **The evaluation is never cut.**

## Slide 11 · How we'll measure it (Member 1 or 3)

- 25 frozen scenarios, five per change type, each failing before the fix.
- Five baselines: do nothing, version bump, hand-written codemod, one-shot LLM,
  our full agent.
- Two models (Claude and Gemini).
- Numbers: detection precision/recall, repair rate **by change type**, attempts,
  cheats caught, false confidence, cost per repair.
- Prediction stated up front: renames go well, response-shape changes go badly.

## Slide 12 · Risks (optional) and questions

Top three from §12: an agent patch passes tests but is wrong (cheat guards and
human review of every patch), running generated code (Docker, no network, no
secrets), model cost (four-attempt cap, token cap, cost logged per run).

---

## Likely questions and short answers

- **"Isn't oasdiff doing the hard part?"** Detection, yes, and we say so. Our
  contribution is the repair loop and the measurement, which nobody has published.
- **"How do you know a patch is actually right, not just passing?"** Cheat
  guards (no test edits, no `@ts-ignore`/`any`, no config changes, the test
  count can't change), plus a human review of every patch in the evaluation.
  "False confidence" is one of the numbers we report.
- **"Why not just let the model guess the rename?"** Guessing a field mapping is
  how you corrupt someone's data. That case is flagged on purpose, and it's in
  the demo.
- **"Why is the dashboard done but the pipeline isn't?"** We built it early to
  pin down the data shapes the pipeline has to produce. Seeing the target made
  the schema better. The cost was schedule, and the recovery plan covers that.
- **"What if you can't catch up?"** The cut order is decided in advance, and
  the evaluation is the one thing we never cut.

## Before Tuesday (checklist)

- [ ] Assign names to Member 1/2/3 and decide who presents which slide
- [ ] Build the slides from this outline
- [ ] On the presenting laptop: Docker installed, `db:up`, `db:seed`, `npm start` work; screenshots taken as a backup
- [ ] Confirm the final deadline so the schedule slide's dates are right
- [ ] Ideally: `main` branch created and one green CI run to show (STATUS.md B1)
