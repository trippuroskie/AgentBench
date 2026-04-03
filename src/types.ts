// ── View Routing ──────────────────────────────────────────────

export type ViewState =
  | 'dashboard'
  | 'benchmark'
  | 'results'
  | 'leaderboard'
  | 'compare'
  | 'tasks'
  | 'models'
  | 'tools'
  | 'settings';

// ── Model System ──────────────────────────────────────────────

export type ModelProvider = 'ollama' | 'openrouter';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  family?: string;
  paramsB?: number;
  color: string;
  inputPrice: number;   // cost per token
  outputPrice: number;  // cost per token
}

// ── Tool System ───────────────────────────────────────────────

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string from LLM
  };
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  durationMs: number;
}

export type ToolExecutor = (
  args: Record<string, any>,
  context?: TaskContext
) => string | Promise<string>;

export interface RegisteredTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

// ── Message Types (OpenAI-compatible) ─────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// ── Task System ───────────────────────────────────────────────

export type TaskType = 'deterministic' | 'open_ended' | 'visual';
export type ScoringMethod = 'exact_match' | 'json_compare' | 'function_check' | 'llm_judge' | 'trajectory';

export interface TaskDefinition {
  id: string;
  name: string;
  type: TaskType;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  tools: string[];       // tool names from registry
  maxSteps: number;
  expectedAnswer?: string;
  scoringMethod: ScoringMethod;
  scoringFn?: (answer: string, context?: TaskContext, steps?: AgentStep[]) => number;
  optimalToolCalls?: number; // minimum tool calls needed for a perfect solution
  configJson?: any;
  builtin?: boolean;
}

// ── Grid Navigation ───────────────────────────────────────────

export type CellType = 'empty' | 'start' | 'goal' | 'obstacle';

export interface GridConfig {
  width: number;
  height: number;
  grid: CellType[][];
  startPos: [number, number]; // [row, col]
  goalPos: [number, number];
  optimalPathLength: number;
}

// ── Task Context (mutable state for visual tasks) ─────────────

export interface TaskContext {
  gridConfig?: GridConfig;
  agentPos?: [number, number];
  visitedCells?: Set<string>;
  stepCount?: number;
  reachedGoal?: boolean;
  [key: string]: any;
}

// ── Agent Execution ───────────────────────────────────────────

export interface AgentStep {
  stepIndex: number;
  role: 'assistant' | 'tool';
  content: string | null;
  toolCall?: ToolCall;
  toolResult?: string;
  tokensInput?: number;
  tokensOutput?: number;
  durationMs: number;
  timestamp: number;
}

export interface RunMetrics {
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  tokensPerSecond: number;
  toolCallsCount: number;
  toolCallTypes: Record<string, number>;
  wallClockMs: number;
  taskSuccess: number;          // 0-1
  costEstimateUsd: number;
  toolEfficiency?: number;       // optimal/actual tool calls (0-1)
  trajectoryEfficiency?: number; // optimal/actual (0-1)
  judgeScore?: number;           // 1-5
  judgeReasoning?: string;
}

export interface BenchmarkRun {
  id: string;
  taskId: string;
  modelId: string;
  benchmarkId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  timestamp: number;
  metrics?: RunMetrics;
  steps: AgentStep[];
  finalAnswer?: string;
  error?: string;
}

export interface Benchmark {
  id: string;
  name: string;
  timestamp: number;
  taskIds: string[];
  modelIds: string[];
  status: 'running' | 'completed' | 'cancelled';
}

// ── Live Monitor ──────────────────────────────────────────────

export interface LiveRunState {
  runId: string;
  modelId: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  steps: AgentStep[];
  tokensIn: number;
  tokensOut: number;
  toolCalls: number;
  startTime: number;
  elapsedMs: number;
  gridState?: {
    agentPos: [number, number];
    visitedCells: string[];
  };
  result?: BenchmarkRun;
}

export interface QueueItem {
  taskId: string;
  modelId: string;
  iteration: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ── Progress ──────────────────────────────────────────────────

export interface BenchmarkProgress {
  isRunning: boolean;
  current: number;
  total: number;
  message: string;
  queue: QueueItem[];
  currentModel?: string;
  currentTask?: string;
}

// ── Langfuse ──────────────────────────────────────────────────

export interface LangfuseConfig {
  enabled: boolean;
  host: string;
  publicKey: string;
  secretKey: string;
}

// ── Settings ──────────────────────────────────────────────────

export interface AppSettings {
  ollamaBaseUrl: string;
  openrouterApiKey: string;
  langfuse: LangfuseConfig;
  defaultMaxSteps: number;
  judgeProvider: 'ollama' | 'openrouter';
  judgeModel: string;
}
