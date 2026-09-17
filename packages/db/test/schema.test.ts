/**
 * Schema tests that need a real Postgres.
 *
 * They run against DATABASE_URL, which CI provides as a service container and a
 * developer provides with `npm run db:up`. Without it the whole file is skipped
 * rather than failed, so `npm test` still works on a laptop with no database —
 * but CI always sets it, so the schema is never unverified on a pull request.
 */

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrate, reset } from '../src/migrate.ts';

const url = process.env['DATABASE_URL'];

describe.skipIf(url === undefined)('schema', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await reset(client);
    await migrate(client);
  });

  afterAll(async () => {
    await client?.end();
  });

  async function tableNames(): Promise<string[]> {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name);
  }

  async function enumValues(typeName: string): Promise<string[]> {
    const { rows } = await client.query<{ label: string }>(
      `SELECT e.enumlabel AS label
         FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = $1
        ORDER BY e.enumsortorder`,
      [typeName],
    );
    return rows.map((r) => r.label);
  }

  /** Runs a statement that must be rejected, and returns the constraint that rejected it. */
  async function rejected(sql: string, params: unknown[] = []): Promise<string> {
    await client.query('BEGIN');
    try {
      await client.query(sql, params);
      throw new Error('expected the database to reject this statement, but it was accepted');
    } catch (error) {
      const constraint = (error as { constraint?: string }).constraint;
      if (constraint === undefined) throw error;
      return constraint;
    } finally {
      await client.query('ROLLBACK');
    }
  }

  it('creates the six tables from the build plan', async () => {
    expect(await tableNames()).toEqual([
      'apis',
      'changes',
      'patches',
      'repos',
      'runs',
      'schema_migrations',
      'spec_versions',
    ]);
  });

  it('knows the five change types in scope for v1', async () => {
    expect(await enumValues('change_type')).toEqual([
      'endpoint_removed',
      'field_renamed',
      'field_type_changed',
      'required_parameter_added',
      'response_shape_changed',
    ]);
  });

  it('treats an unclassifiable change as its own answer', async () => {
    expect(await enumValues('change_classification')).toContain('unknown');
  });

  it('is idempotent: migrating twice applies nothing the second time', async () => {
    const second = await migrate(client);

    expect(second.applied).toEqual([]);
    expect(second.skipped).toContain('001_init.sql');
  });

  describe('a full pipeline run', () => {
    it('records every stage from repo to pull request', async () => {
      await client.query('BEGIN');
      try {
        const repo = await client.query<{ id: string }>(
          `INSERT INTO repos (full_name, token_ref) VALUES ($1, $2) RETURNING id`,
          ['acme/checkout', 'GITHUB_TOKEN'],
        );
        const api = await client.query<{ id: string }>(
          `INSERT INTO apis (name, spec_url, check_schedule) VALUES ($1, $2, $3) RETURNING id`,
          ['billing', 'https://example.test/openapi.json', '0 * * * *'],
        );

        const versions = await Promise.all(
          ['a'.repeat(64), 'b'.repeat(64)].map((hash) =>
            client.query<{ id: string }>(
              `INSERT INTO spec_versions (api_id, spec, content_hash) VALUES ($1, $2, $3) RETURNING id`,
              [api.rows[0]!.id, { openapi: '3.1.0' }, hash],
            ),
          ),
        );

        const change = await client.query<{ id: string }>(
          `INSERT INTO changes
             (from_version_id, to_version_id, type, classification, path, method, pointer,
              confidence, mapping_confirmed_by)
           VALUES ($1, $2, 'field_renamed', 'breaking', '/v1/customers', 'get',
                   '/responses/200/content/application~1json/schema/properties/customer_name',
                   0.95, 'migration_note')
           RETURNING id`,
          [versions[0]!.rows[0]!.id, versions[1]!.rows[0]!.id],
        );

        const run = await client.query<{ id: string }>(
          `INSERT INTO runs
             (change_id, repo_id, stage, status, attempts, tokens_in, tokens_out, cost_usd,
              model, finished_at)
           VALUES ($1, $2, 'validate', 'succeeded', 2, 8100, 900, 0.042, 'claude-opus-5', now())
           RETURNING id`,
          [change.rows[0]!.id, repo.rows[0]!.id],
        );

        const patch = await client.query<{ outcome: string; pr_url: string }>(
          `INSERT INTO patches
             (run_id, attempt, diff, test_output, tests_passed, tests_total, outcome, pr_url)
           VALUES ($1, 2, '--- a/src/client.ts', 'Test Files 1 passed', 12, 12, 'success', $2)
           RETURNING outcome, pr_url`,
          [run.rows[0]!.id, 'https://github.com/acme/checkout/pull/1'],
        );

        expect(patch.rows[0]?.outcome).toBe('success');
        expect(patch.rows[0]?.pr_url).toContain('/pull/1');
      } finally {
        await client.query('ROLLBACK');
      }
    });
  });

  describe('the constraints that protect the evaluation numbers', () => {
    async function seedRun(): Promise<string> {
      const repo = await client.query<{ id: string }>(
        `INSERT INTO repos (full_name) VALUES ('acme/seed') RETURNING id`,
      );
      const api = await client.query<{ id: string }>(
        `INSERT INTO apis (name) VALUES ('seed') RETURNING id`,
      );
      const from = await client.query<{ id: string }>(
        `INSERT INTO spec_versions (api_id, spec, content_hash) VALUES ($1, '{}', $2) RETURNING id`,
        [api.rows[0]!.id, 'c'.repeat(64)],
      );
      const to = await client.query<{ id: string }>(
        `INSERT INTO spec_versions (api_id, spec, content_hash) VALUES ($1, '{}', $2) RETURNING id`,
        [api.rows[0]!.id, 'd'.repeat(64)],
      );
      const change = await client.query<{ id: string }>(
        `INSERT INTO changes (from_version_id, to_version_id, type, classification, path, confidence)
         VALUES ($1, $2, 'endpoint_removed', 'breaking', '/v1/legacy', 1.0) RETURNING id`,
        [from.rows[0]!.id, to.rows[0]!.id],
      );
      const run = await client.query<{ id: string }>(
        `INSERT INTO runs (change_id, repo_id, stage) VALUES ($1, $2, 'repair') RETURNING id`,
        [change.rows[0]!.id, repo.rows[0]!.id],
      );
      return run.rows[0]!.id;
    }

    it('caps attempts at four, as the repair loop does', async () => {
      await client.query('BEGIN');
      try {
        const runId = await seedRun();
        expect(
          await rejected(`UPDATE runs SET attempts = 5 WHERE id = $1`, [runId]),
        ).toBe('runs_attempts_capped');
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('will not record a cheating verdict without naming the guard that fired', async () => {
      await client.query('BEGIN');
      try {
        const runId = await seedRun();
        expect(
          await rejected(
            `INSERT INTO patches (run_id, attempt, diff, outcome)
             VALUES ($1, 1, 'diff', 'rejected_cheating')`,
            [runId],
          ),
        ).toBe('patches_cheat_reason_matches_outcome');
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('will not record more passing tests than there are tests', async () => {
      await client.query('BEGIN');
      try {
        const runId = await seedRun();
        expect(
          await rejected(
            `INSERT INTO patches (run_id, attempt, diff, outcome, tests_passed, tests_total)
             VALUES ($1, 1, 'diff', 'success', 9, 4)`,
            [runId],
          ),
        ).toBe('patches_test_counts');
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('will not diff a spec version against itself', async () => {
      await client.query('BEGIN');
      try {
        const api = await client.query<{ id: string }>(
          `INSERT INTO apis (name) VALUES ('self-diff') RETURNING id`,
        );
        const version = await client.query<{ id: string }>(
          `INSERT INTO spec_versions (api_id, spec, content_hash) VALUES ($1, '{}', $2) RETURNING id`,
          [api.rows[0]!.id, 'e'.repeat(64)],
        );
        expect(
          await rejected(
            `INSERT INTO changes (from_version_id, to_version_id, type, classification, path, confidence)
             VALUES ($1, $1, 'field_renamed', 'unknown', '/x', 0.5)`,
            [version.rows[0]!.id],
          ),
        ).toBe('changes_versions_differ');
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('will not schedule a check against an API with no spec URL to fetch', async () => {
      expect(
        await rejected(`INSERT INTO apis (name, check_schedule) VALUES ('nowhere', '0 * * * *')`),
      ).toBe('apis_schedule_needs_url');
    });

    it('stores the same spec bytes for one API only once', async () => {
      await client.query('BEGIN');
      try {
        const api = await client.query<{ id: string }>(
          `INSERT INTO apis (name) VALUES ('dedupe') RETURNING id`,
        );
        await client.query(
          `INSERT INTO spec_versions (api_id, spec, content_hash) VALUES ($1, '{}', $2)`,
          [api.rows[0]!.id, 'f'.repeat(64)],
        );
        expect(
          await rejected(
            `INSERT INTO spec_versions (api_id, spec, content_hash) VALUES ($1, '{}', $2)`,
            [api.rows[0]!.id, 'f'.repeat(64)],
          ),
        ).toBe('spec_versions_unique_per_api');
      } finally {
        await client.query('ROLLBACK');
      }
    });
  });
});
