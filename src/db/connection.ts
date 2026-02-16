import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getDatabasePath } from '../config/paths.js';
import * as schema from './schema.js';

let _database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabase() {
  if (!_database) {
    const dbPath = getDatabasePath();
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    _database = drizzle(sqlite, { schema });
    runMigrations(sqlite);
  }
  return _database;
}

function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      author_normalized TEXT,
      content_html TEXT,
      excerpt TEXT,
      url TEXT,
      publication_name TEXT,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      word_count INTEGER,
      tags TEXT,
      bundled INTEGER DEFAULT 0,
      last_bundled_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS source_unique_idx ON articles(source_name, source_id);
    CREATE INDEX IF NOT EXISTS author_normalized_idx ON articles(author_normalized);

    CREATE TABLE IF NOT EXISTS bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sent_at TEXT,
      sent_to TEXT,
      file_path TEXT,
      file_size INTEGER,
      article_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bundle_articles (
      bundle_id INTEGER NOT NULL REFERENCES bundles(id),
      article_id INTEGER NOT NULL REFERENCES articles(id),
      order_index INTEGER NOT NULL,
      UNIQUE(bundle_id, article_id)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      fetched INTEGER DEFAULT 0,
      new_articles INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running'
    );
  `);
}
