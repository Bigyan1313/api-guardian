import { Badge, toneFor } from './Badge.tsx';
import { humanize, type ChangeRow } from '../api.ts';

export function ChangesTable({ rows }: { rows: ChangeRow[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Detected changes</h2>
        <p className="card-sub">
          Every difference between two spec versions, with the classifier's verdict. A change whose
          field mapping nobody has confirmed is flagged, never patched.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Verdict</th>
              <th>Type</th>
              <th>Where</th>
              <th>What changed</th>
              <th>Mapping</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const unconfirmed =
                row.mappingConfirmedBy === null && row.classification !== 'safe';

              return (
                <tr key={row.id}>
                  <td>
                    <Badge tone={toneFor('classification', row.classification)}>
                      {humanize(row.classification)}
                    </Badge>
                  </td>
                  <td className="type-name">{humanize(row.type)}</td>
                  <td>
                    <span className="path">
                      {row.method ? `${row.method.toUpperCase()} ` : ''}
                      {row.path}
                    </span>
                    {row.pointer ? <span className="pointer">{row.pointer}</span> : null}
                  </td>
                  <td className="summary">{row.summary ?? '—'}</td>
                  <td>
                    {row.mappingConfirmedBy ? (
                      <Badge tone="good">{humanize(row.mappingConfirmedBy)}</Badge>
                    ) : (
                      <>
                        <Badge tone={unconfirmed ? 'warning' : 'muted'}>
                          {unconfirmed ? 'Unconfirmed' : 'Not needed'}
                        </Badge>
                        {unconfirmed ? (
                          <span className="flag-note">flagged for a human</span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="num">{row.confidence.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
