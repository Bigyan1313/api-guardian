# API Guardian: Build Plan

> **What this file is.** A faithful Markdown copy of `API-Guardian-Build-Plan.pdf`
> (September 2026), so that people and AI agents can read it from the repo. Code
> comments cite it as "section N" — e.g. `001_init.sql` says "section 6" — and the
> section numbers here match the PDF exactly.
>
> **Do not rewrite sections 1–14.** They are the plan we committed to. If the team
> agrees to change something, record it in [Changes to the plan](#changes-to-the-plan)
> at the bottom, with the date and the reason. That keeps the original commitment
> and every deviation from it visible side by side.

*Self-maintaining API integrations — a 3-person project plan. September 2026.*

---

## 1. What we are building

When a company changes its API, the code that calls that API breaks. Someone has
to notice the change, find the broken code, fix it, and test it. That work is
boring, slow, and easy to get wrong.

API Guardian does it automatically. The full loop:

1. A developer connects a GitHub repo and picks an API to watch.
2. We save a copy of that API's OpenAPI spec as the baseline.
3. Later, we compare the new spec against the baseline and list what changed.
4. We decide which of those changes will actually break code.
5. We scan the repo to find the code that uses the changed parts.
6. An AI agent writes a patch, using the spec difference and any migration notes.
7. We apply the patch on a branch, then run type checks and tests in a container.
8. If it passes, we open a pull request with the change, an explanation, and the
   test output. If it fails, or we are not confident, we flag it for a human.
9. A dashboard shows repos, detected changes, affected files, test results, and PRs.

A human always reviews and merges. We never merge our own changes.

**One rule we do not break:** a spec difference is not proof that two fields mean
the same thing. If `customer_name` disappears and `full_name` appears, that is a
guess until a migration note or a human confirms it. Guessing here is how you
corrupt someone's data. **Unconfirmed mappings get flagged, not patched.**

## 2. What already exists, and why we are still building this

Being honest about this up front makes the project stronger, not weaker.

| Tool | What it does | What it does not do |
| --- | --- | --- |
| Dependabot, Renovate | Bumps the version number | Does not fix the code |
| OpenRewrite, Moderne | Applies hand-written recipes, very reliably | Someone must write the recipe first |
| codemod.com, grit.io, ast-grep | Pattern-based code rewriting | Same: needs a pattern per change |
| ApiPatch (solo open-source project) | LLM fixes library breaking changes, opens PRs | No measured results at all; its own tests are mocked with no live model |
| CodeRabbit | Runs oasdiff during PR review | Flags changes in the API you *publish*, not in the APIs you *consume* |

Two gaps are open:

- **Nobody links a provider's spec history to a consumer's codebase.** Each tool
  does one piece. The end-to-end path is missing.
- **Nobody has measured how well this works.** There is no public number for
  "what percent of breaking API changes can an agent fix correctly." That number
  is the most valuable thing we can produce, and it is also exactly what a class
  project is good at producing.

So our contribution is not "an AI that writes patches." It is a working
end-to-end system plus real numbers on where it succeeds and where it fails.

## 3. Scope for version 1

**In scope**

- TypeScript repos only, with a documented list of supported HTTP call patterns
  (`fetch`, `axios`, and a generated client).
- One demo REST API that we control, with an old and a new version.
- Real public spec histories (Stripe, GitHub, Twilio) for detection only.
- Five change types: removed endpoint, renamed field, field type changed, new
  required parameter, response shape changed (single object to paged list).
- Repair only when the mapping is known from a migration note. Everything else
  gets reported as "needs a human."
- Manual spec upload as well as scheduled checking.

**Out of scope for version 1** (list these in the proposal so nobody expects them)

- Languages other than TypeScript.
- GraphQL and gRPC.
- Guessing field mappings without a migration note.
- Auto-merging anything.

## 4. How the parts fit together

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
failure can be traced to the stage that caused it. Do not skip this. When
something breaks in week 9, the run log is how you find it.

## 5. Tech stack

| Part | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Same language as the code we analyze |
| Frontend | React + Vite | Fast setup, standard |
| Backend | Node + Express | Simple routing and job endpoints |
| Database | PostgreSQL | Runs, jobs, spec versions, results |
| Spec diffing | oasdiff | Already solves spec comparison well |
| Code analysis | ts-morph | Real TypeScript AST, not text matching |
| Agent | Our own thin wrapper over a model API | See note below |
| Validation | tsc + Vitest inside Docker | Never run generated code on your laptop |
| GitHub | REST API with a personal token in v1; GitHub App later | Skip the App setup until the core works |

**Note on the agent framework.** eve (Vercel's agent framework) is real but still
in beta. If we use it, all model calls go behind one file of our own, for example
`src/agent/model.ts`. If eve changes or breaks, we swap that one file for plain
API calls and nothing else in the project moves. Pin the version.

## 6. Database sketch

Six tables are enough:

- **repos** — repo name, install token reference, default branch
- **apis** — name, spec URL, check schedule
- **spec_versions** — api_id, fetched_at, the spec itself, content hash
- **changes** — from_version, to_version, change type, path, classification, confidence
- **runs** — change_id, repo_id, stage, status, cost, tokens, timestamps
- **patches** — run_id, diff, test output, PR url, outcome

`runs` and `patches` are where your evaluation numbers come from, so design them
before you write the agent, not after.

## 7. The repair loop in detail

This is the heart of the project. Rough shape:

```
function repair(change, repo):
    files = locateUsages(change, repo)        # ts-morph
    if files is empty:
        return NOT_AFFECTED
    context = buildContext(change, files, migrationNotes)
    for attempt in 1..4:
        patch  = askModel(context)
        apply(patch, workingCopy)
        result = validate(workingCopy)         # tsc + vitest in Docker
        if result.cheated:
            return REJECTED_CHEATING
        if result.passed:
            return SUCCESS(patch, attempt)
        context = context + result.errors      # feed the failure back
    return FAILED
```

Three things matter more than the prompt:

- **What goes in the context.** You cannot paste a whole repo. Send the changed
  spec section, the migration note, the specific files with the call sites, and
  the type errors. Selecting the right context well beats prompt tricks every time.
- **Feeding errors back.** Most successful fixes happen on attempt 2 or 3, after
  the model sees the real compiler error.
- **A hard stop.** Four attempts, then give up and flag it. An agent that loops
  forever burns money and proves nothing.

## 8. Cheat guards (do not skip this)

Models "fix" failing tests in dishonest ways. Reject a patch if any of these are true:

- It edits, deletes, or skips any test file.
- The number of passing tests went down, or total test count changed.
- It adds `@ts-ignore`, `@ts-expect-error`, `any`, or an empty `catch {}` near
  the changed lines.
- It changes config (`tsconfig`, `vitest.config`) instead of code.

Count rejections and report them. "The agent tried to cheat in 6 out of 25 cases"
is a real finding and the kind of detail that makes a report credible.

## 9. Evaluation plan

This section is what gets you the grade. Build it as a repeatable script, not a
one-time demo.

**Test set: 25 to 30 scenarios.** Five per change type from section 3. Each
scenario is a frozen sample repo, an old spec, a new spec, a migration note, and
tests that pass on the old version and fail on the new one.

**Baselines to compare against:**

1. Do nothing (shows the tests really break)
2. Version bump only (the Dependabot-style baseline)
3. A hand-written ts-morph rule per change type (the codemod baseline)
4. One model call, no tests, no retries
5. Our full agent with validation and retries

**Numbers to report:**

- Detection: precision and recall for "is this change breaking," against labels we write by hand
- Repair rate: percent of scenarios where tests pass at the end
- Repair rate broken down by change type (this is the interesting table)
- Attempts needed, average and spread
- Cheat attempts caught
- False confidence: cases we opened a PR for that were actually wrong on review
- Cost and time per repair

**Also run at least two models** (for example Claude and Gemini) over the same
set. The comparison, and the explanation of *why* they fail differently, is the
part that makes this an AI project rather than plumbing.

Expect renames to work well and response-shape changes to work badly. Report that
honestly. A clean result showing where the method fails is worth more than a
vague result claiming it always works.

## 10. Twelve-week timeline

| Weeks | Goal | Done means |
| --- | --- | --- |
| 1 | Setup | Repo, Postgres, CI, one sample TypeScript app with passing tests |
| 2 | Demo API | Old and new versions running, tests that break on the new one |
| 3 | Detection | oasdiff wired in, changes classified, stored in the database |
| 4 | Code locator | ts-morph finds the exact call sites for all five change types |
| 5 | Validator | tsc + Vitest run inside Docker, results parsed, cheat guards working |
| 6–7 | Repair agent | The loop from section 7 fixes at least the rename case end to end |
| 8 | PR writer | A real pull request appears with diff, explanation, and test output |
| 9 | Test set | All 25 scenarios built and frozen |
| 10 | Evaluation | All five baselines run, numbers in a table |
| 11 | Dashboard | Repos, changes, runs, and PRs visible in the UI |
| 12 | Write-up and demo | Report, slides, rehearsed live demo |

**Checkpoint at week 5:** if the validator is not running reliably by then, cut
the dashboard down to a plain results table and keep going. Nothing after week 5
works without a trustworthy validator.

**Cut order if we fall behind:** dashboard polish first, then the scheduled spec
watcher (fall back to manual upload), then the number of change types (from five
down to three). Never cut the evaluation. A project with numbers and an ugly UI
beats a pretty UI with no numbers.

## 11. Who does what

| Member | Owns | Main deliverables |
| --- | --- | --- |
| Member 1 | Frontend and reporting | Dashboard, run views, results tables, demo screens |
| Member 2 | Backend, specs, GitHub | Express API, Postgres, oasdiff integration, classifier, PR writer |
| Member 3 | Code analysis and agent | ts-morph locator, repair loop, prompt and context building |
| Shared | Validator and evaluation | Docker test runner, cheat guards, the 25 scenarios, final report |

The validator and the test set are shared on purpose. In the original split, one
person owned analysis, repair, *and* validation, which is roughly half the
project. Pulling the Docker runner and the scenarios out into shared work evens
the load and means two people understand the piece everything else depends on.

Everyone also writes documentation and rehearses the demo.

## 12. Risks and what we do about them

| Risk | What we do |
| --- | --- |
| oasdiff already does detection, so our new part looks small | Say so openly. Our contribution is repair plus measurement, and we state that in the report |
| Agent produces patches that pass tests but are wrong | Cheat guards, plus a human review of every patch in the evaluation set |
| Weak test coverage in sample repos hides bad fixes | Only use scenarios where the tests actually fail before the fix |
| eve beta changes under us | One wrapper file for all model calls; pinned version |
| Running generated code is unsafe | Everything runs in Docker with no network and no secrets mounted |
| Model costs run away | Cap attempts at four, cap tokens per run, log cost per run |
| Scope creep | The out-of-scope list in section 3 is a commitment, not a wish list |

## 13. Demo script (5 minutes)

1. Show the sample app with green tests against v1 of the API.
2. Publish v2 of the demo API with a renamed field and a removed endpoint.
3. Show tests now failing.
4. Click "check for changes." The dashboard lists the detected changes and marks
   which are breaking.
5. The run appears: files found, patch generated, tests re-run in Docker, passing.
6. Open the real pull request on GitHub. Show the diff and the explanation.
7. Show one flagged case that we deliberately refused to patch, because the
   mapping was not confirmed. This is the slide people remember.
8. End on the results table from section 9.

## 14. Stretch goals (only after everything above works)

- A second language (Python, with an AST-based locator)
- Real spec histories for repair, not just detection
- Suggesting newly available features, not only fixing breaks
- A fine-tuned small model trained on our successful patches, compared against
  the big models on cost and accuracy
- Publishing the 25 scenarios as an open benchmark, since nothing like it exists
  publicly yet

---

## Changes to the plan

Each entry: date, what changed, why, who agreed. Newest first.

| Date | Change | Why | Agreed by |
| --- | --- | --- | --- |
| 2026-09-17 | Dashboard (week 11) built in week 1 | A foundation nobody can look at is hard to trust; it shows seeded data with an on-screen banner until the pipeline exists | Bigyan |
| 2026-10-16 | *Proposed, not yet agreed:* recovery schedule in [ROADMAP.md](ROADMAP.md) that runs weeks 2–5 in parallel | The calendar is at week 5 and only week 1 is done | *Team to decide at Tuesday 2026-10-20 meeting* |
