/**
 * Simple SQLite helper (low-level), alternative to MemoryDatabase.
 */
import sqlite3 from 'sqlite3';
import path from 'path';

export function openSqlite(file = path.join(process.cwd(), 'database', 'memory.sqlite')) {
  return new sqlite3.Database(file);
}
