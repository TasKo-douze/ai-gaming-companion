/**
 * Task
 *
 * Represents a unit of work the AI can perform.
 */
export interface Task {
  id: string;
  name: string;
  data?: any;
  priority?: number;
}
