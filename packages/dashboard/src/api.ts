/**
 * The dashboard's whole data layer. Every shape here is what the server's SQL
 * returns; nothing is recomputed on the client.
 */

export interface Overview {
  repos: number;
  apis: number;
  specVersions: number;
  changes: number;
  breaking: number;
  flagged: number;
  runs: number;
  patches: number;
  repaired: number;
  cheatsCaught: number;
  costUsd: number;
}

export interface ChangeRow {
  id: number;
  api: string;
  type: string;
  classification: string;
  path: string;
  method: string | null;
  pointer: string | null;
  confidence: number;
  mappingConfirmedBy: string | null;
  summary: string | null;
}

export interface TypeCount {
  type: string;
  total: number;
  breaking: number;
}

export interface RunRow {
  id: number;
  repo: string;
  changeType: string;
  changePath: string;
  stage: string;
  status: string;
  attempts: number;
  costUsd: number;
  model: string | null;
  outcome: string | null;
  cheatReason: string | null;
  testsPassed: number | null;
  testsTotal: number | null;
  prUrl: string | null;
  startedAt: string;
}

export interface Health {
  ok: boolean;
  database: string;
  seeded: boolean;
}

export interface Snapshot {
  health: Health;
  overview: Overview;
  changes: ChangeRow[];
  byType: TypeCount[];
  runs: RunRow[];
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return (await response.json()) as T;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [health, overview, changes, byType, runs] = await Promise.all([
    get<Health>('/api/health'),
    get<Overview>('/api/overview'),
    get<ChangeRow[]>('/api/changes'),
    get<TypeCount[]>('/api/changes-by-type'),
    get<RunRow[]>('/api/runs'),
  ]);

  return { health, overview, changes, byType, runs };
}

/** `field_renamed` reads badly in a table header. */
export function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
