import { Intent } from './Intent';
import { BotStateManager, BotState } from './BotStateManager';
import { GameAdapter } from '../games/GameAdapter';
import { MinecraftNavigator } from '../games/minecraft/MinecraftNavigator';
import { TaskPlanner } from '../tasks/TaskPlanner';
import { TaskQueue } from '../tasks/TaskQueue';
import { TaskExecutor } from '../tasks/TaskExecutor';
import { GoalManager } from '../goals/GoalManager';

export class ActionExecutor {
  private adapter: GameAdapter;
  private navigator: MinecraftNavigator | null;
  private stateManager: BotStateManager;

  private taskPlanner: TaskPlanner;
  private taskQueue: TaskQueue;
  private taskExecutor: TaskExecutor;
  private goalManager: GoalManager;

  private processing = false;

  constructor(
    adapter: GameAdapter,
    navigator: MinecraftNavigator | null,
    stateManager: BotStateManager,
    taskPlanner: TaskPlanner,
    taskQueue: TaskQueue,
    taskExecutor: TaskExecutor,
    goalManager: GoalManager
  ) {
    this.adapter = adapter;
    this.navigator = navigator;
    this.stateManager = stateManager;
    this.taskPlanner = taskPlanner;
    this.taskQueue = taskQueue;
    this.taskExecutor = taskExecutor;
    this.goalManager = goalManager;
  }

  setNavigator(nav: MinecraftNavigator | null) {
    this.navigator = nav;
    this.taskExecutor.setNavigator(nav);
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
      case Intent.FOLLOW_PLAYER: {
        // create a goal and plan tasks
        const goal = this.goalManager.createGoalFromIntent(Intent.FOLLOW_PLAYER, username);
        if (!goal) {
          await this.safeSend('Unable to create follow goal');
          return;
        }
        this.goalManager.setActive(goal.id);

        const tasks = this.taskPlanner.plan(Intent.FOLLOW_PLAYER, username);
        tasks.forEach(t => {
          t.data = { ...(t.data || {}), goalId: goal.id };
          this.taskQueue.push(t);
        });

        // immediate confirmation to user for UX parity
        await this.safeSend(`Je te suis, ${username}`);

        // process the queue
        this.processQueue().catch(err => console.error('[action] processQueue error', err));
        return;
      }
      case Intent.STOP_FOLLOWING: {
        const goal = this.goalManager.createGoalFromIntent(Intent.STOP_FOLLOWING, username);
        if (!goal) {
          await this.safeSend('Unable to create stop goal');
          return;
        }
        this.goalManager.setActive(goal.id);

        const tasks = this.taskPlanner.plan(Intent.STOP_FOLLOWING, username);
        tasks.forEach(t => {
          t.data = { ...(t.data || {}), goalId: goal.id };
          this.taskQueue.push(t);
        });

        await this.safeSend(`J'arrête de te suivre, ${username}`);
        this.processQueue().catch(err => console.error('[action] processQueue error', err));
        return;
      }
      case Intent.UNKNOWN:
      default:
        // unknown intent -> no action
        return;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (!this.taskQueue.isEmpty()) {
        const task = this.taskQueue.pop();
        if (!task) break;
        try {
          await this.taskExecutor.execute(task);
          const goalId = task.data?.goalId as string | undefined;
          if (goalId) this.goalManager.markCompleted(goalId);
        } catch (err) {
          console.error('[action] task execution failed', err);
          const goalId = task.data?.goalId as string | undefined;
          if (goalId) this.goalManager.markFailed(goalId, (err as Error).message);
        }
      }
    } finally {
      this.processing = false;
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
