import type { ChatMessage, ToolDefinition, ModelConfig, LLMService, LLMChatResponse, LLMServiceOptions } from '../types';
import { MODEL_COLORS, DEFAULT_OLLAMA_MODELS } from '../constants';

export interface OllamaChatResponse extends LLMChatResponse {
  totalDurationNs?: number;
}

export class OllamaService implements LLMService {
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

  /**
   * Pull a model from the Ollama registry. Streams progress via callback.
   * Returns true if successful.
   */
  async pullModel(
    name: string,
    onProgress?: (status: string, completed?: number, total?: number) => void,
  ): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Pull failed: ${res.status} ${errorText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.error) throw new Error(data.error);
          onProgress?.(data.status || '', data.completed, data.total);
        } catch (e: any) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }
    }

    return true;
  }

  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: LLMServiceOptions,
  ): Promise<OllamaChatResponse> {
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Transform messages to Ollama native format:
      // - content: null → content: ""
      // - tool_calls: arguments must be object, not JSON string; strip id/type
      // - tool messages: strip tool_call_id
      const nativeMessages = messages.map((m) => {
        const msg: any = { role: m.role, content: m.content ?? '' };

        if (m.tool_calls?.length) {
          msg.tool_calls = m.tool_calls.map((tc) => ({
            function: {
              name: tc.function.name,
              arguments: typeof tc.function.arguments === 'string'
                ? safeJsonParse(tc.function.arguments)
                : tc.function.arguments,
            },
          }));
        }

        // Don't send tool_call_id to native API
        return msg;
      });

      const body: any = {
        model,
        messages: nativeMessages,
        stream: false,
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      const ollamaOpts: Record<string, any> = {};
      if (options?.temperature != null) ollamaOpts.temperature = options.temperature;
      if (options?.topP != null) ollamaOpts.top_p = options.topP;
      if (options?.topK != null) ollamaOpts.top_k = options.topK;
      if (options?.repeatPenalty != null) ollamaOpts.repeat_penalty = options.repeatPenalty;
      if (options?.seed != null) ollamaOpts.seed = options.seed;
      if (Object.keys(ollamaOpts).length > 0) {
        body.options = ollamaOpts;
      }

      // Use Ollama's native /api/chat endpoint (more reliable than OpenAI compat layer)
      const res = await fetch(`${this.baseUrl}/api/chat`, {
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

      // Native Ollama /api/chat response format
      const msg = data.message;
      if (!msg) {
        throw new Error('No message in Ollama response');
      }

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

      // Ollama native API returns tokens differently
      const promptTokens = data.prompt_eval_count ?? 0;
      const completionTokens = data.eval_count ?? 0;

      return {
        message,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
        model: data.model || model,
        totalDurationNs: data.total_duration,
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

function safeJsonParse(str: string): Record<string, any> {
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}
