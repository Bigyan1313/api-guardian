/**
 * Getting a specification into `spec_versions`.
 *
 * Canonicalising before hashing matters: a provider that reorders its JSON keys
 * has not changed its API, and a scheduled check that recorded a new version
 * every morning because the serialiser shuffled would bury the real changes.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { Queryable } from '@api-guardian/db';
import { parse as parseYaml } from 'yaml';

export type SpecSource = 'fetch' | 'upload' | 'fixture';

export interface StoredSpec {
  readonly id: string;
  readonly contentHash: string;
  /** False when this exact content was already stored for this API. */
  readonly isNew: boolean;
}

/** Sorts object keys at every depth so that key order cannot change the hash. */
export function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, inner]) => [key, canonicalise(inner)]),
  );
}

export function hashSpec(spec: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(spec))).digest('hex');
}

/** Reads JSON or YAML from disk and returns it as a plain object. */
export async function readSpec(path: string): Promise<Record<string, unknown>> {
  const text = await readFile(path, 'utf8');
  const parsed = /\.ya?ml$/i.test(path) ? parseYaml(text) : JSON.parse(text);

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`${path} does not contain an object`);
  }
  if (!('openapi' in parsed)) {
    throw new Error(`${path} has no "openapi" field; it does not look like an OpenAPI document`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Stores a spec version, or returns the existing row when the content is
 * unchanged. The uniqueness is enforced by the database
 * (`spec_versions_unique_per_api`), not by checking first and hoping.
 */
export async function storeSpecVersion(
  db: Queryable,
  apiId: string,
  spec: Record<string, unknown>,
  source: SpecSource = 'fetch',
): Promise<StoredSpec> {
  const contentHash = hashSpec(spec);

  const inserted = await db.query<{ id: string }>(
    `INSERT INTO spec_versions (api_id, spec, content_hash, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (api_id, content_hash) DO NOTHING
     RETURNING id`,
    [apiId, spec, contentHash, source],
  );

  if (inserted.rows[0] !== undefined) {
    return { id: inserted.rows[0].id, contentHash, isNew: true };
  }

  const existing = await db.query<{ id: string }>(
    `SELECT id FROM spec_versions WHERE api_id = $1 AND content_hash = $2`,
    [apiId, contentHash],
  );
  return { id: existing.rows[0]!.id, contentHash, isNew: false };
}
