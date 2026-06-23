import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  guildName: text('guild_name'),
  format: text('format').notNull(),
  status: text('status').notNull().default('pending'),
  progress: real('progress').default(0),
  progressLabel: text('progress_label'),
  zipPath: text('zip_path'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  options: text('options').notNull(),
});

export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;
