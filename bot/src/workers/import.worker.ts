import { Worker } from 'bullmq';
import StreamZip from 'node-stream-zip';
import fs from 'fs/promises';
import { redisConnection } from '../utils/queue.js';
import { discordClient } from '../client.js';
import { logger } from '../utils/logger.js';
import { ChannelType } from 'discord.js';
import type { TextChannel, NonThreadGuildBasedChannel } from 'discord.js';
import type { ImportOptions, ImportResult, GuildExport } from '../types.js';

// Simplified helper to bypass guild.channels.create overload complexity
type CreateChannelFn = (opts: {
  name: string;
  type: ChannelType;
  parent?: string;
  reason?: string;
}) => Promise<NonThreadGuildBasedChannel>;

const CHANNEL_TYPE_MAP: Record<number, ChannelType> = {
  0: ChannelType.GuildText,
  2: ChannelType.GuildVoice,
  5: ChannelType.GuildAnnouncement,
  15: ChannelType.GuildForum,
  16: ChannelType.GuildForum,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function trunc(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

function isTextChannel(ch: NonThreadGuildBasedChannel): ch is TextChannel {
  return ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement;
}

export function startImportWorker(): Worker {
  const worker = new Worker<ImportOptions, ImportResult>(
    'import',
    async (job) => {
      const {
        zipPath,
        targetGuildId,
        importCategories,
        importChannels,
        importRoles,
        importMessages,
        channelIds,
        messageLimit,
      } = job.data;

      logger.info(`[import-worker] Job ${job.id} démarré — cible=${targetGuildId}`);

      // 1. Lire export.json depuis le ZIP (node-stream-zip supporte ZIP64 / pas de limite de taille)
      await job.updateProgress({ phase: 'extract', pct: 2, label: 'Lecture de l\'archive…' });

      // Vérification existence avant d'ouvrir le ZIP
      try { await fs.access(zipPath); } catch {
        throw new Error(`Archive introuvable: ${zipPath}`);
      }

      const zip = new StreamZip.async({ file: zipPath });
      let exportData: GuildExport;
      try {
        const buf = await zip.entryData('export.json').catch(() => null);
        if (!buf) throw new Error('export.json absent du ZIP. Relancez un export (JSON, SPA, HTML ou Markdown) — ce format inclut désormais le manifeste requis.');
        exportData = JSON.parse(buf.toString('utf-8')) as GuildExport;
      } finally {
        await zip.close().catch(() => {});
      }
      const sourceName = exportData.name;

      // 2. Récupérer le serveur cible
      const guild = await discordClient.guilds.fetch(targetGuildId);
      await guild.fetch();

      let rolesCreated = 0;
      let channelsCreated = 0;
      let messagesImported = 0;
      const catMap = new Map<string, string>(); // old ID → new ID
      const chMap = new Map<string, TextChannel>(); // old ID → TextChannel

      // 3. Rôles
      if (importRoles) {
        const roles = exportData.roles
          .filter((r) => r.name !== '@everyone')
          .sort((a, b) => a.position - b.position);

        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          await job.updateProgress({
            phase: 'roles',
            pct: Math.round(5 + (i / Math.max(roles.length, 1)) * 10),
            label: `Rôle ${i + 1}/${roles.length}: ${role.name}`,
          });
          try {
            await guild.roles.create({
              name: role.name,
              color: role.color || 0,
              reason: `ArchiveForge import — ${sourceName}`,
            });
            rolesCreated++;
          } catch (e) {
            logger.warn(`[import-worker] Rôle ignoré: ${role.name}`, { e });
          }
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
            const newCat = await guild.channels.create({
              name: cat.name,
              type: ChannelType.GuildCategory,
              reason: `ArchiveForge import — ${sourceName}`,
            });
            catMap.set(cat.id, newCat.id);
          } catch (e) {
            logger.warn(`[import-worker] Catégorie ignorée: ${cat.name}`, { e });
          }
          await sleep(300);
        }
      }

      // 5. Salons
      if (importChannels) {
        const toImport = channelIds
          ? exportData.channels.filter((c) => channelIds.includes(c.id))
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
            const newCh = await createFn({
              name: ch.name,
              type: discordType,
              parent: parentId,
              reason: `ArchiveForge import — ${sourceName}`,
            });

            if (isTextChannel(newCh)) {
              chMap.set(ch.id, newCh);
            }
            channelsCreated++;
          } catch (e) {
            logger.warn(`[import-worker] Salon ignoré: ${ch.name}`, { e });
          }
          await sleep(350);
        }
      }

      // 6. Messages via webhooks (texte & annonces uniquement)
      if (importMessages && chMap.size > 0) {
        const chEntries = [...chMap.entries()];
        for (let ci = 0; ci < chEntries.length; ci++) {
          const [oldId, newCh] = chEntries[ci];
          const chData = exportData.channels.find((c) => c.id === oldId);
          if (!chData || chData.messages.length === 0) continue;

          const msgs = chData.messages.slice(0, messageLimit);
          await job.updateProgress({
            phase: 'messages',
            pct: Math.round(45 + (ci / Math.max(chEntries.length, 1)) * 50),
            label: `#${chData.name} — ${msgs.length} messages`,
          });

          let webhook: Awaited<ReturnType<typeof newCh.createWebhook>> | null = null;
          try {
            webhook = await newCh.createWebhook({
              name: 'ArchiveForge Import',
              reason: `Replay messages — ${sourceName}`,
            });
          } catch (e) {
            logger.warn(`[import-worker] Webhook impossible sur #${chData.name}`, { e });
            continue;
          }

          for (const msg of msgs) {
            if (!msg.content && msg.attachments.length === 0) continue;
            try {
              await webhook.send({
                username: trunc(msg.authorName || 'Utilisateur', 80),
                avatarURL: msg.authorAvatar ?? undefined,
                content: msg.content ? trunc(msg.content, 2000) : ' ',
                allowedMentions: { parse: [] },
              });
              messagesImported++;
            } catch (e) {
              logger.warn(`[import-worker] Message ignoré`, { e });
              await sleep(2000);
            }
            await sleep(1100);
          }

          try { await webhook.delete('ArchiveForge cleanup'); } catch {}
        }
      }

      await job.updateProgress({ phase: 'done', pct: 100, label: 'Import terminé' });
      logger.info(
        `[import-worker] Job ${job.id} terminé — ${channelsCreated} salons, ${messagesImported} messages`
      );

      return { targetGuildName: guild.name, sourceName, rolesCreated, channelsCreated, messagesImported };
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on('failed', (job, err) =>
    logger.error(`[import-worker] Job ${job?.id ?? '?'} failed`, { err: (err as Error).message })
  );
  worker.on('completed', (job) =>
    logger.info(`[import-worker] Job ${job.id} completed`)
  );

  return worker;
}
