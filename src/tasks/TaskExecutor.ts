/**
 * TaskExecutor
 *
 * Executes tasks by delegating to game-specific executors.
 */
import { Task } from './Task';

export class TaskExecutor {
  constructor() {}

  async execute(task: Task) {
    // TODO: dispatch to MinecraftTaskExecutor or other adapters
  }
}
