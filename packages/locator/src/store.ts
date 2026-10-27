/**
 * Writing located sites and their coverage against a run.
 *
 * Both in one transaction, because a run that recorded locations but lost its
 * coverage could not answer the only question that matters about an empty
 * result: was nothing affected, or did we fail to look?
 */

import type { Queryable } from '@api-guardian/db';

import type { LocateResult } from './types.ts';

export async function storeLocations(
  db: Queryable,
  runId: string,
  result: LocateResult,
): Promise<number> {
  await db.query('BEGIN');
  try {
    for (const location of result.locations) {
      await db.query(
        `INSERT INTO run_locations (run_id, file, line, col, kind, snippet, reason)
         VALUES ($1, $2, $3, $4, $5::location_kind, $6, $7)
         ON CONFLICT (run_id, file, line, col, kind) DO NOTHING`,
        [
          runId,
          location.file,
          location.line,
          location.column,
          location.kind,
          location.snippet,
          location.reason,
        ],
      );
    }

    await db.query(`UPDATE runs SET coverage = $2 WHERE id = $1`, [
      runId,
      JSON.stringify(result.coverage),
    ]);

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }

  return result.locations.length;
}
