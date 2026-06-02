import { GameAdapter } from '../GameAdapter';
import mineflayer, { Bot } from 'mineflayer';

export interface MinecraftConnectOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  version?: string;
}

/**
 * MinecraftAdapter
 *
 * Minimal Mineflayer-based adapter that creates a bot and exposes connect()/disconnect().
 * - Connects using environment variables if options are not provided.
 * - Registers basic event handlers: spawn, chat, end, error, kicked, death
 * - Emits clear console logs for each event.
 *
 * Note: This implementation intentionally contains NO AI logic. It only manages
 * the bot lifecycle and basic events as requested.
 */

import { GameAdapter } from '../GameAdapter';
// import mineflayer from 'mineflayer';

export class MinecraftAdapter implements GameAdapter {
  private bot: Bot | null = null;
  private connected = false;

  constructor() {}

  /**
   * Connects the mineflayer bot to a server. Resolves once the bot has spawned.
   */
  async connect(options?: MinecraftConnectOptions): Promise<void> {
    if (this.connected) {
      console.log('[minecraft] already connected');
      return;
    }

    const host = options?.host || process.env.MINECRAFT_HOST || 'localhost';
    const port = options?.port ?? (process.env.MINECRAFT_PORT ? Number(process.env.MINECRAFT_PORT) : 25565);
    const username = options?.username || process.env.MINECRAFT_USERNAME || 'AICompanion';
    const password = options?.password || process.env.MINECRAFT_PASSWORD;

    console.log(`[minecraft] connecting to ${host}:${port} as ${username}`);

    return new Promise<void>((resolve, reject) => {
      try {
        this.bot = mineflayer.createBot({ host, port, username, password, version: options?.version });
      } catch (err) {
        console.error('[minecraft] failed to create bot', err);
        return reject(err);
      }

      if (!this.bot) return reject(new Error('Failed to create mineflayer bot'));

      const onSpawn = () => {
        this.connected = true;
        console.log('[minecraft] bot spawned in the world');
        // Keep listeners for runtime; resolve the connect promise now
        resolve();
      };

      const onChat = (username: string, message: string) => {
        // Log chat messages. Avoid logging all bot messages to reduce noise.
        console.log(`[minecraft][chat] <${username}> ${message}`);
      };

      const onEnd = () => {
        this.connected = false;
        console.log('[minecraft] connection ended');
      };

      const onError = (err: Error) => {
        console.error('[minecraft] error', err);
      };

      const onKicked = (reason: string, loggedIn: boolean) => {
        console.warn(`[minecraft] kicked from server. reason=${reason} loggedIn=${loggedIn}`);
      };

      const onDeath = () => {
        console.warn('[minecraft] bot died');
      };

      // Register handlers
      this.bot.once('spawn', onSpawn);
      this.bot.on('chat', onChat as any);
      this.bot.on('end', onEnd as any);
      this.bot.on('error', onError as any);
      this.bot.on('kicked', onKicked as any);
      this.bot.on('death', onDeath as any);

      // Safety: if an error occurs before spawn, reject the promise
      const earlyErrorHandler = (err: Error) => {
        console.error('[minecraft] early connection error', err);
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        if (!this.bot) return;
        try {
          this.bot.removeListener('spawn', onSpawn);
          this.bot.removeListener('chat', onChat as any);
          this.bot.removeListener('end', onEnd as any);
          this.bot.removeListener('error', onError as any);
          this.bot.removeListener('kicked', onKicked as any);
          this.bot.removeListener('death', onDeath as any);
          this.bot.removeListener('error', earlyErrorHandler as any);
        } catch (e) {
          // ignore
        }
      };

      // Attach early error handler to catch create/connect failures
      this.bot.on('error', earlyErrorHandler as any);

      // If the bot disconnects before spawn, ensure promise settles
      this.bot.once('end', () => {
        if (!this.connected) {
          const err = new Error('Connection ended before spawn');
          cleanup();
          reject(err);
        }
      });
    });
  }

  /**
   * Disconnects the bot and removes listeners.
   */
  async disconnect(): Promise<void> {
    if (!this.bot) {
      console.log('[minecraft] bot is not running');
      return;
    }

    try {
      console.log('[minecraft] disconnecting bot');
      // Attempt graceful end
      // mineflayer Bot has an `end()` method on the client socket; call end if available
      // Also try quit command as a fallback
      try {
        // @ts-ignore - runtime check
        if (typeof this.bot.quit === 'function') {
          // some versions expose quit()
          // @ts-ignore
          this.bot.quit();
        } else if (typeof (this.bot as any).end === 'function') {
          (this.bot as any).end();
        }
      } catch (e) {
        // ignore
      }
    } finally {
      // Remove reference to allow GC
      this.bot = null;
      this.connected = false;
      console.log('[minecraft] bot disconnected');
    }
  }

  async getWorldState(): Promise<any> {
    if (!this.bot) return null;
    // Provide a minimal view for compatibility
    return {
      players: Object.keys(this.bot.players || {}),
      time: (this.bot.time && (this.bot.time.age || this.bot.time.worldAge)) || null,
    } as any;
  }

  async getPlayerState(playerId?: string): Promise<any> {
    if (!this.bot) return null;
    return this.bot.entity ? { position: this.bot.entity.position } : null;
  }

  async executeAction(_action: any): Promise<any> {
    // No action execution in this minimal adapter
    return null;
  }

  async sendChatMessage(msg: string): Promise<void> {
    if (!this.bot) throw new Error('Bot not connected');
    this.bot.chat(msg);
  }

  async getVisibleEntities(): Promise<any[]> {
    if (!this.bot) return [];
    return Object.values(this.bot.entities || {});
  }

  async getInventory(): Promise<any> {
    if (!this.bot) return null;
    return (this.bot.inventory && this.bot.inventory.items()) || null;
  }
}
