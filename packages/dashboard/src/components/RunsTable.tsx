import { Badge, toneFor } from './Badge.tsx';
import { humanize, type RunRow } from '../api.ts';

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export function RunsTable({ rows }: { rows: RunRow[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Runs</h2>
        <p className="card-sub">
          One row per attempt to carry one change through the pipeline. Attempts are capped at four;
          the database rejects a fifth.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Outcome</th>
              <th>Change</th>
              <th>Stage</th>
              <th>Attempts</th>
              <th>Tests</th>
              <th>Model</th>
              <th>Cost</th>
              <th>Result</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Badge tone={toneFor(row.outcome ? 'outcome' : 'status', row.outcome ?? row.status)}>
                    {humanize(row.outcome ?? row.status)}
                  </Badge>
                  {row.cheatReason ? (
                    <span className="flag-note">{humanize(row.cheatReason)}</span>
                  ) : null}
                </td>
                <td>
                  <span className="type-name">{humanize(row.changeType)}</span>
                  <span className="pointer">{row.changePath}</span>
                </td>
                <td>{humanize(row.stage)}</td>
                <td className="num">{row.attempts === 0 ? '—' : `${row.attempts} of 4`}</td>
                <td className="num">
                  {row.testsTotal === null ? '—' : `${row.testsPassed}/${row.testsTotal}`}
                </td>
                <td className="num">{row.model ?? '—'}</td>
                <td className="num">{row.costUsd === 0 ? '—' : `$${row.costUsd.toFixed(4)}`}</td>
                <td>
                  {row.prUrl ? (
                    <a href={row.prUrl} target="_blank" rel="noreferrer">
                      {row.prUrl.replace(/^https:\/\/github\.com\//, '')}
                    </a>
                  ) : (
                    <span className="tile-note">no PR</span>
                  )}
                </td>
                <td className="num">{relativeTime(row.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
