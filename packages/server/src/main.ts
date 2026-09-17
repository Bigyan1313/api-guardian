import pg from 'pg';

import { databaseUrl } from '@api-guardian/db';

import { createApp } from './app.ts';

const port = Number(process.env['PORT'] ?? 3001);
const pool = new pg.Pool({ connectionString: databaseUrl() });

createApp(pool).listen(port, () => {
  console.log(`api-guardian server on http://localhost:${port}`);
});
