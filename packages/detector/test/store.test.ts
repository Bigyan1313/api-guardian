/**
 * Storing specs and changes, against a real database.
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate, reset } from '@api-guardian/db';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { detectChanges } from '../src/detect.ts';
import { storeChanges } from '../src/detect.ts';
import { loadMigrationNote } from '../src/migration-note.ts';
import { isInstalled } from '../src/oasdiff.ts';
import { canonicalise, hashSpec, readSpec, storeSpecVersion } from '../src/spec-store.ts';

const url = process.env['DATABASE_URL'];
const openapi = fileURLToPath(new URL('../../sample-app/openapi/', import.meta.url));
const installed = await isInstalled();

describe('canonicalise', () => {
  it('ignores key order, so a reserialised spec is not a new version', () => {
    expect(hashSpec({ b: 1, a: { d: 2, c: 3 } })).toBe(hashSpec({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('does not reorder arrays, because order is meaningful there', () => {
    expect(canonicalise([2, 1])).toEqual([2, 1]);
    expect(hashSpec([1, 2])).not.toBe(hashSpec([2, 1]));
  });

  it('still notices a real change', () => {
    expect(hashSpec({ a: 1 })).not.toBe(hashSpec({ a: 2 }));
  });
});

describe.skipIf(url === undefined || !installed)('storing a detection run', () => {
  let client: pg.Client;
  let apiId: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await reset(client);
    await migrate(client);
    const api = await client.query<{ id: string }>(
      `INSERT INTO apis (name) VALUES ('Contacts API (detector test)') RETURNING id`,
    );
    apiId = api.rows[0]!.id;
  });

  afterAll(async () => {
    await client?.end();
  });

  it('stores the same spec content only once', async () => {
    const spec = await readSpec(join(openapi, 'contacts-v1.json'));

    const first = await storeSpecVersion(client, apiId, spec, 'fixture');
    const second = await storeSpecVersion(client, apiId, spec, 'fixture');

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.id).toBe(first.id);
  });

  it('writes classified changes against the two versions that produced them', async () => {
    const v1 = await readSpec(join(openapi, 'contacts-v1.json'));
    const v2 = await readSpec(join(openapi, 'contacts-v2.json'));
    const note = await loadMigrationNote(join(openapi, 'contacts-v2.migration.json'));

    const before = await storeSpecVersion(client, apiId, v1, 'fixture');
    const after = await storeSpecVersion(client, apiId, v2, 'fixture');
    const detected = await detectChanges(v1, v2, note);

    const ids = await storeChanges(client, before.id, after.id, detected.changes);
    expect(ids.length).toBe(detected.changes.length);

    const { rows } = await client.query<{
      type: string;
      classification: string;
      mapping_confirmed_by: string | null;
      pointer: string | null;
    }>(
      `SELECT type, classification, mapping_confirmed_by, pointer
         FROM changes WHERE to_version_id = $1`,
      [after.id],
    );

    expect(rows.length).toBe(detected.changes.length);

    // The row the whole method rests on survives the round trip: a rename
    // nobody documented is stored unknown and unconfirmed, so the repair stage
    // will never pick it up.
    const email = rows.filter((r) => (r.pointer ?? '').endsWith('email'));
    expect(email.length).toBeGreaterThan(0);
    for (const row of email) {
      expect(row.classification).toBe('unknown');
      expect(row.mapping_confirmed_by).toBeNull();
    }

    const confirmed = rows.filter((r) => r.mapping_confirmed_by === 'migration_note');
    expect(confirmed.length).toBeGreaterThan(0);
  });

  it('cannot store a category this release put out of scope', async () => {
    await expect(
      client.query(`SELECT 'response_shape_changed'::change_type`),
    ).rejects.toThrow(/invalid input value/);
  });
});
