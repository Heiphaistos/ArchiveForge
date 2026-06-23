export type ExportFormat = 'json' | 'html' | 'spa' | 'markdown';

export interface ExportOptions {
  guildId: string;
  format: ExportFormat;
  includeAttachments: boolean;
  channelIds?: string[];
  afterDate?: string;
  beforeDate?: string;
}

export interface ExportProgress {
  phase: 'channels' | 'messages' | 'threads' | 'members' | 'attachments' | 'format' | 'zip';
  current: number;
  total: number;
  label: string;
  pct: number;
  eta: number | null;
  elapsed: number;
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

export interface ThreadData {
  id: string;
  name: string;
  parentId: string;
  archived: boolean;
  messages: MessageData[];
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

export interface WorkerResult {
  zipPath: string;
  guildName: string;
  channelCount: number;
  messageCount: number;
}
