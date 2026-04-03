import type { ModelConfig, AppSettings } from './types';

// ── Model Colors (Tailwind classes) ───────────────────────────

export const MODEL_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-lime-100 text-lime-700 border-lime-200',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
];

export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#6366f1', '#84cc16', '#d946ef',
];

// ── Default Ollama Models ─────────────────────────────────────

export const DEFAULT_OLLAMA_MODELS: Record<string, Omit<ModelConfig, 'id'>> = {
  'llama3.2': {
    name: 'Llama 3.2 3B',
    provider: 'ollama',
    family: 'llama',
    paramsB: 3,
    color: MODEL_COLORS[0],
    inputPrice: 0,
    outputPrice: 0,
  },
  'llama3.1': {
    name: 'Llama 3.1 8B',
    provider: 'ollama',
    family: 'llama',
    paramsB: 8,
    color: MODEL_COLORS[1],
    inputPrice: 0,
    outputPrice: 0,
  },
  'qwen3': {
    name: 'Qwen 3',
    provider: 'ollama',
    family: 'qwen',
    paramsB: 8,
    color: MODEL_COLORS[2],
    inputPrice: 0,
    outputPrice: 0,
  },
  'gemma4': {
    name: 'Gemma 4',
    provider: 'ollama',
    family: 'gemma',
    paramsB: 27,
    color: MODEL_COLORS[3],
    inputPrice: 0,
    outputPrice: 0,
  },
  'mistral': {
    name: 'Mistral 7B',
    provider: 'ollama',
    family: 'mistral',
    paramsB: 7,
    color: MODEL_COLORS[4],
    inputPrice: 0,
    outputPrice: 0,
  },
  'phi3': {
    name: 'Phi-3 3.8B',
    provider: 'ollama',
    family: 'phi',
    paramsB: 3.8,
    color: MODEL_COLORS[5],
    inputPrice: 0,
    outputPrice: 0,
  },
};

// ── Metric Configuration ──────────────────────────────────────

export interface MetricConfig {
  label: string;
  key: string;
  higherBetter: boolean;
  format: (v: number) => string;
  unit?: string;
}

export const METRIC_CONFIGS: Record<string, MetricConfig> = {
  taskSuccess: {
    label: 'Task Success',
    key: 'taskSuccess',
    higherBetter: true,
    format: (v) => `${Math.round(v * 100)}%`,
    unit: '%',
  },
  tokensPerSecond: {
    label: 'Tokens/sec',
    key: 'tokensPerSecond',
    higherBetter: true,
    format: (v) => `${v.toFixed(1)} t/s`,
    unit: 't/s',
  },
  wallClockMs: {
    label: 'Duration',
    key: 'wallClockMs',
    higherBetter: false,
    format: (v) => v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(1)}s`,
    unit: 'ms',
  },
  tokensTotal: {
    label: 'Total Tokens',
    key: 'tokensTotal',
    higherBetter: false,
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`,
  },
  toolCallsCount: {
    label: 'Tool Calls',
    key: 'toolCallsCount',
    higherBetter: false,
    format: (v) => `${Math.round(v)}`,
  },
  toolEfficiency: {
    label: 'Tool Efficiency',
    key: 'toolEfficiency',
    higherBetter: true,
    format: (v) => `${Math.round(v * 100)}%`,
    unit: '%',
  },
  trajectoryEfficiency: {
    label: 'Trajectory',
    key: 'trajectoryEfficiency',
    higherBetter: true,
    format: (v) => `${Math.round(v * 100)}%`,
    unit: '%',
  },
  costEstimateUsd: {
    label: 'Cost',
    key: 'costEstimateUsd',
    higherBetter: false,
    format: (v) => v === 0 ? 'Free' : `$${v.toFixed(5)}`,
    unit: '$',
  },
  judgeScore: {
    label: 'Judge Score',
    key: 'judgeScore',
    higherBetter: true,
    format: (v) => `${v.toFixed(1)}/5`,
  },
};

// ── Limits ────────────────────────────────────────────────────

export const DEFAULT_MAX_STEPS = 15;
export const AGENT_TIMEOUT_MS = 120_000;
export const CONCURRENCY_LIMIT = 1;

// ── Default Settings ──────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  langfuse: {
    enabled: false,
    host: process.env.LANGFUSE_HOST || 'http://localhost:3000',
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
    secretKey: process.env.LANGFUSE_SECRET_KEY || '',
  },
  defaultMaxSteps: DEFAULT_MAX_STEPS,
  judgeProvider: 'ollama',
  judgeModel: 'llama3.1',
};
