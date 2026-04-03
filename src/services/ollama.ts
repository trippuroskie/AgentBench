import type { ChatMessage, ToolDefinition, ModelConfig } from '../types';
import { MODEL_COLORS, DEFAULT_OLLAMA_MODELS } from '../constants';

export interface OllamaChatResponse {
  message: ChatMessage;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  totalDurationNs?: number;
}

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelConfig[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
    const data = await res.json();

    return (data.models || []).map((m: any, i: number) => {
      const id = m.name as string;
      const baseName = id.split(':')[0];
      const defaults = DEFAULT_OLLAMA_MODELS[baseName];

      return {
        id,
        name: defaults?.name || baseName,
        provider: 'ollama' as const,
        family: defaults?.family || m.details?.family || baseName,
        paramsB: defaults?.paramsB || parseParamSize(m.details?.parameter_size),
        color: defaults?.color || MODEL_COLORS[i % MODEL_COLORS.length],
        inputPrice: 0,
        outputPrice: 0,
      };
    });
  }

  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: { temperature?: number; timeoutMs?: number }
  ): Promise<OllamaChatResponse> {
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: any = {
        model,
        messages,
        stream: false,
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      if (options?.temperature != null) {
        body.options = { temperature: options.temperature };
      }

      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ollama API error ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No response choice from Ollama');
      }

      const message: ChatMessage = {
        role: 'assistant',
        content: choice.message?.content ?? null,
      };

      if (choice.message?.tool_calls?.length) {
        message.tool_calls = choice.message.tool_calls.map((tc: any) => ({
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

      return {
        message,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens ?? 0,
          completion_tokens: data.usage?.completion_tokens ?? 0,
          total_tokens: data.usage?.total_tokens ?? 0,
        },
        model: data.model || model,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Ollama request timed out (${timeoutMs / 1000}s)`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function parseParamSize(size?: string): number | undefined {
  if (!size) return undefined;
  const match = size.match(/([\d.]+)\s*[Bb]/);
  return match ? parseFloat(match[1]) : undefined;
}
