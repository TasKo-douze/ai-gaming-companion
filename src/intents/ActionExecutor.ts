// src/intents/ActionExecutor.ts
import { Intent } from './Intent';
import { BotStateManager, BotState } from './BotStateManager';
import { GameAdapter } from '../games/GameAdapter';
import { MinecraftNavigator } from '../games/minecraft/MinecraftNavigator';
import { TaskPlanner } from '../tasks/TaskPlanner';
import { TaskQueue } from '../tasks/TaskQueue';
import { TaskExecutor } from '../tasks/TaskExecutor';
import { GoalManager } from '../goals/GoalManager';
import { MemoryManager } from '../memory/MemoryManager';

export class ActionExecutor {
  private adapter: GameAdapter;
  private navigator: MinecraftNavigator | null;
  private stateManager: BotStateManager;

  private taskPlanner: TaskPlanner;
  private taskQueue: TaskQueue;
  private taskExecutor: TaskExecutor;
  private goalManager: GoalManager;
  private memoryManager: MemoryManager;

  private processing = false;

  constructor(
    adapter: GameAdapter,
    navigator: MinecraftNavigator | null,
    stateManager: BotStateManager,
    taskPlanner: TaskPlanner,
    taskQueue: TaskQueue,
    taskExecutor: TaskExecutor,
    goalManager: GoalManager,
    memoryManager: MemoryManager
  ) {
    this.adapter = adapter;
    this.navigator = navigator;
    this.stateManager = stateManager;
    this.taskPlanner = taskPlanner;
    this.taskQueue = taskQueue;
    this.taskExecutor = taskExecutor;
    this.goalManager = goalManager;
    this.memoryManager = memoryManager;
  }

  setNavigator(nav: MinecraftNavigator | null) {
    this.navigator = nav;
    this.taskExecutor.setNavigator(nav);
  }

  async execute(intent: Intent, username: string): Promise<void> {
    // record intent in memory if available (best effort)
    try {
      this.memoryManager.rememberEvent({
        id: `evt-intent-${Date.now()}`,
        type: ("INTENT_DETECTED" as any),
        timestamp: new Date().toISOString(),
        username,
        content: intent,
      });
    } catch {
      // ignore memory errors
    }

    switch (intent) {
      case Intent.PING:
        await this.safeSend('pong');
        return;

      case Intent.GREETING:
        await this.safeSend('hello');
        return;

      case Intent.HELP:
        await this.safeSend('Available commands: ping, hello, help, follow me / suis-moi, stop / arrête, coupe du bois / collect wood');
        return;

      case Intent.REMEMBER_ME: {
        try {
          this.memoryManager.rememberPlayerFact(username, 'remembered', true);
          this.memoryManager.rememberEvent({
            id: `evt-remember-${Date.now()}`,
            type: ("INTENT_DETECTED" as any),
            timestamp: new Date().toISOString(),
            username,
            content: 'remember_me',
          });
          await this.safeSend('Je me souviendrai de toi.');
        } catch (e) {
          console.error('[action] remember me failed', e);
        }
        return;
      }

      case Intent.WHO_AM_I: {
        try {
          const facts = this.memoryManager.getPlayerFacts(username);
          const remembered = facts['remembered'] ? 'Yes' : 'No';
          const lastFollow = facts['lastFollowedAt'] || 'never';
          await this.safeSend(`You are ${username}. remembered=${remembered}. lastFollowedAt=${lastFollow}`);
        } catch (e) {
          console.error('[action] who am i failed', e);
        }
        return;
      }

      // Movement intents (create goal -> plan tasks -> push -> confirm -> process queue)
      case Intent.COME_HERE: {
        const goal = this.goalManager.createGoalFromIntent(Intent.COME_HERE, username);
        if (!goal) {
          await this.safeSend('Unable to create come here goal');
          return;
        }
        this.goalManager.setActive(goal.id);

        const tasks = this.taskPlanner.plan(Intent.COME_HERE, username);
        tasks.forEach(t => {
          t.data = { ...(t.data || {}), goalId: goal.id };
          this.taskQueue.push(t);
        });

        await this.safeSend(`J'arrive.`);
        this.processQueue().catch((err: unknown) => console.error('[action] processQueue error', err));
        return;
      }

      case Intent.STAY_HERE: {
        const goal = this.goalManager.createGoalFromIntent(Intent.STAY_HERE, username);
        if (!goal) {
          await this.safeSend('Unable to create stay here goal');
          return;
        }
        this.goalManager.setActive(goal.id);

        const tasks = this.taskPlanner.plan(Intent.STAY_HERE, username);
        tasks.forEach(t => {
          t.data = { ...(t.data || {}), goalId: goal.id };
          this.taskQueue.push(t);
        });

        await this.safeSend(`Je reste ici.`);
        this.processQueue().catch((err: unknown) => console.error('[action] processQueue error', err));
        return;
      }

      case Intent.WHERE_ARE_YOU: {
        try {
          if (!this.navigator) {
            await this.safeSend('Navigator not initialized');
            return;
          }
          const pos = this.navigator.getPosition();
          if (pos) {
            await this.safeSend(`Je suis en x=${pos.x} y=${pos.y} z=${pos.z}`);
          } else {
            await this.safeSend('Position inconnue');
          }
        } catch (e) {
          console.error('[action] where are you failed', e);
        }
        return;
      }

      case Intent.COLLECT_WOOD: {
        const goal = this.goalManager.createGoalFromIntent(Intent.COLLECT_WOOD, username);
        if (!goal) {
          await this.safeSend('Unable to create collect wood goal');
          return;
        }
        this.goalManager.setActive(goal.id);

        const tasks = this.taskPlanner.plan(Intent.COLLECT_WOOD, username);
        tasks.forEach(t => {
          t.data = { ...(t.data || {}), goalId: goal.id };
          this.taskQueue.push(t);
        });

        await this.safeSend('Je vais chercher du bois.');
        this.processQueue().catch((err: unknown) => console.error('[action] processQueue error', err));
        return;
      }

      // Follow / Stop following (legacy commands)
      case Intent.FOLLOW_PLAYER: {
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

        await this.safeSend(`Je te suis, ${username}`);
        this.processQueue().catch((err: unknown) => console.error('[action] processQueue error', err));
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
        this.processQueue().catch((err: unknown) => console.error('[action] processQueue error', err));
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

          try {
            this.memoryManager.rememberEvent({
              id: `evt-task-${Date.now()}`,
              type: ("TASK_EXECUTED" as any),
              timestamp: new Date().toISOString(),
              username: task.data?.username,
              metadata: { taskName: task.name, goalId: task.data?.goalId },
            });
          } catch {
            // ignore memory errors
          }
        } catch (err) {
          console.error('[action] task execution failed', err);
          const goalId = task.data?.goalId as string | undefined;
          if (goalId) this.goalManager.markFailed(goalId, (err as Error)?.message || String(err));

          try {
            this.memoryManager.rememberEvent({
              id: `evt-task-failed-${Date.now()}`,
              type: ("TASK_EXECUTED" as any),
              timestamp: new Date().toISOString(),
              username: task.data?.username,
              metadata: { taskName: task.name, goalId: task.data?.goalId, error: (err as Error)?.message || String(err) },
            });
          } catch {
            // ignore memory errors
          }
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