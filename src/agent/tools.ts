import type { ToolDefinition, ToolExecutor, RegisteredTool, TaskContext } from '../types';

// ── Tool Registry ─────────────────────────────────────────────

const REGISTRY: Record<string, RegisteredTool> = {};

function register(name: string, description: string, parameters: Record<string, any>, required: string[], execute: ToolExecutor): void {
  REGISTRY[name] = {
    definition: {
      type: 'function',
      function: {
        name,
        description,
        parameters: { type: 'object', properties: parameters, required },
      },
    },
    execute,
  };
}

export function getToolDefinitions(names: string[]): ToolDefinition[] {
  return names.map((n) => {
    const tool = REGISTRY[n];
    if (!tool) throw new Error(`Unknown tool: ${n}`);
    return tool.definition;
  });
}

export function executeTool(name: string, argsJson: string, context?: TaskContext): { result: string; durationMs: number } {
  const tool = REGISTRY[name];
  if (!tool) return { result: JSON.stringify({ error: `Unknown tool: ${name}` }), durationMs: 0 };

  let args: Record<string, any>;
  try {
    args = typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson;
  } catch {
    return { result: JSON.stringify({ error: 'Invalid JSON arguments' }), durationMs: 0 };
  }

  const start = performance.now();
  try {
    const result = tool.execute(args, context);
    const durationMs = performance.now() - start;
    return { result: typeof result === 'string' ? result : JSON.stringify(result), durationMs };
  } catch (e: any) {
    return { result: JSON.stringify({ error: e.message }), durationMs: performance.now() - start };
  }
}

export function getAllToolNames(): string[] {
  return Object.keys(REGISTRY);
}

/** Get all registered tools (definitions only, no executors) for UI display */
export function getAllToolDefinitions(): ToolDefinition[] {
  return Object.values(REGISTRY).map((t) => t.definition);
}

/** Check if a tool name exists */
export function hasTool(name: string): boolean {
  return name in REGISTRY;
}

/** Register a custom tool from the UI (static response) */
export function registerCustomTool(
  name: string,
  description: string,
  parameters: Record<string, { type: string; description?: string }>,
  required: string[],
  responseTemplate: string,
): void {
  register(name, description, parameters, required, (args) => {
    // Replace {{paramName}} placeholders in the response template
    let response = responseTemplate;
    for (const [key, val] of Object.entries(args)) {
      response = response.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
    }
    return response;
  });
}

// ── Calculator ────────────────────────────────────────────────

register(
  'calculator',
  'Evaluate a mathematical expression and return the numeric result. Supports +, -, *, /, parentheses, Math functions.',
  {
    expression: { type: 'string', description: 'The mathematical expression to evaluate, e.g. "(23 * 17) + 5"' },
  },
  ['expression'],
  (args) => {
    const expr = String(args.expression).replace(/[^0-9+\-*/().,%\s]|Math\.\w+/g, (match) => {
      if (/^Math\.\w+$/.test(match)) return match;
      return '';
    });
    try {
      const result = new Function(`"use strict"; return (${expr})`)();
      if (typeof result !== 'number' || !isFinite(result)) {
        return JSON.stringify({ error: 'Expression did not evaluate to a finite number' });
      }
      return JSON.stringify({ result });
    } catch (e: any) {
      return JSON.stringify({ error: `Evaluation error: ${e.message}` });
    }
  }
);

// ── Search ────────────────────────────────────────────────────

const KNOWLEDGE_BASE: Record<string, { title: string; snippet: string }[]> = {
  'capital france': [{ title: 'France - Capital', snippet: 'The capital of France is Paris.' }],
  'capital germany': [{ title: 'Germany - Capital', snippet: 'The capital of Germany is Berlin.' }],
  'capital japan': [{ title: 'Japan - Capital', snippet: 'The capital of Japan is Tokyo.' }],
  'capital uk': [{ title: 'United Kingdom - Capital', snippet: 'The capital of the United Kingdom is London.' }],
  'capital italy': [{ title: 'Italy - Capital', snippet: 'The capital of Italy is Rome.' }],
  'population earth': [{ title: 'World Population', snippet: 'The estimated world population is approximately 8.1 billion people as of 2024.' }],
  'speed light': [{ title: 'Speed of Light', snippet: 'The speed of light in a vacuum is approximately 299,792,458 meters per second (about 186,282 miles per second).' }],
  'boiling point water': [{ title: 'Water Properties', snippet: 'The boiling point of water at standard atmospheric pressure is 100 degrees Celsius (212 degrees Fahrenheit).' }],
  'tallest mountain': [{ title: 'Mount Everest', snippet: 'Mount Everest is the tallest mountain on Earth at 8,849 meters (29,032 feet) above sea level.' }],
  'largest ocean': [{ title: 'Pacific Ocean', snippet: 'The Pacific Ocean is the largest and deepest ocean on Earth, covering approximately 165.25 million square kilometers.' }],
  'python programming': [{ title: 'Python Language', snippet: 'Python is a high-level, interpreted programming language known for its clear syntax and readability. Created by Guido van Rossum in 1991.' }],
  'machine learning': [{ title: 'Machine Learning', snippet: 'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.' }],
};

