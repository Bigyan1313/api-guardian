/**
 * The machine-readable half of a provider's migration note (decision D2).
 *
 * This file is the only thing that may turn a guess into a confirmed mapping.
 * If a correspondence is not stated here, it does not exist as far as the
 * pipeline is concerned, and the change is flagged for a human (BR-04).
 */

import { readFile } from 'node:fs/promises';

export interface Rename {
  readonly schema: string;
  readonly from: string;
  readonly to: string;
}

export interface EndpointReplacement {
  readonly from: { path: string; method: string };
  readonly to: { path: string; method: string };
}

export interface MigrationNote {
  readonly api?: string;
  readonly from_version?: string;
  readonly to_version?: string;
  /** Path to the prose note. The agent reads it; the detector does not. */
  readonly note?: string;
  readonly renames: readonly Rename[];
  readonly endpoints_replaced: readonly EndpointReplacement[];
  readonly endpoints_removed: readonly { path: string; method: string; replacement: null }[];
}

/** An absent note is legal and means nothing is confirmed. */
export const EMPTY_NOTE: MigrationNote = {
  renames: [],
  endpoints_replaced: [],
  endpoints_removed: [],
};

export async function loadMigrationNote(path: string | undefined): Promise<MigrationNote> {
  if (path === undefined) return EMPTY_NOTE;

  const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<MigrationNote>;

  return {
    ...parsed,
    renames: parsed.renames ?? [],
    endpoints_replaced: parsed.endpoints_replaced ?? [],
    endpoints_removed: parsed.endpoints_removed ?? [],
  };
}

/** Does the note state that `from` became `to`? Resemblance is not an answer. */
export function confirmsRename(note: MigrationNote, from: string, to: string): boolean {
  return note.renames.some((rename) => rename.from === from && rename.to === to);
}

/** Every new name the note offers for a removed field, usually zero or one. */
export function documentedTargetsFor(note: MigrationNote, from: string): string[] {
  return note.renames.filter((rename) => rename.from === from).map((rename) => rename.to);
}

export function replacementFor(
  note: MigrationNote,
  path: string,
  method: string,
): { path: string; method: string } | null {
  const match = note.endpoints_replaced.find(
    (entry) =>
      entry.from.path === path && entry.from.method.toLowerCase() === method.toLowerCase(),
  );
  return match ? match.to : null;
}
