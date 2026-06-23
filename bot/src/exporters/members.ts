import type { Guild } from 'discord.js';
import type { MemberData } from '../types.js';
import { withRetry } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

export async function fetchAllMembers(guild: Guild): Promise<MemberData[]> {
  await withRetry(`members:${guild.name}`, () => guild.members.fetch());

  const members: MemberData[] = [...guild.members.cache.values()].map((m) => ({
    id: m.id,
    username: m.user.username,
    displayName: m.displayName,
    avatar: m.displayAvatarURL({ extension: 'png', size: 64 }),
    roles: [...m.roles.cache.keys()].filter((id) => id !== guild.id),
    joinedAt: m.joinedAt?.toISOString() ?? null,
  }));

  logger.info(`[members] ${members.length} membres dans "${guild.name}"`);
  return members;
}
