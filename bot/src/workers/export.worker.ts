import { Worker } from 'bullmq';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { redisConnection } from '../utils/queue.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { discordClient } from '../client.js';
import { updateProgress } from '../utils/progress.js';
import { removeDir } from '../utils/cleanup.js';
import { getExportableChannels, channelToMeta } from '../exporters/channels.js';
import { fetchAllMessages } from '../exporters/messages.js';
import { fetchThreads } from '../exporters/threads.js';
import { fetchAllMembers } from '../exporters/members.js';
import { fetchRoles } from '../exporters/roles.js';
import { collectAttachments, downloadAttachments, applyDownloadedAttachments } from '../exporters/attachments.js';
import { writeJsonExport } from '../formatters/json.js';
import { writeHtmlExport } from '../formatters/html.js';
import { writeSpaExport } from '../formatters/spa.js';
import type { ExportOptions, GuildExport, ChannelData, WorkerResult } from '../types.js';
import type { TextChannel } from 'discord.js';

export function startExportWorker(): Worker {
  const worker = new Worker<ExportOptions, WorkerResult>(
    'export',
    async (job) => {
      const { guildId, format, includeAttachments, channelIds, afterDate, beforeDate } = job.data;
      const workDir = path.join(config.EXPORTS_DIR, job.id!);
      const zipPath = path.join(config.EXPORTS_DIR, `${job.id}.zip`);

      logger.info(`[worker] Job ${job.id} démarré — guild ${guildId} format=${format}`);

      try {
        const guild = await discordClient.guilds.fetch(guildId);
        await guild.fetch();

        // Membres + Rôles en parallèle
        await updateProgress(job, { phase: 'members', current: 0, total: 1, label: 'Récupération membres et rôles' });
        const [members, roles] = await Promise.all([
          fetchAllMembers(guild),
          fetchRoles(guild),
        ]);

        // Canaux
        const rawChannels = getExportableChannels(guild, channelIds);
        const channels: ChannelData[] = [];
        let totalMessages = 0;

        for (let i = 0; i < rawChannels.length; i++) {
          const ch = rawChannels[i];
          await updateProgress(job, {
            phase: 'messages',
            current: i,
            total: rawChannels.length,
            label: `#${ch.name}`,
          });

          const textCh = ch as TextChannel;
          const parsedAfter = afterDate ? new Date(afterDate) : undefined;
          const parsedBefore = beforeDate ? new Date(beforeDate) : undefined;

          const [messages, threads] = await Promise.all([
            fetchAllMessages(textCh, { afterDate: parsedAfter, beforeDate: parsedBefore }),
            fetchThreads(textCh),
          ]);

          totalMessages += messages.length + threads.reduce((s, t) => s + t.messages.length, 0);
          channels.push({ ...channelToMeta(ch), messages, threads });
        }

        // Pièces jointes
        let finalChannels = channels;
        if (includeAttachments) {
          const atts = collectAttachments(channels);
          await updateProgress(job, {
            phase: 'attachments',
            current: 0,
            total: atts.length,
            label: `Download ${atts.length} pièces jointes`,
          });
          const attDir = path.join(workDir, 'attachments');
          const attMap = await downloadAttachments(atts, attDir);
          finalChannels = applyDownloadedAttachments(channels, attMap);
        }

        const exportData: GuildExport = {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ extension: 'png', size: 128 }),
          exportedAt: new Date().toISOString(),
          options: job.data,
          channels: finalChannels,
          members,
          roles,
        };

        // Formatage
        await updateProgress(job, { phase: 'format', current: 0, total: 1, label: 'Génération fichiers export' });
        if (format === 'json') await writeJsonExport(exportData, workDir);
        else if (format === 'html') await writeHtmlExport(finalChannels, workDir);
        else await writeSpaExport(exportData, workDir);

        // ZIP
        await updateProgress(job, { phase: 'zip', current: 0, total: 1, label: 'Compression ZIP' });
        await zipDirectory(workDir, zipPath);
        await removeDir(workDir);

        logger.info(`[worker] Job ${job.id} terminé — ${zipPath} (${totalMessages} messages)`);
        return { zipPath, guildName: guild.name, channelCount: channels.length, messageCount: totalMessages };
      } catch (err) {
        logger.error(`[worker] Job ${job.id} échoué`, { err });
        await removeDir(workDir).catch(() => {});
        throw err;
      }
    },
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on('failed', (job, err) =>
    logger.error(`[worker] Job ${job?.id ?? '?'} failed`, { err: (err as Error).message })
  );
  worker.on('completed', (job) =>
    logger.info(`[worker] Job ${job.id} completed successfully`)
  );

  return worker;
}

async function zipDirectory(srcDir: string, destFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destFile);
    const arc = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    arc.on('error', reject);
    arc.pipe(output);
    arc.directory(srcDir, false);
    arc.finalize();
  });
}
