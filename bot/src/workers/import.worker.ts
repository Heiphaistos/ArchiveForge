import { Worker } from 'bullmq';
import { WebhookClient, ChannelType, Routes, ThreadAutoArchiveDuration } from 'discord.js';
import type { TextChannel, ForumChannel, NonThreadGuildBasedChannel } from 'discord.js';
import StreamZip from 'node-stream-zip';
import fs from 'fs/promises';
import { redisConnection } from '../utils/queue.js';
import { discordClient } from '../client.js';
import { logger } from '../utils/logger.js';
import type { ImportOptions, ImportResult, GuildExport, ThreadData } from '../types.js';

const CHANNEL_TYPE_MAP: Record<number, ChannelType> = {
  0: ChannelType.GuildText,
  2: ChannelType.GuildVoice,
  5: ChannelType.GuildAnnouncement,
  13: ChannelType.GuildStageVoice,
  15: ChannelType.GuildForum,
  16: ChannelType.GuildMedia,
};

const MSG_DELAY = 1100; // ~0.9 msg/sec — en dessous du rate limit Discord webhook

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function trunc(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

function isTextLike(ch: NonThreadGuildBasedChannel): ch is TextChannel {
  return ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement;
}

function isForum(ch: NonThreadGuildBasedChannel): ch is ForumChannel {
  return ch.type === ChannelType.GuildForum || ch.type === ChannelType.GuildMedia;
}

type CreateChannelOpts = {
  name: string;
  type: ChannelType;
  parent?: string;
  topic?: string;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  reason?: string;
};
type CreateChannelFn = (opts: CreateChannelOpts) => Promise<NonThreadGuildBasedChannel>;

async function replayMessagesViaWebhook(
  webhookId: string,
  webhookToken: string,
  msgs: GuildExport['channels'][0]['messages'],
  limit: number,
  threadId?: string,
): Promise<number> {
  let count = 0;
  const wh = new WebhookClient({ id: webhookId, token: webhookToken });
  for (const msg of msgs.slice(0, limit)) {
    if (!msg.content && !msg.attachments.length) continue;
    const payload = {
      username: trunc(msg.authorName || 'Utilisateur', 80),
      avatarURL: msg.authorAvatar ?? undefined,
      content: msg.content ? trunc(msg.content, 2000) : ' ',
      ...(threadId ? { threadId } : {}),
      allowedMentions: { parse: [] },
    };
    let sent = false;
    for (let attempt = 0; attempt < 3 && !sent; attempt++) {
      try {
        await wh.send(payload);
        sent = true;
        count++;
      } catch (e: unknown) {
        const err = e as { status?: number; retryAfter?: number };
        if (err?.status === 429) {
          const retryAfter = (err.retryAfter ?? 5) * 1000;
          logger.warn(`[import] 429 webhook — retry dans ${retryAfter}ms`);
          await sleep(retryAfter);
        } else {
          logger.warn('[import] Message ignoré', { e });
          await sleep(2000);
          break;
        }
      }
    }
    await sleep(MSG_DELAY);
  }
  wh.destroy();
  return count;
}

async function cleanupOldWebhooks(channelId: string): Promise<void> {
  try {
    const webhooks = await discordClient.rest.get(Routes.channelWebhooks(channelId)) as Array<{ id: string; token?: string; name?: string }>;
    for (const wh of webhooks) {
      if (wh.name === 'ArchiveForge Import' && wh.token) {
        await discordClient.rest.delete(Routes.webhook(wh.id, wh.token)).catch(() => {});
        await sleep(300);
      }
    }
  } catch {}
}

async function createChannelWebhook(channelId: string): Promise<{ id: string; token: string } | null> {
  await cleanupOldWebhooks(channelId);
  try {
    const wh = await discordClient.rest.post(Routes.channelWebhooks(channelId), {
      body: { name: 'ArchiveForge Import' },
    }) as { id: string; token: string };
    return wh;
  } catch (e) {
    logger.warn(`[import] Webhook impossible sur ${channelId}`, { e });
    return null;
  }
}

async function deleteWebhook(id: string, token: string): Promise<void> {
  try { await discordClient.rest.delete(Routes.webhook(id, token)); } catch {}
}

async function replayThread(
  thread: ThreadData,
  textCh: TextChannel,
  webhookId: string,
  webhookToken: string,
  messageLimit: number,
  sourceName: string,
): Promise<number> {
  try {
    const newThread = await textCh.threads.create({
      name: trunc(thread.name, 100),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `ArchiveForge import — ${sourceName}`,
    });
    return await replayMessagesViaWebhook(webhookId, webhookToken, thread.messages, messageLimit, newThread.id);
  } catch (e) {
    logger.warn(`[import] Thread "${thread.name}" ignoré`, { e });
    return 0;
  }
}

async function replayForumPost(
  post: ThreadData,
  forumCh: ForumChannel,
  webhookId: string,
  webhookToken: string,
  messageLimit: number,
  sourceName: string,
): Promise<number> {
  if (post.messages.length === 0) return 0;
  try {
    const firstMsg = post.messages[0];
    const newPost = await forumCh.threads.create({
      name: trunc(post.name, 100),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      message: { content: firstMsg.content ? trunc(firstMsg.content, 2000) : '.' },
      reason: `ArchiveForge import — ${sourceName}`,
    });
    await sleep(500);
    const rest = await replayMessagesViaWebhook(
      webhookId, webhookToken, post.messages.slice(1), messageLimit, newPost.id
    );
    return 1 + rest;
  } catch (e) {
    logger.warn(`[import] Post forum "${post.name}" ignoré`, { e });
    return 0;
  }
}

export function startImportWorker(): Worker {
  const worker = new Worker<ImportOptions, ImportResult>(
    'import',
    async (job) => {
      const {
        zipPath, targetGuildId,
        importCategories, importChannels, importRoles, importMessages,
        channelIds, messageLimit,
      } = job.data;

      logger.info(`[import-worker] Job ${job.id} démarré — cible=${targetGuildId}`);

      // 1. Lire export.json (node-stream-zip = ZIP64, pas de limite de taille)
      await job.updateProgress({ phase: 'extract', pct: 2, label: 'Lecture de l\'archive…' });
      try { await fs.access(zipPath); } catch {
        throw new Error(`Archive introuvable: ${zipPath}`);
      }
      const zip = new StreamZip.async({ file: zipPath });
      let exportData: GuildExport;
      try {
        const buf = await zip.entryData('export.json').catch(() => null);
        if (!buf) throw new Error('export.json absent du ZIP. Relancez un export — ce manifeste est inclus depuis la dernière version.');
        exportData = JSON.parse(buf.toString('utf-8')) as GuildExport;
      } finally {
        await zip.close().catch(() => {});
      }
      const sourceName = exportData.name;

      // 2. Serveur cible
      let guild: Awaited<ReturnType<typeof discordClient.guilds.fetch>>;
      try {
        guild = await discordClient.guilds.fetch(targetGuildId);
        await guild.fetch();
      } catch (e) {
        const code = (e as { code?: number }).code;
        if (code === 10004 || String(e).includes('Unknown Guild')) {
          throw new Error(`Serveur introuvable (${targetGuildId}). Le bot doit être invité dans le serveur cible avec la permission Administrateur.`);
        }
        throw e;
      }

      let rolesCreated = 0;
      let channelsCreated = 0;
      let messagesImported = 0;
      const catMap = new Map<string, string>();     // old cat ID → new cat ID
      const textChMap = new Map<string, TextChannel>(); // old ch ID → new TextChannel
      const forumChMap = new Map<string, string>();  // old ch ID → new forum channel ID

      // 3. Rôles
      if (importRoles) {
        const roles = exportData.roles
          .filter(r => r.name !== '@everyone')
          .sort((a, b) => a.position - b.position);
        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          await job.updateProgress({
            phase: 'roles',
            pct: Math.round(5 + (i / Math.max(roles.length, 1)) * 10),
            label: `Rôle ${i + 1}/${roles.length}: ${role.name}`,
          });
          try {
            await guild.roles.create({ name: role.name, color: role.color || 0, reason: `ArchiveForge import — ${sourceName}` });
            rolesCreated++;
          } catch (e) { logger.warn(`[import] Rôle ignoré: ${role.name}`, { e }); }
          await sleep(300);
        }
      }

      // 4. Catégories
      if (importCategories) {
        const sorted = [...exportData.categories].sort((a, b) => a.position - b.position);
        for (let i = 0; i < sorted.length; i++) {
          const cat = sorted[i];
          await job.updateProgress({
            phase: 'categories',
            pct: Math.round(15 + (i / Math.max(sorted.length, 1)) * 10),
            label: `Catégorie ${i + 1}/${sorted.length}: ${cat.name}`,
          });
          try {
            const newCat = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, reason: `ArchiveForge import — ${sourceName}` });
            catMap.set(cat.id, newCat.id);
          } catch (e) { logger.warn(`[import] Catégorie ignorée: ${cat.name}`, { e }); }
          await sleep(300);
        }
      }

      // 5. Salons
      if (importChannels) {
        const toImport = channelIds
          ? exportData.channels.filter(c => channelIds.includes(c.id))
          : exportData.channels;

        for (let i = 0; i < toImport.length; i++) {
          const ch = toImport[i];
          const discordType = CHANNEL_TYPE_MAP[ch.type];
          if (discordType === undefined) continue;

          await job.updateProgress({
            phase: 'channels',
            pct: Math.round(25 + (i / Math.max(toImport.length, 1)) * 20),
            label: `Salon ${i + 1}/${toImport.length}: #${ch.name}`,
          });

          try {
            const parentId = ch.parentId ? (catMap.get(ch.parentId) ?? undefined) : undefined;
            const createFn = guild.channels.create.bind(guild.channels) as CreateChannelFn;
            const opts: CreateChannelOpts = {
              name: ch.name,
              type: discordType,
              reason: `ArchiveForge import — ${sourceName}`,
              ...(parentId ? { parent: parentId } : {}),
              ...(ch.topic ? { topic: ch.topic } : {}),
            };
            // nsfw et rateLimitPerUser uniquement sur les salons texte/annonce
            if (discordType === ChannelType.GuildText || discordType === ChannelType.GuildAnnouncement) {
              if (ch.nsfw) opts.nsfw = true;
              if (ch.rateLimitPerUser) opts.rateLimitPerUser = ch.rateLimitPerUser;
            }

            const newCh = await createFn(opts);

            if (isTextLike(newCh)) textChMap.set(ch.id, newCh);
            else if (isForum(newCh)) forumChMap.set(ch.id, newCh.id);
            channelsCreated++;
          } catch (e) { logger.warn(`[import] Salon ignoré: ${ch.name}`, { e }); }
          await sleep(350);
        }
      }

      // 6. Messages — texte + threads + forum posts
      if (importMessages) {
        const totalChannels = textChMap.size + forumChMap.size;

        if (totalChannels === 0) {
          await job.updateProgress({ phase: 'messages', pct: 95, label: 'Aucun salon avec messages' });
        } else {
          let processed = 0;

          // 6a. Salons texte : messages directs + threads
          for (const [oldId, newCh] of textChMap) {
            const chData = exportData.channels.find(c => c.id === oldId);
            if (!chData) { processed++; continue; }

            await job.updateProgress({
              phase: 'messages',
              pct: Math.round(45 + (processed / totalChannels) * 50),
              label: `#${chData.name} (${chData.messages.length} msgs, ${chData.threads.length} threads)`,
            });

            const wh = await createChannelWebhook(newCh.id);
            if (wh) {
              messagesImported += await replayMessagesViaWebhook(wh.id, wh.token, chData.messages, messageLimit);

              for (const thread of chData.threads) {
                messagesImported += await replayThread(thread, newCh, wh.id, wh.token, messageLimit, sourceName);
                await sleep(500);
              }

              await deleteWebhook(wh.id, wh.token);
            }
            processed++;
          }

          // 6b. Forums : posts (= threads) avec messages
          for (const [oldId, newChId] of forumChMap) {
            const chData = exportData.channels.find(c => c.id === oldId);
            if (!chData || chData.threads.length === 0) { processed++; continue; }

            await job.updateProgress({
              phase: 'messages',
              pct: Math.round(45 + (processed / totalChannels) * 50),
              label: `Forum #${chData.name} — ${chData.threads.length} posts`,
            });

            const wh = await createChannelWebhook(newChId);
            let forumCh: ForumChannel | null = null;
            try {
              forumCh = await discordClient.channels.fetch(newChId) as ForumChannel;
            } catch (e) {
              logger.warn(`[import] Forum channel introuvable: ${newChId}`, { e });
            }

            if (wh && forumCh) {
              for (const post of chData.threads) {
                messagesImported += await replayForumPost(post, forumCh, wh.id, wh.token, messageLimit, sourceName);
                await sleep(500);
              }
              await deleteWebhook(wh.id, wh.token);
            }
            processed++;
          }
        }
      }

      await job.updateProgress({ phase: 'done', pct: 100, label: 'Import terminé' });
      logger.info(`[import-worker] Job ${job.id} terminé — ${channelsCreated} salons, ${messagesImported} messages`);

      return { targetGuildName: guild.name, sourceName, rolesCreated, channelsCreated, messagesImported };
    },
    { connection: redisConnection, concurrency: 1, lockDuration: 300_000 }
  );

  worker.on('failed', (job, err) =>
    logger.error(`[import-worker] Job ${job?.id ?? '?'} failed`, { err: (err as Error).message })
  );
  worker.on('completed', (job) =>
    logger.info(`[import-worker] Job ${job.id} completed`)
  );

  return worker;
}
