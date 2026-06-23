import type { Job } from 'bullmq';
import type { ExportProgress } from '../types.js';

export async function updateProgress(
  job: Job,
  p: Omit<ExportProgress, 'pct' | 'eta' | 'elapsed'>,
  startedAt: number,
): Promise<void> {
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
  const eta =
    pct > 0 && pct < 100
      ? Math.round((elapsed / pct) * (100 - pct))
      : null;

  await job.updateProgress({ ...p, pct, eta, elapsed });
}
