import type { LangfuseConfig } from '../types';

export class LangfuseClient {
  private host: string;
  private publicKey: string;
  private secretKey: string;
  private enabled: boolean;

  constructor(config: LangfuseConfig) {
    this.host = config.host.replace(/\/$/, '');
    this.publicKey = config.publicKey;
    this.secretKey = config.secretKey;
    this.enabled = config.enabled && !!config.publicKey && !!config.secretKey;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async createTrace(params: {
    id: string;
    name: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.ingest([{
      type: 'trace-create',
      body: {
        id: params.id,
        name: params.name,
        metadata: params.metadata,
        timestamp: new Date().toISOString(),
      },
    }]);
  }

  async createGeneration(params: {
    traceId: string;
    id: string;
    name: string;
    model: string;
    input: any;
    output: any;
    usage: { input: number; output: number; total: number };
    startTime: string;
    endTime: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.ingest([{
      type: 'generation-create',
      body: {
        traceId: params.traceId,
        id: params.id,
        name: params.name,
        model: params.model,
        input: params.input,
        output: params.output,
        usage: {
          input: params.usage.input,
          output: params.usage.output,
          total: params.usage.total,
        },
        startTime: params.startTime,
        endTime: params.endTime,
        metadata: params.metadata,
      },
    }]);
  }

  async createSpan(params: {
    traceId: string;
    id: string;
    name: string;
    startTime: string;
    endTime?: string;
    input?: any;
    output?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.ingest([{
      type: 'span-create',
      body: {
        traceId: params.traceId,
        id: params.id,
        name: params.name,
        startTime: params.startTime,
        endTime: params.endTime,
        input: params.input,
        output: params.output,
        metadata: params.metadata,
      },
    }]);
  }

  async createScore(params: {
    traceId: string;
    name: string;
    value: number;
    comment?: string;
  }): Promise<void> {
    if (!this.enabled) return;

    try {
      await fetch(`${this.host}/api/public/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${this.publicKey}:${this.secretKey}`)}`,
        },
        body: JSON.stringify({
          traceId: params.traceId,
          name: params.name,
          value: params.value,
          comment: params.comment,
          dataType: 'NUMERIC',
        }),
      });
    } catch (e) {
      console.warn('Langfuse score error:', e);
    }
  }

  private async ingest(events: { type: string; body: Record<string, any> }[]): Promise<void> {
    if (!this.enabled) return;

    try {
      await fetch(`${this.host}/api/public/ingestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${this.publicKey}:${this.secretKey}`)}`,
        },
        body: JSON.stringify({
          batch: events.map((e) => ({
            id: crypto.randomUUID(),
            type: e.type,
            timestamp: new Date().toISOString(),
            body: e.body,
          })),
        }),
      });
    } catch (e) {
      console.warn('Langfuse ingestion error:', e);
    }
  }
}
