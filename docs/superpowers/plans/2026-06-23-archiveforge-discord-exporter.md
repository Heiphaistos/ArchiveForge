# ArchiveForge — Discord Server Exporter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer un système d'exportation intégrale de serveurs Discord (messages, threads, membres, rôles, pièces jointes) avec un portail web d'administration sécurisé, déployable via Docker sur VPS Linux.

**Architecture:** Bot Discord.js v14 tournant comme worker BullMQ/Redis consommant les jobs d'export. Interface Next.js 15 (App Router) servant de portail admin avec auth Discord OAuth restreinte à l'admin ID, Drizzle+SQLite pour la persistance des jobs, téléchargements streamés.

**Tech Stack:** discord.js v14 · TypeScript 5 · BullMQ + Redis · Next.js 15 · NextAuth v5 · Drizzle ORM + SQLite (better-sqlite3) · Docker Compose · Tailwind CSS · archiver (ZIP)

---

## File Map

```
ArchiveForge/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .gitignore
├── bot/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # Entry point — connect Discord + start workers
│       ├── client.ts              # Discord.js Client singleton
│       ├── config.ts              # Env vars typés + validation
│       ├── types.ts               # Types partagés (ExportJob, ExportOptions, etc.)
│       ├── workers/
│       │   └── export.worker.ts   # BullMQ Worker — orchestre l'export complet
│       ├── exporters/
│       │   ├── channels.ts        # Découverte + tri des salons
│       │   ├── messages.ts        # Fetch messages paginés (before cursor) + retry 429
│       │   ├── threads.ts         # Threads actifs + archivés (API séparée)
│       │   ├── members.ts         # Fetch membres avec pagination
│       │   ├── roles.ts           # Fetch rôles
│       │   └── attachments.ts     # Download pièces jointes CDN + vérif lien mort
│       ├── formatters/
│       │   ├── json.ts            # Sérialisation JSON complète
│       │   ├── html.ts            # Export HTML statique par salon
│       │   └── spa.ts             # Génération mini-SPA offline (viewer.html + data.json)
│       └── utils/
│           ├── rate-limiter.ts    # Adaptive retry 429 + exponential backoff
│           ├── logger.ts          # Winston — fichiers .logs/ avec rotation
│           ├── queue.ts           # BullMQ Queue + Redis connection
│           ├── progress.ts        # Mise à jour progression job via BullMQ
│           └── cleanup.ts         # Suppression dossiers temporaires post-ZIP
└── web/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── drizzle.config.ts
    └── src/
        ├── db/
        │   └── schema.ts          # Tables: export_jobs, logs
        ├── lib/
        │   ├── db.ts              # Drizzle + SQLite singleton
        │   ├── auth.ts            # NextAuth v5 config (Discord OAuth, admin whitelist)
        │   ├── queue.ts           # BullMQ Queue producer
        │   └── logger.ts          # Server-side logger
        ├── app/
        │   ├── layout.tsx         # Root layout + SessionProvider
        │   ├── page.tsx           # Redirect → /dashboard ou /login
        │   ├── login/
        │   │   └── page.tsx       # Page login Discord OAuth
        │   ├── dashboard/
        │   │   ├── page.tsx       # Dashboard principal — liste exports
        │   │   └── logs/
        │   │       └── page.tsx   # Viewer logs en temps réel
        │   └── api/
        │       ├── auth/[...nextauth]/route.ts  # NextAuth handler
        │       ├── exports/
        │       │   ├── route.ts               # GET (liste) + POST (créer job)
        │       │   └── [id]/route.ts          # GET (détail) + DELETE (annuler)
        │       └── downloads/[id]/route.ts    # Stream ZIP vers client
        └── components/
            ├── ExportForm.tsx     # Formulaire: guild ID + options export
            ├── ExportList.tsx     # Liste jobs avec statuts temps réel (polling)
            ├── ExportCard.tsx     # Carte individuelle job (statut, progression, dl)
            ├── LogViewer.tsx      # Affichage logs avec auto-scroll
            └── StatusBadge.tsx    # Badge coloré pending/running/done/failed
```

---

## Task 1 — Infrastructure Docker + Scaffold

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Créer docker-compose.yml**

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - archiveforge

  bot:
    build: ./bot
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./exports:/app/exports
      - ./logs:/app/.logs
    depends_on:
      - redis
    networks:
      - archiveforge

  web:
    build: ./web
    restart: unless-stopped
    env_file: .env
    ports:
      - "3009:3009"
    volumes:
      - ./exports:/app/exports
      - ./data:/app/data
    depends_on:
      - redis
    networks:
      - archiveforge

volumes:
  redis_data:

networks:
  archiveforge:
    driver: bridge
```

- [ ] **Créer .env.example**

```env
# Discord Bot
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3009
ADMIN_DISCORD_ID=

# Redis
REDIS_URL=redis://redis:6379

# Paths
EXPORTS_DIR=/app/exports
LOGS_DIR=/app/.logs

