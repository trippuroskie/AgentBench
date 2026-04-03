import type { AgentStep, TaskDefinition, TaskContext } from '../types';
import { OllamaService } from '../services/ollama';

// ── Deterministic Scoring ─────────────────────────────────────

export function scoreExactMatch(actual: string, expected: string): number {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  return normalize(actual) === normalize(expected) ? 1 : 0;
}

export function scoreContains(actual: string, expected: string): number {
  const normalActual = actual.toLowerCase().trim();
  const normalExpected = expected.toLowerCase().trim();
  return normalActual.includes(normalExpected) ? 1 : 0;
}

export function scoreNumericMatch(actual: string, expected: string, tolerance: number = 0.01): number {
  const actualNum = parseFloat(actual.replace(/[^0-9.\-]/g, ''));
  const expectedNum = parseFloat(expected.replace(/[^0-9.\-]/g, ''));
  if (isNaN(actualNum) || isNaN(expectedNum)) return 0;
  return Math.abs(actualNum - expectedNum) <= tolerance ? 1 : 0;
}

// ── Trajectory Scoring ────────────────────────────────────────

export function scoreTrajectory(actualSteps: number, optimalSteps: number, reachedGoal: boolean): number {
  if (!reachedGoal) return 0;
  if (actualSteps === 0 || optimalSteps === 0) return 0;
  return Math.min(1, optimalSteps / actualSteps);
}

// ── LLM-as-Judge ──────────────────────────────────────────────

const JUDGE_PROMPT = `You are an expert evaluator for AI agent performance. Score the agent's output on a scale of 1-5.

## Scoring Rubric
- 5: Perfect — completely correct, well-reasoned, efficient
- 4: Good — mostly correct with minor issues
- 3: Adequate — partially correct, achieves the core goal
- 2: Poor — significant errors or incomplete
- 1: Failed — completely wrong or did not attempt the task

## Task Description
{task}

## Agent's Final Answer
{answer}

## Agent's Tool Usage Trajectory
{trajectory}

## Instructions
Evaluate the agent's performance. Respond with ONLY valid JSON in this exact format:
{"score": <1-5>, "reasoning": "<brief explanation>"}`;

export async function scoreWithJudge(params: {
  taskDescription: string;
  steps: AgentStep[];
  finalAnswer: string;
  judgeModel: string;
  ollamaBaseUrl: string;
}): Promise<{ score: number; reasoning: string }> {
  const trajectory = params.steps
    .map((s) => {
      if (s.role === 'assistant' && s.toolCall) {
        return `[Step ${s.stepIndex}] Called tool: ${s.toolCall.function.name}(${s.toolCall.function.arguments})`;
      }
      if (s.role === 'tool') {
        return `[Step ${s.stepIndex}] Tool result: ${(s.toolResult || s.content || '').slice(0, 200)}`;
      }
      if (s.role === 'assistant' && s.content) {
        return `[Step ${s.stepIndex}] Assistant: ${s.content.slice(0, 200)}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n');

  const prompt = JUDGE_PROMPT
    .replace('{task}', params.taskDescription)
    .replace('{answer}', params.finalAnswer || '(no final answer)')
    .replace('{trajectory}', trajectory || '(no steps taken)');

  try {
    const ollama = new OllamaService(params.ollamaBaseUrl);
    const res = await ollama.chatCompletion(
      params.judgeModel,
      [{ role: 'user', content: prompt }],
      undefined,
      { temperature: 0 }
    );

    const text = res.message.content || '';
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return { score: 3, reasoning: 'Judge did not return valid JSON' };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Math.max(1, Math.min(5, Number(parsed.score) || 3)),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (e: any) {
    return { score: 0, reasoning: `Judge error: ${e.message}` };
  }
}

// ── Score a Run ───────────────────────────────────────────────

export async function scoreRun(
  task: TaskDefinition,
  finalAnswer: string,
  steps: AgentStep[],
  context: TaskContext,
  judgeConfig?: { model: string; ollamaBaseUrl: string }
): Promise<{ taskSuccess: number; trajectoryEfficiency?: number; judgeScore?: number; judgeReasoning?: string }> {
  let taskSuccess = 0;
  let trajectoryEfficiency: number | undefined;
  let judgeScore: number | undefined;
  let judgeReasoning: string | undefined;

  // Custom scoring function
  if (task.scoringFn) {
    taskSuccess = task.scoringFn(finalAnswer, context);
  }
  // Deterministic scoring
  else if (task.scoringMethod === 'exact_match' && task.expectedAnswer) {
    taskSuccess = scoreExactMatch(finalAnswer, task.expectedAnswer);
  } else if (task.scoringMethod === 'function_check' && task.expectedAnswer) {
    taskSuccess = scoreContains(finalAnswer, task.expectedAnswer);
  }
  // Trajectory scoring (visual tasks)
  else if (task.scoringMethod === 'trajectory') {
    const optimal = context.gridConfig?.optimalPathLength ?? 0;
    const actual = context.stepCount ?? 0;
    const reached = context.reachedGoal ?? false;
    taskSuccess = reached ? 1 : 0;
    trajectoryEfficiency = scoreTrajectory(actual, optimal, reached);
  }

  // LLM-as-judge (if configured)
  if (task.scoringMethod === 'llm_judge' && judgeConfig) {
    const judgeResult = await scoreWithJudge({
      taskDescription: `${task.name}: ${task.description}\n\nUser prompt: ${task.userPrompt}`,
      steps,
      finalAnswer,
      judgeModel: judgeConfig.model,
      ollamaBaseUrl: judgeConfig.ollamaBaseUrl,
    });
    judgeScore = judgeResult.score;
    judgeReasoning = judgeResult.reasoning;
    taskSuccess = (judgeScore - 1) / 4; // normalize 1-5 to 0-1
  }

  return { taskSuccess, trajectoryEfficiency, judgeScore, judgeReasoning };
}
