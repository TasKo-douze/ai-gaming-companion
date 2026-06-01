/**
 * TaskPlanner
 *
 * Converts plans into task queues.
 */
import { Task } from './Task';
import { TaskQueue } from './TaskQueue';

export class TaskPlanner {
  plan(actions: any[]): TaskQueue {
    const q = new TaskQueue();
    // TODO: transform actions into Task items
    return q;
  }
}
