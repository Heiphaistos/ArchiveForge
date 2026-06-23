import type { TextChannel, Message, Attachment, Embed } from 'discord.js';
import type { MessageData, AttachmentData, EmbedData } from '../types.js';
import { withRetry, sleep } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

const BATCH_SIZE = 100;
const INTER_BATCH_DELAY_MS = 500;

export async function fetchAllMessages(
  channel: TextChannel,
  options: { afterDate?: Date; beforeDate?: Date } = {}
): Promise<MessageData[]> {
  const all: MessageData[] = [];
  let before: string | undefined;
  let skipped = 0;

  while (true) {
    let batch;
    try {
      batch = await withRetry(`messages:${channel.name}`, () =>
        channel.messages.fetch({ limit: BATCH_SIZE, ...(before ? { before } : {}) })
      );
    } catch {
      logger.warn(`[messages] Canal ${channel.name} inaccessible — ignoré`);
      break;
    }

    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      if (options.afterDate && msg.createdAt < options.afterDate) {
        skipped++;
        continue;
      }
      if (options.beforeDate && msg.createdAt > options.beforeDate) {
        logger.info(`[messages:${channel.name}] Limite beforeDate atteinte`);
        return all;
      }
      all.push(mapMessage(msg));
    }

    before = sorted[0].id;
    await sleep(INTER_BATCH_DELAY_MS);
  }

  logger.info(`[messages:${channel.name}] ${all.length} messages (${skipped} ignorés par date)`);
  return all;
}

function mapMessage(msg: Message): MessageData {
  return {
    id: msg.id,
    content: msg.content,
    authorId: msg.author.id,
    authorName: msg.author.username,
    authorAvatar: msg.author.displayAvatarURL({ extension: 'png', size: 64 }),
    timestamp: msg.createdAt.toISOString(),
    editedTimestamp: msg.editedAt?.toISOString() ?? null,
    attachments: [...msg.attachments.values()].map(mapAttachment),
    embeds: msg.embeds.map(mapEmbed),
    reactions: [...msg.reactions.cache.values()].map((r) => ({
      emoji: r.emoji.toString(),
      count: r.count ?? 0,
    })),
    referencedMessageId: msg.reference?.messageId ?? null,
  };
}

function mapAttachment(a: Attachment): AttachmentData {
  return {
    id: a.id,
    url: a.url,
    filename: a.name,
    size: a.size,
    contentType: a.contentType ?? null,
    isAlive: true,
  };
}

function mapEmbed(e: Embed): EmbedData {
  return {
    title: e.title ?? undefined,
    description: e.description ?? undefined,
    url: e.url ?? undefined,
    color: e.color ?? undefined,
    timestamp: e.timestamp ?? undefined,
    imageUrl: e.image?.url,
    thumbnailUrl: e.thumbnail?.url,
    fields: e.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
  };
}
