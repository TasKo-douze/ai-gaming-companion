export enum BotState {
  IDLE = 'IDLE',
  FOLLOWING = 'FOLLOWING',
  BUSY = 'BUSY'
}

export class BotStateManager {
  private state: BotState = BotState.IDLE;
  private targetUsername: string | null = null;

  constructor() {}

  getState(): BotState {
    return this.state;
  }

  setState(state: BotState, targetUsername: string | null = null): void {
    this.state = state;
    this.targetUsername = targetUsername;
  }

  getTargetUsername(): string | null {
    return this.targetUsername;
  }
}
