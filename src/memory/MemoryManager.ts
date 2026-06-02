import { MemoryEvent, MemoryEventType } from './MemoryEvent';

export class MemoryManager {
  private events: MemoryEvent[] = [];
  private playerFacts: Map<string, Record<string, any>> = new Map();
  private lastInteractedPlayer: string | null = null;
  private maxEvents: number;

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  rememberEvent(event: MemoryEvent): void {
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.length = this.maxEvents;
    }
  }

  getRecentEvents(limit = 10): MemoryEvent[] {
    return this.events.slice(0, limit);
  }

  rememberPlayerFact(username: string, key: string, value: any): void {
    const k = username.toLowerCase();
    const facts = this.playerFacts.get(k) || {};
    facts[key] = value;
    this.playerFacts.set(k, facts);
  }

  getPlayerFact(username: string, key: string): any {
    const k = username.toLowerCase();
    const facts = this.playerFacts.get(k) || {};
    return facts[key];
  }

  getPlayerFacts(username: string): Record<string, any> {
    const k = username.toLowerCase();
    return this.playerFacts.get(k) || {};
  }

  getLastInteractedPlayer(): string | null {
    return this.lastInteractedPlayer;
  }

  setLastInteractedPlayer(username: string | null): void {
    this.lastInteractedPlayer = username;
  }

  clear(): void {
    this.events = [];
    this.playerFacts.clear();
    this.lastInteractedPlayer = null;
  }
}
