import fs from 'fs/promises';
import path from 'path';
import { sleep } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import type { AttachmentData, ChannelData } from '../types.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function collectAttachments(channels: ChannelData[]): AttachmentData[] {
  const all: AttachmentData[] = [];
  for (const ch of channels) {
    for (const msg of ch.messages) all.push(...msg.attachments);
    for (const t of ch.threads)
      for (const msg of t.messages) all.push(...msg.attachments);
  }
  // Dédupliquer par id
  const seen = new Set<string>();
  return all.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

export async function downloadAttachments(
  attachments: AttachmentData[],
  destDir: string
): Promise<Map<string, AttachmentData>> {
  await fs.mkdir(destDir, { recursive: true });
  const results = new Map<string, AttachmentData>();

  for (const att of attachments) {
    if (att.size > MAX_FILE_SIZE) {
      logger.warn(`[attachments] Fichier trop grand (${att.size}B), ignoré: ${att.filename}`);
      results.set(att.id, { ...att, isAlive: true });
      continue;
    }

    const filePath = path.join(destDir, `${att.id}_${att.filename}`);

    try {
      const res = await fetch(att.url, { signal: AbortSignal.timeout(30_000) });

      if (!res.ok) {
        logger.warn(`[attachments] Lien mort (${res.status}): ${att.url}`);
        results.set(att.id, { ...att, isAlive: false });
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      results.set(att.id, { ...att, localPath: filePath, isAlive: true });
      await sleep(100);
    } catch (err) {
      logger.error(`[attachments] Échec download ${att.url}`, { err });
      results.set(att.id, { ...att, isAlive: false });
    }
  }

  logger.info(`[attachments] ${results.size} pièces jointes traitées`);
  return results;
}

export function applyDownloadedAttachments(
  channels: ChannelData[],
  attMap: Map<string, AttachmentData>
): ChannelData[] {
  return channels.map((ch) => ({
    ...ch,
    messages: ch.messages.map((m) => ({
      ...m,
      attachments: m.attachments.map((a) => attMap.get(a.id) ?? a),
    })),
    threads: ch.threads.map((t) => ({
      ...t,
      messages: t.messages.map((m) => ({
        ...m,
        attachments: m.attachments.map((a) => attMap.get(a.id) ?? a),
      })),
    })),
  }));
}