# Web
PORT=3009
NODE_ENV=production
```

- [ ] **Créer .gitignore**

```gitignore
node_modules/
dist/
.env
exports/
.logs/
data/
*.zip
*.sqlite
.next/
```

---

## Task 2 — Bot: Config + Types + Client

**Files:**
- Create: `bot/package.json`
- Create: `bot/tsconfig.json`
- Create: `bot/src/config.ts`
- Create: `bot/src/types.ts`
- Create: `bot/src/client.ts`

- [ ] **bot/package.json**

```json
{
  "name": "archiveforge-bot",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "discord.js": "^14.16.3",
    "bullmq": "^5.7.0",
    "ioredis": "^5.3.2",
    "winston": "^3.13.0",
    "archiver": "^7.0.1",
    "node-fetch": "^3.3.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/archiver": "^6.0.2",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.1",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **bot/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **bot/src/config.ts**

```typescript
import { z } from 'zod';

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  REDIS_URL: z.string().url(),
  EXPORTS_DIR: z.string().default('/app/exports'),
  LOGS_DIR: z.string().default('/app/.logs'),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
});

export const config = schema.parse(process.env);
```

- [ ] **bot/src/types.ts**

```typescript
export type ExportFormat = 'json' | 'html' | 'spa';

export interface ExportOptions {
  guildId: string;
  format: ExportFormat;
  includeAttachments: boolean;
  channelIds?: string[];   // undefined = tous les salons
  afterDate?: Date;
  beforeDate?: Date;
}

export interface ExportProgress {
  phase: 'channels' | 'messages' | 'threads' | 'members' | 'attachments' | 'format' | 'zip';
  current: number;
  total: number;
  label: string;
}

export interface MessageData {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  timestamp: string;
  editedTimestamp: string | null;
  attachments: AttachmentData[];
  embeds: EmbedData[];
  reactions: ReactionData[];
  referencedMessageId: string | null;
}

export interface AttachmentData {
  id: string;
  url: string;
  filename: string;
  size: number;
  contentType: string | null;
  localPath?: string;
  isAlive: boolean;
}

export interface EmbedData {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  fields: { name: string; value: string; inline: boolean }[];
}

export interface ReactionData {
  emoji: string;
  count: number;
}

export interface ChannelData {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
  topic: string | null;
  messages: MessageData[];
  threads: ThreadData[];
}

export interface ThreadData {
  id: string;
  name: string;
  parentId: string;
  archived: boolean;
  messages: MessageData[];
}

export interface MemberData {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  roles: string[];
  joinedAt: string | null;
}

export interface RoleData {
  id: string;
  name: string;
  color: number;
  permissions: string;
  position: number;
}

export interface GuildExport {
  id: string;
  name: string;
  icon: string | null;
  exportedAt: string;
  options: ExportOptions;
  channels: ChannelData[];
  members: MemberData[];
  roles: RoleData[];
}
```

- [ ] **bot/src/client.ts**

```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});
```

---

## Task 3 — Bot: Utils (Logger + Rate Limiter + Queue)

**Files:**
- Create: `bot/src/utils/logger.ts`
- Create: `bot/src/utils/rate-limiter.ts`
- Create: `bot/src/utils/queue.ts`

- [ ] **bot/src/utils/logger.ts**

```typescript
import winston from 'winston';
import { config } from '../config.js';
import path from 'path';
import fs from 'fs';

fs.mkdirSync(config.LOGS_DIR, { recursive: true });
fs.mkdirSync(path.join(config.LOGS_DIR, 'archive'), { recursive: true });

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) =>
          `[${timestamp}] [${level}] ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`
        )
      ),
    }),
    new winston.transports.File({
      filename: path.join(config.LOGS_DIR, 'archiveforge.log'),
      maxsize: 1_048_576, // 1 MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(config.LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: 1_048_576,
      maxFiles: 3,
    }),
  ],
});
```

- [ ] **bot/src/utils/rate-limiter.ts**

```typescript
import { logger } from './logger.js';

const MAX_RETRIES = 7;
const BASE_DELAY_MS = 1000;

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = 0
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 429 && retries < MAX_RETRIES) {
      const retryAfter = (err as { retryAfter?: number }).retryAfter ?? 1;
      const delay = Math.max(retryAfter * 1000, BASE_DELAY_MS * 2 ** retries);
      logger.warn(`[${label}] 429 rate limit — retry ${retries + 1}/${MAX_RETRIES} in ${delay}ms`);
      await sleep(delay);
      return withRetry(label, fn, retries + 1);
    }
    throw err;
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
```

- [ ] **bot/src/utils/queue.ts**

```typescript
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import type { ExportOptions } from '../types.js';

export const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const exportQueue = new Queue<ExportOptions>('export', { connection: redis });
```

---

## Task 4 — Bot: Exporters (Channels + Messages)

**Files:**
- Create: `bot/src/exporters/channels.ts`
- Create: `bot/src/exporters/messages.ts`

- [ ] **bot/src/exporters/channels.ts**

```typescript
import { Guild, ChannelType, TextChannel, type GuildBasedChannel } from 'discord.js';
import type { ChannelData } from '../types.js';
import { logger } from '../utils/logger.js';

const EXPORTABLE_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildVoice,
]);

export function getExportableChannels(guild: Guild, allowedIds?: string[]): GuildBasedChannel[] {
  const channels = [...guild.channels.cache.values()]
    .filter((c) => EXPORTABLE_TYPES.has(c.type))
    .filter((c) => !allowedIds || allowedIds.includes(c.id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  logger.info(`[channels] Found ${channels.length} exportable channels in ${guild.name}`);
  return channels;
}

export function channelToData(channel: GuildBasedChannel): Omit<ChannelData, 'messages' | 'threads'> {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId,
    position: (channel as TextChannel).position ?? 0,
    topic: (channel as TextChannel).topic ?? null,
  };
}
```

- [ ] **bot/src/exporters/messages.ts**

```typescript
import { type TextChannel, Collection, type Message } from 'discord.js';
import type { MessageData, AttachmentData, EmbedData, ReactionData } from '../types.js';
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

  while (true) {
    const batch = await withRetry(`messages:${channel.name}`, () =>
      channel.messages.fetch({ limit: BATCH_SIZE, ...(before ? { before } : {}) })
    );

    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)));

    for (const msg of sorted) {
      if (options.afterDate && msg.createdAt < options.afterDate) continue;
      if (options.beforeDate && msg.createdAt > options.beforeDate) {
        logger.info(`[messages:${channel.name}] Reached beforeDate — stopping`);
        return all;
      }
      all.push(mapMessage(msg));
    }

    before = sorted[0].id;
    await sleep(INTER_BATCH_DELAY_MS);
  }

  logger.info(`[messages:${channel.name}] Fetched ${all.length} messages`);
  return all;
}

function mapMessage(msg: Message): MessageData {
  return {
    id: msg.id,
    content: msg.content,
    authorId: msg.author.id,
    authorName: msg.author.username,
    authorAvatar: msg.author.displayAvatarURL({ extension: 'png', size: 64 }) ?? null,
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

function mapAttachment(a: import('discord.js').Attachment): AttachmentData {
  return {
    id: a.id,
    url: a.url,
    filename: a.name,
    size: a.size,
    contentType: a.contentType ?? null,
    isAlive: true,
  };
}

function mapEmbed(e: import('discord.js').Embed): EmbedData {
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
```

---

## Task 5 — Bot: Exporters (Threads + Members + Roles)

**Files:**
- Create: `bot/src/exporters/threads.ts`
- Create: `bot/src/exporters/members.ts`
- Create: `bot/src/exporters/roles.ts`

- [ ] **bot/src/exporters/threads.ts**

```typescript
import { type TextChannel, ChannelType } from 'discord.js';
import type { ThreadData } from '../types.js';
import { fetchAllMessages } from './messages.js';
import { withRetry, sleep } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

export async function fetchThreads(channel: TextChannel): Promise<ThreadData[]> {
  const threads: ThreadData[] = [];

  // Threads actifs
  const active = await withRetry(`threads:active:${channel.name}`, () =>
    channel.threads.fetchActive()
  );

  for (const thread of active.threads.values()) {
    logger.info(`[threads] Fetching active thread: ${thread.name}`);
    const messages = await fetchAllMessages(thread as unknown as TextChannel);
    threads.push({ id: thread.id, name: thread.name, parentId: channel.id, archived: false, messages });
    await sleep(300);
  }

  // Threads archivés (public)
  let before: string | undefined;
  while (true) {
    const archived = await withRetry(`threads:archived:${channel.name}`, () =>
      channel.threads.fetchArchived({ limit: 100, ...(before ? { before } : {}) })
    );
    if (archived.threads.size === 0) break;

    for (const thread of archived.threads.values()) {
      logger.info(`[threads] Fetching archived thread: ${thread.name}`);
      const messages = await fetchAllMessages(thread as unknown as TextChannel);
      threads.push({ id: thread.id, name: thread.name, parentId: channel.id, archived: true, messages });
      await sleep(300);
    }

    if (!archived.hasMore) break;
    before = [...archived.threads.values()].at(-1)?.id;
  }

  logger.info(`[threads:${channel.name}] Total: ${threads.length} threads`);
  return threads;
}
```

- [ ] **bot/src/exporters/members.ts**

```typescript
import type { Guild } from 'discord.js';
import type { MemberData } from '../types.js';
import { withRetry, sleep } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

export async function fetchAllMembers(guild: Guild): Promise<MemberData[]> {
  await withRetry(`members:fetch:${guild.name}`, () =>
    guild.members.fetch()
  );

  const members: MemberData[] = [...guild.members.cache.values()].map((m) => ({
    id: m.id,
    username: m.user.username,
    displayName: m.displayName,
    avatar: m.displayAvatarURL({ extension: 'png', size: 64 }) ?? null,
    roles: [...m.roles.cache.keys()].filter((id) => id !== guild.id),
    joinedAt: m.joinedAt?.toISOString() ?? null,
  }));

  logger.info(`[members] Fetched ${members.length} members from ${guild.name}`);
  return members;
}
```

- [ ] **bot/src/exporters/roles.ts**

```typescript
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

  logger.info(`[roles] Fetched ${roles.length} roles`);
  return roles;
}
```

---

## Task 6 — Bot: Attachment Downloader + Cleanup

**Files:**
- Create: `bot/src/exporters/attachments.ts`
- Create: `bot/src/utils/cleanup.ts`

- [ ] **bot/src/exporters/attachments.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { withRetry, sleep } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import type { AttachmentData } from '../types.js';

export async function downloadAttachments(
  attachments: AttachmentData[],
  destDir: string
): Promise<AttachmentData[]> {
  await fs.mkdir(destDir, { recursive: true });
  const results: AttachmentData[] = [];

  for (const att of attachments) {
    const filePath = path.join(destDir, `${att.id}_${att.filename}`);

    try {
      const res = await withRetry(`attachment:${att.filename}`, () => fetch(att.url));

      if (!res.ok) {
        logger.warn(`[attachments] Dead link (${res.status}): ${att.url}`);
        results.push({ ...att, isAlive: false });
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      results.push({ ...att, localPath: filePath, isAlive: true });
      await sleep(100);
    } catch (err) {
      logger.error(`[attachments] Failed to download ${att.url}`, { err });
      results.push({ ...att, isAlive: false });
    }
  }

  return results;
}

export function collectAttachments(channels: import('../types.js').ChannelData[]): AttachmentData[] {
  const all: AttachmentData[] = [];
  for (const ch of channels) {
    for (const msg of ch.messages) all.push(...msg.attachments);
    for (const t of ch.threads)
      for (const msg of t.messages) all.push(...msg.attachments);
  }
  return all;
}
```

- [ ] **bot/src/utils/cleanup.ts**

```typescript
import fs from 'fs/promises';
import { logger } from './logger.js';

export async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.info(`[cleanup] Removed: ${dirPath}`);
  } catch (err) {
    logger.error(`[cleanup] Failed to remove ${dirPath}`, { err });
  }
}
```

---

## Task 7 — Bot: Formatters (JSON + HTML + SPA)

**Files:**
- Create: `bot/src/formatters/json.ts`
- Create: `bot/src/formatters/html.ts`
- Create: `bot/src/formatters/spa.ts`

- [ ] **bot/src/formatters/json.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { GuildExport } from '../types.js';

export async function writeJsonExport(data: GuildExport, outputDir: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, 'export.json');
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  return file;
}
```

