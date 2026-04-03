import type { ChatMessage, AgentStep, BenchmarkRun, RunMetrics, TaskDefinition, TaskContext, LLMService, ModelParams } from '../types';
import { getToolDefinitions, executeTool } from './tools';
import { scoreRun } from './scorer';

export interface AgentRunOptions {
  model: string;
  task: TaskDefinition;
  llmService: LLMService;
  onStep?: (step: AgentStep, context?: TaskContext) => void;
  abortSignal?: AbortSignal;
  judgeConfig?: { model: string; ollamaBaseUrl: string };
  modelConfig?: { inputPrice: number; outputPrice: number };
  modelParams?: ModelParams;
}

export async function runAgent(options: AgentRunOptions): Promise<BenchmarkRun> {
  const { model, task, llmService, onStep, abortSignal, judgeConfig, modelConfig, modelParams } = options;
  const runId = crypto.randomUUID();
  const runStart = performance.now();

  // Build initial messages
  const messages: ChatMessage[] = [
    { role: 'system', content: task.systemPrompt },
    { role: 'user', content: task.userPrompt },
  ];

  // Get tool definitions
  const toolDefs = task.tools.length > 0 ? getToolDefinitions(task.tools) : undefined;

  // Initialize task context
  const context: TaskContext = {};
  if (task.type === 'visual' && task.configJson) {
    context.gridConfig = task.configJson;
    context.agentPos = [...task.configJson.startPos] as [number, number];
    context.visitedCells = new Set([`${task.configJson.startPos[0]},${task.configJson.startPos[1]}`]);
    context.stepCount = 0;
    context.reachedGoal = false;
  }

  const steps: AgentStep[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let stepIndex = 0;
  let done = false;
  let error: string | undefined;

  try {
    let llmCalls = 0;
    let lastToolSig = '';
    let repeatedToolCalls = 0;

    const TIMEOUT_MS = 120_000; // 2 minute hard timeout per run

    while (!done && llmCalls < task.maxSteps) {
      if (abortSignal?.aborted) {
        return buildRun(runId, task, model, 'cancelled', runStart, steps, totalInputTokens, totalOutputTokens, context, undefined);
      }

      // Hard timeout
      if (performance.now() - runStart > TIMEOUT_MS) {
        console.warn(`Agent timed out after ${TIMEOUT_MS / 1000}s`);
        break;
      }

      const stepStart = performance.now();

      // Call LLM
      const response = await llmService.chatCompletion(model, messages, toolDefs, {
        temperature: modelParams?.temperature,
        topP: modelParams?.topP,
        topK: modelParams?.topK,
        repeatPenalty: modelParams?.repeatPenalty,
        seed: modelParams?.seed,
        timeoutMs: TIMEOUT_MS,
      });

      const assistantMsg = response.message;
      messages.push(assistantMsg);
      llmCalls++;

      totalInputTokens += response.usage.prompt_tokens;
      totalOutputTokens += response.usage.completion_tokens;

      // Record assistant step
      const assistantStep: AgentStep = {
        stepIndex: stepIndex++,
        role: 'assistant',
        content: assistantMsg.content,
        toolCall: assistantMsg.tool_calls?.[0],
        tokensInput: response.usage.prompt_tokens,
        tokensOutput: response.usage.completion_tokens,
        durationMs: performance.now() - stepStart,
        timestamp: Date.now(),
      };
      steps.push(assistantStep);
      onStep?.(assistantStep, context);

      // Handle tool calls
      const hasToolCalls = assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0;

      if (hasToolCalls) {
        // Detect if the model is stuck repeating the same tool call
        const toolSig = assistantMsg.tool_calls!.map(
          (tc) => `${tc.function.name}:${tc.function.arguments}`
        ).join('|');
        if (toolSig === lastToolSig) {
          repeatedToolCalls++;
          if (repeatedToolCalls >= 2) {
            console.warn('Agent stuck in loop — same tool call repeated 3 times. Stopping.');
            done = true;
            break;
          }
        } else {
          repeatedToolCalls = 0;
          lastToolSig = toolSig;
        }

        for (const tc of assistantMsg.tool_calls!) {
          const toolStart = performance.now();
          const { result, durationMs } = await executeTool(tc.function.name, tc.function.arguments, context);

          // Add tool result message
          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          });

          // Record tool step
          const toolStep: AgentStep = {
            stepIndex: stepIndex++,
            role: 'tool',
            content: result,
            toolResult: result,
            durationMs: durationMs || (performance.now() - toolStart),
            timestamp: Date.now(),
          };
          steps.push(toolStep);
          onStep?.(toolStep, context);

          // Check if goal reached (for visual tasks)
          if (context.reachedGoal) {
            done = true;
            break;
          }
        }
      } else {
        // No tool calls = agent gave its final answer, we're done
        done = true;
      }
    }
  } catch (e: any) {
    error = e.message;
    return buildRun(runId, task, model, 'failed', runStart, steps, totalInputTokens, totalOutputTokens, context, error);
  }

  // Score the run
  const finalAnswer = steps
    .filter((s) => s.role === 'assistant' && s.content)
    .pop()?.content || '';

  const scoring = await scoreRun(task, finalAnswer, steps, context, judgeConfig);

  // Build metrics
  const wallClockMs = performance.now() - runStart;
  const toolCallTypes: Record<string, number> = {};
  for (const s of steps) {
    if (s.role === 'assistant' && s.toolCall) {
      const name = s.toolCall.function.name;
      toolCallTypes[name] = (toolCallTypes[name] || 0) + 1;
    }
  }

  const metrics: RunMetrics = {
    tokensInput: totalInputTokens,
    tokensOutput: totalOutputTokens,
    tokensTotal: totalInputTokens + totalOutputTokens,
    tokensPerSecond: totalOutputTokens > 0 ? totalOutputTokens / (wallClockMs / 1000) : 0,
    toolCallsCount: Object.values(toolCallTypes).reduce((a, b) => a + b, 0),
    toolCallTypes,
    wallClockMs,
    taskSuccess: scoring.taskSuccess,
    costEstimateUsd: modelConfig
      ? (totalInputTokens * modelConfig.inputPrice) + (totalOutputTokens * modelConfig.outputPrice)
      : 0,
    toolEfficiency: scoring.toolEfficiency,
    trajectoryEfficiency: scoring.trajectoryEfficiency,
    judgeScore: scoring.judgeScore,
    judgeReasoning: scoring.judgeReasoning,
  };

  return {
    id: runId,
    taskId: task.id,
    modelId: model,
    status: 'completed',
    timestamp: Date.now(),
    metrics,
    steps,
    finalAnswer,
  };
}

function buildRun(
  id: string,
  task: TaskDefinition,
  model: string,
  status: BenchmarkRun['status'],
  runStart: number,
  steps: AgentStep[],
  tokensIn: number,
  tokensOut: number,
  context: TaskContext,
  error?: string,
): BenchmarkRun {
  const wallClockMs = performance.now() - runStart;
  return {
    id,
    taskId: task.id,
    modelId: model,
    status,
    timestamp: Date.now(),
    steps,
    error,
    finalAnswer: steps.filter((s) => s.role === 'assistant' && s.content).pop()?.content || undefined,
    metrics: {
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
      tokensTotal: tokensIn + tokensOut,
      tokensPerSecond: tokensOut > 0 ? tokensOut / (wallClockMs / 1000) : 0,
      toolCallsCount: steps.filter((s) => s.role === 'assistant' && s.toolCall).length,
      toolCallTypes: {},
      wallClockMs,
      taskSuccess: 0,
      costEstimateUsd: 0,
    },
  };
}
