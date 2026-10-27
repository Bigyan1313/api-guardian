/**
 * Run detection from the command line.
 *
 *   npm run detect -w @api-guardian/detector -- <before.json> <after.json> [note.json]
 *
 * With no arguments it runs the demo API's v1 to v2, which is the path the
 * dashboard's "check for changes" button will take once the server has write
 * endpoints. Results are written to the database when DATABASE_URL is set, and
 * printed either way, so the classifier can be inspected without one.
 */

import { fileURLToPath } from 'node:url';

import { databaseUrl } from '@api-guardian/db';
import pg from 'pg';

import { detectChanges, storeChanges } from './detect.ts';
import { loadMigrationNote } from './migration-note.ts';
import { isInstalled, OASDIFF_VERSION } from './oasdiff.ts';
import { readSpec, storeSpecVersion } from './spec-store.ts';

const openapi = fileURLToPath(new URL('../../sample-app/openapi/', import.meta.url));

async function main(): Promise<void> {
  if (!(await isInstalled())) {
    console.error(
      `oasdiff is not on PATH. Install the pinned version:\n` +
        `  go install github.com/oasdiff/oasdiff@v${OASDIFF_VERSION}`,
    );
    process.exit(1);
  }

  const [beforeArg, afterArg, noteArg] = process.argv.slice(2);
  const beforePath = beforeArg ?? `${openapi}contacts-v1.json`;
  const afterPath = afterArg ?? `${openapi}contacts-v2.json`;
  const notePath = noteArg ?? (beforeArg === undefined ? `${openapi}contacts-v2.migration.json` : undefined);

  const before = await readSpec(beforePath);
  const after = await readSpec(afterPath);
  const note = await loadMigrationNote(notePath);

  const result = await detectChanges(before, after, note);

  console.log(`${result.findingCount} findings from oasdiff, ${result.changes.length} classified\n`);
  for (const change of result.changes) {
    const confirmed = change.mappingConfirmedBy ?? 'unconfirmed — flagged for a human';
    console.log(`  [${change.classification.padEnd(8)}] ${change.type}`);
    console.log(`     ${change.method?.toUpperCase() ?? ''} ${change.path}`);
    console.log(`     ${String(change.detail['summary'])}`);
    console.log(`     confidence ${change.confidence.toFixed(2)} · mapping: ${confirmed}\n`);
  }

  if (result.unmapped.length > 0) {
    console.log(`${result.unmapped.length} findings outside the supported categories:`);
    for (const entry of result.unmapped) console.log(`  - ${entry.finding.id}: ${entry.reason}`);
    console.log();
  }

  if (process.env['DATABASE_URL'] === undefined) {
    console.log('DATABASE_URL is not set, so nothing was stored.');
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const api = await client.query<{ id: string }>(
      `INSERT INTO apis (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [String((before['info'] as Record<string, unknown>)['title'] ?? 'Unnamed API')],
    );
    const apiId = api.rows[0]!.id;

    const from = await storeSpecVersion(client, apiId, before, 'fixture');
    const to = await storeSpecVersion(client, apiId, after, 'fixture');
    const ids = await storeChanges(client, from.id, to.id, result.changes);
    await client.query('COMMIT');

    console.log(`stored ${ids.length} changes against spec versions ${from.id} -> ${to.id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
