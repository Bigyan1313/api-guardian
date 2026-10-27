/**
 * The detection stage, end to end: two stored specifications in, classified
 * `changes` rows out.
 *
 * Writing the result before the next stage begins is what makes a run
 * replayable and a failure traceable to the stage that caused it (plan
 * section 4), so everything here lands in one transaction.
 */

import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import type { Queryable } from '@api-guardian/db';

import type { Change, Unmapped } from './classify.ts';
import { classify, isUnmapped } from './classify.ts';
import type { MigrationNote } from './migration-note.ts';
import { EMPTY_NOTE, replacementFor } from './migration-note.ts';
import { changelog } from './oasdiff.ts';
import { resolveRenames } from './renames.ts';

export interface DetectionResult {
  readonly changes: readonly Change[];
  readonly unmapped: readonly Unmapped[];
  readonly findingCount: number;
}

/** Runs oasdiff over two spec documents and classifies what it reports. */
export async function detectChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  note: MigrationNote = EMPTY_NOTE,
): Promise<DetectionResult> {
  const dir = await mkdtemp(join(tmpdir(), 'api-guardian-diff-'));
  try {
    const basePath = join(dir, 'before.json');
    const revisionPath = join(dir, 'after.json');
    await writeFile(basePath, JSON.stringify(before));
    await writeFile(revisionPath, JSON.stringify(after));

    const findings = await changelog(basePath, revisionPath);

    const changes: Change[] = [];
    const unmapped: Unmapped[] = [];

    for (const finding of findings) {
      const result = classify(finding);
      if (result === null) continue; // belongs to the rename pass
      if (isUnmapped(result)) {
        unmapped.push(result);
        continue;
      }

      // An endpoint removal is repairable only when the note names where the
      // traffic should go instead. Without that there is nothing to migrate to,
      // and inventing a destination is exactly what we refuse to do (BR-05).
      if (result.type === 'endpoint_removed' && result.method !== null) {
        const replacement = replacementFor(note, result.path, result.method);
        changes.push(
          replacement === null
            ? {
                ...result,
                detail: {
                  ...result.detail,
                  summary: `${result.path} removed with no documented replacement`,
                },
              }
            : {
                ...result,
                mappingConfirmedBy: 'migration_note',
                detail: {
                  ...result.detail,
                  summary: `${result.path} replaced by ${replacement.path}`,
                  replacement,
                },
              },
        );
        continue;
      }

      changes.push(result);
    }

    const renames = resolveRenames(findings, note);

    return {
      changes: [...changes, ...renames.changes],
      unmapped: [...unmapped, ...renames.unmapped],
      findingCount: findings.length,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Writes classified changes against a pair of stored spec versions. */
export async function storeChanges(
  db: Queryable,
  fromVersionId: string,
  toVersionId: string,
  changes: readonly Change[],
): Promise<string[]> {
  const ids: string[] = [];

  for (const change of changes) {
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO changes
         (from_version_id, to_version_id, type, classification, path, method, pointer,
          confidence, mapping_confirmed_by, detail)
       VALUES ($1, $2, $3::change_type, $4::change_classification, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        fromVersionId,
        toVersionId,
        change.type,
        change.classification,
        change.path,
        change.method,
        change.pointer,
        change.confidence,
        change.mappingConfirmedBy,
        JSON.stringify(change.detail),
      ],
    );
    ids.push(inserted.rows[0]!.id);
  }

  return ids;
}
