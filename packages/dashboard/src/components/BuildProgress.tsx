/**
 * Where the twelve-week build actually is. Honest by construction: the weeks are
 * hard-coded from the build plan and only week 1 is marked done, so the page
 * cannot quietly imply more of the pipeline exists than does.
 */

const WEEKS: { weeks: string; name: string; done: boolean }[] = [
  { weeks: '1', name: 'Setup: repo, Postgres, CI, sample app', done: true },
  { weeks: '2', name: 'Demo API at v1 and v2', done: false },
  { weeks: '3', name: 'Detection: oasdiff + classifier', done: false },
  { weeks: '4', name: 'Code locator: ts-morph', done: false },
  { weeks: '5', name: 'Validator: tsc + Vitest in Docker', done: false },
  { weeks: '6–7', name: 'Repair agent', done: false },
  { weeks: '8', name: 'PR writer', done: false },
  { weeks: '9', name: '25 frozen scenarios', done: false },
  { weeks: '10', name: 'Evaluation: five baselines', done: false },
  { weeks: '11', name: 'Dashboard', done: false },
  { weeks: '12', name: 'Write-up and demo', done: false },
];

export function BuildProgress() {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Build progress</h2>
        <p className="card-sub">
          Week {WEEKS.filter((week) => week.done).at(-1)?.weeks ?? '0'} of 12 done. This dashboard
          is week 11's deliverable, pulled forward so the shapes can be judged early.
        </p>
      </div>

      <div className="weeks">
        {WEEKS.map((week) => (
          <div className={`week${week.done ? ' is-done' : ''}`} key={week.weeks}>
            <span className="week-num">{week.weeks}</span>
            <span className="week-name">{week.name}</span>
            <span className="week-bar" aria-hidden="true" />
            <span className="week-state">{week.done ? 'done' : 'to do'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
