-- 001_init.sql
-- The six tables from section 6 of the build plan.
--
-- Every stage of a run writes its result here, so a run can be replayed and a
-- failure can be traced to the stage that caused it. `runs` and `patches` are
-- where the evaluation numbers in section 9 come from, which is why they are
-- designed before the agent rather than after it.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

-- The five change types in scope for v1 (section 3).
CREATE TYPE change_type AS ENUM (
  'endpoint_removed',
  'field_renamed',
  'field_type_changed',
  'required_parameter_added',
  'response_shape_changed'
);

-- The classifier's verdict. 'unknown' is a real answer, not a failure: it is
-- what we record when a change may break code but we cannot prove it.
CREATE TYPE change_classification AS ENUM (
  'breaking',
  'safe',
  'unknown'
);

-- Pipeline stages, in the order they run (section 4).
CREATE TYPE run_stage AS ENUM (
  'detect',
  'classify',
  'locate',
  'repair',
  'validate',
  'pull_request'
);

CREATE TYPE run_status AS ENUM (
  'pending',
  'running',
  'succeeded',
  'failed',
  'needs_human'
);

-- The terminal outcomes of the repair loop (section 7), plus the cheat-guard
-- rejection from section 8.
CREATE TYPE patch_outcome AS ENUM (
  'success',
  'failed',
  'rejected_cheating',
  'not_affected',
  'needs_human'
);

-- ---------------------------------------------------------------------------
-- repos: the codebases we maintain
-- ---------------------------------------------------------------------------

CREATE TABLE repos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name      TEXT        NOT NULL UNIQUE,   -- "owner/name"
  default_branch TEXT        NOT NULL DEFAULT 'main',

  -- A reference to where the credential lives, never the credential itself.
  -- v1 reads a personal token from the environment by this name; the GitHub
  -- App installation id goes here later.
  token_ref      TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT repos_full_name_shape CHECK (full_name ~ '^[^/[:space:]]+/[^/[:space:]]+$')
);

-- ---------------------------------------------------------------------------
-- apis: the upstream APIs a repo consumes
-- ---------------------------------------------------------------------------

CREATE TABLE apis (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT        NOT NULL UNIQUE,
  spec_url       TEXT,                          -- NULL when specs are uploaded by hand
  check_schedule TEXT,                          -- cron expression; NULL means manual only
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Section 3 keeps manual upload in scope alongside scheduled checking, so an
  -- API with neither a URL nor a schedule is legal. An API with a schedule but
  -- no URL is not: there would be nothing to fetch.
  CONSTRAINT apis_schedule_needs_url CHECK (check_schedule IS NULL OR spec_url IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- spec_versions: every spec we have ever seen, kept forever
-- ---------------------------------------------------------------------------

CREATE TABLE spec_versions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  api_id       BIGINT      NOT NULL REFERENCES apis (id) ON DELETE CASCADE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The spec itself. JSONB because oasdiff and the classifier both want to
  -- address paths inside it; YAML specs are converted on the way in.
  spec         JSONB       NOT NULL,

  -- sha256 of the canonical spec bytes. Lets the watcher skip a re-fetch that
  -- changed nothing, which is the common case on a schedule.
  content_hash TEXT        NOT NULL,

  source       TEXT        NOT NULL DEFAULT 'fetch',

  CONSTRAINT spec_versions_hash_shape CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT spec_versions_source_known CHECK (source IN ('fetch', 'upload', 'fixture')),

  -- The same bytes for the same API are one version, not two.
  CONSTRAINT spec_versions_unique_per_api UNIQUE (api_id, content_hash)
);

CREATE INDEX spec_versions_api_fetched_idx ON spec_versions (api_id, fetched_at DESC);

-- ---------------------------------------------------------------------------
-- changes: one row per difference between two spec versions
-- ---------------------------------------------------------------------------

CREATE TABLE changes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_version_id BIGINT NOT NULL REFERENCES spec_versions (id) ON DELETE CASCADE,
  to_version_id   BIGINT NOT NULL REFERENCES spec_versions (id) ON DELETE CASCADE,

  type            change_type          NOT NULL,
  classification  change_classification NOT NULL,

  -- Where in the API the change happened: the OpenAPI path, the method, and
  -- the JSON pointer into the operation for field-level changes.
  path            TEXT   NOT NULL,
  method          TEXT,
  pointer         TEXT,

  -- The classifier's confidence in `classification`, 0..1.
  confidence      NUMERIC(4, 3) NOT NULL,

  -- oasdiff's own description, kept verbatim so we can show our work.
  detail          JSONB  NOT NULL DEFAULT '{}'::jsonb,

  -- The rule in section 1 we do not break: a mapping is a guess until a
  -- migration note or a human confirms it. A field rename with no confirmed
  -- mapping is flagged, never patched.
  mapping_confirmed_by TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT changes_versions_differ CHECK (from_version_id <> to_version_id),
  CONSTRAINT changes_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT changes_method_known CHECK (
    method IS NULL OR method IN ('get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace')
  ),
  CONSTRAINT changes_mapping_source_known CHECK (
    mapping_confirmed_by IS NULL OR mapping_confirmed_by IN ('migration_note', 'human')
  )
);

