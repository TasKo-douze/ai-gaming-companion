import { Goal } from './Goal';
import { GoalType } from './GoalType';
import { GoalStatus } from './GoalStatus';
import { Intent } from '../intents/Intent';

export class GoalManager {
  private goals: Map<string, Goal> = new Map();

  constructor() {}

  createGoal(type: GoalType, priority = 0, metadata?: Record<string, any>): Goal {
    const id = `${type.toString().toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const goal: Goal = {
      id,
      type,
      status: GoalStatus.PENDING,
      priority,
      createdAt: new Date().toISOString(),
      metadata: metadata || {},
    };
    this.goals.set(id, goal);
    return goal;
  }

  createGoalFromIntent(intent: Intent, username?: string): Goal | null {
    switch (intent) {
      case Intent.FOLLOW_PLAYER:
        return this.createGoal(GoalType.FOLLOW_PLAYER, 10, { username });
      case Intent.STOP_FOLLOWING:
        return this.createGoal(GoalType.STOP_FOLLOWING, 20, { username });
      case Intent.HELP:
        return this.createGoal(GoalType.IDLE, 0, { reason: 'help' });
      case Intent.GREETING:
      case Intent.PING:
      case Intent.UNKNOWN:
      default:
        return null;
    }
  }

  getGoal(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  getAllGoals(): Goal[] {
    return Array.from(this.goals.values());
  }

  getActiveGoals(): Goal[] {
    return this.getAllGoals().filter(g => g.status === GoalStatus.ACTIVE || g.status === GoalStatus.PENDING);
  }

  getTopGoal(): Goal | null {
    const arr = this.getActiveGoals().sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
    return arr.length ? arr[0] : null;
  }

  setActive(id: string): boolean {
    const g = this.goals.get(id);
    if (!g) return false;
    g.status = GoalStatus.ACTIVE;
    this.goals.set(id, g);
    return true;
  }

  markCompleted(id: string): boolean {
    const g = this.goals.get(id);
    if (!g) return false;
    g.status = GoalStatus.COMPLETED;
    this.goals.set(id, g);
    return true;
  }

  markFailed(id: string, reason?: string): boolean {
    const g = this.goals.get(id);
    if (!g) return false;
    g.status = GoalStatus.FAILED;
    if (reason) g.metadata = { ...g.metadata, reason };
    this.goals.set(id, g);
    return true;
  }

  cancelGoal(id: string): boolean {
    const g = this.goals.get(id);
    if (!g) return false;
    g.status = GoalStatus.CANCELLED;
    this.goals.set(id, g);
    return true;
  }

  clear(): void {
    this.goals.clear();
  }
}
