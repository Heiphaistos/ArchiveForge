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
sqlite.pragma('secure_delete = ON');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS export_jobs (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    guild_name TEXT,
    format TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress REAL DEFAULT 0,
    progress_label TEXT,
    progress_eta INTEGER,
    progress_elapsed INTEGER,
    progress_phase TEXT,
    channel_count INTEGER,
    message_count INTEGER,
    zip_path TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    options TEXT NOT NULL
  );

  -- Migration: add new columns if they don't exist
  ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS progress_eta INTEGER;
  ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS progress_elapsed INTEGER;
  ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS progress_phase TEXT;
  ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS channel_count INTEGER;
  ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS message_count INTEGER;
  ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS started_at INTEGER;
`);

export const db = drizzle(sqlite, { schema });