CREATE INDEX changes_to_version_idx ON changes (to_version_id);
CREATE INDEX changes_classification_idx ON changes (classification, type);

-- ---------------------------------------------------------------------------
-- runs: one attempt to carry one change through the pipeline for one repo
-- ---------------------------------------------------------------------------

CREATE TABLE runs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  change_id    BIGINT     NOT NULL REFERENCES changes (id) ON DELETE CASCADE,
  repo_id      BIGINT     NOT NULL REFERENCES repos (id) ON DELETE CASCADE,

  stage        run_stage  NOT NULL,
  status       run_status NOT NULL DEFAULT 'pending',

  -- Cost control from section 12: cap attempts, cap tokens, log cost per run.
  attempts       INTEGER       NOT NULL DEFAULT 0,
  tokens_in      INTEGER       NOT NULL DEFAULT 0,
  tokens_out     INTEGER       NOT NULL DEFAULT 0,
  cost_usd       NUMERIC(10, 6) NOT NULL DEFAULT 0,

  -- Which model produced this run, so section 9's model comparison is a query
  -- rather than a spreadsheet someone kept by hand.
  model          TEXT,

  error          TEXT,

  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,

  CONSTRAINT runs_attempts_capped CHECK (attempts >= 0 AND attempts <= 4),
  CONSTRAINT runs_tokens_nonneg CHECK (tokens_in >= 0 AND tokens_out >= 0),
  CONSTRAINT runs_cost_nonneg CHECK (cost_usd >= 0),
  CONSTRAINT runs_finished_after_started CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT runs_terminal_is_finished CHECK (
    status IN ('pending', 'running') OR finished_at IS NOT NULL
  )
);

CREATE INDEX runs_change_idx ON runs (change_id);
CREATE INDEX runs_repo_started_idx ON runs (repo_id, started_at DESC);
CREATE INDEX runs_status_idx ON runs (status, stage);

-- ---------------------------------------------------------------------------
-- patches: what the agent produced, and what happened when we tested it
-- ---------------------------------------------------------------------------

CREATE TABLE patches (
  id            BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id        BIGINT        NOT NULL REFERENCES runs (id) ON DELETE CASCADE,

  attempt       INTEGER       NOT NULL,
  diff          TEXT          NOT NULL,

  -- Raw tsc and Vitest output, kept whole. The PR body quotes it and the
  -- evaluation parses it; both want the real thing, not a summary.
  test_output   TEXT,
  tests_passed  INTEGER,
  tests_total   INTEGER,

  outcome       patch_outcome NOT NULL,

  -- Which cheat guard fired, when one did (section 8). NULL when none did.
  cheat_reason  TEXT,

  pr_url        TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT patches_attempt_range CHECK (attempt >= 1 AND attempt <= 4),
  CONSTRAINT patches_one_per_attempt UNIQUE (run_id, attempt),
  CONSTRAINT patches_test_counts CHECK (
    (tests_passed IS NULL AND tests_total IS NULL)
    OR (tests_passed >= 0 AND tests_total >= tests_passed)
  ),
  -- A cheating verdict must say which guard caught it, and a patch that was
  -- not rejected for cheating must not carry a reason.
  CONSTRAINT patches_cheat_reason_matches_outcome CHECK (
    (outcome = 'rejected_cheating') = (cheat_reason IS NOT NULL)
  ),
  CONSTRAINT patches_cheat_reason_known CHECK (
    cheat_reason IS NULL OR cheat_reason IN (
      'test_file_modified',
      'passing_tests_decreased',
      'test_count_changed',
      'type_suppression_added',
      'config_modified'
    )
  )
);

CREATE INDEX patches_run_idx ON patches (run_id, attempt);
CREATE INDEX patches_outcome_idx ON patches (outcome);
