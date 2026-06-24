import { QueueEvents } from 'bullmq';
import { db } from './db';
import { exportJobs, importJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

function parseRedisUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '6379', 10) };
}

interface ExportProgressData {
  pct?: number;
  label?: string;
  eta?: number | null;
  elapsed?: number;
  phase?: string;
}

interface ImportProgressData {
  pct?: number;
  label?: string;
  phase?: string;
}

export function startStatusSyncWorker(): void {
  const connection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://redis:6379');

  // ── Export queue events ──
  const exportEvents = new QueueEvents('export', { connection });

  exportEvents.on('active', async ({ jobId }) => {
    await db.update(exportJobs).set({ status: 'active', startedAt: new Date() }).where(eq(exportJobs.id, jobId));
  });

  exportEvents.on('progress', async ({ jobId, data }) => {
    const p = data as ExportProgressData;
    await db.update(exportJobs).set({
      status: 'active',
      progress: p.pct ?? 0,
      progressLabel: p.label ?? null,
      progressEta: p.eta ?? null,
      progressElapsed: p.elapsed ?? null,
      progressPhase: p.phase ?? null,
    }).where(eq(exportJobs.id, jobId));
  });

  exportEvents.on('completed', async ({ jobId, returnvalue }) => {
    const rv = returnvalue as { zipPath?: string; guildName?: string; channelCount?: number; messageCount?: number } | undefined;
    await db.update(exportJobs).set({
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
    }).where(eq(exportJobs.id, jobId));
  });

  exportEvents.on('failed', async ({ jobId, failedReason }) => {
    await db.update(exportJobs).set({ status: 'failed', errorMessage: failedReason }).where(eq(exportJobs.id, jobId));
  });

  // ── Import queue events ──
  const importEvents = new QueueEvents('import', { connection });

  importEvents.on('active', async ({ jobId }) => {
    await db.update(importJobs).set({ status: 'active', startedAt: new Date() }).where(eq(importJobs.id, jobId));
  });

  importEvents.on('progress', async ({ jobId, data }) => {
    const p = data as ImportProgressData;
    await db.update(importJobs).set({
      status: 'active',
      progress: p.pct ?? 0,
      progressLabel: p.label ?? null,
      progressPhase: p.phase ?? null,
    }).where(eq(importJobs.id, jobId));
  });

  importEvents.on('completed', async ({ jobId, returnvalue }) => {
    const rv = returnvalue as { targetGuildName?: string; rolesCreated?: number; channelsCreated?: number; messagesImported?: number } | undefined;
    await db.update(importJobs).set({
      status: 'completed',
      targetGuildName: rv?.targetGuildName ?? null,
      rolesCreated: rv?.rolesCreated ?? null,
      channelsCreated: rv?.channelsCreated ?? null,
      messagesImported: rv?.messagesImported ?? null,
      completedAt: new Date(),
      progress: 100,
      progressLabel: 'Terminé',
      progressPhase: null,
    }).where(eq(importJobs.id, jobId));
  });

  importEvents.on('failed', async ({ jobId, failedReason }) => {
    await db.update(importJobs).set({ status: 'failed', errorMessage: failedReason }).where(eq(importJobs.id, jobId));
  });

  console.log('[status-sync] Workers démarrés (export + import)');
}
