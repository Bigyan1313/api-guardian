/**
 * The locator, against the real sample app.
 *
 * Exact file and line assertions, not "found something". A locator that returns
 * the right count of the wrong lines sends the repair agent to edit code that
 * was never broken, and the only way to catch that is to say where the answers
 * should be.
 */

import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadProject, type LoadedProject } from '../src/project.ts';
import { locate, operationIdFor } from '../src/locate.ts';
import { pathPattern, urlOf } from '../src/endpoints.ts';
import { SyntaxKind } from 'ts-morph';
import type { ChangeInput } from '../src/types.ts';

const sampleApp = fileURLToPath(new URL('../../sample-app/', import.meta.url));
const dynamicFixture = fileURLToPath(new URL('../fixtures/dynamic/', import.meta.url));

describe('path patterns', () => {
  it('matches a parameterised OpenAPI path against a concrete URL', () => {
    expect(pathPattern('/v1/contacts/{id}').test('/v1/contacts/ct_001')).toBe(true);
  });

  it('does not let a parameter swallow extra segments', () => {
    expect(pathPattern('/v1/contacts/{id}').test('/v1/contacts/ct_001/activity')).toBe(false);
  });
});

describe('operationIdFor', () => {
  it('derives the generated client’s function names', () => {
    expect(operationIdFor('/v1/contacts', 'get')).toBe('getV1Contacts');
    expect(operationIdFor('/v1/contacts/{id}', 'get')).toBe('getV1ContactsById');
    expect(operationIdFor('/v1/contacts/{id}/activity', 'get')).toBe('getV1ContactsByIdActivity');
  });
});

describe('locating changes in the sample app', () => {
  let loaded: LoadedProject;

  beforeAll(() => {
    loaded = loadProject(`${sampleApp}tsconfig.json`, sampleApp);
  });

  const files = (change: ChangeInput) => [
    ...new Set(locate(loaded, change).locations.map((l) => l.file)),
  ].sort();

  const at = (change: ChangeInput) =>
    locate(loaded, change)
      .locations.map((l) => `${l.file}:${l.line}`)
      .sort();

  it('walks from a renamed field to the reporting layer, two levels above the call', () => {
    const change: ChangeInput = {
      type: 'field_renamed',
      path: '/v1/contacts',
      method: 'get',
      pointer: '/properties/customer_name',
      field: 'customer_name',
    };

    expect(files(change)).toEqual([
      'src/clients/axios-client.ts',
      'src/clients/fetch-client.ts',
      'src/clients/generated-client.ts',
      'src/reporting.ts',
      'src/types.ts',
    ]);

    // The exact reads in reporting.ts, which is the set a correct patch edits.
    expect(at(change).filter((l) => l.startsWith('src/reporting.ts'))).toEqual([
      'src/reporting.ts:23',
      'src/reporting.ts:24',
      'src/reporting.ts:53',
      'src/reporting.ts:53',
    ]);
  });

  it('finds the arithmetic a retyped field breaks', () => {
    const change: ChangeInput = {
      type: 'field_type_changed',
      path: '/v1/contacts',
      method: 'get',
      pointer: '/properties/lifetime_value',
      field: 'lifetime_value',
    };

    expect(at(change)).toContain('src/reporting.ts:59'); // totalLifetimeValue
    expect(at(change)).toContain('src/types.ts:15');
    expect(files(change)).toContain('src/reporting.ts');
  });

  it('finds every call pattern when a required parameter is added', () => {
    const change: ChangeInput = {
      type: 'required_parameter_added',
      path: '/v1/contacts',
      method: 'get',
      pointer: '/parameters/workspace_id',
    };

    // fetch, axios and the generated client, and nothing else: the parameter
    // changes the request, not anything that reads the response.
    expect(files(change)).toEqual([
      'src/clients/axios-client.ts',
      'src/clients/fetch-client.ts',
      'src/clients/generated-client.ts',
    ]);
  });

  it('finds the single caller of a removed endpoint', () => {
    expect(
      at({ type: 'endpoint_removed', path: '/v1/contacts/{id}/activity', method: 'get', pointer: null }),
    ).toEqual(['src/clients/axios-client.ts:29']);

    expect(
      at({ type: 'endpoint_removed', path: '/v1/contacts/{id}/notes', method: 'get', pointer: null }),
    ).toEqual(['src/clients/axios-client.ts:39']);
  });

  it('reports not affected when an endpoint nothing calls is removed', () => {
    const result = locate(loaded, {
      type: 'endpoint_removed',
      path: '/v1/widgets/{id}',
      method: 'get',
      pointer: null,
    });

    expect(result.locations).toEqual([]);
    expect(result.notAffected).toBe(true);
  });

  it('never offers a test file for repair, even though tests read the field', () => {
    const change: ChangeInput = {
      type: 'field_renamed',
      path: '/v1/contacts',
      method: 'get',
      pointer: '/properties/customer_name',
      field: 'customer_name',
    };

    // The fixture and the tests genuinely read customer_name, and
    // find-references reports them. The validator rejects any patch touching a
    // test, so handing one to the agent guarantees a wasted attempt.
    for (const location of locate(loaded, change).locations) {
      expect(location.file).not.toMatch(/test/);
    }

    const skipped = locate(loaded, change).coverage.skipped.map((s) => s.file);
    expect(skipped.some((f) => f.includes('test'))).toBe(true);
  });

  it('reports what it inspected, so silence can be judged', () => {
    const { coverage } = locate(loaded, {
      type: 'endpoint_removed',
      path: '/v1/contacts/{id}/notes',
      method: 'get',
      pointer: null,
    });

    expect(coverage.inspected).toContain('src/reporting.ts');
    expect(coverage.inspected.every((f) => f.startsWith('src/'))).toBe(true);
    expect(coverage.skipped.length).toBeGreaterThan(0);
  });
});

describe('a repository the locator cannot fully read', () => {
  it('refuses to call an empty result "not affected"', () => {
    const loaded = loadProject(`${dynamicFixture}tsconfig.json`, dynamicFixture);
    const result = locate(loaded, {
      type: 'required_parameter_added',
      path: '/v1/contacts',
      method: 'get',
      pointer: '/parameters/workspace_id',
    });

    // The URL is concatenated at run time, so this call may or may not hit the
    // changed endpoint. Not knowing is "needs review", never "not affected".
    expect(result.locations).toEqual([]);
    expect(result.notAffected).toBe(false);
    expect(result.coverage.skipped.some((s) => /run time/.test(s.reason))).toBe(true);
  });
});

describe('urlOf', () => {
  it('reads a literal URL and refuses a computed one', () => {
    const loaded = loadProject(`${dynamicFixture}tsconfig.json`, dynamicFixture);
    const calls = loaded.sourceFiles.flatMap((f) =>
      f.getDescendantsOfKind(SyntaxKind.CallExpression),
    );
    const fetchCall = calls.find((c) => c.getExpression().getText() === 'fetch');

    expect(fetchCall).toBeDefined();
    // `base + route` is a value, not a readable path, so the answer is "I do
    // not know" rather than a guess at what it concatenates to.
    expect(urlOf(fetchCall!.getArguments()[0]!)).toBeNull();
  });
});
