/**
 * The server's tests run against a real database and a real listening socket.
 *
 * Skipped without DATABASE_URL, like the schema tests, and CI always sets it.
 * They seed first, so the numbers asserted here are the numbers the dashboard
 * shows — if a query drifts from what the UI claims, this is what catches it.
 */

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrate, reset } from '@api-guardian/db';

import { createApp } from '../src/app.ts';
import { seed } from '../src/seed.ts';

const url = process.env['DATABASE_URL'];

describe.skipIf(url === undefined)('read API', () => {
  let pool: pg.Pool;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const setup = new pg.Client({ connectionString: url });
    await setup.connect();
    await reset(setup);
    await migrate(setup);
    await seed(setup);
    await setup.end();

    pool = new pg.Pool({ connectionString: url });
    server = createApp(pool).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  });

  const get = async (path: string): Promise<any> => {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(200);
    return response.json();
  };

  it('reports the database is up', async () => {
    expect(await get('/api/health')).toEqual({ ok: true, database: 'up', seeded: true });
  });

  it('counts what the stat tiles show', async () => {
    const overview = await get('/api/overview');

    expect(overview).toMatchObject({
      repos: 1,
      apis: 1,
      specVersions: 2,
      changes: 7,
      breaking: 5,
      runs: 6,
    });
  });

  it('counts a change as flagged when no note confirms its mapping', async () => {
    const [overview, changes] = await Promise.all([get('/api/overview'), get('/api/changes')]);

    // The rule from section 1, counted the same way in SQL and here: a breaking
    // or unknown change nobody has confirmed a mapping for.
    const expected = changes.filter(
      (change: { classification: string; mappingConfirmedBy: string | null }) =>
        change.mappingConfirmedBy === null &&
        (change.classification === 'breaking' || change.classification === 'unknown'),
    ).length;

    expect(overview.flagged).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('never reports a repair for a change we refused to patch', async () => {
    const runs = await get('/api/runs');
    const refused = runs.find((run: { outcome: string | null }) => run.outcome === null);

    expect(refused?.status).toBe('needs_human');
    expect(refused?.attempts).toBe(0);
  });

  it('groups changes by type for the chart, totals matching the overview', async () => {
    const [byType, overview] = await Promise.all([
      get('/api/changes-by-type'),
      get('/api/overview'),
    ]);

    const summed = byType.reduce((total: number, row: { total: number }) => total + row.total, 0);

    expect(summed).toBe(overview.changes);
    expect(byType.length).toBeGreaterThan(0);
  });

  it('carries the cheat reason through to the runs table', async () => {
    const runs = await get('/api/runs');
    const cheated = runs.find(
      (run: { outcome: string | null }) => run.outcome === 'rejected_cheating',
    );

    expect(cheated?.cheatReason).toBe('test_file_modified');
  });

  it('returns a pull request URL for a repaired change', async () => {
    const runs = await get('/api/runs');
    const repaired = runs.filter((run: { outcome: string | null }) => run.outcome === 'success');

    expect(repaired.length).toBeGreaterThan(0);
    for (const run of repaired) {
      expect(run.prUrl).toMatch(/^https:\/\/github\.com\//);
      expect(run.testsPassed).toBe(run.testsTotal);
    }
  });

  it('serves the dashboard for a non-API path', async () => {
    const response = await fetch(`${base}/`);

    // The static handler is only mounted once the dashboard has been built.
    if (response.status === 404) return;

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
  });
});
