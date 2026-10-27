-- 003_run_locations.sql
--
-- Where the locator's results live (open decision D3).
--
-- A run already records which stage it reached and how it ended; this adds the
-- evidence behind the `locate` stage: the exact lines the repair agent will be
-- shown, and the coverage that says whether an empty result means "not
-- affected" or "we could not tell".
--
-- A separate table rather than a JSONB column on `runs`, because the dashboard
-- lists and counts these rows, the agent reads them file by file, and week 9
-- compares them against hand-written expectations per scenario. All three want
-- rows, not a document.

CREATE TYPE location_kind AS ENUM (
  -- A call to the changed endpoint.
  'call_site',
  -- A read of the changed field, anywhere in the program.
  'field_read',
  -- The hand-written type that mirrors the changed schema.
  'type_decl'
);

CREATE TABLE run_locations (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id     BIGINT      NOT NULL REFERENCES runs (id) ON DELETE CASCADE,

  -- Repository-relative, so a record stays meaningful on another machine.
  file       TEXT        NOT NULL,
  line       INTEGER     NOT NULL,
  col        INTEGER     NOT NULL,

  kind       location_kind NOT NULL,
  snippet    TEXT        NOT NULL,

  -- Why the locator believes this line is affected. The dashboard shows it, and
  -- it is what makes a wrong location debuggable rather than mysterious.
  reason     TEXT        NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT run_locations_position_positive CHECK (line >= 1 AND col >= 1),
  -- The same line found twice for the same reason is one finding.
  CONSTRAINT run_locations_unique UNIQUE (run_id, file, line, col, kind)
);

CREATE INDEX run_locations_run_idx ON run_locations (run_id);
CREATE INDEX run_locations_file_idx ON run_locations (run_id, file);

-- Coverage belongs to the run, not to any one location: which files were read,
-- and which were not and why. "No call sites found" only means "not affected"
-- when nothing was skipped, so the two have to be stored together.
ALTER TABLE runs
  ADD COLUMN coverage JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN runs.coverage IS
  'Locator coverage: { inspected: string[], skipped: { file, reason }[] }. '
  'An empty location list with a non-empty skipped list is "needs review", not "not affected".';
