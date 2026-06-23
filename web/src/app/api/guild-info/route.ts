import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
  topic: string | null;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  channels: ChannelInfo[];
  categories: { id: string; name: string; position: number }[];
}

// Type numbers from Discord API
// 0 = GuildText, 2 = GuildVoice, 4 = GuildCategory, 5 = GuildAnnouncement
// 10/11/12 = threads, 13 = GuildStageVoice, 15 = GuildForum, 16 = GuildMedia

const EXPORTABLE_TYPES = new Set([0, 2, 5, 10, 11, 12, 15, 16]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guildId = req.nextUrl.searchParams.get('guildId');
  if (!guildId || !/^\d{17,20}$/.test(guildId)) {
    return NextResponse.json({ error: 'Guild ID invalide' }, { status: 400 });
  }

  const token = process.env.DISCORD_TOKEN;
  if (!token) return NextResponse.json({ error: 'Bot token manquant' }, { status: 500 });

  const headers = { Authorization: `Bot ${token}` };

  const [guildRes, channelsRes] = await Promise.all([
    fetch(`${DISCORD_API}/guilds/${guildId}`, { headers }),
    fetch(`${DISCORD_API}/guilds/${guildId}/channels`, { headers }),
  ]);

  if (!guildRes.ok) {
    const status = guildRes.status === 403 ? 403 : guildRes.status === 404 ? 404 : 502;
    const msg = guildRes.status === 403
      ? 'Bot absent du serveur ou permissions insuffisantes'
      : guildRes.status === 404
      ? 'Serveur introuvable'
      : 'Erreur Discord API';
    return NextResponse.json({ error: msg }, { status });
  }

  const guild = await guildRes.json() as { id: string; name: string; icon?: string };
  const rawChannels = await channelsRes.json() as DiscordChannel[];

  const categories = rawChannels
    .filter((c) => c.type === 4)
    .map((c) => ({ id: c.id, name: c.name, position: c.position ?? 0 }))
    .sort((a, b) => a.position - b.position);

  const channels: ChannelInfo[] = rawChannels
    .filter((c) => EXPORTABLE_TYPES.has(c.type))
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parent_id ?? null,
      position: c.position ?? 0,
      topic: c.topic ?? null,
    }))
    .sort((a, b) => a.position - b.position);

  const iconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
    : null;

  return NextResponse.json({ id: guild.id, name: guild.name, icon: iconUrl, channels, categories } as GuildInfo);
}
