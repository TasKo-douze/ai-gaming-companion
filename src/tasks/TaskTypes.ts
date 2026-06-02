import { Task } from './Task';

/**
 * Specific Task types constructors / helpers
 */

export type FollowPlayerTask = Task & { name: 'FOLLOW_PLAYER'; data: { username: string } };
export function createFollowPlayerTask(username: string): FollowPlayerTask {
  return {
    id: `follow-${username}-${Date.now()}`,
    name: 'FOLLOW_PLAYER',
    data: { username },
    priority: 10,
  } as FollowPlayerTask;
}

export type StopFollowingTask = Task & { name: 'STOP_FOLLOWING'; data?: null };
export function createStopFollowingTask(): StopFollowingTask {
  return {
    id: `stop-${Date.now()}`,
    name: 'STOP_FOLLOWING',
    data: null,
    priority: 20,
  } as StopFollowingTask;
}
