import { QueueEvents } from 'bullmq';
import { db } from './db';
import { exportJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

function parseRedisUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '6379', 10) };
}

interface ProgressData {
  pct?: number;
  label?: string;
  eta?: number | null;
  elapsed?: number;
  phase?: string;
}

export function startStatusSyncWorker(): void {
  const connection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://redis:6379');
  const events = new QueueEvents('export', { connection });

  events.on('active', async ({ jobId }) => {
    await db
      .update(exportJobs)
      .set({ status: 'active', startedAt: new Date() })
      .where(eq(exportJobs.id, jobId));
  });

  events.on('progress', async ({ jobId, data }) => {
    const p = data as ProgressData;
    await db
      .update(exportJobs)
      .set({
        status: 'active',
        progress: p.pct ?? 0,
        progressLabel: p.label ?? null,
        progressEta: p.eta ?? null,
        progressElapsed: p.elapsed ?? null,
        progressPhase: p.phase ?? null,
      })
      .where(eq(exportJobs.id, jobId));
  });

  events.on('completed', async ({ jobId, returnvalue }) => {
    const rv = returnvalue as { zipPath?: string; guildName?: string; channelCount?: number; messageCount?: number } | undefined;
    await db
      .update(exportJobs)
      .set({
        status: 'completed',
        zipPath: rv?.zipPath ?? null,
        guildName: rv?.guildName ?? null,
        channelCount: rv?.channelCount ?? null,
        messageCount: rv?.messageCount ?? null,
        completedAt: new Date(),
        progress: 100,
        progressLabel: 'Terminé',
        progressEta: null,
        progressPhase: null,
      })
      .where(eq(exportJobs.id, jobId));
  });

  events.on('failed', async ({ jobId, failedReason }) => {
    await db
      .update(exportJobs)
      .set({ status: 'failed', errorMessage: failedReason })
      .where(eq(exportJobs.id, jobId));
  });

  console.log('[status-sync] Worker démarré');
}
