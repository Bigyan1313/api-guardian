/**
 * One place that knows how to reach Postgres.
 *
 * Nothing in this package reads process.env directly, so a test can point at a
 * throwaway database by passing a URL instead of mutating the environment.
 */

export const DEFAULT_DATABASE_URL =
  'postgres://api_guardian:api_guardian@localhost:5432/api_guardian';

export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL;
}
