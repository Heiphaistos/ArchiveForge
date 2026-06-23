import type { Guild } from 'discord.js';
import type { RoleData } from '../types.js';
import { logger } from '../utils/logger.js';

export async function fetchRoles(guild: Guild): Promise<RoleData[]> {
  const roles: RoleData[] = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
    }));

  logger.info(`[roles] ${roles.length} rôles`);
  return roles;
}
