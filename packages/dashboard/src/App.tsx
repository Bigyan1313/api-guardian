import { useEffect, useState } from 'react';

import { loadSnapshot, type Snapshot } from './api.ts';
import { BuildProgress } from './components/BuildProgress.tsx';
import { ChangesByType } from './components/ChangesByType.tsx';
import { ChangesTable } from './components/ChangesTable.tsx';
import { RunsTable } from './components/RunsTable.tsx';
import { StatTile } from './components/StatTile.tsx';

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSnapshot()
      .then(setSnapshot)
      .catch((cause: unknown) => setError((cause as Error).message));
  }, []);

  if (error !== null) {
    return (
      <div className="page">
        <div className="state">
          Could not reach the API: {error}
          <br />
          Is the server running on port 3001?
        </div>
      </div>
    );
  }

  if (snapshot === null) {
    return (
      <div className="page">
        <div className="state">Loading…</div>
      </div>
    );
  }

  const { health, overview, changes, byType, runs } = snapshot;
  const repairRate =
    overview.patches === 0 ? null : Math.round((overview.repaired / overview.runs) * 100);

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>API Guardian</h1>
          <p>
            Self-maintaining API integrations. Detect a breaking change upstream, repair the code
            that calls it, and stop at a pull request a human reviews.
          </p>
        </div>
        <div className="masthead-meta">
          <span className="pill">
            <span className={`pill-dot${health.database === 'up' ? '' : ' is-down'}`} />
            Postgres {health.database}
          </span>
          <span className="pill">Week 1 of 12</span>
        </div>
      </header>

      {health.seeded ? (
        <div className="notice">
          <span className="notice-icon" aria-hidden="true">
            ●
          </span>
          <div>
            <strong>These rows are seed data, not a real pipeline run.</strong>
            <p>
              Week 1 built the schema; the detector, locator, agent and validator arrive in weeks
              3–7. The rows below were written by <code>npm run seed</code> in the shapes those
              stages will produce, so the UI can be judged now. Every number on this page is a live
              query against Postgres — only the contents are staged.
            </p>
          </div>
        </div>
      ) : null}

      <div className="tiles">
        <StatTile label="Repos watched" value={overview.repos} note={`${overview.apis} API tracked`} />
        <StatTile
          label="Changes detected"
          value={overview.changes}
          note={`across ${overview.specVersions} spec versions`}
        />
        <StatTile
          label="Breaking"
          value={overview.breaking}
          tone="critical"
          note="will break calling code"
        />
        <StatTile
          label="Flagged for a human"
          value={overview.flagged}
          tone="warning"
          note="no confirmed mapping"
        />
        <StatTile
          label="Repaired"
          value={repairRate === null ? '—' : `${repairRate}%`}
          tone="good"
          note={`${overview.repaired} of ${overview.runs} runs`}
        />
        <StatTile
          label="Cheat attempts caught"
          value={overview.cheatsCaught}
          tone="critical"
          note={`$${overview.costUsd.toFixed(2)} spent total`}
        />
      </div>

      <div className="grid-2">
        <ChangesByType rows={byType} />
        <BuildProgress />
      </div>

      <ChangesTable rows={changes} />
      <RunsTable rows={runs} />
    </div>
  );
}
