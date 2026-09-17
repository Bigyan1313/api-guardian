import { describe, expect, it } from 'vitest';

import { loadMigrations } from '../src/migrate.ts';

describe('loadMigrations', () => {
  it('returns migrations in filename order', async () => {
    const migrations = await loadMigrations();
    const names = migrations.map((m) => m.name);

    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort());
    expect(names[0]).toBe('001_init.sql');
  });

  it('checksums the file contents', async () => {
    const [first] = await loadMigrations();

    expect(first?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
