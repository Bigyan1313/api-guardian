/**
 * Detection over the real demo specs, with the real oasdiff binary.
 *
 * No mocked findings. The classifier maps oasdiff's rule identifiers by name,
 * so a test against a hand-written fixture would keep passing through exactly
 * the upgrade that breaks it.
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, beforeAll } from 'vitest';

import { detectChanges } from '../src/detect.ts';
import { loadMigrationNote, EMPTY_NOTE } from '../src/migration-note.ts';
import { isInstalled } from '../src/oasdiff.ts';
import { readSpec } from '../src/spec-store.ts';

const openapi = fileURLToPath(new URL('../../sample-app/openapi/', import.meta.url));
const V1 = join(openapi, 'contacts-v1.json');
const V2 = join(openapi, 'contacts-v2.json');
const NOTE = join(openapi, 'contacts-v2.migration.json');

const installed = await isInstalled();

describe.skipIf(!installed)('detecting v1 -> v2 of the Contacts API', () => {
  let result: Awaited<ReturnType<typeof detectChanges>>;

  beforeAll(async () => {
    result = await detectChanges(await readSpec(V1), await readSpec(V2), await loadMigrationNote(NOTE));
  });

  const find = (type: string, pointerEnds: string) =>
    result.changes.filter((c) => c.type === type && (c.pointer ?? '').endsWith(pointerEnds));

  it('reports findings from oasdiff rather than inventing them', () => {
    expect(result.findingCount).toBeGreaterThan(0);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('confirms the documented rename, and says what confirmed it', () => {
    const renames = find('field_renamed', 'customer_name');

    expect(renames.length).toBeGreaterThan(0);
    for (const change of renames) {
      expect(change.classification).toBe('breaking');
      expect(change.mappingConfirmedBy).toBe('migration_note');
      expect(change.detail['to']).toBe('full_name');
    }
  });

  it('refuses to confirm the rename the note never mentions', () => {
    const renames = find('field_renamed', 'email');

    expect(renames.length).toBeGreaterThan(0);
    for (const change of renames) {
      // The whole project rests on this row. `email` vanished and
      // `contact_email` appeared, and nothing documents that they are the same
      // field, so the verdict is unknown and the mapping stays unconfirmed.
      expect(change.classification).toBe('unknown');
      expect(change.mappingConfirmedBy).toBeNull();
      expect(change.confidence).toBeLessThan(0.5);
    }
  });

  it('records the unexplained new name as a candidate, never as a mapping', () => {
    const [change] = find('field_renamed', 'email');

    expect(change?.detail['candidates']).toContain('contact_email');
    // `to` is what a confirmed rename carries. An unconfirmed one must not.
    expect(change?.detail['to']).toBeUndefined();
  });

  it('separates the endpoint that has a replacement from the one that does not', () => {
    const removals = result.changes.filter((c) => c.type === 'endpoint_removed');
    const activity = removals.find((c) => c.path.endsWith('/activity'));
    const notes = removals.find((c) => c.path.endsWith('/notes'));

    expect(activity?.mappingConfirmedBy).toBe('migration_note');
    expect(activity?.detail['summary']).toContain('/events');

    expect(notes?.mappingConfirmedBy).toBeNull();
    expect(notes?.detail['summary']).toContain('no documented replacement');
  });

  it('classifies the type change and the new required parameter as breaking', () => {
    const retyped = result.changes.filter((c) => c.type === 'field_type_changed');
    const required = result.changes.filter((c) => c.type === 'required_parameter_added');

    expect(retyped.length).toBeGreaterThan(0);
    expect(required.length).toBeGreaterThan(0);
    for (const change of [...retyped, ...required]) {
      expect(change.classification).toBe('breaking');
    }
  });

  it('finds every category the release supports and invents none', () => {
    expect(new Set(result.changes.map((c) => c.type))).toEqual(
      new Set([
        'endpoint_removed',
        'field_renamed',
        'field_type_changed',
        'required_parameter_added',
      ]),
    );
  });

  it('accounts for the findings it did not map instead of dropping them', () => {
    expect(result.unmapped.length).toBeGreaterThan(0);
    for (const entry of result.unmapped) {
      expect(entry.reason).not.toBe('');
      expect(entry.finding.id).toBeTruthy();
    }
  });

  it('keeps oasdiff’s own wording, so a verdict can be checked against its evidence', () => {
    for (const change of result.changes) {
      expect(change.detail['oasdiff']).toBeDefined();
    }
  });
});

describe.skipIf(!installed)('without a migration note', () => {
  it('confirms nothing at all', async () => {
    const result = await detectChanges(await readSpec(V1), await readSpec(V2), EMPTY_NOTE);
    const renames = result.changes.filter((c) => c.type === 'field_renamed');

    expect(renames.length).toBeGreaterThan(0);
    // Without a note there is no authority for any mapping, so every rename is
    // a guess and every one of them is flagged.
    for (const change of renames) {
      expect(change.mappingConfirmedBy).toBeNull();
      expect(change.classification).toBe('unknown');
    }
  });
});
