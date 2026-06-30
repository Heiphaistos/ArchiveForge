import { ChannelType, type Guild, type GuildBasedChannel, type TextChannel } from 'discord.js';
import type { ChannelData } from '../types.js';
import { logger } from '../utils/logger.js';

// Threads (PublicThread, PrivateThread, AnnouncementThread) sont capturés via
// fetchThreads() depuis leur canal parent — ne pas les inclure ici pour éviter les doublons
const EXPORTABLE_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
]);

export function getExportableChannels(guild: Guild, allowedIds?: string[]): GuildBasedChannel[] {
  const channels = [...guild.channels.cache.values()]
    .filter((c) => EXPORTABLE_TYPES.has(c.type))
    .filter((c) => !allowedIds || allowedIds.includes(c.id))
    .sort((a, b) => ((a as TextChannel).position ?? 0) - ((b as TextChannel).position ?? 0));

  logger.info(`[channels] ${channels.length} canaux exportables dans "${guild.name}"`);
  return channels;
}

export function channelToMeta(channel: GuildBasedChannel): Omit<ChannelData, 'messages' | 'threads'> {
  const tc = channel as TextChannel;
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId,
    position: tc.position ?? 0,
    topic: tc.topic ?? null,
    nsfw: tc.nsfw ?? false,
    rateLimitPerUser: tc.rateLimitPerUser ?? 0,
  };
}
