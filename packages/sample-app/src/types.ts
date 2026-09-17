/**
 * The shapes the Contacts API returns at v1.
 *
 * These mirror `openapi/contacts-v1.json` by hand. That is deliberate: when the
 * spec moves to v2, nothing regenerates these for us, so `tsc` goes quiet while
 * the code is already wrong at runtime. Catching exactly that is the job.
 */

export interface Contact {
  readonly id: string;
  /** Renamed in v2. The rename is the canonical scenario in the evaluation set. */
  readonly customer_name: string;
  readonly email: string;
  /** A number at v1; a decimal string at v2. */
  readonly lifetime_value: number;
  readonly created_at: string;
}

export interface ActivityEntry {
  readonly id: string;
  readonly contact_id: string;
  readonly kind: 'login' | 'purchase' | 'support_ticket';
  readonly occurred_at: string;
}
