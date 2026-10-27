/**
 * What the locator returns.
 *
 * A location is evidence: a file, a line, and the reason this line is affected.
 * The repair stage sends these files to the model and nothing else, so a missed
 * location is a patch that cannot compile, and a spurious one is context spent
 * on code that did not need to change.
 */

export type LocationKind =
  /** A call to the changed endpoint. */
  | 'call_site'
  /** A read of the changed field, anywhere in the program. */
  | 'field_read'
  /** The hand-written type that mirrors the changed schema. */
  | 'type_decl';

export interface Location {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly kind: LocationKind;
  readonly snippet: string;
  /** Why the locator believes this line is affected. Shown in the dashboard. */
  readonly reason: string;
}

/**
 * Which files were looked at and which were not.
 *
 * Reported rather than assumed: "no call sites found" only means "not affected"
 * when coverage was complete. A skipped file is why the answer may be
 * "needs review" instead (SRS FR-15, FR-17; BR-02).
 */
export interface Coverage {
  readonly inspected: readonly string[];
  readonly skipped: readonly { file: string; reason: string }[];
}

export interface LocateResult {
  readonly locations: readonly Location[];
  readonly coverage: Coverage;
  /** True when coverage was complete and nothing matched. */
  readonly notAffected: boolean;
}

/** The subset of a `changes` row the locator needs. */
export interface ChangeInput {
  readonly type: 'endpoint_removed' | 'field_renamed' | 'field_type_changed' | 'required_parameter_added';
  readonly path: string;
  readonly method: string | null;
  readonly pointer: string | null;
  /** The field name, for field-level changes. Read from `changes.detail.from`. */
  readonly field?: string | undefined;
}
