import { GameAdapter } from '../GameAdapter';
import mineflayer, { Bot } from 'mineflayer';
import { EventEmitter } from 'events';
import { ChatMessage } from './IMinecraftChat';
import { MinecraftNavigator } from './MinecraftNavigator';
import { MinecraftResourceCollector } from './MinecraftResourceCollector';

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
 * Minimal Mineflayer-based adapter that creates a bot, exposes connect()/disconnect()
 * and provides a chat event publication mechanism.
 *
 * Responsibilities added in this change:
 * - listen to Minecraft chat and emit typed chat events via EventEmitter
 * - ignore messages sent by the bot itself
 * - provide sendChatMessage(message: string)
 * - provide add/remove chat listener helpers
 * - delegate navigation to MinecraftNavigator (follow/stop)
 */
export class MinecraftAdapter implements GameAdapter {
  private bot: Bot | null = null;
  private connected = false;
  private emitter = new EventEmitter();
  private navigator: MinecraftNavigator | null = null;
  private resourceCollector: MinecraftResourceCollector | null = null;

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
      } catch (err: unknown) {
        console.error('[minecraft] failed to create bot', err);
        return reject(err);
      }

      if (!this.bot) return reject(new Error('Failed to create mineflayer bot'));

      const onSpawn = () => {
        this.connected = true;
        console.log('[minecraft] bot spawned in the world');

        // Initialize navigator once the bot is spawned
        try {
          this.navigator = new MinecraftNavigator(this.bot);
        } catch (e: unknown) {
          console.error('[minecraft] failed to initialize navigator', e);
        }

        // Initialize Intent/Goal/Task system
        try {
          this.intentParser = new IntentParser();
          this.stateManager = new BotStateManager();
          this.goalManager = new GoalManager();
          this.taskPlanner = new TaskPlanner();
          this.taskQueue = new TaskQueue();
          this.taskExecutor = new TaskExecutor(this, this.navigator, this.stateManager);
          this.memoryManager = new MemoryManager();
          this.actionExecutor = new ActionExecutor(
            this,
            this.navigator,
            this.stateManager,
            this.taskPlanner,
            this.taskQueue,
            this.taskExecutor,
            this.goalManager,
            this.memoryManager
          );

          // Initialize resource collector once taskExecutor is available
          try {
            this.resourceCollector = new MinecraftResourceCollector(this.bot as Bot, this.navigator);
            if (this.taskExecutor) {
              this.taskExecutor.setResourceCollector(this.resourceCollector);
            }
          } catch (e: unknown) {
            console.error('[minecraft] failed to initialize resource collector', e);
          }
        } catch (e: unknown) {
          console.error('[minecraft] failed to initialize intent/task system', e);
        }

        // Keep listeners for runtime; resolve the connect promise now
        resolve();
      };

      const onChat = (username: string, message: string) => {
        // Ignore messages from the bot itself
        try {
          const botName = (this.bot && (this.bot.username || (this.bot as any).entity?.username)) || null;
          if (botName && username === botName) return;
        } catch (e) {
          // ignore any lookup error and proceed
        }

        console.log(`[minecraft][chat] <${username}> ${message}`);

        const chatMsg: ChatMessage = { username, message };
        // Emit event for other modules to consume
        this.emitter.emit('chat', chatMsg);

        // Built-in simple command responses (no generative AI)
        const cmd = (message || '').trim().toLowerCase();
        if (cmd === 'ping') {
          // respond with pong
          this.sendChatMessage('pong').catch(err => console.error('[minecraft] failed to send pong', err));
        } else if (cmd === 'hello') {
          this.sendChatMessage('hello').catch(err => console.error('[minecraft] failed to send hello', err));
        } else if (cmd === 'help') {
          this.sendChatMessage('Available commands: ping, hello, help, follow me / suis-moi, stop / arrête')
            .catch(err => console.error('[minecraft] failed to send help', err));
        } else if (cmd === 'suis-moi' || cmd === 'follow me') {
          // Delegate follow to navigator
          if (this.navigator) {
            this.navigator.followPlayer(username).catch(err => console.error('[minecraft] follow failed', err));
            this.sendChatMessage(`Je te suis, ${username}`).catch(err => console.error('[minecraft] failed to send follow confirmation', err));
          } else {
            this.sendChatMessage('Navigator not initialized').catch(() => {});
          }
        } else if (cmd === 'stop' || cmd === 'arrête' || cmd === 'arrête de me suivre') {
          if (this.navigator) {
            this.navigator.stopFollowing().catch(err => console.error('[minecraft] stop following failed', err));
            this.sendChatMessage(`J'arrête de te suivre, ${username}`).catch(err => console.error('[minecraft] failed to send stop confirmation', err));
          } else {
            this.sendChatMessage('Navigator not initialized').catch(() => {});
          }
        }
      };

      const onEnd = () => {
        this.connected = false;
        console.log('[minecraft] connection ended');
      };

      const onError = (err: unknown) => {
        if (err instanceof Error) console.error('[minecraft] error', err);
        else console.error('[minecraft] error', String(err));
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
      const earlyErrorHandler = (err: unknown) => {
        if (err instanceof Error) {
          console.error('[minecraft] early connection error', err);
          cleanup();
          reject(err);
        } else {
          console.error('[minecraft] early connection error', String(err));
          cleanup();
          reject(new Error(String(err)));
        }
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
      try {
        // @ts-ignore - runtime check
        if (typeof this.bot.quit === 'function') {
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
      this.navigator = null;
      this.resourceCollector = null;
      console.log('[minecraft] bot disconnected');
    }
  }

  /**
   * Send a chat message to the server from the bot.
   */
  async sendChatMessage(message: string): Promise<void> {
    if (!this.bot) throw new Error('Bot not connected');
    this.bot.chat(message);
  }

  /**
   * Register a chat listener. Listener receives a ChatMessage object.
   */
  addChatListener(listener: (msg: ChatMessage) => void): void {
    this.emitter.on('chat', listener);
  }

  /**
   * Remove a specific chat listener.
   */
  removeChatListener(listener: (msg: ChatMessage) => void): void {
    this.emitter.off('chat', listener);
  }

  async getWorldState(): Promise<any> {
    if (!this.bot) return null;
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

  async getVisibleEntities(): Promise<any[]> {
    if (!this.bot) return [];
    return Object.values(this.bot.entities || {});
  }

  async getInventory(): Promise<any> {
    if (!this.bot) return null;
    return (this.bot.inventory && this.bot.inventory.items()) || null;
  }
}
