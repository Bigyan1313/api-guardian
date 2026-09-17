/**
 * The read side of the API. Week 1 has no write endpoints: nothing in the
 * pipeline runs yet, and a dashboard that can only read cannot corrupt a run.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express, type Request, type Response } from 'express';
import type { Queryable } from '@api-guardian/db';

import { changes, changesByType, overview, runs } from './queries.ts';
import { DEMO_REPO } from './seed.ts';

/** Turns a query function into a handler, so one error path covers every route. */
function read<T>(
  pool: Queryable,
  query: (db: Queryable) => Promise<T>,
): (req: Request, res: Response) => Promise<void> {
  return async (_req, res) => {
    try {
      res.json(await query(pool));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: (error as Error).message });
    }
  };
}

export function createApp(pool: Queryable): Express {
  const app = express();

  app.get('/api/health', async (_req, res) => {
    try {
      // Whether the rows on screen came from `npm run seed` rather than a real
      // pipeline run. The dashboard says so on screen when they did, because a
      // demo that does not admit it is a demo is how a project loses trust.
      const { rows } = await pool.query<{ seeded: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM repos WHERE full_name = $1) AS seeded`,
        [DEMO_REPO],
      );
      res.json({ ok: true, database: 'up', seeded: rows[0]?.seeded ?? false });
    } catch (error) {
      res.status(503).json({ ok: false, database: 'down', error: (error as Error).message });
    }
  });

  app.get('/api/overview', read(pool, overview));
  app.get('/api/changes', read(pool, changes));
  app.get('/api/changes-by-type', read(pool, changesByType));
  app.get('/api/runs', read(pool, runs));

  // In development the dashboard runs on Vite's own server and proxies /api
  // here. Once it has been built, serve it from this process too, so the demo
  // is one command on one port instead of two that have to agree.
  const here = dirname(fileURLToPath(import.meta.url));
  const dist = join(here, '..', '..', 'dashboard', 'dist');

  if (existsSync(dist)) {
    app.use(express.static(dist));
    // Anything that is not an API route is the single-page app.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(join(dist, 'index.html'));
    });
  }

  return app;
}
