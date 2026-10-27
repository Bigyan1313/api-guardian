/**
 * The application path, end to end: fetch contacts over HTTP, then render them
 * through the reporting layer.
 *
 * This file exists because the other two miss the case that matters most.
 * `clients.test.ts` stops at the client, and `reporting.test.ts` feeds the
 * reporting functions a fixed v1 array, so both stay green through a rename that
 * would ruin the rendered output. A field renamed in the spec breaks code two
 * layers above the HTTP call, and the locator (week 4) has to walk that far, so
 * something has to fail that far out when it happens.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ContactsFetchClient } from '../src/clients/fetch-client.ts';
import { rankByValue, totalLifetimeValue } from '../src/reporting.ts';
import { startFakeApi, type FakeApi } from './support/fake-api.ts';

describe('contacts rendered from the live API', () => {
  let api: FakeApi;

  beforeAll(async () => {
    api = await startFakeApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it('ranks the contacts it fetched, highest value first', async () => {
    const contacts = await new ContactsFetchClient(api.url).listContacts();
    const ranked = rankByValue(contacts);

    expect(ranked.map((row) => row.displayName)).toEqual([
      'Grace Hopper',
      'Ada Lovelace',
      'Katherine Johnson',
    ]);
  });

  it('formats the fetched lifetime values as currency', async () => {
    const contacts = await new ContactsFetchClient(api.url).listContacts();
    const ranked = rankByValue(contacts);

    expect(ranked.map((row) => row.lifetimeValueUsd)).toEqual([
      '$15,300.00',
      '$8,420.50',
      '$640.25',
    ]);
  });

  it('builds initials from the fetched names', async () => {
    const contacts = await new ContactsFetchClient(api.url).listContacts();

    expect(rankByValue(contacts).map((row) => row.initials)).toEqual(['GH', 'AL', 'KJ']);
  });

  it('totals the fetched lifetime values', async () => {
    const contacts = await new ContactsFetchClient(api.url).listContacts();

    expect(totalLifetimeValue(contacts)).toBeCloseTo(24_360.75, 2);
  });
});
