/**
 * Detected changes per change type.
 *
 * One series, so one color for every bar and no legend — the title names what
 * the bars are. Deliberately not colored darker-where-bigger: that would encode
 * bar length twice and spend the only free channel on information the length
 * already carries. Every bar is direct-labeled, so the chart is readable
 * without resolving color at all.
 */

import { humanize, type TypeCount } from '../api.ts';

export function ChangesByType({ rows }: { rows: TypeCount[] }) {
  const max = Math.max(1, ...rows.map((row) => row.total));

  return (
    <div className="card">
      <div className="card-head">
        <h2>Detected changes by type</h2>
        <p className="card-sub">
          The five change types in scope for v1. Repair rate per type is the table that matters in
          week 10 — this is its detection half.
        </p>
      </div>

      <div className="bars">
        {rows.map((row) => (
          <div className="bar-row" key={row.type}>
            <div className="bar-label" title={humanize(row.type)}>
              {humanize(row.type)}
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(row.total / max) * 100}%` }}
                title={`${humanize(row.type)}: ${row.total} detected, ${row.breaking} breaking`}
              />
            </div>
            <div className="bar-value">{row.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
