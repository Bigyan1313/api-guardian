import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // A live Postgres connection is slower than the 5s default, and these run
    // serially against one database.
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
