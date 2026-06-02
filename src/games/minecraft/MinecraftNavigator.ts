import { Bot } from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import mcDataLib from 'minecraft-data';

/**
 * MinecraftNavigator
 *
 * Encapsulates navigation logic using mineflayer-pathfinder.
 * Responsibilities:
 * - follow a player entity by username
 * - stop following
 * - come to a player's current position
 * - stay at current position
 *
 * This class does not listen to chat directly; it exposes methods that
 * can be called by MinecraftAdapter in response to chat commands.
 */
export class MinecraftNavigator {
  private bot: Bot;
  private movements?: Movements;
  private following: boolean = false;
  private currentGoal: any = null;
  private targetUsername: string | null = null;
  private staying: boolean = false;
  private stayPosition: { x: number; y: number; z: number } | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
    this.ensurePathfinder();
  }

  private ensurePathfinder(): void {
    // Load plugin if not already loaded
    try {
      if (!(this.bot as any).pathfinder) {
        (this.bot as any).loadPlugin(pathfinder);
      }

      // Initialize movements with minecraft-data for the current bot version
      const mcData = mcDataLib(this.bot.version as string);
      this.movements = new Movements(this.bot, mcData);
      (this.bot as any).pathfinder.setMovements(this.movements);
    } catch (e) {
      // Re-throw to allow caller to handle initialization errors
      throw new Error(`Failed to initialize pathfinder: ${e}`);
    }
  }

  /**
   * Start following a player by username. Resolves when following has been started.
   */
  async followPlayer(username: string): Promise<void> {
    if (!this.bot) throw new Error('Bot not initialized');
    // Find the player entity
    const playerObj = this.bot.players[username];
    const entity = playerObj && playerObj.entity ? playerObj.entity : null;
    if (!entity) {
      // Try to find entity by name among entities
      for (const id in this.bot.entities) {
        const e = this.bot.entities[id];
        if (e && (e.username === username || e.name === username)) {
          this.startFollowing(e, username);
          return;
        }
      }
      throw new Error(`Player entity for '${username}' not found`);
    }

    this.startFollowing(entity, username);
  }

  private startFollowing(entity: any, username: string): void {
    if (!(this.bot as any).pathfinder) throw new Error('Pathfinder not initialized');

    // Cancel any existing goal
    try {
      (this.bot as any).pathfinder.setGoal(null);
    } catch (e) {
      // ignore
    }

    // GoalFollow(entity, range)
    const goal = new goals.GoalFollow(entity, 2); // follow within 2 blocks
    this.currentGoal = goal;
    (this.bot as any).pathfinder.setGoal(goal, true);
    this.following = true;
    this.staying = false;
    this.targetUsername = username;
    console.log(`[navigator] started following ${username}`);
  }

  /**
   * Stop following any target immediately.
   */
  async stopFollowing(): Promise<void> {
    if (!(this.bot as any).pathfinder) return;
    try {
      // Stop pathfinder and clear goal
      if (typeof (this.bot as any).pathfinder.stop === 'function') {
        (this.bot as any).pathfinder.stop();
      }
      (this.bot as any).pathfinder.setGoal(null);
    } catch (e) {
      // ignore errors while stopping
    }
    this.following = false;
    this.currentGoal = null;
    const prev = this.targetUsername;
    this.targetUsername = null;
    this.staying = false;
    this.stayPosition = null;
    console.log(`[navigator] stopped following ${prev || 'target'}`);
  }

  /**
   * Move to the player's current position (one-shot).
   */
  async comeToPlayer(username: string): Promise<void> {
    if (!this.bot) throw new Error('Bot not initialized');
    const playerObj = this.bot.players[username];
    const entity = playerObj && playerObj.entity ? playerObj.entity : null;
    if (!entity) {
      // Try find among entities
      for (const id in this.bot.entities) {
        const e = this.bot.entities[id];
        if (e && (e.username === username || e.name === username)) {
          await this.moveToPosition(e.position);
          return;
        }
      }
      throw new Error(`Player entity for '${username}' not found`);
    }

    await this.moveToPosition(entity.position);
    // not setting following; this is a one-shot move
  }

  private async moveToPosition(position: any): Promise<void> {
    if (!(this.bot as any).pathfinder) throw new Error('Pathfinder not initialized');
    try {
      // Cancel any existing goal
      try { (this.bot as any).pathfinder.setGoal(null); } catch (e) { /* ignore */ }

      const goal = new goals.GoalNear(position.x, position.y, position.z, 1);
      this.currentGoal = goal;
      (this.bot as any).pathfinder.setGoal(goal, true);
      this.following = false;
      this.staying = false;
      this.stayPosition = null;
      console.log(`[navigator] moving to position x=${position.x} y=${position.y} z=${position.z}`);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Stop any navigation and remain at current position.
   */
  async stayHere(): Promise<void> {
    if (!(this.bot as any).pathfinder) return;
    try {
      // Stop movement and clear goal
      if (typeof (this.bot as any).pathfinder.stop === 'function') {
        (this.bot as any).pathfinder.stop();
      }
      (this.bot as any).pathfinder.setGoal(null);
    } catch (e) {
      // ignore
    }
    // record stay position as current block center
    if (this.bot.entity && this.bot.entity.position) {
      const p = this.bot.entity.position;
      this.stayPosition = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
    } else {
      this.stayPosition = null;
    }
    this.following = false;
    this.currentGoal = null;
    this.staying = true;
    console.log('[navigator] staying at position', this.stayPosition);
  }

  isFollowing(): boolean {
    return this.following;
  }

  isStaying(): boolean {
    return this.staying;
  }

  getPosition(): { x: number; y: number; z: number } | null {
    if (this.bot.entity && this.bot.entity.position) {
      const p = this.bot.entity.position;
      return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
    }
    return null;
  }
}
