/**
 * Call pattern 1 of 3: the global `fetch`.
 *
 * The locator (ts-morph, week 4) has to find call sites in all three patterns,
 * so each one is written the way a real codebase writes it rather than being
 * funnelled through a shared helper.
 */

import type { Contact } from '../types.ts';

export class ContactsFetchClient {
  constructor(private readonly baseUrl: string) {}

  async listContacts(): Promise<Contact[]> {
    const response = await fetch(`${this.baseUrl}/v1/contacts`);

    if (!response.ok) {
      throw new Error(`listContacts failed: ${response.status}`);
    }

    return (await response.json()) as Contact[];
  }

  async getContact(id: string): Promise<Contact> {
    const response = await fetch(`${this.baseUrl}/v1/contacts/${id}`, {
      headers: { accept: 'application/json' },
    });

    if (response.status === 404) {
      throw new Error(`no contact ${id}`);
    }

    return (await response.json()) as Contact;
  }
}
