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

export type ComeToPlayerTask = Task & { name: 'COME_TO_PLAYER'; data: { username: string } };
export function createComeToPlayerTask(username: string): ComeToPlayerTask {
  return {
    id: `come-${username}-${Date.now()}`,
    name: 'COME_TO_PLAYER',
    data: { username },
    priority: 15,
  } as ComeToPlayerTask;
}

export type StayHereTask = Task & { name: 'STAY_HERE'; data?: null };
export function createStayHereTask(): StayHereTask {
  return {
    id: `stay-${Date.now()}`,
    name: 'STAY_HERE',
    data: null,
    priority: 20,
  } as StayHereTask;
}

export type CollectWoodTask = Task & { name: 'COLLECT_WOOD'; data: { username: string } };
export function createCollectWoodTask(username: string): CollectWoodTask {
  return {
    id: `collect-wood-${username}-${Date.now()}`,
    name: 'COLLECT_WOOD',
    data: { username },
    priority: 5,
  } as CollectWoodTask;
}
