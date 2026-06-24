'use client';
import { StatusBadge } from './StatusBadge';

export interface ImportJobRow {
  id: string;
  sourceJobId: string;
  sourceGuildName: string | null;
  targetGuildId: string;
  targetGuildName: string | null;
  status: string;
  progress: number | null;
  progressLabel: string | null;
  progressPhase: string | null;
  rolesCreated: number | null;
  channelsCreated: number | null;
  messagesImported: number | null;
  errorMessage: string | null;
  createdAt: number | Date;
  startedAt: number | Date | null;
  completedAt: number | Date | null;
}

interface Props {
  job: ImportJobRow;
  onDelete: (id: string) => void;
}

function fmtDate(ts: number | Date): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(startedAt: number | Date | null, completedAt: number | Date | null): string | null {
  if (!startedAt || !completedAt) return null;
  const s = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function ImportCard({ job, onDelete }: Props) {
  const pct = Math.round(job.progress ?? 0);
  const srcName = job.sourceGuildName ?? job.sourceJobId.slice(0, 8);
  const tgtName = job.targetGuildName ?? job.targetGuildId;
  const duration = fmtDuration(job.startedAt, job.completedAt);

  return (
    <div className={`job-card job-card-${job.status}`}>
      <div className="job-top">
        <div className="job-info">
          <div className="job-guild">
            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>↑ </span>
            {srcName}
            <span style={{ color: 'var(--blurple)', margin: '0 6px', fontWeight: 400 }}>→</span>
            {tgtName}
          </div>
          <div className="job-meta">
            <span className="job-format">IMPORT</span>
            <span className="job-date">{fmtDate(job.createdAt)}</span>
            {job.status === 'completed' && job.channelsCreated != null && (
              <span className="job-stat">📁 {job.channelsCreated} salons</span>
            )}
            {job.status === 'completed' && job.rolesCreated != null && job.rolesCreated > 0 && (
              <span className="job-stat">🎭 {job.rolesCreated} rôles</span>
            )}
            {job.status === 'completed' && job.messagesImported != null && job.messagesImported > 0 && (
              <span className="job-stat">💬 {job.messagesImported.toLocaleString('fr-FR')} msgs</span>
            )}
            {duration && <span className="job-stat">⏱ {duration}</span>}
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'active' && (
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-label">
            <span className="progress-phase-label">{job.progressLabel ?? 'Traitement…'}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {job.status === 'pending' && (
        <div className="pending-hint">En attente dans la file…</div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <div className="job-error">{job.errorMessage}</div>
      )}

      <div className="job-actions">
        <button
          className="btn btn-danger"
          onClick={() => { if (confirm('Supprimer cet import ?')) onDelete(job.id); }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
