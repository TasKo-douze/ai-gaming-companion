import { MemoryDatabase } from './MemoryDatabase';

export class MemoryManager {
  private db = new MemoryDatabase();

  save(key: string, value: any) {
    this.db.set(key, value);
  }

  load(key: string) {
    return this.db.get(key);
  }
}