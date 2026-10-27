/**
 * Asserts that the sample app really is broken by v2 of the Contacts API.
 *
 * The evaluation only admits a scenario whose tests pass before the API change
 * and fail after it (SRS section 6.2, EV-02). If the suite ever goes green
 * against v2, that rule has been violated somewhere — usually because someone
 * "fixed" src/types.ts or the fixture — and every repair rate measured
 * afterwards would be meaningless. So the expected outcome here is failure, and
 * this script inverts the exit code to say so.
 *
 * Run from the repo root: node scripts/check-v2-breaks.mjs
 */

import { spawnSync } from 'node:child_process';

const EXPECTED_BREAKAGES = [
  'field_renamed: customer_name -> full_name',
  'field_type_changed: lifetime_value number -> decimal string',
  'required_parameter_added: workspace_id on GET /v1/contacts',
  'endpoint_removed: GET /v1/contacts/{id}/activity (replaced by /events)',
  'endpoint_removed: GET /v1/contacts/{id}/notes (no replacement)',
  'field_renamed, undocumented: email -> contact_email',
];

const result = spawnSync(
  'npm',
  ['run', '--silent', 'test', '--workspace', '@api-guardian/sample-app'],
  {
    env: { ...process.env, CONTACTS_API_VERSION: 'v2' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
// Match the summary line specifically. A looser pattern picks up the
// per-file counts above it and under-reports the total.
const failed = /Tests\s+(\d+) failed/.exec(output);

if (result.status === 0) {
  console.error('The sample app still passes against v2 of the Contacts API.');
  console.error('');
  console.error('That should be impossible. v2 contains these breaking changes:');
  for (const change of EXPECTED_BREAKAGES) console.error(`  - ${change}`);
  console.error('');
  console.error('Either the fixture no longer serves v2, or the sample app was');
  console.error('edited to accommodate it. That drift is the bug this project');
  console.error('exists to repair, so it must not be fixed by hand.');
  process.exit(1);
}

console.log(`The sample app fails against v2, as it must${failed ? `: ${failed[1]} tests failed` : ''}.`);
console.log('Breaking changes exercised:');
for (const change of EXPECTED_BREAKAGES) console.log(`  - ${change}`);
