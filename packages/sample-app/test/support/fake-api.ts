/**
 * A real HTTP server speaking v1 of the Contacts API, on an ephemeral port.
 *
 * Not a mocked `fetch`. A mock would be rewritten by hand whenever the spec
 * moved, which would quietly keep the tests green through exactly the breakage
 * we are trying to measure. Section 9 only admits a scenario whose tests fail
 * before the fix, and that is only trustworthy if the tests talk to something
 * that actually serves the old contract.
 *
 * Week 2 adds the v2 server beside this one; these same tests then fail against
 * it, which is the starting state of every evaluation scenario.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ActivityEntry, Contact } from '../../src/types.ts';

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

export interface FakeApi {
  readonly url: string;
  close(): Promise<void>;
}

export async function startFakeApiV1(): Promise<FakeApi> {
  const server: Server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    // GET /v1/contacts — a bare array at v1. At v2 it becomes a paged envelope.
    if (path === '/v1/contacts') {
      send(200, CONTACTS_V1);
      return;
    }

    const activity = /^\/v1\/contacts\/([^/]+)\/activity$/.exec(path);
    if (activity) {
      send(
        200,
        ACTIVITY_V1.filter((entry) => entry.contact_id === activity[1]),
      );
      return;
    }

    const byId = /^\/v1\/contacts\/([^/]+)$/.exec(path);
    if (byId) {
      const contact = CONTACTS_V1.find((c) => c.id === byId[1]);
      contact ? send(200, contact) : send(404, { error: 'not_found' });
      return;
    }

    send(404, { error: 'not_found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
