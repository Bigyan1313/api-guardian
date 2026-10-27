-- 002_scope_change_types_to_four.sql
--
-- Narrows `change_type` from five categories to the four the SRS puts in scope
-- for this release, dropping 'response_shape_changed'.
--
-- Why: the SRS (section 5.2) lists endpoint removed, field renamed, field type
-- changed, and required parameter added as the supported categories, and moves
-- response-shape migrations (single object to paged collection) to the deferred
-- extensions in section 7.4. The original plan listed five. The schema is where
-- "out of scope stays out" is enforced rather than merely documented, which is
-- the same reason the attempt cap and the cheat-guard accounting are constraints
-- rather than conventions.
--
-- Deferred is not forbidden. If the team puts response shapes back in scope,
-- that is a new migration adding the value back, not an edit to this file.
--
-- On data loss: Postgres cannot drop a value from an enum in place, so the type
-- is recreated and the columns are re-typed. Any row still carrying the removed
-- category has to go first. At the time this migration was written the only such
-- rows were written by `npm run db:seed` — no part of the pipeline exists yet to
-- produce real ones — so the delete below is bounded to regenerable demo data.
-- It cascades to the runs and patches that referenced those changes.

BEGIN;

-- 1. Remove rows in the category being dropped. runs and patches cascade.
DELETE FROM changes WHERE type = 'response_shape_changed';

-- 2. Recreate the type with the four supported categories.
ALTER TYPE change_type RENAME TO change_type_v1;

CREATE TYPE change_type AS ENUM (
  'endpoint_removed',
  'field_renamed',
  'field_type_changed',
  'required_parameter_added'
);

-- 3. Move the column across. The USING clause is a plain relabel: every
--    surviving value exists in both types.
ALTER TABLE changes
  ALTER COLUMN type TYPE change_type USING type::text::change_type;

DROP TYPE change_type_v1;

COMMIT;
