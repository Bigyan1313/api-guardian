/**
 * A status badge is a dot plus a word, never a color alone: the status hues are
 * reserved, and two of them sit below 3:1 on the light surface by design. The
 * label is the channel that carries the meaning; the dot only reinforces it.
 */

export type Tone = 'critical' | 'warning' | 'serious' | 'good' | 'muted';

const CLASSIFICATION_TONE: Record<string, Tone> = {
  breaking: 'critical',
  unknown: 'warning',
  safe: 'good',
};

const OUTCOME_TONE: Record<string, Tone> = {
  success: 'good',
  rejected_cheating: 'critical',
  failed: 'serious',
  needs_human: 'warning',
  not_affected: 'muted',
};

const STATUS_TONE: Record<string, Tone> = {
  succeeded: 'good',
  failed: 'serious',
  needs_human: 'warning',
  running: 'muted',
  pending: 'muted',
};

export function Badge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={`badge is-${tone}`}>
      <span className="badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function toneFor(kind: 'classification' | 'outcome' | 'status', value: string): Tone {
  const table =
    kind === 'classification'
      ? CLASSIFICATION_TONE
      : kind === 'outcome'
        ? OUTCOME_TONE
        : STATUS_TONE;

  return table[value] ?? 'muted';
}
