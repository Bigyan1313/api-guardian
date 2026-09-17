import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ContactsAxiosClient } from '../src/clients/axios-client.ts';
import { ContactsFetchClient } from '../src/clients/fetch-client.ts';
import { getV1Contacts, getV1ContactsById } from '../src/clients/generated-client.ts';
import { startFakeApiV1, type FakeApi } from './support/fake-api.ts';

describe('the three supported call patterns', () => {
  let api: FakeApi;

  beforeAll(async () => {
    api = await startFakeApiV1();
  });

  afterAll(async () => {
    await api.close();
  });

  describe('fetch', () => {
    it('lists contacts', async () => {
      const contacts = await new ContactsFetchClient(api.url).listContacts();

      expect(contacts).toHaveLength(3);
      expect(contacts[0]?.customer_name).toBe('Ada Lovelace');
    });

    it('fetches one contact by id', async () => {
      const contact = await new ContactsFetchClient(api.url).getContact('ct_002');

      expect(contact.email).toBe('grace@example.test');
      expect(typeof contact.lifetime_value).toBe('number');
    });

    it('reports a missing contact rather than returning undefined', async () => {
      await expect(new ContactsFetchClient(api.url).getContact('ct_999')).rejects.toThrow(
        'no contact ct_999',
      );
    });
  });

  describe('axios', () => {
    it('lists contacts', async () => {
      const contacts = await new ContactsAxiosClient(api.url).listContacts();

      expect(contacts.map((c) => c.id)).toEqual(['ct_001', 'ct_002', 'ct_003']);
    });

    it('reads a contact activity feed', async () => {
      const activity = await new ContactsAxiosClient(api.url).getActivity('ct_001');

      expect(activity).toHaveLength(2);
      expect(activity[1]?.kind).toBe('purchase');
    });
  });

  describe('generated client', () => {
    it('lists contacts', async () => {
      const contacts = await getV1Contacts({ baseUrl: api.url });

      expect(contacts).toHaveLength(3);
    });

    it('fetches one contact by id', async () => {
      const contact = await getV1ContactsById({ baseUrl: api.url }, 'ct_003');

      expect(contact.customer_name).toBe('Katherine Johnson');
    });

    it('raises on an unknown contact', async () => {
      await expect(getV1ContactsById({ baseUrl: api.url }, 'nope')).rejects.toThrow('responded 404');
    });
  });
});
