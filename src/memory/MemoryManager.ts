/**
 * MemoryManager
 *
 * Coordinates short-term and long-term memory access.
 */
import { ShortTermMemory } from './ShortTermMemory';
import { LongTermMemory } from './LongTermMemory';
import { MemoryDatabase } from './MemoryDatabase';

export class MemoryManager {
  private stm: ShortTermMemory;
  private ltm: LongTermMemory;
  private db: MemoryDatabase;

  constructor() {
    this.db = new MemoryDatabase();
    this.stm = new ShortTermMemory();
    this.ltm = new LongTermMemory(this.db);
  }

  async initialize() {
    await this.db.connect();
    // TODO: load LTM entries
  }
}
