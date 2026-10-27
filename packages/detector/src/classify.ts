/**
 * Turning oasdiff findings into the project's own change records.
 *
 * Two jobs. First, map oasdiff's rule identifiers onto the four change
 * categories this release supports, and refuse to invent a category for
 * anything else. Second, decide breaking / safe / unknown, which is not the
 * same question as oasdiff's severity level: oasdiff says how alarming a
 * difference looks in the specification, while we have to say whether calling
 * code will break, and whether we know enough to act.
 *
 * The rule identifiers are checked against the pinned oasdiff version
 * (see OASDIFF_VERSION). They are matched by name, so an upgrade that renames
 * one must be noticed here rather than silently reclassifying changes.
 */

import type { Finding } from './oasdiff.ts';

export type ChangeType =
  | 'endpoint_removed'
  | 'field_renamed'
  | 'field_type_changed'
  | 'required_parameter_added';

export type Classification = 'breaking' | 'safe' | 'unknown';

export interface Change {
  readonly type: ChangeType;
  readonly classification: Classification;
  readonly path: string;
  readonly method: string | null;
  readonly pointer: string | null;
  readonly confidence: number;
  /** 'migration_note', 'human', or null when nothing confirms the mapping. */
  readonly mappingConfirmedBy: 'migration_note' | 'human' | null;
  readonly detail: Record<string, unknown>;
}

/** A finding we understood but that falls outside the four supported categories. */
export interface Unmapped {
  readonly finding: Finding;
  readonly reason: string;
}

/**
 * Rules that map directly onto a category. Renames are absent on purpose: they
 * arrive as a removal plus an addition and are resolved in renames.ts.
 */
const DIRECT: Record<string, { type: ChangeType; confidence: number }> = {
  'api-path-removed-without-deprecation': { type: 'endpoint_removed', confidence: 1.0 },
  'api-path-removed-with-deprecation': { type: 'endpoint_removed', confidence: 1.0 },
  'api-removed-without-deprecation': { type: 'endpoint_removed', confidence: 1.0 },
  'new-required-request-parameter': { type: 'required_parameter_added', confidence: 0.95 },
  'request-parameter-became-required': { type: 'required_parameter_added', confidence: 0.95 },
  'response-property-type-changed': { type: 'field_type_changed', confidence: 0.95 },
  'request-property-type-changed': { type: 'field_type_changed', confidence: 0.95 },
  'response-property-format-changed': { type: 'field_type_changed', confidence: 0.85 },
};

/** Rules handled by renames.ts, which needs to see both halves of a pair. */
export const RENAME_CANDIDATE_RULES = new Set([
  'response-required-property-removed',
  'response-optional-property-removed',
  'response-required-property-added',
  'response-optional-property-added',
]);

/**
 * Rules we have looked at and decided are not breaking. Listing them explicitly,
 * rather than treating "not in DIRECT" as safe, is what stops a future oasdiff
 * rule we have never seen from being silently waved through.
 */
const KNOWN_SAFE = new Set([
  'endpoint-added',
  'api-schema-removed',
  'response-non-success-status-added',
  'response-property-pattern-added',
  'response-property-max-length-increased',
  'optional-response-header-added',
  'api-operation-id-changed',
  'api-tag-added',
  'description-changed',
  'api-deprecated-sunset-parse',
]);

/** oasdiff's severity: 3 ERR, 2 WARN, 1 INFO. */
function isBreakingLevel(level: number): boolean {
  return level >= 3;
}

/** The property name oasdiff embeds in its text, e.g. `items/customer_name`. */
export function propertyNameOf(finding: Finding): string | null {
  const match = /property `([^`]+)`/.exec(finding.text);
  if (match?.[1] === undefined) return null;
  // `items/foo` means the property of an array's item schema. The leaf is the
  // field name; the prefix only says where in the response it sits.
  const parts = match[1].split('/');
  return parts[parts.length - 1] ?? null;
}

export function pointerOf(finding: Finding): string | null {
  const match = /property `([^`]+)`/.exec(finding.text);
  return match?.[1] === undefined ? null : `/properties/${match[1]}`;
}

/**
 * Classifies one finding that is not part of a rename pair.
 * Returns null when the finding belongs to renames.ts.
 */
export function classify(finding: Finding): Change | Unmapped | null {
  if (RENAME_CANDIDATE_RULES.has(finding.id)) return null;

  const direct = DIRECT[finding.id];
  if (direct !== undefined) {
    return {
      type: direct.type,
      classification: isBreakingLevel(finding.level) ? 'breaking' : 'unknown',
      path: finding.path ?? '(components)',
      method: finding.operation?.toLowerCase() ?? null,
      pointer: pointerOf(finding),
      confidence: direct.confidence,
      // An endpoint removal's mapping is confirmed only if the note names a
      // replacement; detect.ts fills that in, because only it has the note.
      mappingConfirmedBy: null,
      detail: { summary: finding.text, oasdiff: finding },
    };
  }

  if (KNOWN_SAFE.has(finding.id)) {
    return {
      finding,
      reason: `${finding.id} does not break calling code and has no category in this release`,
    };
  }

  // Never seen before. Not assumed safe: reported so a human looks.
  return {
    finding,
    reason:
      `${finding.id} is not a rule this classifier knows. It is reported rather than ` +
      `classified, because treating an unknown rule as harmless is how a breaking ` +
      `change gets missed`,
  };
}

export function isUnmapped(value: Change | Unmapped): value is Unmapped {
  return 'finding' in value;
}
