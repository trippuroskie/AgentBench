import type { TaskDefinition } from '../types';
import { getDeterministicTasks } from './deterministic';
import { getGridNavigationTasks } from './grid-navigation';

export function getBuiltinTasks(): TaskDefinition[] {
  return [
    ...getDeterministicTasks(),
    ...getGridNavigationTasks(),
  ];
}
