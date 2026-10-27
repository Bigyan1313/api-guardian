/**
 * Rename detection, which is where this project either keeps its promise or
 * breaks it.
 *
 * oasdiff does not report renames. It reports a property removed and a property
 * added, and whether those two are the same field under a new name is not
 * something a specification diff can know. If `customer_name` disappears and
 * `full_name` appears, that is a guess until a migration note or a human
 * confirms it, and acting on a guess is how an automated tool corrupts data
 * (plan section 1, BR-04).
 *
 * So this file never pairs by resemblance. It pairs only what the note states.
 * Everything left over becomes a change classified `unknown`, carrying the
 * unexplained additions as *candidates* — written down so a human can judge
 * them, never as an asserted mapping.
 */

import type { Change, Unmapped } from './classify.ts';
import { propertyNameOf } from './classify.ts';
import type { MigrationNote } from './migration-note.ts';
import { documentedTargetsFor } from './migration-note.ts';
import type { Finding } from './oasdiff.ts';

const REMOVED = new Set([
  'response-required-property-removed',
  'response-optional-property-removed',
]);
const ADDED = new Set([
  'response-required-property-added',
  'response-optional-property-added',
]);

/** Findings in the same operation are candidates for pairing; others are not. */
function scopeOf(finding: Finding): string {
  return `${finding.path ?? ''}|${finding.operation ?? ''}`;
}

export interface RenameResult {
  readonly changes: readonly Change[];
  readonly unmapped: readonly Unmapped[];
}

export function resolveRenames(findings: readonly Finding[], note: MigrationNote): RenameResult {
  const removals = findings.filter((f) => REMOVED.has(f.id));
  const additions = findings.filter((f) => ADDED.has(f.id));

  const changes: Change[] = [];
  const unmapped: Unmapped[] = [];
  const consumedAdditions = new Set<Finding>();

  for (const removal of removals) {
    const from = propertyNameOf(removal);
    if (from === null) {
      unmapped.push({
        finding: removal,
        reason: 'could not read a property name out of the oasdiff text',
      });
      continue;
    }

    const scope = scopeOf(removal);
    const siblings = additions.filter((a) => scopeOf(a) === scope);
    const targets = documentedTargetsFor(note, from);

    // Confirmed: the note says what this field became, and the addition is there.
    const confirmed = siblings.find((a) => {
      const to = propertyNameOf(a);
      return to !== null && targets.includes(to);
    });

    if (confirmed !== undefined) {
      consumedAdditions.add(confirmed);
      changes.push({
        type: 'field_renamed',
        classification: 'breaking',
        path: removal.path ?? '(components)',
        method: removal.operation?.toLowerCase() ?? null,
        pointer: `/properties/${from}`,
        confidence: 0.98,
        mappingConfirmedBy: 'migration_note',
        detail: {
          summary: `${from} renamed to ${propertyNameOf(confirmed)} (migration note confirms the mapping)`,
          from,
          to: propertyNameOf(confirmed),
          oasdiff: [removal, confirmed],
        },
      });
      continue;
    }

    // Not confirmed. The field is gone, which breaks callers either way, but we
    // do not know what to replace it with — so the verdict is `unknown`, the
    // mapping stays unconfirmed, and the change is flagged rather than patched.
    const candidates = siblings
      .filter((a) => !consumedAdditions.has(a))
      .map((a) => propertyNameOf(a))
      .filter((name): name is string => name !== null);

    changes.push({
      type: 'field_renamed',
      classification: 'unknown',
      path: removal.path ?? '(components)',
      method: removal.operation?.toLowerCase() ?? null,
      pointer: `/properties/${from}`,
      // Low on purpose. A field vanished and nothing explains where it went.
      confidence: 0.42,
      mappingConfirmedBy: null,
      detail: {
        summary:
          candidates.length > 0
            ? `${from} disappeared, ${candidates.join(' / ')} appeared — no migration note confirms a mapping`
            : `${from} disappeared with nothing added in its place and no migration note`,
        from,
        // Candidates, not a mapping. Nothing downstream may treat these as the
        // answer; they exist so a human has somewhere to start.
        candidates,
        oasdiff: removal,
      },
    });
  }

  // Additions nobody claimed are not breaking: a new field does not stop old
  // code working. They are recorded as unmapped so coverage stays honest.
  for (const addition of additions) {
    if (consumedAdditions.has(addition)) continue;
    unmapped.push({
      finding: addition,
      reason: 'a property was added; additions do not break existing callers',
    });
  }

  return { changes, unmapped };
}