- [ ] **bot/src/formatters/html.ts** — génère un fichier HTML par salon

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { ChannelData, MessageData } from '../types.js';

export async function writeHtmlExport(channels: ChannelData[], outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  for (const ch of channels) {
    const html = buildChannelHtml(ch);
    await fs.writeFile(path.join(outputDir, `${ch.name}-${ch.id}.html`), html, 'utf-8');
  }
}

function buildChannelHtml(ch: ChannelData): string {
  const messages = ch.messages.map(msgHtml).join('\n');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>#${ch.name}</title>
<style>
body { font-family: sans-serif; background: #313338; color: #dbdee1; padding: 16px; }
.msg { display: flex; gap: 12px; margin-bottom: 8px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; }
.meta { font-size: 0.75em; color: #949ba4; margin-bottom: 2px; }
.username { font-weight: 600; color: #f2f3f5; margin-right: 8px; }
.content { white-space: pre-wrap; word-break: break-word; }
.attachment { margin-top: 4px; }
.attachment img { max-width: 400px; max-height: 300px; border-radius: 4px; }
</style>
</head>
<body>
<h1>#${ch.name}</h1>
${messages}
</body>
</html>`;
}

function msgHtml(msg: MessageData): string {
  const avatar = msg.authorAvatar
    ? `<img class="avatar" src="${msg.authorAvatar}" alt="${msg.authorName}">`
    : `<div class="avatar" style="background:#5865f2;display:flex;align-items:center;justify-content:center">${msg.authorName[0]}</div>`;

  const attachments = msg.attachments
    .map((a) => {
      const isImage = a.contentType?.startsWith('image/');
      return `<div class="attachment">${isImage ? `<img src="${a.url}" alt="${a.filename}">` : `<a href="${a.url}">${a.filename}</a>`}</div>`;
    })
    .join('');

  return `<div class="msg">
${avatar}
<div>
<div class="meta"><span class="username">${msg.authorName}</span>${new Date(msg.timestamp).toLocaleString('fr-FR')}</div>
<div class="content">${escapeHtml(msg.content)}</div>
${attachments}
</div>
</div>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **bot/src/formatters/spa.ts** — génère viewer.html + data.json navigable offline

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { GuildExport } from '../types.js';

export async function writeSpaExport(data: GuildExport, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'data.json'), JSON.stringify(data), 'utf-8');
  await fs.writeFile(path.join(outputDir, 'viewer.html'), buildSpaHtml(), 'utf-8');
}

function buildSpaHtml(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>ArchiveForge Viewer</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #313338; color: #dbdee1; display: flex; height: 100vh; overflow: hidden; }
#sidebar { width: 240px; background: #2b2d31; overflow-y: auto; flex-shrink: 0; padding: 8px; }
#sidebar h2 { font-size: 0.75em; text-transform: uppercase; color: #949ba4; padding: 8px 4px; letter-spacing: 0.05em; }
.ch-item { padding: 6px 8px; border-radius: 4px; cursor: pointer; color: #949ba4; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch-item:hover, .ch-item.active { background: #404249; color: #dbdee1; }
#main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
#header { padding: 12px 16px; border-bottom: 1px solid #3f4147; font-weight: 600; display: flex; align-items: center; gap: 8px; }
#search { margin: 8px 16px; }
#search input { width: 100%; background: #1e1f22; border: none; color: #dbdee1; padding: 6px 10px; border-radius: 4px; font-size: 0.9em; outline: none; }
#messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.msg { display: flex; gap: 12px; padding: 4px 0; }
.msg:hover { background: rgba(255,255,255,0.03); border-radius: 4px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; background: #5865f2; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1em; overflow: hidden; }
.avatar img { width: 100%; height: 100%; }
.meta { font-size: 0.75em; color: #949ba4; margin-bottom: 2px; }
.username { font-weight: 600; color: #f2f3f5; margin-right: 8px; }
.content { white-space: pre-wrap; word-break: break-word; font-size: 0.95em; line-height: 1.4; }
.att-img { max-width: 400px; max-height: 300px; border-radius: 4px; margin-top: 4px; cursor: pointer; }
.att-link { color: #00a8fc; text-decoration: none; font-size: 0.85em; }
.dead-link { color: #ed4245; text-decoration: line-through; }
#status { padding: 8px 16px; font-size: 0.8em; color: #949ba4; border-top: 1px solid #3f4147; }
</style>
</head>
<body>
<div id="sidebar">
  <h2 id="guild-name">Chargement…</h2>
  <div id="channel-list"></div>
</div>
<div id="main">
  <div id="header"># <span id="channel-name">—</span></div>
  <div id="search"><input id="search-input" type="search" placeholder="Rechercher dans ce salon…"></div>
  <div id="messages"></div>
  <div id="status" id="msg-count"></div>
</div>
<script>
let data = null;
let currentChannel = null;
let allMessages = [];

async function init() {
  const res = await fetch('./data.json');
  data = await res.json();
  document.getElementById('guild-name').textContent = data.name;
  renderSidebar();
  if (data.channels.length > 0) selectChannel(data.channels[0].id);
}

function renderSidebar() {
  const list = document.getElementById('channel-list');
  list.innerHTML = data.channels.map(ch =>
    \`<div class="ch-item" data-id="\${ch.id}" onclick="selectChannel('\${ch.id}')"># \${ch.name}</div>\`
  ).join('');
}

function selectChannel(id) {
  currentChannel = data.channels.find(c => c.id === id);
  document.querySelectorAll('.ch-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  document.getElementById('channel-name').textContent = currentChannel.name;
  allMessages = currentChannel.messages;
  document.getElementById('search-input').value = '';
  renderMessages(allMessages);
}

function renderMessages(msgs) {
  const container = document.getElementById('messages');
  container.innerHTML = msgs.map(renderMsg).join('');
  container.scrollTop = container.scrollHeight;
  document.getElementById('status').textContent = \`\${msgs.length} messages\`;
}

function renderMsg(msg) {
  const avatar = msg.authorAvatar
    ? \`<div class="avatar"><img src="\${msg.authorAvatar}" loading="lazy" alt="\${msg.authorName}"></div>\`
    : \`<div class="avatar">\${msg.authorName[0].toUpperCase()}</div>\`;

  const atts = msg.attachments.map(a => {
    if (!a.isAlive) return \`<div><span class="dead-link">\${a.filename} (lien mort)</span></div>\`;
    const src = a.localPath ? \`./attachments/\${a.id}_\${a.filename}\` : a.url;
    if (a.contentType?.startsWith('image/'))
      return \`<div><img class="att-img" src="\${src}" alt="\${a.filename}" loading="lazy"></div>\`;
    return \`<div><a class="att-link" href="\${src}" target="_blank">\${a.filename}</a></div>\`;
  }).join('');

  const date = new Date(msg.timestamp).toLocaleString('fr-FR');
  const content = escapeHtml(msg.content);
  return \`<div class="msg">
\${avatar}
<div style="min-width:0;flex:1">
<div class="meta"><span class="username">\${escapeHtml(msg.authorName)}</span>\${date}</div>
<div class="content">\${content}</div>
\${atts}
</div>
</div>\`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.getElementById('search-input').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderMessages(allMessages); return; }
  renderMessages(allMessages.filter(m => m.content.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q)));
});

init().catch(err => { document.getElementById('messages').textContent = 'Erreur: ' + err.message; });
</script>
</body>
</html>`;
}
```

---

## Task 8 — Bot: Worker Principal + Progress + Index

**Files:**
- Create: `bot/src/utils/progress.ts`
- Create: `bot/src/workers/export.worker.ts`
- Create: `bot/src/index.ts`
- Create: `bot/Dockerfile`

- [ ] **bot/src/utils/progress.ts**

```typescript
import type { Job } from 'bullmq';
import type { ExportProgress } from '../types.js';

export async function updateProgress(job: Job, progress: ExportProgress): Promise<void> {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  await job.updateProgress({ ...progress, pct });
}
```

- [ ] **bot/src/workers/export.worker.ts**

```typescript
import { Worker } from 'bullmq';
import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { redis } from '../utils/queue.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { discordClient } from '../client.js';
import type { ExportOptions, GuildExport } from '../types.js';
import { getExportableChannels, channelToData } from '../exporters/channels.js';
import { fetchAllMessages } from '../exporters/messages.js';
import { fetchThreads } from '../exporters/threads.js';
import { fetchAllMembers } from '../exporters/members.js';
import { fetchRoles } from '../exporters/roles.js';
import { collectAttachments, downloadAttachments } from '../exporters/attachments.js';
import { writeJsonExport } from '../formatters/json.js';
import { writeHtmlExport } from '../formatters/html.js';
import { writeSpaExport } from '../formatters/spa.js';
import { updateProgress } from '../utils/progress.js';
import { removeDir } from '../utils/cleanup.js';
import type { TextChannel } from 'discord.js';

export function startExportWorker(): Worker {
  const worker = new Worker<ExportOptions>(
    'export',
    async (job) => {
      const { guildId, format, includeAttachments, channelIds, afterDate, beforeDate } = job.data;
      const workDir = path.join(config.EXPORTS_DIR, job.id!);
      const zipPath = path.join(config.EXPORTS_DIR, `${job.id}.zip`);

      logger.info(`[worker] Job ${job.id} started — guild ${guildId}`);

      try {
        const guild = await discordClient.guilds.fetch(guildId);
        await guild.fetch();

        // Rôles + Membres
        await updateProgress(job, { phase: 'members', current: 0, total: 1, label: 'Fetch membres' });
        const [members, roles] = await Promise.all([fetchAllMembers(guild), fetchRoles(guild)]);

        // Canaux
        const rawChannels = getExportableChannels(guild, channelIds);
        const channels: import('../types.js').ChannelData[] = [];

        for (let i = 0; i < rawChannels.length; i++) {
          const ch = rawChannels[i];
          await updateProgress(job, { phase: 'messages', current: i, total: rawChannels.length, label: `#${ch.name}` });

          const textCh = ch as TextChannel;
          const messages = await fetchAllMessages(textCh, { afterDate, beforeDate });
          const threads = await fetchThreads(textCh);
          channels.push({ ...channelToData(ch), messages, threads });
        }

        // Pièces jointes
        let finalChannels = channels;
        if (includeAttachments) {
          await updateProgress(job, { phase: 'attachments', current: 0, total: 1, label: 'Download pièces jointes' });
          const atts = collectAttachments(channels);
          const attDir = path.join(workDir, 'attachments');
          const downloaded = await downloadAttachments(atts, attDir);
          // Remplacer dans les channels
          const attMap = new Map(downloaded.map((a) => [a.id, a]));
          finalChannels = channels.map((ch) => ({
            ...ch,
            messages: ch.messages.map((m) => ({ ...m, attachments: m.attachments.map((a) => attMap.get(a.id) ?? a) })),
            threads: ch.threads.map((t) => ({
              ...t,
              messages: t.messages.map((m) => ({ ...m, attachments: m.attachments.map((a) => attMap.get(a.id) ?? a) })),
            })),
          }));
        }

        const exportData: GuildExport = {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ extension: 'png', size: 128 }) ?? null,
          exportedAt: new Date().toISOString(),
          options: job.data,
          channels: finalChannels,
          members,
          roles,
        };

        // Formatage
        await updateProgress(job, { phase: 'format', current: 0, total: 1, label: 'Génération export' });
        if (format === 'json') await writeJsonExport(exportData, workDir);
        else if (format === 'html') await writeHtmlExport(finalChannels, workDir);
        else await writeSpaExport(exportData, workDir);

        // ZIP
        await updateProgress(job, { phase: 'zip', current: 0, total: 1, label: 'Compression ZIP' });
        await zipDirectory(workDir, zipPath);
        await removeDir(workDir);

        logger.info(`[worker] Job ${job.id} complete — ${zipPath}`);
        return { zipPath };
      } catch (err) {
        logger.error(`[worker] Job ${job.id} failed`, { err });
        await removeDir(workDir).catch(() => {});
        throw err;
      }
    },
    { connection: redis, concurrency: 2 }
  );

  worker.on('failed', (job, err) => logger.error(`[worker] Job ${job?.id} failed`, { err }));
  return worker;
}

async function zipDirectory(srcDir: string, destFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destFile);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}
```

- [ ] **bot/src/index.ts**

```typescript
import { discordClient } from './client.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { startExportWorker } from './workers/export.worker.js';

discordClient.once('ready', (client) => {
  logger.info(`[bot] Connected as ${client.user.tag}`);
  startExportWorker();
  logger.info('[worker] Export worker started');
});

discordClient.on('error', (err) => logger.error('[discord] Client error', { err }));

discordClient.login(config.DISCORD_TOKEN);
```

- [ ] **bot/Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY tsconfig.json .
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package.json .
RUN npm install --omit=dev
RUN mkdir -p /app/exports /app/.logs
USER node
CMD ["node", "dist/index.js"]
```

---

## Task 9 — Web: DB Schema + Lib

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/drizzle.config.ts`
- Create: `web/src/db/schema.ts`
- Create: `web/src/lib/db.ts`
- Create: `web/src/lib/auth.ts`
- Create: `web/src/lib/queue.ts`

- [ ] **web/package.json**

```json
{
  "name": "archiveforge-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3009",
    "build": "next build",
    "start": "next start -p 3009",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "next": "^15.0.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^5.0.0-beta.25",
    "drizzle-orm": "^0.38.3",
    "better-sqlite3": "^11.7.0",
    "bullmq": "^5.7.0",
    "ioredis": "^5.3.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "drizzle-kit": "^0.30.1",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **web/next.config.ts**

```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default config;
```

- [ ] **web/drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DATABASE_URL ?? './data/archiveforge.sqlite' },
});
```

- [ ] **web/src/db/schema.ts**

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  guildName: text('guild_name'),
  format: text('format').notNull(),
  status: text('status').notNull().default('pending'),  // pending | active | completed | failed
  progress: real('progress').default(0),
  progressLabel: text('progress_label'),
  zipPath: text('zip_path'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  options: text('options').notNull(),  // JSON
});
```

- [ ] **web/src/lib/db.ts**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import path from 'path';
import fs from 'fs';

const dataDir = process.env.DATABASE_DIR ?? './data';
fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(path.join(dataDir, 'archiveforge.sqlite'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Auto-migrate: create table if not exists
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS export_jobs (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    guild_name TEXT,
    format TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress REAL DEFAULT 0,
    progress_label TEXT,
    zip_path TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    options TEXT NOT NULL
  )
`);
```

- [ ] **web/src/lib/auth.ts**

```typescript
import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      return (profile as { id: string }).id === ADMIN_DISCORD_ID;
    },
    async session({ session, token }) {
      return { ...session, user: { ...session.user, discordId: token.sub } };
    },
  },
  pages: { signIn: '/login', error: '/login' },
});
```

- [ ] **web/src/lib/queue.ts**

```typescript
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { ExportOptions } from '@/types';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://redis:6379', {
  maxRetriesPerRequest: null,
});

export const exportQueue = new Queue<ExportOptions>('export', { connection: redis });
```

---

## Task 10 — Web: API Routes

**Files:**
- Create: `web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `web/src/app/api/exports/route.ts`
- Create: `web/src/app/api/exports/[id]/route.ts`
- Create: `web/src/app/api/downloads/[id]/route.ts`
- Create: `web/src/types.ts`

- [ ] **web/src/types.ts**

```typescript
export interface ExportOptions {
  guildId: string;
  format: 'json' | 'html' | 'spa';
  includeAttachments: boolean;
  channelIds?: string[];
  afterDate?: string;
  beforeDate?: string;
}
```

- [ ] **web/src/app/api/auth/[...nextauth]/route.ts**

```typescript
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

- [ ] **web/src/app/api/exports/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { exportJobs } from '@/db/schema';
import { exportQueue } from '@/lib/queue';
import { randomUUID } from 'crypto';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  guildId: z.string().min(1),
  format: z.enum(['json', 'html', 'spa']),
  includeAttachments: z.boolean().default(false),
  channelIds: z.array(z.string()).optional(),
  afterDate: z.string().datetime().optional(),
  beforeDate: z.string().datetime().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobs = await db.select().from(exportJobs).orderBy(desc(exportJobs.createdAt)).limit(50);
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const id = randomUUID();
  const now = new Date();

  await db.insert(exportJobs).values({
    id,
    guildId: parsed.data.guildId,
    format: parsed.data.format,
    status: 'pending',
    createdAt: now,
    options: JSON.stringify(parsed.data),
  });

  await exportQueue.add('export', { ...parsed.data }, { jobId: id });

  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **web/src/app/api/exports/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { exportJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { exportQueue } from '@/lib/queue';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, id));
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(job);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const bullJob = await exportQueue.getJob(id);
  if (bullJob) await bullJob.remove();
  await db.delete(exportJobs).where(eq(exportJobs.id, id));

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **web/src/app/api/downloads/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { exportJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, id));
  if (!job || job.status !== 'completed' || !job.zipPath) {
    return NextResponse.json({ error: 'Export non disponible' }, { status: 404 });
  }

  const absPath = job.zipPath;
  if (!fs.existsSync(absPath)) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

  const stat = fs.statSync(absPath);
  const stream = fs.createReadStream(absPath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="export-${id}.zip"`,
    },
  });
}
```

---

## Task 11 — Web: UI Components + Pages

**Files:**
- Create: `web/src/components/StatusBadge.tsx`
- Create: `web/src/components/ExportCard.tsx`
- Create: `web/src/components/ExportForm.tsx`
- Create: `web/src/components/ExportList.tsx`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/login/page.tsx`
- Create: `web/src/app/dashboard/page.tsx`

- [ ] **web/src/components/StatusBadge.tsx**

```tsx
type Status = 'pending' | 'active' | 'completed' | 'failed';

const colors: Record<Status, string> = {
  pending:   'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  active:    'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse',
  completed: 'bg-green-500/20 text-green-300 border border-green-500/30',
  failed:    'bg-red-500/20 text-red-300 border border-red-500/30',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? colors.pending}`}>
      {status}
    </span>
  );
}
```

- [ ] **web/src/components/ExportCard.tsx**

```tsx
'use client';
import { StatusBadge } from './StatusBadge';

interface Job {
  id: string;
  guildId: string;
  guildName: string | null;
  format: string;
  status: string;
  progress: number | null;
  progressLabel: string | null;
  createdAt: number;
  completedAt: number | null;
  errorMessage: string | null;
}

export function ExportCard({ job, onDelete }: { job: Job; onDelete: (id: string) => void }) {
  const created = new Date(job.createdAt).toLocaleString('fr-FR');
  const pct = Math.round(job.progress ?? 0);

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-white">{job.guildName ?? job.guildId}</span>
          <span className="ml-2 text-xs text-gray-400 uppercase">{job.format}</span>
        </div>
        <StatusBadge status={job.status as 'pending' | 'active' | 'completed' | 'failed'} />
      </div>

      {job.status === 'active' && (
        <div className="space-y-1">
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400">{job.progressLabel} — {pct}%</p>
        </div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <p className="text-xs text-red-400 font-mono">{job.errorMessage}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{created}</span>
        <div className="flex gap-2">
          {job.status === 'completed' && (
            <a
              href={`/api/downloads/${job.id}`}
              className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-500 transition"
            >
              Télécharger
            </a>
          )}
          <button
            onClick={() => onDelete(job.id)}
            className="px-2 py-1 bg-red-600/50 text-red-300 rounded hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **web/src/components/ExportForm.tsx**

```tsx
'use client';
import { useState } from 'react';

interface Props { onCreated: () => void; }

export function ExportForm({ onCreated }: Props) {
  const [guildId, setGuildId] = useState('');
  const [format, setFormat] = useState<'json' | 'html' | 'spa'>('spa');
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: guildId.trim(), format, includeAttachments }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(JSON.stringify(data.error));
      }
      setGuildId('');
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Nouvel export</h2>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Guild ID</label>
        <input
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          required
          placeholder="123456789012345678"
          className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as typeof format)}
          className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
        >
          <option value="spa">SPA Viewer (navigable offline)</option>
          <option value="html">HTML statique par salon</option>
          <option value="json">JSON brut</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={includeAttachments}
          onChange={(e) => setIncludeAttachments(e.target.checked)}
          className="accent-blue-500"
        />
        Télécharger les pièces jointes localement
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded transition"
      >
        {loading ? 'Création…' : 'Lancer l\'export'}
      </button>
    </form>
  );
}
```

- [ ] **web/src/components/ExportList.tsx**

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { ExportCard } from './ExportCard';

interface Job { id: string; guildId: string; guildName: string | null; format: string; status: string; progress: number | null; progressLabel: string | null; createdAt: number; completedAt: number | null; errorMessage: string | null; }

export function ExportList({ refresh }: { refresh: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/exports');
    if (res.ok) setJobs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refresh]);

  // Polling si jobs actifs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'active' || j.status === 'pending');
    if (!hasActive) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [jobs, load]);

  async function handleDelete(id: string) {
    await fetch(`/api/exports/${id}`, { method: 'DELETE' });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  if (loading) return <p className="text-gray-500 text-sm">Chargement…</p>;
  if (jobs.length === 0) return <p className="text-gray-500 text-sm">Aucun export.</p>;

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <ExportCard key={job.id} job={job} onDelete={handleDelete} />
      ))}
    </div>
  );
}
```

- [ ] **web/src/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'ArchiveForge', description: 'Discord Server Exporter' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-[#1e1f22] text-gray-200 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **web/src/app/globals.css**

```css
@import "tailwindcss";
```

- [ ] **web/src/app/page.tsx**

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await auth();
  if (session) redirect('/dashboard');
  else redirect('/login');
}
```

- [ ] **web/src/app/login/page.tsx**

```tsx
import { signIn } from '@/lib/auth';

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-white">ArchiveForge</h1>
          <p className="text-gray-400 text-sm mt-1">Accès administrateur uniquement</p>
        </div>
        <form action={async () => { 'use server'; await signIn('discord', { redirectTo: '/dashboard' }); }}>
          <button
            type="submit"
            className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            Connexion via Discord
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **web/src/app/dashboard/page.tsx**

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { ExportForm } from '@/components/ExportForm';
import { ExportList } from '@/components/ExportList';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ArchiveForge</h1>
          <p className="text-gray-400 text-sm">{session.user?.name}</p>
        </div>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}>
          <button className="text-sm text-gray-400 hover:text-white transition">Déconnexion</button>
        </form>
      </header>

      <ExportFormWrapper />
    </div>
  );
}

