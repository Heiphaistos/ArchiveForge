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

// Lazy init — évite d'instancier BullMQ au module load (crash build Next.js)
let _queue: Queue<ExportJobPayload> | null = null;

export function getExportQueue(): Queue<ExportJobPayload> {
  if (!_queue) {
    const connection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://redis:6379');
    _queue = new Queue<ExportJobPayload>('export', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    });
  }
  return _queue;
}
