export interface Goal {
  id: string;
  type: GoalType;
  status: GoalStatus;
  priority: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

import { GoalType } from './GoalType';
import { GoalStatus } from './GoalStatus';