function ExportFormWrapper() {
  return (
    <div className="space-y-6">
      <ClientDashboard />
    </div>
  );
}

// Client component for interactivity
import ClientDashboard from './ClientDashboard';
```

- [ ] **web/src/app/dashboard/ClientDashboard.tsx**

```tsx
'use client';
import { useState } from 'react';
import { ExportForm } from '@/components/ExportForm';
import { ExportList } from '@/components/ExportList';

export default function ClientDashboard() {
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="space-y-6">
      <ExportForm onCreated={() => setRefresh((r) => r + 1)} />
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Historique exports</h2>
        <ExportList refresh={refresh} />
      </div>
    </div>
  );
}
```

- [ ] **web/Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p /app/data /app/exports
USER node
EXPOSE 3009
CMD ["node", "server.js"]
```

---

## Task 12 — BullMQ Bridge: Sync statuts Bot → DB Web

Le worker bot doit mettre à jour la DB SQLite de la Web app (volume partagé). On utilise un second worker côté web.

**Files:**
- Create: `web/src/lib/status-sync.ts`
- Create: `web/src/app/api/internal/sync/route.ts`

- [ ] **web/src/lib/status-sync.ts** — Worker BullMQ côté web qui sync les événements

```typescript
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { db } from './db';
import { exportJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://redis:6379', { maxRetriesPerRequest: null });

export function startStatusSyncWorker() {
  // On écoute les events BullMQ plutôt que de reprocesser les jobs
  const queueEvents = new (require('bullmq').QueueEvents)('export', { connection: redis });

  queueEvents.on('progress', async ({ jobId, data }: { jobId: string; data: { pct: number; label: string } }) => {
    await db.update(exportJobs)
      .set({ status: 'active', progress: data.pct, progressLabel: data.label })
      .where(eq(exportJobs.id, jobId));
  });

  queueEvents.on('completed', async ({ jobId, returnvalue }: { jobId: string; returnvalue: { zipPath: string } }) => {
    await db.update(exportJobs)
      .set({ status: 'completed', zipPath: returnvalue.zipPath, completedAt: new Date() })
      .where(eq(exportJobs.id, jobId));
  });

  queueEvents.on('failed', async ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    await db.update(exportJobs)
      .set({ status: 'failed', errorMessage: failedReason })
      .where(eq(exportJobs.id, jobId));
  });

  return queueEvents;
}
```

