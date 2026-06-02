export enum MemoryEventType {
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  INTENT_DETECTED = 'INTENT_DETECTED',
  GOAL_CREATED = 'GOAL_CREATED',
  TASK_EXECUTED = 'TASK_EXECUTED',
  FOLLOW_STARTED = 'FOLLOW_STARTED',
  FOLLOW_STOPPED = 'FOLLOW_STOPPED',
}

export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  timestamp: string; // ISO
  username?: string;
  content?: string;
  metadata?: Record<string, any>;
}
