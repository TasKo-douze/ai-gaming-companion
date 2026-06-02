import { Task } from './Task';

export class TaskQueue {
  private queue: Task[] = [];

  push(task: Task) {
    this.queue.push(task);
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  pop(): Task | undefined {
    return this.queue.shift();
  }

  peek(): Task | undefined { return this.queue[0]; }

  size(): number { return this.queue.length; }

  clear(): void { this.queue = []; }

  isEmpty(): boolean { return this.queue.length === 0; }

  list(): Task[] { return [...this.queue]; }
}