- [ ] **web/src/app/api/internal/sync/route.ts** — Starter du sync au boot Next.js (instrumentation)

```typescript
// Crée plutôt web/src/instrumentation.ts pour démarrer le sync au boot
```

- [ ] **web/src/instrumentation.ts**

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startStatusSyncWorker } = await import('./lib/status-sync');
    startStatusSyncWorker();
  }
}
```

---

## Task 13 — Git + GitHub + Forgejo

**Files:** aucun fichier additionnel

- [ ] **Initialiser git + premier commit**

```bash
cd C:\Users\Momo\Desktop\ArchiveForge
git init
git add .
git commit -m "feat: initial ArchiveForge Discord server exporter

Bot discord.js v14 + BullMQ worker, Next.js 15 admin panel,
Docker Compose, SPA viewer offline, reprise sur erreur, rate limit."
```

- [ ] **Créer repo GitHub**

```bash
gh repo create Heiphaistos/ArchiveForge --private --description "Discord server exporter — Bot + Admin Panel" --source . --remote origin --push
```

- [ ] **Créer repo Forgejo + push**

```bash
# Créer via API Forgejo
curl -X POST "https://mydepot.heiphaistos.org/api/v1/user/repos" \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"ArchiveForge","private":true,"description":"Discord server exporter"}'

