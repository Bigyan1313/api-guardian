/**
 * Every read the dashboard makes, as one SQL statement each.
 *
 * The dashboard is a view over the database and nothing more: it computes no
 * totals of its own. If a number on screen disagrees with the database, the
 * query is wrong, and that is a bug in one place rather than two.
 */

import type { Queryable } from '@api-guardian/db';

export interface Overview {
  readonly repos: number;
  readonly apis: number;
  readonly specVersions: number;
  readonly changes: number;
  readonly breaking: number;
  readonly flagged: number;
  readonly runs: number;
  readonly patches: number;
  readonly repaired: number;
  readonly cheatsCaught: number;
  readonly costUsd: number;
}

export async function overview(db: Queryable): Promise<Overview> {
  const { rows } = await db.query<Record<string, string>>(`
    SELECT
      (SELECT count(*) FROM repos)                                        AS repos,
      (SELECT count(*) FROM apis)                                         AS apis,
      (SELECT count(*) FROM spec_versions)                                AS spec_versions,
      (SELECT count(*) FROM changes)                                      AS changes,
      (SELECT count(*) FROM changes WHERE classification = 'breaking')    AS breaking,
      -- "Flagged" is the rule from section 1 made countable: a breaking or
      -- unknown change whose field mapping nobody has confirmed. These are the
      -- ones we refuse to patch.
      (SELECT count(*) FROM changes
        WHERE classification IN ('breaking', 'unknown')
          AND mapping_confirmed_by IS NULL)                               AS flagged,
      (SELECT count(*) FROM runs)                                         AS runs,
      (SELECT count(*) FROM patches)                                      AS patches,
      (SELECT count(*) FROM patches WHERE outcome = 'success')            AS repaired,
      (SELECT count(*) FROM patches WHERE outcome = 'rejected_cheating')  AS cheats_caught,
      (SELECT coalesce(sum(cost_usd), 0) FROM runs)                       AS cost_usd
  `);

  const row = rows[0]!;
  return {
    repos: Number(row['repos']),
    apis: Number(row['apis']),
    specVersions: Number(row['spec_versions']),
    changes: Number(row['changes']),
    breaking: Number(row['breaking']),
    flagged: Number(row['flagged']),
    runs: Number(row['runs']),
    patches: Number(row['patches']),
    repaired: Number(row['repaired']),
    cheatsCaught: Number(row['cheats_caught']),
    costUsd: Number(row['cost_usd']),
  };
}

export interface ChangeRow {
  readonly id: number;
  readonly api: string;
  readonly type: string;
  readonly classification: string;
  readonly path: string;
  readonly method: string | null;
  readonly pointer: string | null;
  readonly confidence: number;
  readonly mappingConfirmedBy: string | null;
  readonly summary: string | null;
}

export async function changes(db: Queryable): Promise<ChangeRow[]> {
  const { rows } = await db.query(`
    SELECT c.id, a.name AS api, c.type, c.classification, c.path, c.method, c.pointer,
           c.confidence, c.mapping_confirmed_by, c.detail ->> 'summary' AS summary
      FROM changes c
      JOIN spec_versions sv ON sv.id = c.to_version_id
      JOIN apis a           ON a.id = sv.api_id
     ORDER BY c.classification, c.id
  `);

  return rows.map((row) => ({
    id: Number(row.id),
    api: row.api,
    type: row.type,
    classification: row.classification,
    path: row.path,
    method: row.method,
    pointer: row.pointer,
    confidence: Number(row.confidence),
    mappingConfirmedBy: row.mapping_confirmed_by,
    summary: row.summary,
  }));
}

/** Changes grouped by type, for the one chart on the page. */
export async function changesByType(
  db: Queryable,
): Promise<{ type: string; breaking: number; total: number }[]> {
  const { rows } = await db.query(`
    SELECT type,
           count(*)                                          AS total,
           count(*) FILTER (WHERE classification = 'breaking') AS breaking
      FROM changes
     GROUP BY type
     ORDER BY count(*) DESC, type
  `);

  return rows.map((row) => ({
    type: row.type,
    total: Number(row.total),
    breaking: Number(row.breaking),
  }));
}

export interface RunRow {
  readonly id: number;
  readonly repo: string;
  readonly changeType: string;
  readonly changePath: string;
  readonly stage: string;
  readonly status: string;
  readonly attempts: number;
  readonly costUsd: number;
  readonly model: string | null;
  readonly outcome: string | null;
  readonly cheatReason: string | null;
  readonly testsPassed: number | null;
  readonly testsTotal: number | null;
  readonly prUrl: string | null;
  readonly startedAt: string;
}

export async function runs(db: Queryable): Promise<RunRow[]> {
  // The latest patch per run carries the outcome; earlier attempts are the
  // retry history and are not what the table shows.
  const { rows } = await db.query(`
    SELECT r.id, repos.full_name AS repo, c.type AS change_type, c.path AS change_path,
           r.stage, r.status, r.attempts, r.cost_usd, r.model, r.started_at,
           p.outcome, p.cheat_reason, p.tests_passed, p.tests_total, p.pr_url
      FROM runs r
      JOIN repos   ON repos.id = r.repo_id
      JOIN changes c ON c.id = r.change_id
      LEFT JOIN LATERAL (
        SELECT * FROM patches WHERE patches.run_id = r.id ORDER BY attempt DESC LIMIT 1
      ) p ON true
     ORDER BY r.started_at DESC, r.id DESC
  `);

  return rows.map((row) => ({
    id: Number(row.id),
    repo: row.repo,
    changeType: row.change_type,
    changePath: row.change_path,
    stage: row.stage,
    status: row.status,
    attempts: Number(row.attempts),
    costUsd: Number(row.cost_usd),
    model: row.model,
    outcome: row.outcome,
    cheatReason: row.cheat_reason,
    testsPassed: row.tests_passed === null ? null : Number(row.tests_passed),
    testsTotal: row.tests_total === null ? null : Number(row.tests_total),
    prUrl: row.pr_url,
    startedAt: new Date(row.started_at).toISOString(),
  }));
}
