import { describe, expect, it } from 'vitest';

import { formatUsd, initialsOf, rankByValue, summarize, totalLifetimeValue } from '../src/reporting.ts';
import { CONTACTS_V1 } from './support/fake-api.ts';

describe('summarize', () => {
  it('builds a display row from a contact', () => {
    expect(summarize(CONTACTS_V1[0]!)).toEqual({
      id: 'ct_001',
      displayName: 'Ada Lovelace',
      initials: 'AL',
      lifetimeValueUsd: '$8,420.50',
    });
  });
});

describe('initialsOf', () => {
  it('takes the first and last initial', () => {
    expect(initialsOf('Katherine Johnson')).toBe('KJ');
  });

  it('handles a single name', () => {
    expect(initialsOf('Prince')).toBe('P');
  });

  it('handles extra whitespace', () => {
    expect(initialsOf('  Ada   Lovelace  ')).toBe('AL');
  });

  it('falls back to a placeholder for an empty name', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('rankByValue', () => {
  it('orders by lifetime value, highest first', () => {
    expect(rankByValue(CONTACTS_V1).map((c) => c.id)).toEqual(['ct_002', 'ct_001', 'ct_003']);
  });

  it('breaks ties by name so the order is stable', () => {
    const tied = [
      { ...CONTACTS_V1[0]!, id: 'b', customer_name: 'Zoe Zhang', lifetime_value: 100 },
      { ...CONTACTS_V1[0]!, id: 'a', customer_name: 'Alan Turing', lifetime_value: 100 },
    ];

    expect(rankByValue(tied).map((c) => c.displayName)).toEqual(['Alan Turing', 'Zoe Zhang']);
  });
});

describe('totalLifetimeValue', () => {
  it('sums the lifetime value of every contact', () => {
    expect(totalLifetimeValue(CONTACTS_V1)).toBeCloseTo(24_360.75, 2);
  });

  it('is zero for no contacts', () => {
    expect(totalLifetimeValue([])).toBe(0);
  });
});

describe('formatUsd', () => {
  it('formats a number as US currency', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
  });
});