register(
  'search',
  'Search a knowledge base for information. Returns relevant results for the query.',
  {
    query: { type: 'string', description: 'The search query' },
  },
  ['query'],
  (args) => {
    const query = String(args.query).toLowerCase();
    const results: { title: string; snippet: string }[] = [];

    for (const [key, entries] of Object.entries(KNOWLEDGE_BASE)) {
      const keywords = key.split(' ');
      if (keywords.some((kw) => query.includes(kw))) {
        results.push(...entries);
      }
    }

    if (results.length === 0) {
      return JSON.stringify({ results: [], message: `No results found for "${args.query}"` });
    }
    return JSON.stringify({ results });
  }
);

// ── Weather ───────────────────────────────────────────────────

const WEATHER_DATA: Record<string, { temperature_f: number; temperature_c: number; conditions: string; humidity: number; wind_mph: number }> = {
  'new york': { temperature_f: 72, temperature_c: 22, conditions: 'Partly Cloudy', humidity: 55, wind_mph: 8 },
  'london': { temperature_f: 59, temperature_c: 15, conditions: 'Overcast', humidity: 78, wind_mph: 12 },
  'tokyo': { temperature_f: 77, temperature_c: 25, conditions: 'Sunny', humidity: 60, wind_mph: 5 },
  'paris': { temperature_f: 64, temperature_c: 18, conditions: 'Clear', humidity: 45, wind_mph: 7 },
  'sydney': { temperature_f: 68, temperature_c: 20, conditions: 'Sunny', humidity: 50, wind_mph: 10 },
  'berlin': { temperature_f: 55, temperature_c: 13, conditions: 'Rainy', humidity: 82, wind_mph: 15 },
  'rome': { temperature_f: 75, temperature_c: 24, conditions: 'Sunny', humidity: 40, wind_mph: 6 },
  'mumbai': { temperature_f: 88, temperature_c: 31, conditions: 'Humid', humidity: 85, wind_mph: 4 },
};

register(
  'weather',
  'Get the current weather for a city. Returns temperature, conditions, humidity, and wind speed.',
  {
    city: { type: 'string', description: 'The city name to get weather for' },
  },
  ['city'],
  (args) => {
    const city = String(args.city).toLowerCase().trim();
    const data = WEATHER_DATA[city];
    if (!data) {
      return JSON.stringify({ error: `Weather data not available for "${args.city}". Available cities: ${Object.keys(WEATHER_DATA).join(', ')}` });
    }
    return JSON.stringify({ city: args.city, ...data });
  }
);

// ── Grid Navigation: Move ─────────────────────────────────────

register(
  'move',
  'Move the agent one step in the specified direction on the grid. Returns the new position and whether the move was successful.',
  {
    direction: { type: 'string', description: 'Direction to move: "up", "down", "left", or "right"', enum: ['up', 'down', 'left', 'right'] },
  },
  ['direction'],
  (args, context) => {
    if (!context?.gridConfig || !context.agentPos) {
      return JSON.stringify({ error: 'No grid context available' });
    }

    const { gridConfig, agentPos } = context;
    const [row, col] = agentPos;
    const dir = String(args.direction).toLowerCase();

    const deltas: Record<string, [number, number]> = {
      up: [-1, 0],
      down: [1, 0],
      left: [0, -1],
      right: [0, 1],
    };

    const delta = deltas[dir];
    if (!delta) {
      return JSON.stringify({ success: false, message: `Invalid direction: "${dir}". Use up, down, left, or right.`, position: agentPos });
    }

    const newRow = row + delta[0];
    const newCol = col + delta[1];

    if (newRow < 0 || newRow >= gridConfig.height || newCol < 0 || newCol >= gridConfig.width) {
      return JSON.stringify({ success: false, message: 'Cannot move outside the grid boundary.', position: agentPos });
    }

    if (gridConfig.grid[newRow][newCol] === 'obstacle') {
      return JSON.stringify({ success: false, message: 'Cannot move into an obstacle.', position: agentPos });
    }

    context.agentPos = [newRow, newCol];
    context.stepCount = (context.stepCount ?? 0) + 1;
    context.visitedCells = context.visitedCells ?? new Set();
    context.visitedCells.add(`${newRow},${newCol}`);

    const reachedGoal = newRow === gridConfig.goalPos[0] && newCol === gridConfig.goalPos[1];
    if (reachedGoal) context.reachedGoal = true;

    return JSON.stringify({
      success: true,
      position: [newRow, newCol],
      reachedGoal,
      message: reachedGoal ? 'You have reached the goal!' : `Moved ${dir} to [${newRow}, ${newCol}].`,
    });
  }
);

// ── Grid Navigation: Look ─────────────────────────────────────

register(
  'look',
  'Look around the current position on the grid. Returns the contents of adjacent cells (up, down, left, right) and the current position.',
  {},
  [],
  (_args, context) => {
    if (!context?.gridConfig || !context.agentPos) {
      return JSON.stringify({ error: 'No grid context available' });
    }

    const { gridConfig, agentPos } = context;
    const [row, col] = agentPos;

    const cellAt = (r: number, c: number): string => {
      if (r < 0 || r >= gridConfig.height || c < 0 || c >= gridConfig.width) return 'boundary';
      return gridConfig.grid[r][c];
    };

    return JSON.stringify({
      position: [row, col],
      goalPosition: gridConfig.goalPos,
      surroundings: {
        up: cellAt(row - 1, col),
        down: cellAt(row + 1, col),
        left: cellAt(row, col - 1),
        right: cellAt(row, col + 1),
      },
      gridSize: [gridConfig.height, gridConfig.width],
    });
  }
);
