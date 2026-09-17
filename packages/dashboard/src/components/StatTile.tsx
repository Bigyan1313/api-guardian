export function StatTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: 'critical' | 'warning' | 'good';
}) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      {/* Proportional figures: a standalone value at 30px reads loose in tabular-nums. */}
      <div className={`tile-value${tone ? ` is-${tone}` : ''}`}>{value}</div>
      {note ? <div className="tile-note">{note}</div> : null}
    </div>
  );
}
