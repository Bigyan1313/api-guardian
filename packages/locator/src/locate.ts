/**
 * One behaviour per change category.
 *
 * An empty result is only "not affected" when coverage was complete. If a file
 * was skipped, or a URL was built at run time and could not be read, the honest
 * answer is that we do not know — which is why `notAffected` is computed from
 * coverage rather than from the number of locations (BR-02, SRS FR-16, FR-17).
 */

import type { LoadedProject } from './project.ts';
import { findEndpointCalls } from './endpoints.ts';
import { findFieldReads } from './fields.ts';
import type { ChangeInput, Coverage, LocateResult, Location } from './types.ts';
import { relativePath } from './project.ts';

/** `/v1/contacts/{id}` + GET -> `getV1ContactsById`, the usual generator rule. */
export function operationIdFor(path: string, method: string | null): string {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const parameter = /^\{(.+)\}$/.exec(segment);
      const name = parameter?.[1] ?? segment;
      const camel = name.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());
      const capitalised = camel.charAt(0).toUpperCase() + camel.slice(1);
      return parameter ? `By${capitalised}` : capitalised;
    });

  return `${(method ?? 'get').toLowerCase()}${segments.join('')}`;
}

export function locate(loaded: LoadedProject, change: ChangeInput): LocateResult {
  const { sourceFiles, root, skipped } = loaded;
  const locations: Location[] = [];
  const unreadableSites: Location[] = [];

  const endpoint = (): void => {
    const match = findEndpointCalls(
      sourceFiles,
      root,
      change.path,
      change.method,
      operationIdFor(change.path, change.method),
    );
    locations.push(...match.locations);
    unreadableSites.push(...match.unreadable);
  };

  const field = (): void => {
    if (change.field === undefined) return;
    const match = findFieldReads(sourceFiles, root, change.field);
    locations.push(...match.locations);
  };

  switch (change.type) {
    case 'endpoint_removed':
      // Every call to the endpoint has to go somewhere else, or nowhere.
      endpoint();
      break;

    case 'required_parameter_added':
      // The call sites are what must start sending the parameter.
      endpoint();
      break;

    case 'field_renamed':
    case 'field_type_changed':
      // The field is read far from the HTTP call, so the call sites alone are
      // not enough: the type that mirrors the schema and every read of it have
      // to change together or the build stays broken.
      field();
      endpoint();
      break;
  }

  const coverage: Coverage = {
    inspected: sourceFiles.map((file) => relativePath(root, file)),
    skipped: [
      ...skipped,
      ...unreadableSites.map((site) => ({
        file: `${site.file}:${site.line}`,
        reason: site.reason,
      })),
    ],
  };

  // A dynamically built URL inside the repository means we may have missed a
  // call. Coverage of *this* question is incomplete, so silence is not proof.
  const coverageComplete = unreadableSites.length === 0;

  return {
    locations: dedupe(locations),
    coverage,
    notAffected: locations.length === 0 && coverageComplete,
  };
}

function dedupe(locations: readonly Location[]): Location[] {
  const seen = new Set<string>();
  const unique: Location[] = [];

  for (const location of locations) {
    const key = `${location.file}:${location.line}:${location.column}:${location.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(location);
  }

  return unique.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
}
