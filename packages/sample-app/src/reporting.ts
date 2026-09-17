/**
 * Application code, two layers away from the HTTP call.
 *
 * This is the part that makes the sample app a fair test. A rename of
 * `customer_name` does not only break the client file; it breaks everything
 * that reads the field, and a repair that fixes the client and stops there
 * leaves the build red. The locator has to walk from the changed spec field to
 * here.
 */

import type { Contact } from './types.ts';

export interface ContactSummary {
  readonly id: string;
  readonly displayName: string;
  readonly initials: string;
  readonly lifetimeValueUsd: string;
}

export function summarize(contact: Contact): ContactSummary {
  return {
    id: contact.id,
    displayName: contact.customer_name,
    initials: initialsOf(contact.customer_name),
    lifetimeValueUsd: formatUsd(contact.lifetime_value),
  };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';

  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';

  return (first + last).toUpperCase();
}

/** Takes a number at v1. At v2 the field is a decimal string, and this stops compiling. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/** Highest lifetime value first, then by name so the order is stable. */
export function rankByValue(contacts: readonly Contact[]): ContactSummary[] {
  return [...contacts]
    .sort(
      (a, b) =>
        b.lifetime_value - a.lifetime_value || a.customer_name.localeCompare(b.customer_name),
    )
    .map(summarize);
}

export function totalLifetimeValue(contacts: readonly Contact[]): number {
  return contacts.reduce((total, contact) => total + contact.lifetime_value, 0);
}
