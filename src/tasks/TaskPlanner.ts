import { Intent } from '../intents/Intent';
import { Task } from './Task';
import { createFollowPlayerTask, createStopFollowingTask } from './TaskTypes';

export class TaskPlanner {
  constructor() {}

  /**
   * Convert an intent and the message sender into a sequence of Tasks.
   */
  plan(intent: Intent, username: string): Task[] {
    switch (intent) {
      case Intent.FOLLOW_PLAYER:
        return [createFollowPlayerTask(username)];
      case Intent.STOP_FOLLOWING:
        return [createStopFollowingTask()];
      default:
        return [];
    }
  }
}
