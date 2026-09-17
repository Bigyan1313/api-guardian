/**
 * Seed data for the dashboard.
 *
 * Week 1 has a schema and no pipeline, so a dashboard reading the real database
 * would correctly show nothing at all. This script writes one worked example
 * through every table, so the UI can be built and judged against realistic
 * shapes now rather than in week 11.
 *
 * It is demo data and the dashboard says so on screen. It is written to match
 * what weeks 2-8 will actually produce — the same Contacts API v1 to v2 move the
 * sample app consumes, with all five in-scope change types — so the day the
 * pipeline fills these tables for real, nothing about the UI has to change.
 *
 * Safe to re-run: it clears the tables it owns first.
 */

import pg from 'pg';

import { databaseUrl, type Queryable } from '@api-guardian/db';

export const DEMO_REPO = 'acme/storefront';

export async function seed(db: Queryable): Promise<void> {
  await db.query('BEGIN');
  try {
    // Ordered by dependency; the cascades would handle it, but being explicit
    // means a partial seed cannot leave half a run behind.
    await db.query('TRUNCATE patches, runs, changes, spec_versions, apis, repos RESTART IDENTITY CASCADE');

    const repo = await db.query<{ id: string }>(
      `INSERT INTO repos (full_name, default_branch, token_ref)
       VALUES ($1, 'main', 'GITHUB_TOKEN') RETURNING id`,
      [DEMO_REPO],
    );
    const repoId = repo.rows[0]!.id;

    const api = await db.query<{ id: string }>(
      `INSERT INTO apis (name, spec_url, check_schedule)
       VALUES ('Contacts API', 'https://contacts.example.test/openapi.json', '0 * * * *')
       RETURNING id`,
    );
    const apiId = api.rows[0]!.id;

    const v1 = await db.query<{ id: string }>(
      `INSERT INTO spec_versions (api_id, spec, content_hash, source, fetched_at)
       VALUES ($1, $2, $3, 'fetch', now() - interval '8 days') RETURNING id`,
      [apiId, { openapi: '3.1.0', info: { version: '1.0.0' } }, '1'.repeat(64)],
    );
    const v2 = await db.query<{ id: string }>(
      `INSERT INTO spec_versions (api_id, spec, content_hash, source, fetched_at)
       VALUES ($1, $2, $3, 'fetch', now() - interval '2 hours') RETURNING id`,
      [apiId, { openapi: '3.1.0', info: { version: '2.0.0' } }, '2'.repeat(64)],
    );

    // The five in-scope change types, plus one safe change and one we refuse to
    // touch. The refusal is the point of the project, so it is in the seed.
    const rows: {
      type: string;
      classification: string;
      path: string;
      method: string | null;
      pointer: string | null;
      confidence: number;
      confirmedBy: string | null;
      summary: string;
    }[] = [
      {
        type: 'field_renamed',
        classification: 'breaking',
        path: '/v1/contacts',
        method: 'get',
        pointer: '/properties/customer_name',
        confidence: 0.98,
        confirmedBy: 'migration_note',
        summary: 'customer_name renamed to full_name (migration note confirms the mapping)',
      },
      {
        type: 'field_type_changed',
        classification: 'breaking',
        path: '/v1/contacts',
        method: 'get',
        pointer: '/properties/lifetime_value',
        confidence: 0.94,
        confirmedBy: 'migration_note',
        summary: 'lifetime_value changed from number to decimal string',
      },
      {
        type: 'endpoint_removed',
        classification: 'breaking',
        path: '/v1/contacts/{id}/activity',
        method: 'get',
        pointer: null,
        confidence: 1.0,
        confirmedBy: null,
        summary: 'Activity endpoint removed with no documented replacement',
      },
      {
        type: 'required_parameter_added',
        classification: 'breaking',
        path: '/v1/contacts',
        method: 'get',
        pointer: '/parameters/workspace_id',
        confidence: 0.91,
        confirmedBy: 'migration_note',
        summary: 'workspace_id is now a required query parameter',
      },
      {
        type: 'response_shape_changed',
        classification: 'breaking',
        path: '/v1/contacts',
        method: 'get',
        pointer: '/responses/200',
        confidence: 0.87,
        confirmedBy: null,
        summary: 'Bare array replaced by a paged envelope: { data, next_cursor }',
      },
      {
        // The one we deliberately refuse to patch. email disappeared and
        // contact_email appeared, and no migration note says they are the same
        // field. Guessing here is how you corrupt someone's data.
        type: 'field_renamed',
        classification: 'unknown',
        path: '/v1/contacts',
        method: 'get',
        pointer: '/properties/email',
        confidence: 0.42,
        confirmedBy: null,
        summary: 'email disappeared, contact_email appeared — no migration note confirms a mapping',
      },
      {
        type: 'field_type_changed',
        classification: 'safe',
        path: '/v1/contacts/{id}',
        method: 'get',
        pointer: '/properties/created_at',
        confidence: 0.99,
        confirmedBy: null,
        summary: 'created_at widened to accept a nullable date-time; existing callers unaffected',
      },
    ];

    const changeIds: string[] = [];
    for (const row of rows) {
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO changes
           (from_version_id, to_version_id, type, classification, path, method, pointer,
            confidence, mapping_confirmed_by, detail)
         VALUES ($1, $2, $3::change_type, $4::change_classification, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          v1.rows[0]!.id,
          v2.rows[0]!.id,
          row.type,
          row.classification,
          row.path,
          row.method,
          row.pointer,
          row.confidence,
          row.confirmedBy,
          { summary: row.summary },
        ],
      );
      changeIds.push(inserted.rows[0]!.id);
    }

    const [renamed, retyped, removed, requiredParam, reshaped, unconfirmed] = changeIds;

    // A run per change that we acted on. The shapes here are the ones section 9
    // measures: attempts needed, cost, model, and how it ended.
    const runOf = async (
      changeId: string,
      stage: string,
      status: string,
      attempts: number,
      cost: number,
      model: string | null,
      minutesAgo: number,
    ): Promise<string> => {
      const terminal = status !== 'pending' && status !== 'running';
      const result = await db.query<{ id: string }>(
        `INSERT INTO runs
           (change_id, repo_id, stage, status, attempts, tokens_in, tokens_out, cost_usd, model,
            started_at, finished_at)
         VALUES ($1, $2, $3::run_stage, $4::run_status, $5, $6, $7, $8, $9,
                 now() - ($10 || ' minutes')::interval,
                 CASE WHEN $11 THEN now() - ($10 || ' minutes')::interval + interval '3 minutes' END)
         RETURNING id`,
        [
          changeId, repoId, stage, status, attempts,
          attempts * 7400, attempts * 820, cost, model, String(minutesAgo), terminal,
        ],
      );
      return result.rows[0]!.id;
    };

    // Repaired on the second attempt, after the compiler error went back to the
    // model. Section 7 predicts this is the common shape.
    const runRenamed = await runOf(renamed!, 'pull_request', 'succeeded', 2, 0.0412, 'claude-opus-5', 96);
    await db.query(
      `INSERT INTO patches (run_id, attempt, diff, test_output, tests_passed, tests_total, outcome)
       VALUES ($1, 1, $2, $3, 14, 18, 'failed')`,
      [
        runRenamed,
        "--- a/src/reporting.ts\n+++ b/src/reporting.ts\n@@\n-    displayName: contact.customer_name,\n+    displayName: contact.full_name,",
        "src/clients/fetch-client.ts(24,12): error TS2551: Property 'full_name' does not exist on type 'Contact'.",
      ],
    );
    await db.query(
      `INSERT INTO patches (run_id, attempt, diff, test_output, tests_passed, tests_total, outcome, pr_url)
       VALUES ($1, 2, $2, $3, 18, 18, 'success', $4)`,
      [
        runRenamed,
        "--- a/src/types.ts\n+++ b/src/types.ts\n@@\n-  readonly customer_name: string;\n+  readonly full_name: string;\n--- a/src/reporting.ts\n+++ b/src/reporting.ts\n@@\n-    displayName: contact.customer_name,\n+    displayName: contact.full_name,",
        'Test Files  2 passed (2)\n     Tests  18 passed (18)',
        'https://github.com/acme/storefront/pull/482',
      ],
    );

    const runRetyped = await runOf(retyped!, 'pull_request', 'succeeded', 1, 0.0198, 'claude-opus-5', 74);
    await db.query(
      `INSERT INTO patches (run_id, attempt, diff, test_output, tests_passed, tests_total, outcome, pr_url)
       VALUES ($1, 1, $2, $3, 18, 18, 'success', $4)`,
      [
        runRetyped,
        "--- a/src/reporting.ts\n+++ b/src/reporting.ts\n@@\n-export function formatUsd(amount: number): string {\n+export function formatUsd(amount: string): string {\n+  const value = Number.parseFloat(amount);",
        'Test Files  2 passed (2)\n     Tests  18 passed (18)',
        'https://github.com/acme/storefront/pull/483',
      ],
    );

    // Caught cheating: it deleted the failing test instead of fixing the code.
    const runRequired = await runOf(requiredParam!, 'validate', 'failed', 3, 0.0367, 'gemini-2.5-pro', 55);
    await db.query(
      `INSERT INTO patches (run_id, attempt, diff, test_output, tests_passed, tests_total,
                            outcome, cheat_reason)
       VALUES ($1, 3, $2, $3, 17, 17, 'rejected_cheating', 'test_file_modified')`,
      [
        runRequired,
        "--- a/test/clients.test.ts\n+++ b/test/clients.test.ts\n@@\n-  it('lists contacts', async () => {\n-    const contacts = await client.listContacts();",
        'Test Files  2 passed (2)\n     Tests  17 passed (17)   <-- one fewer than before',
      ],
    );

    // Ran out of attempts. Honest failure, flagged for a human.
    const runReshaped = await runOf(reshaped!, 'repair', 'needs_human', 4, 0.0721, 'claude-opus-5', 38);
    await db.query(
      `INSERT INTO patches (run_id, attempt, diff, test_output, tests_passed, tests_total, outcome)
       VALUES ($1, 4, $2, $3, 11, 18, 'failed')`,
      [
        runReshaped,
        "--- a/src/clients/fetch-client.ts\n+++ b/src/clients/fetch-client.ts\n@@\n-    return (await response.json()) as Contact[];\n+    return ((await response.json()) as { data: Contact[] }).data;",
        'Tests  11 passed | 7 failed (18)\n  paging not handled at 3 of 5 call sites',
      ],
    );

    // Never attempted: no confirmed mapping, so it is flagged rather than patched.
    const runFlagged = await runOf(unconfirmed!, 'classify', 'needs_human', 0, 0, null, 30);
    await db.query(`UPDATE runs SET error = $2 WHERE id = $1`, [
      runFlagged,
      'No migration note confirms email -> contact_email. Flagged for a human; not patched.',
    ]);

    // Nothing in the repo calls the removed endpoint, so there is nothing to fix.
    const runRemoved = await runOf(removed!, 'locate', 'succeeded', 0, 0, null, 24);
    await db.query(
      `INSERT INTO patches (run_id, attempt, diff, outcome)
       VALUES ($1, 1, '', 'not_affected')`,
      [runRemoved],
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await seed(client);
    console.log('seeded: 1 repo, 1 API, 2 spec versions, 7 changes, 6 runs, 6 patches');
  } finally {
    await client.end();
  }
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
