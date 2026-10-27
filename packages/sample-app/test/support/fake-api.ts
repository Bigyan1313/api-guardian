/**
 * The demo Contacts API, served for real over HTTP on an ephemeral port, at
 * either version.
 *
 * Not a mocked `fetch`. A mock gets hand-edited whenever the spec moves, which
 * would quietly keep these tests green through exactly the breakage the project
 * exists to measure. A scenario is only admissible when its tests pass against
 * the old contract and fail against the new one (SRS section 6.2), and that is
 * only trustworthy if the tests talk to something that really serves each one.
 *
 * `startFakeApi()` reads CONTACTS_API_VERSION, so the same suite runs against
 * both: unset or `v1` for the normal run, `v2` for `npm run test:v2`, which is
 * expected to fail. `scripts/check-v2-breaks.mjs` fails the build if it does not.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ActivityEntry, Contact, Note } from '../../src/types.ts';

export type ApiVersion = 'v1' | 'v2';

export const CONTACTS_V1: readonly Contact[] = [
  {
    id: 'ct_001',
    customer_name: 'Ada Lovelace',
    email: 'ada@example.test',
    lifetime_value: 8420.5,
    created_at: '2025-03-14T09:00:00Z',
  },
  {
    id: 'ct_002',
    customer_name: 'Grace Hopper',
    email: 'grace@example.test',
    lifetime_value: 15300,
    created_at: '2025-04-02T11:30:00Z',
  },
  {
    id: 'ct_003',
    customer_name: 'Katherine Johnson',
    email: 'katherine@example.test',
    lifetime_value: 640.25,
    created_at: '2025-06-21T16:45:00Z',
  },
];

const ACTIVITY_V1: readonly ActivityEntry[] = [
  { id: 'ac_1', contact_id: 'ct_001', kind: 'login', occurred_at: '2025-07-01T08:00:00Z' },
  { id: 'ac_2', contact_id: 'ct_001', kind: 'purchase', occurred_at: '2025-07-02T13:15:00Z' },
];

const NOTES_V1: readonly Note[] = [
  {
    id: 'nt_1',
    contact_id: 'ct_001',
    body: 'Asked about annual billing.',
    written_at: '2025-07-03T10:00:00Z',
  },
];

/**
 * The same three contacts as v2 serves them: `customer_name` is `full_name`,
 * `email` is `contact_email`, and `lifetime_value` is a decimal string.
 *
 * Deliberately typed loosely. These rows do not satisfy `Contact`, and that is
 * the whole point — the hand-written types in src/types.ts still describe v1,
 * so the drift shows up at runtime rather than at compile time, which is the
 * realistic case.
 */
const CONTACTS_V2: readonly Record<string, unknown>[] = CONTACTS_V1.map((contact) => ({
  id: contact.id,
  full_name: contact.customer_name,
  contact_email: contact.email,
  lifetime_value: contact.lifetime_value.toFixed(2),
  created_at: contact.created_at,
}));

const EVENTS_V2: readonly Record<string, unknown>[] = ACTIVITY_V1.map((entry) => ({
  id: entry.id,
  contact_id: entry.contact_id,
  type: entry.kind,
  occurred_at: entry.occurred_at,
}));

export interface FakeApi {
  readonly url: string;
  readonly version: ApiVersion;
  close(): Promise<void>;
}

/** Which version the suite runs against. Unset means v1. */
export function configuredVersion(env: NodeJS.ProcessEnv = process.env): ApiVersion {
  return env['CONTACTS_API_VERSION'] === 'v2' ? 'v2' : 'v1';
}

export async function startFakeApi(version: ApiVersion = configuredVersion()): Promise<FakeApi> {
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (path === '/v1/contacts') {
      // v2 requires workspace_id and rejects the request without it.
      if (version === 'v2' && url.searchParams.get('workspace_id') === null) {
        send(400, { error: 'workspace_id_required' });
        return;
      }
      send(200, version === 'v1' ? CONTACTS_V1 : CONTACTS_V2);
      return;
    }

    const activity = /^\/v1\/contacts\/([^/]+)\/activity$/.exec(path);
    if (activity) {
      // Replaced by /events at v2.
      if (version === 'v2') {
        send(404, { error: 'not_found' });
        return;
      }
      send(200, ACTIVITY_V1.filter((entry) => entry.contact_id === activity[1]));
      return;
    }

    const events = /^\/v1\/contacts\/([^/]+)\/events$/.exec(path);
    if (events) {
      // Does not exist at v1.
      if (version === 'v1') {
        send(404, { error: 'not_found' });
        return;
      }
      send(200, EVENTS_V2.filter((entry) => entry['contact_id'] === events[1]));
      return;
    }

    const notes = /^\/v1\/contacts\/([^/]+)\/notes$/.exec(path);
    if (notes) {
      // Withdrawn at v2, with nothing to call instead.
      if (version === 'v2') {
        send(404, { error: 'not_found' });
        return;
      }
      send(200, NOTES_V1.filter((note) => note.contact_id === notes[1]));
      return;
    }

    const byId = /^\/v1\/contacts\/([^/]+)$/.exec(path);
    if (byId) {
      // `Contact` has a known shape and the v2 rows do not, so they are read
      // through a common index signature rather than one pretending to be the
      // other.
      const rows: readonly Record<string, unknown>[] =
        version === 'v1'
          ? CONTACTS_V1.map((contact) => ({ ...contact }))
          : CONTACTS_V2;
      const contact = rows.find((row) => row['id'] === byId[1]);
      contact ? send(200, contact) : send(404, { error: 'not_found' });
      return;
    }

    send(404, { error: 'not_found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    version,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

/** Kept so existing imports read naturally; v1 is still the default contract. */
export const startFakeApiV1 = (): Promise<FakeApi> => startFakeApi('v1');
export const startFakeApiV2 = (): Promise<FakeApi> => startFakeApi('v2');
