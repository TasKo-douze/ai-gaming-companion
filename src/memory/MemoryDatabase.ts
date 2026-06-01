/**
 * MemoryDatabase
 *
 * Simple SQLite-backed key-value store used by LongTermMemory.
 */
import Database from 'better-sqlite3';
import path from 'path';

export class MemoryDatabase {
  private db?: Database.Database;
  private filePath: string;

  constructor(filePath = path.join(process.cwd(), 'database', 'memory.db')) {
    this.filePath = filePath;
  }

  async connect() {
    // better-sqlite3 is synchronous; keeping async signature for flexibility
    this.db = new Database(this.filePath);
    this.db.prepare(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)`)
      .run();
  }

  async save(key: string, value: string) {
    if (!this.db) throw new Error('DB not initialized');
    const stmt = this.db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  }

  async load(key: string) {
    if (!this.db) throw new Error('DB not initialized');
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
    return row ? row.value : null;
  }
}
