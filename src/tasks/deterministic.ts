import type { TaskDefinition } from '../types';

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to tools. Use the available tools to answer the user's question accurately. When you have the final answer, respond with just the answer — no extra explanation unless asked.`;

export function getDeterministicTasks(): TaskDefinition[] {
  return [
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
      builtin: true,
      scoringFn: (answer) => {
        const num = parseFloat(answer.replace(/[^0-9.\-]/g, ''));
        return Math.abs(num - 384) < 0.01 ? 1 : 0;
      },
    },
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
      builtin: true,
      scoringFn: (answer) => answer.toLowerCase().includes('paris') ? 1 : 0,
    },
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
      builtin: true,
      scoringFn: (answer) => {
        const num = parseFloat(answer.replace(/[^0-9.\-]/g, ''));
        return Math.abs(num - 77) < 1 ? 1 : answer.toLowerCase().includes('77') ? 1 : 0;
      },
    },
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
      builtin: true,
      scoringFn: (answer) => {
        // 72F = 22.22C, sqrt(22.22) ≈ 4.71
        const num = parseFloat(answer.replace(/[^0-9.\-]/g, ''));
        return Math.abs(num - 4.714) < 0.1 ? 1 : 0;
      },
    },
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
      builtin: true,
      scoringFn: (answer) => answer.toLowerCase().includes('tokyo') ? 1 : 0,
    },
  ];
}
