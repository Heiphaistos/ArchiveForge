import { Queue } from 'bullmq';

export interface ExportJobPayload {
  guildId: string;
  format: 'json' | 'html' | 'spa' | 'markdown';
  includeAttachments: boolean;
  channelIds?: string[];
  afterDate?: string;
  beforeDate?: string;
}

export interface ImportJobPayload {
  zipPath: string;
  sourceGuildName: string;
  targetGuildId: string;
  importCategories: boolean;
  importChannels: boolean;
  importRoles: boolean;
  importMessages: boolean;
  channelIds?: string[];
  messageLimit: number;
}

function parseRedisUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '6379', 10) };
}

// Lazy init — évite d'instancier BullMQ au module load (crash build Next.js)
let _exportQueue: Queue<ExportJobPayload> | null = null;
let _importQueue: Queue<ImportJobPayload> | null = null;

export function getExportQueue(): Queue<ExportJobPayload> {
  if (!_exportQueue) {
    const connection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://redis:6379');
    _exportQueue = new Queue<ExportJobPayload>('export', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    });
  }
  return _exportQueue;
}

export function getImportQueue(): Queue<ImportJobPayload> {
  if (!_importQueue) {
    const connection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://redis:6379');
    _importQueue = new Queue<ImportJobPayload>('import', {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    });
  }
  return _importQueue;
}
