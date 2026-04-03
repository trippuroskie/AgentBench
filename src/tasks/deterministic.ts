import type { TaskDefinition, AgentStep } from '../types';
import {
  scoreNumericProximity,
  scoreToolUsage,
  toolCalledWith,
  toolResultContains,
  extractNumber,
} from '../agent/scorer';

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to tools. Use the available tools to answer the user's question accurately. When you have the final answer, respond with just the answer — no extra explanation unless asked.`;

// ── Milestone-based scoring helpers ──────────────────────────
// Each task awards partial credit across weighted milestones.
// Milestones: [weight, scoreFn] where scoreFn returns 0-1.
// Final score = sum(weight * scoreFn) / sum(weights), clamped to [0,1].

type Milestone = { weight: number; score: number };

function combineMilestones(milestones: Milestone[]): number {
  const totalWeight = milestones.reduce((s, m) => s + m.weight, 0);
  if (totalWeight === 0) return 0;
  const raw = milestones.reduce((s, m) => s + m.weight * m.score, 0) / totalWeight;
  return Math.max(0, Math.min(1, raw));
}

export function getDeterministicTasks(): TaskDefinition[] {
  return [
    // ── Multi-Step Math ────────────────────────────────────
    {
      id: 'math_multi_step',
      name: 'Multi-Step Math',
      type: 'deterministic',
      description: 'Solve a multi-step math problem using the calculator tool.',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: 'What is (23 * 17) + (45 / 9) - 12? Use the calculator tool to compute this step by step, then give me the final numeric answer.',
      tools: ['calculator'],
      maxSteps: 10,
      expectedAnswer: '384',
      scoringMethod: 'function_check',
      optimalToolCalls: 3, // (23*17), (45/9), then combine
      builtin: true,
      scoringFn: (answer: string, _ctx, steps: AgentStep[] = []) => {
        const num = extractNumber(answer);
        return combineMilestones([
          // Did the agent use the calculator at all?
          { weight: 0.2, score: scoreToolUsage(steps, ['calculator']) },
          // Did it compute intermediate sub-expressions?
          { weight: 0.2, score: Math.min(1, steps.filter(s => s.role === 'assistant' && s.toolCall?.function.name === 'calculator').length / 2) },
          // How close is the final answer? Full credit at exact, partial within ±50
          { weight: 0.6, score: scoreNumericProximity(num, 384, 50) },
        ]);
      },
    },

    // ── Fact Lookup ────────────────────────────────────────
    {
      id: 'fact_lookup',
      name: 'Fact Lookup',
      type: 'deterministic',
      description: 'Look up a fact using the search tool and report it accurately.',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: 'What is the capital of France? Use the search tool to find out.',
      tools: ['search'],
      maxSteps: 6,
      expectedAnswer: 'Paris',
      scoringMethod: 'function_check',
      optimalToolCalls: 1,
      builtin: true,
      scoringFn: (answer: string, _ctx, steps: AgentStep[] = []) => {
        const ansLower = answer.toLowerCase();
        return combineMilestones([
          // Used search tool
          { weight: 0.25, score: scoreToolUsage(steps, ['search']) },
          // Searched for something relevant (france/capital)
          { weight: 0.15, score: (toolCalledWith(steps, 'search', 'france') || toolCalledWith(steps, 'search', 'capital')) ? 1 : 0 },
          // Got relevant results back
          { weight: 0.1, score: toolResultContains(steps, 'paris') ? 1 : 0 },
          // Final answer contains Paris
          { weight: 0.5, score: ansLower.includes('paris') ? 1 : 0 },
        ]);
      },
    },

    // ── Multi-Tool: Weather + Search ──────────────────────
    {
      id: 'multi_tool_weather',
      name: 'Multi-Tool: Weather + Search',
      type: 'deterministic',
      description: 'Use multiple tools to gather information and synthesize an answer.',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: 'Search for the capital of Japan, then get the current weather there. What is the temperature in Fahrenheit?',
      tools: ['search', 'weather'],
      maxSteps: 10,
      expectedAnswer: '77',
      scoringMethod: 'function_check',
      optimalToolCalls: 2, // search Japan, weather Tokyo
      builtin: true,
      scoringFn: (answer: string, _ctx, steps: AgentStep[] = []) => {
        const num = extractNumber(answer);
        return combineMilestones([
          // Used search tool
          { weight: 0.15, score: scoreToolUsage(steps, ['search']) },
          // Used weather tool
          { weight: 0.15, score: scoreToolUsage(steps, ['weather']) },
          // Found Tokyo through search
          { weight: 0.1, score: toolResultContains(steps, 'tokyo') ? 1 : 0 },
          // Called weather for Tokyo specifically
          { weight: 0.1, score: toolCalledWith(steps, 'weather', 'tokyo') ? 1 : 0 },
          // Final answer numeric proximity (full credit at 77, partial within ±20)
          { weight: 0.5, score: scoreNumericProximity(num, 77, 20) },
        ]);
      },
    },

    // ── Unit Conversion Chain ─────────────────────────────
    {
      id: 'unit_conversion',
      name: 'Unit Conversion Chain',
      type: 'deterministic',
      description: 'Perform a chained calculation requiring multiple tool calls.',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: 'Convert 72 degrees Fahrenheit to Celsius using the formula (F - 32) * 5/9. Then calculate the square root of that Celsius value. Use the calculator for each step. Give me just the final number rounded to 2 decimal places.',
      tools: ['calculator'],
      maxSteps: 10,
      expectedAnswer: '4.71',
      scoringMethod: 'function_check',
      optimalToolCalls: 2, // F→C conversion, then sqrt
      builtin: true,
      scoringFn: (answer: string, _ctx, steps: AgentStep[] = []) => {
        const num = extractNumber(answer);
        // Check if intermediate Celsius value (~22.22) appeared in tool results
        const gotCelsius = steps.some(s => {
          if (s.role !== 'tool' || !s.toolResult) return false;
          const toolNum = extractNumber(s.toolResult);
          return Math.abs(toolNum - 22.222) < 0.5;
        });
        return combineMilestones([
          // Used calculator
          { weight: 0.15, score: scoreToolUsage(steps, ['calculator']) },
          // Made multiple calculator calls (chained computation)
          { weight: 0.1, score: Math.min(1, steps.filter(s => s.role === 'assistant' && s.toolCall?.function.name === 'calculator').length / 2) },
          // Got correct intermediate Celsius value
          { weight: 0.2, score: gotCelsius ? 1 : 0 },
          // Final answer proximity (exact=4.714, partial within ±2)
          { weight: 0.55, score: scoreNumericProximity(num, 4.714, 2) },
        ]);
      },
    },

    // ── Weather Comparison ────────────────────────────────
    {
      id: 'weather_comparison',
      name: 'Weather Comparison',
      type: 'deterministic',
      description: 'Compare weather across cities and determine which is warmest.',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: 'Get the current weather for New York, London, and Tokyo. Which city is the warmest? Just tell me the city name.',
      tools: ['weather'],
      maxSteps: 10,
      expectedAnswer: 'Tokyo',
      scoringMethod: 'function_check',
      optimalToolCalls: 3, // weather for each city
      builtin: true,
      scoringFn: (answer: string, _ctx, steps: AgentStep[] = []) => {
        const ansLower = answer.toLowerCase();
        // How many of the 3 required cities did the agent query?
        const cities = ['new york', 'london', 'tokyo'];
        const queriedCount = cities.filter(c => toolCalledWith(steps, 'weather', c)).length;
        return combineMilestones([
          // Used weather tool at all
          { weight: 0.1, score: scoreToolUsage(steps, ['weather']) },
          // Queried all 3 cities (partial credit for 1 or 2)
          { weight: 0.3, score: queriedCount / 3 },
          // Correct answer: Tokyo
          { weight: 0.6, score: ansLower.includes('tokyo') ? 1 : 0 },
        ]);
      },
    },
  ];
}
