type Status = 'pending' | 'active' | 'completed' | 'failed';

const styles: Record<Status, string> = {
  pending:   'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  active:    'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse',
  completed: 'bg-green-500/20 text-green-300 border border-green-500/40',
  failed:    'bg-red-500/20 text-red-300 border border-red-500/40',
};

const labels: Record<Status, string> = {
  pending: 'En attente',
  active: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status as Status) in styles ? (status as Status) : 'pending';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[s]}`}>
      {labels[s]}
    </span>
  );
}
