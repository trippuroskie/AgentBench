export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
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