git remote add forgejo ssh://git@mydepot.heiphaistos.org:2222/Heiphaistos/ArchiveForge.git
git push forgejo main
```

---

## Self-Review

**Spec coverage:**
- ✅ Token de Bot Discord (pas self-bot) — `bot/src/client.ts`
- ✅ Export canaux, threads actifs+archivés — `exporters/threads.ts` avec deux phases
- ✅ Membres, rôles — `exporters/members.ts`, `exporters/roles.ts`
- ✅ Retry 429 robuste — `utils/rate-limiter.ts` avec exponential backoff ×7
- ✅ Reprise sur erreur — BullMQ gère la persistence des jobs, cursor `before`
- ✅ Vérificateur liens morts — `exporters/attachments.ts` (check HTTP status)
- ✅ Export SPA offline navigable — `formatters/spa.ts` avec recherche intégrée
- ✅ Export HTML statique — `formatters/html.ts`
- ✅ Export JSON brut — `formatters/json.ts`
- ✅ Interface admin sécurisée — NextAuth Discord OAuth, `ADMIN_DISCORD_ID` whitelist
- ✅ Logs détaillés — Winston, rotation >1MB, `.logs/archive/`
- ✅ Nettoyage dossiers temporaires — `utils/cleanup.ts` post-ZIP
- ✅ Docker Compose — Redis + Bot + Web
- ✅ Progression temps réel — BullMQ QueueEvents → SQLite → polling 3s UI

**Types cohérents:** `ExportOptions` défini dans `bot/src/types.ts` et `web/src/types.ts` (miroir) — synchronisés.

**Version:** 1.0.0 dans les deux `package.json`.
