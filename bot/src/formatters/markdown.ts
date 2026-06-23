import fs from 'fs/promises';
import path from 'path';
import { ChannelType } from 'discord.js';
import type { GuildExport, ChannelData, MessageData } from '../types.js';

export async function writeMarkdownExport(data: GuildExport, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  // Index
  const categories = new Map<string | null, ChannelData[]>();
  for (const ch of data.channels) {
    const key = ch.parentId ?? null;
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key)!.push(ch);
  }

  let index = `# ${data.name} — Export Discord\n\n`;
  index += `> Exporté le ${new Date(data.exportedAt).toLocaleString('fr-FR')}\n`;
  index += `> ${data.channels.length} salons · ${data.members.length} membres\n\n`;
  index += `## Salons\n\n`;

  for (const [, channels] of categories) {
    for (const ch of channels) {
      const icon = getIcon(ch.type);
      const total = ch.messages.length + ch.threads.reduce((s, t) => s + t.messages.length, 0);
      index += `- ${icon} [${ch.name}](channels/${ch.name}.md) — ${total} messages\n`;
    }
  }

  await fs.writeFile(path.join(outputDir, 'README.md'), index, 'utf-8');

  // Un fichier par salon
  const channelDir = path.join(outputDir, 'channels');
  await fs.mkdir(channelDir, { recursive: true });

  for (const ch of data.channels) {
    const icon = getIcon(ch.type);
    let content = `# ${icon} ${ch.name}\n\n`;
    if (ch.topic) content += `> ${ch.topic}\n\n`;
    content += `---\n\n`;

    if (ch.messages.length === 0 && ch.threads.length === 0) {
      content += `_Aucun message._\n`;
    } else {
      content += formatMessages(ch.messages);

      for (const thread of ch.threads) {
        content += `\n---\n\n### 💬 Thread : ${thread.name}${thread.archived ? ' _(archivé)_' : ''}\n\n`;
        content += formatMessages(thread.messages);
      }
    }

    const safeName = ch.name.replace(/[^\w\-]/g, '_');
    await fs.writeFile(path.join(channelDir, `${safeName}.md`), content, 'utf-8');
  }

  // Membres
  let members = `# Membres (${data.members.length})\n\n`;
  members += `| Pseudo | Nom affiché | Rôles |\n|--------|-------------|-------|\n`;
  for (const m of data.members) {
    const roles = m.roles.slice(0, 3).join(', ') || '—';
    members += `| ${m.username} | ${m.displayName} | ${roles} |\n`;
  }
  await fs.writeFile(path.join(outputDir, 'membres.md'), members, 'utf-8');
}

function formatMessages(messages: MessageData[]): string {
  let out = '';
  let lastAuthor = '';

  for (const msg of messages) {
    const date = new Date(msg.timestamp).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    if (msg.authorName !== lastAuthor) {
      out += `\n**${msg.authorName}** · _${date}_\n`;
      lastAuthor = msg.authorName;
    }

    if (msg.content) out += `${msg.content}\n`;

    for (const att of msg.attachments) {
      out += `[📎 ${att.filename}](${att.url})\n`;
    }
    for (const embed of msg.embeds) {
      if (embed.title) out += `> **${embed.title}**\n`;
      if (embed.description) out += `> ${embed.description.slice(0, 200)}\n`;
    }
    for (const r of msg.reactions) {
      out += `${r.emoji} ${r.count}  `;
    }
    if (msg.reactions.length > 0) out += '\n';
  }

  return out;
}

function getIcon(type: number): string {
  if (type === ChannelType.GuildForum) return '📋';
  if (type === ChannelType.GuildAnnouncement) return '📣';
  if (type === ChannelType.GuildVoice) return '🔊';
  return '#';
}
