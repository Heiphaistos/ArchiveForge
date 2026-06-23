import { QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { db } from './db';
import { exportJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://redis:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export function startStatusSyncWorker(): void {
  const events = new QueueEvents('export', { connection: redis });

  events.on('progress', async ({ jobId, data }) => {
    const p = data as { pct?: number; label?: string };
    await db
      .update(exportJobs)
      .set({ status: 'active', progress: p.pct ?? 0, progressLabel: p.label ?? null })
      .where(eq(exportJobs.id, jobId));
  });

  events.on('completed', async ({ jobId, returnvalue }) => {
    const rv = returnvalue as { zipPath?: string; guildName?: string } | undefined;
    await db
      .update(exportJobs)
      .set({
        status: 'completed',
        zipPath: rv?.zipPath ?? null,
        guildName: rv?.guildName ?? null,
        completedAt: new Date(),
        progress: 100,
        progressLabel: 'Terminé',
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
