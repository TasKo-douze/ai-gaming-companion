/**
 * GoalManager
 *
 * Responsible for creating and managing high-level goals for the AI.
 */
export class GoalManager {
  private goals: string[] = [];

  addGoal(goal: string) {
    this.goals.push(goal);
  }

  getTopGoal(): string | null {
    return this.goals.length ? this.goals[0] : null;
  }

  // TODO: persistence, prioritization, goal lifecycle
}
