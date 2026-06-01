/**
 * LongTermMemory
 *
 * Backed by a persistent database.
 */
import { MemoryDatabase } from './MemoryDatabase';

export class LongTermMemory {
  private db: MemoryDatabase;

  constructor(db: MemoryDatabase) {
    this.db = db;
  }

  // TODO: typed methods to store preferences, memories, history
  async save(key: string, value: any) {
    await this.db.set(key, JSON.stringify(value));
  }

  async load(key: string) {
    const v = await this.db.get(key);
    return v ? JSON.parse(v) : null;
  }
}
