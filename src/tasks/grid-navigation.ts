import type { TaskDefinition, GridConfig } from '../types';
import { generateGrid } from '../utils/pathfinding';

const GRID_SYSTEM_PROMPT = `You are navigating an NxN grid. Your goal is to reach the target position from your starting position.

Rules:
- Use the "look" tool to see your current position, the goal position, and what's around you (up/down/left/right)
- Use the "move" tool to move one step in a direction (up/down/left/right)
- You cannot move into obstacles or outside the grid boundary
- Navigate efficiently — try to reach the goal in as few moves as possible

Strategy: First look around to understand your surroundings and the goal location. Then plan and execute moves toward the goal, avoiding obstacles.`;

export type GridDifficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<GridDifficulty, { size: number; density: number }> = {
  easy: { size: 5, density: 0.15 },
  medium: { size: 8, density: 0.2 },
  hard: { size: 12, density: 0.25 },
};

export function createGridTask(difficulty: GridDifficulty = 'easy', id?: string): TaskDefinition {
  const config = DIFFICULTY_CONFIG[difficulty];
  const gridConfig = generateGrid(config.size, config.size, config.density);
  const taskId = id || `grid_nav_${difficulty}_${crypto.randomUUID().slice(0, 8)}`;

  return {
    id: taskId,
    name: `Grid Navigation (${difficulty})`,
    type: 'visual',
    description: `Navigate a ${config.size}x${config.size} grid from start to goal, avoiding obstacles. Difficulty: ${difficulty}.`,
    systemPrompt: GRID_SYSTEM_PROMPT,
    userPrompt: `You are on a ${config.size}x${config.size} grid. Navigate from position [${gridConfig.startPos}] to the goal at [${gridConfig.goalPos}]. Start by using "look" to see your surroundings, then use "move" to navigate to the goal.`,
    tools: ['move', 'look'],
    maxSteps: config.size * config.size,
    scoringMethod: 'trajectory',
    configJson: gridConfig,
    builtin: true,
  };
}

export function getGridNavigationTasks(): TaskDefinition[] {
  return [
    createGridTask('easy', 'grid_nav_easy'),
    createGridTask('medium', 'grid_nav_medium'),
  ];
}
