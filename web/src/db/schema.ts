import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  guildName: text('guild_name'),
  format: text('format').notNull(),
  status: text('status').notNull().default('pending'),
  progress: real('progress').default(0),
  progressLabel: text('progress_label'),
  progressEta: integer('progress_eta'),
  progressElapsed: integer('progress_elapsed'),
  progressPhase: text('progress_phase'),
  channelCount: integer('channel_count'),
  messageCount: integer('message_count'),
  zipPath: text('zip_path'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  options: text('options').notNull(),
});

export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;

export const importJobs = sqliteTable('import_jobs', {
  id: text('id').primaryKey(),
  sourceJobId: text('source_job_id').notNull(),
  sourceGuildName: text('source_guild_name'),
  targetGuildId: text('target_guild_id').notNull(),
  targetGuildName: text('target_guild_name'),
  status: text('status').notNull().default('pending'),
  progress: real('progress').default(0),
  progressLabel: text('progress_label'),
  progressPhase: text('progress_phase'),
  rolesCreated: integer('roles_created'),
  channelsCreated: integer('channels_created'),
  messagesImported: integer('messages_imported'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  options: text('options').notNull(),
});

export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;
