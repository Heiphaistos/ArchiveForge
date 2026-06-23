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

// Auto-init schéma sans dépendance externe au démarrage
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

export const db = drizzle(sqlite, { schema });
