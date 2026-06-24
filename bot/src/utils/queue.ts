import { Queue } from 'bullmq';
import { config } from '../config.js';
import type { ExportOptions, ImportOptions } from '../types.js';

function parseRedisUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '6379', 10) };
}

export const redisConnection = parseRedisUrl(config.REDIS_URL);

const queueDefaults = {
  removeOnComplete: { age: 86_400 },
  removeOnFail: { age: 604_800 },
};

export const exportQueue = new Queue<ExportOptions>('export', {
  connection: redisConnection,
  defaultJobOptions: { ...queueDefaults, attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
});

export const importQueue = new Queue<ImportOptions>('import', {
  connection: redisConnection,
  defaultJobOptions: { ...queueDefaults, attempts: 1 },
});
