import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import type { ExportOptions } from '../types.js';

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const exportQueue = new Queue<ExportOptions>('export', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});
