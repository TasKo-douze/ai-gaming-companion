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
    console.log(`[navigator] stopped following ${prev || 'target'}`);
  }

  isFollowing(): boolean {
    return this.following;
  }
}
