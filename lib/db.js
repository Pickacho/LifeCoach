import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Allow overriding DB path via environment variable, fallback to data/coach_v2.db
const defaultDbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(defaultDbDir)) {
  fs.mkdirSync(defaultDbDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.resolve(defaultDbDir, 'coach_v2.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    water_liters REAL DEFAULT 0,
    fiber_grams REAL DEFAULT 0,
    zone2_minutes INTEGER DEFAULT 0,
    strength_minutes INTEGER DEFAULT 0,
    sleep_hours REAL DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL, -- Ikigai, Longevity, Grief, General Career, Health, Relationships, Personal Growth
    insight TEXT NOT NULL,
    confidence INTEGER DEFAULT 3,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inbox_capture (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, -- google
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    last_sync DATETIME
  );
`);

export default db;
