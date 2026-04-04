import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Allow overriding DB path via environment variable, fallback to data/coach.db
const defaultDbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(defaultDbDir)) {
  fs.mkdirSync(defaultDbDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.resolve(defaultDbDir, 'coach.db');
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
    sleep_hours REAL,
    stress_level INTEGER,
    focus_level INTEGER,
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
    domain TEXT NOT NULL, -- Career, Health, Relationships, Personal Growth
    insight TEXT NOT NULL,
    confidence INTEGER DEFAULT 3,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
