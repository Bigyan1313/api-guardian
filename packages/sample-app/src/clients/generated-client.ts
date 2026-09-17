/**
 * Call pattern 3 of 3: a generated client.
 *
 * Checked in as if `openapi-typescript-codegen` had produced it from
 * `openapi/contacts-v1.json`, down to the flat function-per-operation style.
 * It is here because a generated client breaks differently from hand-written
 * calls: regenerating it moves the type error to the call site rather than
 * leaving the code silently wrong, and the locator has to handle both.
 */

import type { Contact } from '../types.ts';

export interface RequestOptions {
  readonly baseUrl: string;
  readonly signal?: AbortSignal;
}

async function request<T>(options: RequestOptions, path: string): Promise<T> {
  const init: RequestInit = options.signal ? { signal: options.signal } : {};
  const response = await fetch(`${options.baseUrl}${path}`, init);

  if (!response.ok) {
    throw new Error(`${path} responded ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getV1Contacts(options: RequestOptions): Promise<Contact[]> {
  return request<Contact[]>(options, '/v1/contacts');
}

export function getV1ContactsById(options: RequestOptions, id: string): Promise<Contact> {
  return request<Contact>(options, `/v1/contacts/${id}`);
}
