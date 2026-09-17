/**
 * A migration runner small enough to read in one sitting.
 *
 * Rules it enforces:
 *   - migrations run in filename order, each inside its own transaction;
 *   - a migration that has already been applied is never applied twice;
 *   - editing an applied migration is an error, not a silent no-op. The
 *     checksum catches the case where someone fixes a typo in 001 after it has
 *     already run on a teammate's database.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { databaseUrl } from './config.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, '..', '..', '..', 'db', 'migrations');

export interface Migration {
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface MigrateResult {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT        PRIMARY KEY,
    checksum   TEXT        NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

export async function loadMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const entries = await readdir(dir);
  const names = entries.filter((name) => name.endsWith('.sql')).sort();

  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

/** Drops and recreates the public schema. Only ever pointed at a dev or CI database. */
export async function reset(client: pg.ClientBase): Promise<void> {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
}

export async function migrate(
  client: pg.ClientBase,
  dir: string = MIGRATIONS_DIR,
): Promise<MigrateResult> {
  await client.query(CREATE_MIGRATIONS_TABLE);

  const { rows } = await client.query<{ name: string; checksum: string }>(
    'SELECT name, checksum FROM schema_migrations',
  );
  const alreadyApplied = new Map(rows.map((row) => [row.name, row.checksum]));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of await loadMigrations(dir)) {
    const previous = alreadyApplied.get(migration.name);

    if (previous !== undefined) {
      if (previous !== migration.checksum) {
        throw new Error(
          `${migration.name} has changed since it was applied. ` +
            `Write a new migration instead of editing this one.`,
        );
      }
      skipped.push(migration.name);
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
        migration.name,
        migration.checksum,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${migration.name} failed: ${(error as Error).message}`, { cause: error });
    }

    applied.push(migration.name);
  }

  return { applied, skipped };
}

async function main(): Promise<void> {
  const shouldReset = process.argv.includes('--reset');
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();

  try {
    if (shouldReset) {
      await reset(client);
      console.log('schema reset');
    }

    const { applied, skipped } = await migrate(client);
    for (const name of skipped) console.log(`  = ${name} (already applied)`);
    for (const name of applied) console.log(`  + ${name}`);
    console.log(applied.length === 0 ? 'database already up to date' : `${applied.length} applied`);
  } finally {
    await client.end();
  }
}

// Run only when invoked directly, so importing this module in a test is free of
// side effects.
if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
