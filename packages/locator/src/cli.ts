/**
 * Locate the code affected by a change, from the command line.
 *
 *   npm run locate -- <change_type> <path> [method] [field]
 *
 * With no arguments it runs every v1 -> v2 change of the demo API against the
 * sample app, which is the week 4 demonstration.
 */

import { fileURLToPath } from 'node:url';

import { loadProject } from './project.ts';
import { locate } from './locate.ts';
import type { ChangeInput } from './types.ts';

const sampleApp = fileURLToPath(new URL('../../sample-app/', import.meta.url));

const DEMO: ChangeInput[] = [
  { type: 'field_renamed', path: '/v1/contacts', method: 'get', pointer: '/properties/customer_name', field: 'customer_name' },
  { type: 'field_renamed', path: '/v1/contacts', method: 'get', pointer: '/properties/email', field: 'email' },
  { type: 'field_type_changed', path: '/v1/contacts', method: 'get', pointer: '/properties/lifetime_value', field: 'lifetime_value' },
  { type: 'required_parameter_added', path: '/v1/contacts', method: 'get', pointer: '/parameters/workspace_id' },
  { type: 'endpoint_removed', path: '/v1/contacts/{id}/activity', method: 'get', pointer: null },
  { type: 'endpoint_removed', path: '/v1/contacts/{id}/notes', method: 'get', pointer: null },
];

function main(): void {
  const [type, path, method, field] = process.argv.slice(2);
  const changes: ChangeInput[] =
    type === undefined
      ? DEMO
      : [
          {
            type: type as ChangeInput['type'],
            path: path ?? '/',
            method: method ?? null,
            pointer: null,
            field,
          },
        ];

  const loaded = loadProject(`${sampleApp}tsconfig.json`, sampleApp);
  console.log(`${loaded.sourceFiles.length} files inspected, ${loaded.skipped.length} skipped\n`);

  for (const change of changes) {
    const result = locate(loaded, change);
    const label = change.field ?? change.path;
    console.log(`${change.type}  ${label}`);

    if (result.notAffected) {
      console.log('  not affected within supported scope\n');
      continue;
    }
    if (result.locations.length === 0) {
      console.log('  no locations, but coverage is incomplete — needs review\n');
      continue;
    }

    for (const location of result.locations) {
      console.log(`  ${location.file}:${location.line}:${location.column}  [${location.kind}]`);
      console.log(`     ${location.reason}`);
    }
    console.log();
  }
}

main();
