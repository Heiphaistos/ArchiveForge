import type { TextChannel } from 'discord.js';
import type { ThreadData } from '../types.js';
import { fetchAllMessages } from './messages.js';
import { withRetry, sleep } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

const THREAD_DELAY_MS = 400;

// Accepte n'importe quel canal qui expose un ThreadManager (TextChannel, ForumChannel, etc.)
type ChannelWithThreads = Pick<TextChannel, 'threads' | 'name' | 'id'>;

async function fetchThread(thread: { id: string; name: string }, archived: boolean): Promise<ThreadData> {
  const messages = await fetchAllMessages(thread as unknown as TextChannel);
  return {
    id: thread.id,
    name: thread.name,
    parentId: (thread as { parentId?: string }).parentId ?? '',
    archived,
    messages,
  };
}

export async function fetchThreads(channel: ChannelWithThreads): Promise<ThreadData[]> {
  const threads: ThreadData[] = [];

  // Threads actifs (forum posts actifs inclus)
  try {
    const active = await withRetry(`threads:active:${channel.id}`, () =>
      channel.threads.fetchActive()
    );
    for (const thread of active.threads.values()) {
      logger.info(`[threads] Actif: "${thread.name}" (${channel.name})`);
      threads.push(await fetchThread(thread, false));
      await sleep(THREAD_DELAY_MS);
    }
  } catch (err) {
    logger.warn(`[threads] Threads actifs inaccessibles pour #${channel.name}`, { err });
  }

  // Threads archivés publics — pagination complète
  let before: string | undefined;
  for (;;) {
    try {
      const archived = await withRetry(`threads:archived:pub:${channel.id}`, () =>
        channel.threads.fetchArchived({ limit: 100, type: 'public', ...(before ? { before } : {}) })
      );
      if (archived.threads.size === 0) break;

      for (const thread of archived.threads.values()) {
        logger.info(`[threads] Archivé public: "${thread.name}" (${channel.name})`);
        threads.push(await fetchThread(thread, true));
        await sleep(THREAD_DELAY_MS);
      }

      if (!archived.hasMore) break;
      before = [...archived.threads.values()].at(-1)?.id;
    } catch (err) {
      logger.warn(`[threads] Threads archivés publics inaccessibles pour #${channel.name}`, { err });
      break;
    }
  }

  // Threads archivés privés (requiert permission MANAGE_THREADS — silencieux si refusé)
  let privateBefore: string | undefined;
  for (;;) {
    try {
      const privateArchived = await withRetry(`threads:archived:priv:${channel.id}`, () =>
        channel.threads.fetchArchived({ limit: 100, type: 'private', ...(privateBefore ? { before: privateBefore } : {}) })
      );
      if (privateArchived.threads.size === 0) break;

      for (const thread of privateArchived.threads.values()) {
        logger.info(`[threads] Archivé privé: "${thread.name}" (${channel.name})`);
        threads.push(await fetchThread(thread, true));
        await sleep(THREAD_DELAY_MS);
      }

      if (!privateArchived.hasMore) break;
      privateBefore = [...privateArchived.threads.values()].at(-1)?.id;
    } catch {
      // Pas la permission MANAGE_THREADS ou non applicable (forum) — ignoré
      break;
    }
  }

  logger.info(`[threads:${channel.name}] Total: ${threads.length} threads/posts`);
  return threads;
}
