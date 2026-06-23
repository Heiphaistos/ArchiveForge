import type { TextChannel } from 'discord.js';
import type { ThreadData } from '../types.js';
import { fetchAllMessages } from './messages.js';
import { withRetry, sleep } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

const THREAD_DELAY_MS = 300;

export async function fetchThreads(channel: TextChannel): Promise<ThreadData[]> {
  const threads: ThreadData[] = [];

  // Threads actifs
  try {
    const active = await withRetry(`threads:active:${channel.name}`, () =>
      channel.threads.fetchActive()
    );
    for (const thread of active.threads.values()) {
      logger.info(`[threads] Thread actif: "${thread.name}"`);
      const messages = await fetchAllMessages(thread as unknown as TextChannel);
      threads.push({
        id: thread.id,
        name: thread.name,
        parentId: channel.id,
        archived: false,
        messages,
      });
      await sleep(THREAD_DELAY_MS);
    }
  } catch (err) {
    logger.warn(`[threads] Threads actifs inaccessibles pour #${channel.name}`, { err });
  }

  // Threads archivés (public)
  let before: string | undefined;
  while (true) {
    try {
      const archived = await withRetry(`threads:archived:${channel.name}`, () =>
        channel.threads.fetchArchived({ limit: 100, ...(before ? { before } : {}) })
      );
      if (archived.threads.size === 0) break;

      for (const thread of archived.threads.values()) {
        logger.info(`[threads] Thread archivé: "${thread.name}"`);
        const messages = await fetchAllMessages(thread as unknown as TextChannel);
        threads.push({
          id: thread.id,
          name: thread.name,
          parentId: channel.id,
          archived: true,
          messages,
        });
        await sleep(THREAD_DELAY_MS);
      }

      if (!archived.hasMore) break;
      before = [...archived.threads.values()].at(-1)?.id;
    } catch (err) {
      logger.warn(`[threads] Threads archivés inaccessibles pour #${channel.name}`, { err });
      break;
    }
  }

  logger.info(`[threads:${channel.name}] Total: ${threads.length} threads`);
  return threads;
}
