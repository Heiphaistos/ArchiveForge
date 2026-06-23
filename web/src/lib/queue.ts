import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://redis:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

export interface ExportJobPayload {
  guildId: string;
  format: 'json' | 'html' | 'spa';
  includeAttachments: boolean;
  channelIds?: string[];
  afterDate?: string;
  beforeDate?: string;
}

export const exportQueue = new Queue<ExportJobPayload>('export', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});
