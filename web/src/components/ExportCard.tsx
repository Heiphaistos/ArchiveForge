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

export function ExportCard({ job, onDelete }: Props) {
  const created = new Date(job.createdAt).toLocaleString('fr-FR');
  const pct = Math.round(job.progress ?? 0);
  const formatLabel: Record<string, string> = { json: 'JSON', html: 'HTML', spa: 'SPA Viewer' };

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">
              {job.guildName ?? job.guildId}
            </span>
            <span className="text-xs text-gray-400 bg-white/10 px-1.5 py-0.5 rounded">
              {formatLabel[job.format] ?? job.format}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{created}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'active' && (
        <div className="space-y-1">
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{job.progressLabel ?? 'Traitement…'} — {pct}%</p>
        </div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <p className="text-xs text-red-400 font-mono bg-red-500/10 px-2 py-1.5 rounded break-all">
          {job.errorMessage}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {job.status === 'completed' && (
          <a
            href={`/api/downloads/${job.id}`}
            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
          >
            Télécharger ZIP
          </a>
        )}
        <button
          onClick={() => { if (confirm('Supprimer cet export ?')) onDelete(job.id); }}
          className="px-3 py-1 bg-red-600/40 hover:bg-red-600 text-red-300 hover:text-white text-sm rounded transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
