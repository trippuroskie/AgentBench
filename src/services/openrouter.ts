import type { ChatMessage, ToolDefinition, LLMService, LLMChatResponse, LLMServiceOptions } from '../types';

export class OpenRouterService implements LLMService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: LLMServiceOptions,
  ): Promise<LLMChatResponse> {
    const timeoutMs = options?.timeoutMs ?? 120_000;

    // OpenRouter uses OpenAI-compatible format — messages can pass through mostly as-is
    const body: any = {
      model,
      messages: messages.map((m) => {
        const msg: any = { role: m.role, content: m.content ?? '' };
        if (m.tool_calls?.length) {
          msg.tool_calls = m.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }));
        }
        if (m.tool_call_id) {
          msg.tool_call_id = m.tool_call_id;
        }
        return msg;
      }),
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }
    if (options?.temperature != null) body.temperature = options.temperature;
    if (options?.topP != null) body.top_p = options.topP;
    if (options?.seed != null) body.seed = options.seed;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'AgentBench',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice?.message) {
      throw new Error('No message in OpenRouter response');
    }

    const msg = choice.message;
    const message: ChatMessage = {
      role: 'assistant',
      content: msg.content ?? null,
    };

    if (msg.tool_calls?.length) {
      message.tool_calls = msg.tool_calls.map((tc: any) => ({
        id: tc.id || crypto.randomUUID(),
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments),
        },
      }));
    }

    const usage = data.usage ?? {};

    return {
      message,
      usage: {
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
      },
      model: data.model || model,
    };
  }

  async judgeResponse(params: {
    judgeModel: string;
    taskDescription: string;
    agentTrajectory: string;
    finalAnswer: string;
  }): Promise<{ score: number; reasoning: string }> {
    const prompt = `You are an expert evaluator for AI agent performance. Score the agent's output on a scale of 1-5.

## Scoring Rubric
- 5: Perfect — completely correct, well-reasoned, efficient
- 4: Good — mostly correct with minor issues
- 3: Adequate — partially correct, achieves the core goal
- 2: Poor — significant errors or incomplete
- 1: Failed — completely wrong or did not attempt the task

## Task Description
${params.taskDescription}

## Agent's Final Answer
${params.finalAnswer || '(no final answer)'}

## Agent's Tool Usage Trajectory
${params.agentTrajectory || '(no steps taken)'}

## Instructions
Evaluate the agent's performance. Respond with ONLY valid JSON:
{"score": <1-5>, "reasoning": "<brief explanation>"}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'AgentBench',
      },
      body: JSON.stringify({
        model: params.judgeModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(text);
      return {
        score: Math.max(1, Math.min(5, Number(parsed.score) || 3)),
        reasoning: String(parsed.reasoning || ''),
      };
    } catch {
      return { score: 3, reasoning: 'Failed to parse judge response' };
    }
  }
}
