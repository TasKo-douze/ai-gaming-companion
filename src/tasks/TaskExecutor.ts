import { Task } from './Task';
import { MinecraftNavigator } from '../games/minecraft/MinecraftNavigator';
import { BotStateManager, BotState } from '../intents/BotStateManager';
import { GameAdapter } from '../games/GameAdapter';
import { MemoryManager } from '../memory/MemoryManager';

/**
 * TaskExecutor executes a single Task by delegating to the appropriate subsystem (navigator, adapter).
 */
export class TaskExecutor {
  private adapter: GameAdapter;
  private navigator: MinecraftNavigator | null;
  private stateManager: BotStateManager;
  private memoryManager: MemoryManager | null;

  constructor(adapter: GameAdapter, navigator: MinecraftNavigator | null, stateManager: BotStateManager, memoryManager?: MemoryManager | null) {
    this.adapter = adapter;
    this.navigator = navigator;
    this.stateManager = stateManager;
    this.memoryManager = memoryManager || null;
  }

  setNavigator(nav: MinecraftNavigator | null) {
    this.navigator = nav;
  }

  setMemoryManager(mm: MemoryManager | null) {
    this.memoryManager = mm;
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

          // Memory: remember follow started
          try {
            if (this.memoryManager) {
              this.memoryManager.rememberEvent({
                id: `evt-follow-start-${Date.now()}`,
                type: ("FOLLOW_STARTED" as any),
                timestamp: new Date().toISOString(),
                username,
                content: `Started following ${username}`,
              });
              this.memoryManager.setLastInteractedPlayer(username);
              this.memoryManager.rememberPlayerFact(username, 'lastFollowedAt', new Date().toISOString());
            }
          } catch (e) {
            // non-fatal
          }

          return;
        }
        case 'STOP_FOLLOWING': {
          if (!this.navigator) {
            await this.safeSend('Navigator not initialized');
            return;
          }
          await this.navigator.stopFollowing();
          this.stateManager.setState(BotState.IDLE, null);

          // Memory: remember follow stopped
          try {
            if (this.memoryManager) {
              const username = this.stateManager.getTargetUsername() || undefined;
              this.memoryManager.rememberEvent({
                id: `evt-follow-stop-${Date.now()}`,
                type: ("FOLLOW_STOPPED" as any),
                timestamp: new Date().toISOString(),
                username: username as any,
                content: `Stopped following ${username}`,
              });
            }
          } catch (e) {
            // non-fatal
          }

          return;
        }
        default:
          // Unknown tasks are ignored
          return;
      }
    } catch (e) {
      console.error('[task-executor] task execution error', e);
      // store task executed failure
      try {
        if (this.memoryManager) {
          this.memoryManager.rememberEvent({
            id: `evt-task-failed-${Date.now()}`,
            type: ("TASK_EXECUTED" as any),
            timestamp: new Date().toISOString(),
            metadata: { task, error: (e as Error).message },
          });
        }
      } catch (e2) {
        // ignore
      }
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
