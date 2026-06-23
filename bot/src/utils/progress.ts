import type { Job } from 'bullmq';
import type { ExportProgress } from '../types.js';

export async function updateProgress(job: Job, progress: Omit<ExportProgress, 'pct'>): Promise<void> {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  await job.updateProgress({ ...progress, pct });
}
