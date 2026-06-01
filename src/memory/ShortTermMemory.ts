/**
 * ShortTermMemory
 *
 * In-memory buffer for recent events and conversation.
 */
export class ShortTermMemory {
  private events: string[] = [];

  push(event: string) {
    this.events.push(event);
  }

  getRecent(count = 10) {
    return this.events.slice(-count);
  }

  clear() {
    this.events = [];
  }
}
