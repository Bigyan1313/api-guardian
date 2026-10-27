/**
 * Call pattern 2 of 3: axios, with a pre-configured instance.
 *
 * The `activity` endpoint is the one v2 removes, so this file is where the
 * removed-endpoint scenario lands.
 */

import axios, { type AxiosInstance } from 'axios';

import type { ActivityEntry, Contact, Note } from '../types.ts';

export class ContactsAxiosClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 5_000 });
  }

  async listContacts(): Promise<Contact[]> {
    const { data } = await this.http.get<Contact[]>('/v1/contacts');
    return data;
  }

  /**
   * Replaced at v2 by `/events`, with `kind` renamed to `type`. The migration
   * note documents the replacement, so this one is repairable.
   */
  async getActivity(contactId: string): Promise<ActivityEntry[]> {
    const { data } = await this.http.get<ActivityEntry[]>(`/v1/contacts/${contactId}/activity`);
    return data;
  }

  /**
   * Withdrawn at v2 with nothing to call instead. There is no correct patch for
   * this, so the right outcome is a flagged finding and a human decision — not a
   * confident guess at some other endpoint (SRS section 6.2, BR-05).
   */
  async getNotes(contactId: string): Promise<Note[]> {
    const { data } = await this.http.get<Note[]>(`/v1/contacts/${contactId}/notes`);
    return data;
  }
}
