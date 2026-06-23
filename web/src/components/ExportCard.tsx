'use client';
import { StatusBadge } from './StatusBadge';

export interface JobRow {
  id: string;
  guildId: string;
  guildName: string | null;
  format: string;
  status: string;
  progress: number | null;
  progressLabel: string | null;
  createdAt: number | Date;
  completedAt: number | Date | null;
  errorMessage: string | null;
}

interface Props {
  job: JobRow;
  onDelete: (id: string) => void;
}

const formatLabel: Record<string, string> = { json: 'JSON', html: 'HTML', spa: 'SPA Viewer' };

export function ExportCard({ job, onDelete }: Props) {
  const created = new Date(job.createdAt).toLocaleString('fr-FR');
  const pct = Math.round(job.progress ?? 0);

  return (
    <div className="job-card">
      <div className="job-top">
        <div>
          <div className="job-guild">{job.guildName ?? job.guildId}</div>
          <div className="job-meta">
            <span className="job-format">{formatLabel[job.format] ?? job.format}</span>
            <span className="job-date">{created}</span>
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
            <span>{job.progressLabel ?? 'Traitement…'}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <div className="job-error">{job.errorMessage}</div>
      )}

      <div className="job-actions">
        {job.status === 'completed' && (
          <a href={`/api/downloads/${job.id}`} className="btn btn-green">
            ↓ Télécharger ZIP
          </a>
        )}
        <button
          className="btn btn-danger"
          onClick={() => { if (confirm('Supprimer cet export ?')) onDelete(job.id); }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
