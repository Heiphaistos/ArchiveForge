import { Queue } from 'bullmq';

export interface ExportJobPayload {
  guildId: string;
  format: 'json' | 'html' | 'spa';
  includeAttachments: boolean;
  channelIds?: string[];
  afterDate?: string;
  beforeDate?: string;
}

function parseRedisUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '6379', 10) };
}

const redisConnection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://redis:6379');

export const exportQueue = new Queue<ExportJobPayload>('export', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});
