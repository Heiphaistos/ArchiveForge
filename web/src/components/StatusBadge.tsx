type Status = 'pending' | 'active' | 'completed' | 'failed';

const cls: Record<Status, string> = {
  pending:   'badge badge-pending',
  active:    'badge badge-active',
  completed: 'badge badge-completed',
  failed:    'badge badge-failed',
};

const labels: Record<Status, string> = {
  pending:   '⏳ En attente',
  active:    '⚡ En cours',
  completed: '✓ Terminé',
  failed:    '✗ Échoué',
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status as Status) in cls ? (status as Status) : 'pending';
  return <span className={cls[s]}>{labels[s]}</span>;
}
