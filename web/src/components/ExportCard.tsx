'use client';
import { useEffect, useState } from 'react';
import { StatusBadge } from './StatusBadge';

export interface JobRow {
  id: string;
  guildId: string;
  guildName: string | null;
  format: string;
  status: string;
  progress: number | null;
  progressLabel: string | null;
  progressEta: number | null;
  progressElapsed: number | null;
  progressPhase: string | null;
  channelCount: number | null;
  messageCount: number | null;
  createdAt: number | Date;
  startedAt: number | Date | null;
  completedAt: number | Date | null;
  errorMessage: string | null;
  options: string;
}

interface Props {
  job: JobRow;
  onDelete: (id: string) => void;
}

const formatLabel: Record<string, string> = {
  json: 'JSON', html: 'HTML', spa: 'SPA', markdown: 'MD'
};

function fmtTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function ElapsedTimer({ startedAt, eta }: { startedAt: number | Date | null; eta: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="timer-row">
      <span className="timer-elapsed">⏱ {fmtTime(elapsed)}</span>
      {eta !== null && eta > 0 && (
        <span className="timer-eta">~{fmtTime(eta)} restant</span>
      )}
    </div>
  );
}

export function ExportCard({ job, onDelete }: Props) {
  const created = new Date(job.createdAt).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const pct = Math.round(job.progress ?? 0);

  let durationStr: string | null = null;
  if (job.startedAt && job.completedAt) {
    const secs = Math.round(
      (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
    );
    durationStr = fmtTime(secs);
  }

  return (
    <div className={`job-card job-card-${job.status}`}>
      <div className="job-top">
        <div className="job-info">
          <div className="job-guild">{job.guildName ?? job.guildId}</div>
          <div className="job-meta">
            <span className="job-format">{formatLabel[job.format] ?? job.format}</span>
            <span className="job-date">{created}</span>
            {job.status === 'completed' && job.channelCount !== null && (
              <span className="job-stat">📁 {job.channelCount} salons</span>
            )}
            {job.status === 'completed' && job.messageCount !== null && (
              <span className="job-stat">💬 {job.messageCount.toLocaleString('fr-FR')} msgs</span>
            )}
            {durationStr && <span className="job-stat">⏱ {durationStr}</span>}
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'active' && (
        <>
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="progress-label">
              <span className="progress-phase-label">{job.progressLabel ?? 'Traitement…'}</span>
              <span>{pct}%</span>
            </div>
          </div>
          <ElapsedTimer startedAt={job.startedAt ?? null} eta={job.progressEta ?? null} />
        </>
      )}

      {job.status === 'pending' && (
        <div className="pending-hint">En attente dans la file…</div>
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
