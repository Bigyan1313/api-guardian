/**
 * The slice of node-postgres that everything here actually uses.
 *
 * `Pool` and `Client` both satisfy this but neither extends the other, so code
 * that takes a `Queryable` runs against a pooled connection in the server and a
 * single transactional client in a test, unchanged.
 */

import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
