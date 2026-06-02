import { Intent } from './Intent';
import { BotStateManager, BotState } from './BotStateManager';
import { GameAdapter } from '../games/GameAdapter';
import { MinecraftNavigator } from '../games/minecraft/MinecraftNavigator';

export class ActionExecutor {
  private adapter: GameAdapter;
  private navigator: MinecraftNavigator | null;
  private stateManager: BotStateManager;

  constructor(adapter: GameAdapter, navigator: MinecraftNavigator | null, stateManager: BotStateManager) {
    this.adapter = adapter;
    this.navigator = navigator;
    this.stateManager = stateManager;
  }

  setNavigator(nav: MinecraftNavigator | null) {
    this.navigator = nav;
  }

  async execute(intent: Intent, username: string): Promise<void> {
    switch (intent) {
      case Intent.PING:
        await this.safeSend('pong');
        return;
      case Intent.GREETING:
        await this.safeSend('hello');
        return;
      case Intent.HELP:
        await this.safeSend('Available commands: ping, hello, help, follow me / suis-moi, stop / arrête');
        return;
      case Intent.FOLLOW_PLAYER:
        if (!this.navigator) {
          await this.safeSend('Navigator not initialized');
          return;
        }
        try {
          await this.navigator.followPlayer(username);
          this.stateManager.setState(BotState.FOLLOWING, username);
        } catch (e) {
          console.error('[action] followPlayer error', e);
          await this.safeSend(`Failed to follow ${username}`);
        }
        return;
      case Intent.STOP_FOLLOWING:
        if (!this.navigator) {
          await this.safeSend('Navigator not initialized');
          return;
        }
        try {
          await this.navigator.stopFollowing();
          this.stateManager.setState(BotState.IDLE, null);
        } catch (e) {
          console.error('[action] stopFollowing error', e);
          await this.safeSend('Failed to stop following');
        }
        return;
      case Intent.UNKNOWN:
      default:
        // unknown intent -> no action
        return;
    }
  }

  private async safeSend(msg: string): Promise<void> {
    try {
      await this.adapter.sendChatMessage(msg);
    } catch (e) {
      console.error('[action] failed to send chat message', e);
    }
  }
}
