/**
 * Call pattern 2 of 3: axios, with a pre-configured instance.
 *
 * The `activity` endpoint is the one v2 removes, so this file is where the
 * removed-endpoint scenario lands.
 */

import axios, { type AxiosInstance } from 'axios';

import type { ActivityEntry, Contact } from '../types.ts';

export class ContactsAxiosClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 5_000 });
  }

  async listContacts(): Promise<Contact[]> {
    const { data } = await this.http.get<Contact[]>('/v1/contacts');
    return data;
  }

  /** Removed at v2. Nothing replaces it; callers have to be rewritten or flagged. */
  async getActivity(contactId: string): Promise<ActivityEntry[]> {
    const { data } = await this.http.get<ActivityEntry[]>(`/v1/contacts/${contactId}/activity`);
    return data;
  }
}
