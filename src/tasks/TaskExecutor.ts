import { Task } from './Task';
import { MinecraftNavigator } from '../games/minecraft/MinecraftNavigator';
import { BotStateManager, BotState } from '../intents/BotStateManager';
import { GameAdapter } from '../games/GameAdapter';

/**
 * TaskExecutor executes a single Task by delegating to the appropriate subsystem (navigator, adapter).
 */
export class TaskExecutor {
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

  async execute(task: Task): Promise<void> {
    if (!task) return;

    try {
      switch (task.name) {
        case 'FOLLOW_PLAYER': {
          const username = task.data?.username as string;
          if (!this.navigator) {
            await this.safeSend('Navigator not initialized');
            return;
          }
          await this.navigator.followPlayer(username);
          this.stateManager.setState(BotState.FOLLOWING, username);
          return;
        }
        case 'STOP_FOLLOWING': {
          if (!this.navigator) {
            await this.safeSend('Navigator not initialized');
            return;
          }
          await this.navigator.stopFollowing();
          this.stateManager.setState(BotState.IDLE, null);
          return;
        }
        default:
          // Unknown tasks are ignored
          return;
      }
    } catch (e) {
      console.error('[task-executor] task execution error', e);
    }
  }

  private async safeSend(msg: string): Promise<void> {
    try {
      await this.adapter.sendChatMessage(msg);
    } catch (e) {
      console.error('[task-executor] failed to send chat message', e);
    }
  }
}
