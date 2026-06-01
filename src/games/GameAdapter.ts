/**
 * GameAdapter
 *
 * Generic interface for connecting to games.
 */
export interface GameAdapter {
  connect(...args: any[]): Promise<void>;
  disconnect(): Promise<void>;
  getWorldState(): Promise<any>;
  getPlayerState(playerId?: string): Promise<any>;
  executeAction(action: any): Promise<any>;
  sendChatMessage(msg: string): Promise<void>;
  getVisibleEntities(): Promise<any[]>;
  getInventory(): Promise<any>;
}
