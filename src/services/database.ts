import initSqlJs, { type Database } from 'sql.js';
import type { ModelConfig, TaskDefinition, BenchmarkRun, RunMetrics, AgentStep, Benchmark } from '../types';

const DB_STORAGE_KEY = 'agentbench_db';
const DB_VERSION = 1;

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

// ── Schema ────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'ollama',
    params_b REAL,
    family TEXT,
    input_price REAL DEFAULT 0,
    output_price REAL DEFAULT 0,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT,
    user_prompt TEXT,
    tools TEXT,
    max_steps INTEGER DEFAULT 15,
    expected_answer TEXT,
    scoring_method TEXT,
    config_json TEXT,
    builtin INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS benchmarks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    task_ids TEXT,
    model_ids TEXT,
    status TEXT DEFAULT 'running'
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    benchmark_id TEXT,
    timestamp INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    final_answer TEXT,
    error TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
  );

  CREATE TABLE IF NOT EXISTS run_metrics (
    run_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    PRIMARY KEY (run_id, metric_name),
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );

  CREATE TABLE IF NOT EXISTS run_steps (
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_call_json TEXT,
    tool_result TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    duration_ms INTEGER,
    timestamp INTEGER,
    PRIMARY KEY (run_id, step_index),
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );
`;

// ── IndexedDB persistence ─────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AgentBenchDB', 1);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains('data')) {
        idb.createObjectStore('data');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadDbBytes(): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction('data', 'readonly');
      const store = tx.objectStore('data');
      const req = store.get(DB_STORAGE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function saveDbBytes(data: Uint8Array): Promise<void> {
  try {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction('data', 'readwrite');
      const store = tx.objectStore('data');
      const req = store.put(data, DB_STORAGE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to persist DB to IndexedDB:', e);
  }
}

// ── Init ──────────────────────────────────────────────────────

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });

    const saved = await loadDbBytes();
    if (saved) {
      db = new SQL.Database(saved);
    } else {
      db = new SQL.Database();
      db.run(SCHEMA);
      db.run(`INSERT OR IGNORE INTO meta (key, value) VALUES ('version', '${DB_VERSION}')`);
    }

    return db;
  })();

  return initPromise;
}

function getDb(): Database | null {
  return db;
}

function requireDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

async function persist(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await saveDbBytes(data);
}

// ── Models ────────────────────────────────────────────────────

export function saveModel(model: ModelConfig): void {
  const d = getDb();
  if (!d) return;
  d.run(
    `INSERT OR REPLACE INTO models (id, name, provider, params_b, family, input_price, output_price, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [model.id, model.name, model.provider, model.paramsB ?? null, model.family ?? null, model.inputPrice, model.outputPrice, model.color]
  );
  persist();
}

export function getModels(): ModelConfig[] {
  const d = getDb();
  if (!d) return [];
  const rows = d.exec('SELECT * FROM models');
  if (!rows.length) return [];
  return rows[0].values.map((r) => ({
    id: r[0] as string,
    name: r[1] as string,
    provider: r[2] as 'ollama' | 'openrouter',
    paramsB: r[3] as number | undefined,
    family: r[4] as string | undefined,
    inputPrice: r[5] as number,
    outputPrice: r[6] as number,
    color: r[7] as string,
  }));
}

export function deleteModel(id: string): void {
  const d = getDb();
  if (!d) return;
  d.run('DELETE FROM models WHERE id = ?', [id]);
  persist();
}

// ── Tasks ─────────────────────────────────────────────────────

export function saveTask(task: TaskDefinition): void {
  const d = getDb();
  if (!d) return;
  d.run(
    `INSERT OR REPLACE INTO tasks (id, name, type, description, system_prompt, user_prompt, tools, max_steps, expected_answer, scoring_method, config_json, builtin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.name, task.type, task.description, task.systemPrompt, task.userPrompt,
     JSON.stringify(task.tools), task.maxSteps, task.expectedAnswer ?? null, task.scoringMethod,
     task.configJson ? JSON.stringify(task.configJson) : null, task.builtin ? 1 : 0]
  );
  persist();
}

export function getTasks(): TaskDefinition[] {
  const d = getDb();
  if (!d) return [];
  const rows = d.exec('SELECT * FROM tasks');
  if (!rows.length) return [];
  return rows[0].values.map((r) => ({
    id: r[0] as string,
    name: r[1] as string,
    type: r[2] as TaskDefinition['type'],
    description: r[3] as string,
    systemPrompt: r[4] as string,
    userPrompt: r[5] as string,
    tools: JSON.parse(r[6] as string),
    maxSteps: r[7] as number,
    expectedAnswer: r[8] as string | undefined,
    scoringMethod: r[9] as TaskDefinition['scoringMethod'],
    configJson: r[10] ? JSON.parse(r[10] as string) : undefined,
    builtin: r[11] === 1,
  }));
}

// ── Runs ──────────────────────────────────────────────────────

export function saveRun(run: BenchmarkRun): void {
  const d = getDb();
  if (!d) return;
  d.run(
    `INSERT OR REPLACE INTO runs (id, task_id, model_id, benchmark_id, timestamp, status, final_answer, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [run.id, run.taskId, run.modelId, run.benchmarkId ?? null, run.timestamp, run.status,
     run.finalAnswer ?? null, run.error ?? null]
  );

  if (run.metrics) {
    saveRunMetrics(run.id, run.metrics);
  }

  if (run.steps.length > 0) {
    saveRunSteps(run.id, run.steps);
  }

  persist();
}

export function getRuns(filters?: { taskId?: string; modelId?: string; benchmarkId?: string; limit?: number }): BenchmarkRun[] {
  let query = 'SELECT * FROM runs WHERE 1=1';
  const params: any[] = [];

  if (filters?.taskId) { query += ' AND task_id = ?'; params.push(filters.taskId); }
  if (filters?.modelId) { query += ' AND model_id = ?'; params.push(filters.modelId); }
  if (filters?.benchmarkId) { query += ' AND benchmark_id = ?'; params.push(filters.benchmarkId); }

  query += ' ORDER BY timestamp DESC';
  if (filters?.limit) { query += ` LIMIT ${filters.limit}`; }

  const d = getDb();
  if (!d) return [];
  const rows = d.exec(query, params);
  if (!rows.length) return [];

  return rows[0].values.map((r) => {
    const runId = r[0] as string;
    return {
      id: runId,
      taskId: r[1] as string,
      modelId: r[2] as string,
      benchmarkId: r[3] as string | undefined,
      timestamp: r[4] as number,
      status: r[5] as BenchmarkRun['status'],
      finalAnswer: r[6] as string | undefined,
      error: r[7] as string | undefined,
      metrics: getRunMetrics(runId),
      steps: [], // loaded on demand via getRunSteps
    };
  });
}

// ── Run Metrics ───────────────────────────────────────────────

function saveRunMetrics(runId: string, metrics: RunMetrics): void {
  const d = getDb();
  if (!d) return;
  d.run('DELETE FROM run_metrics WHERE run_id = ?', [runId]);

  const entries: [string, number][] = [
    ['tokensInput', metrics.tokensInput],
    ['tokensOutput', metrics.tokensOutput],
    ['tokensTotal', metrics.tokensTotal],
    ['tokensPerSecond', metrics.tokensPerSecond],
    ['toolCallsCount', metrics.toolCallsCount],
    ['wallClockMs', metrics.wallClockMs],
    ['taskSuccess', metrics.taskSuccess],
    ['costEstimateUsd', metrics.costEstimateUsd],
  ];

  if (metrics.toolEfficiency != null) entries.push(['toolEfficiency', metrics.toolEfficiency]);
  if (metrics.trajectoryEfficiency != null) entries.push(['trajectoryEfficiency', metrics.trajectoryEfficiency]);
  if (metrics.judgeScore != null) entries.push(['judgeScore', metrics.judgeScore]);

  for (const [name, value] of entries) {
    d.run('INSERT INTO run_metrics (run_id, metric_name, metric_value) VALUES (?, ?, ?)', [runId, name, value]);
  }
}

function getRunMetrics(runId: string): RunMetrics | undefined {
  const d = getDb();
  if (!d) return undefined;
  const rows = d.exec('SELECT metric_name, metric_value FROM run_metrics WHERE run_id = ?', [runId]);
  if (!rows.length || rows[0].values.length === 0) return undefined;

  const map: Record<string, number> = {};
  for (const r of rows[0].values) {
    map[r[0] as string] = r[1] as number;
  }

  return {
    tokensInput: map.tokensInput ?? 0,
    tokensOutput: map.tokensOutput ?? 0,
    tokensTotal: map.tokensTotal ?? 0,
    tokensPerSecond: map.tokensPerSecond ?? 0,
    toolCallsCount: map.toolCallsCount ?? 0,
    toolCallTypes: {},
    wallClockMs: map.wallClockMs ?? 0,
    taskSuccess: map.taskSuccess ?? 0,
    costEstimateUsd: map.costEstimateUsd ?? 0,
    trajectoryEfficiency: map.trajectoryEfficiency,
    judgeScore: map.judgeScore,
  };
}

// ── Run Steps ─────────────────────────────────────────────────

function saveRunSteps(runId: string, steps: AgentStep[]): void {
  const d = getDb();
  if (!d) return;
  d.run('DELETE FROM run_steps WHERE run_id = ?', [runId]);

  for (const step of steps) {
    d.run(
      `INSERT INTO run_steps (run_id, step_index, role, content, tool_call_json, tool_result, tokens_input, tokens_output, duration_ms, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [runId, step.stepIndex, step.role, step.content,
       step.toolCall ? JSON.stringify(step.toolCall) : null,
       step.toolResult ?? null,
       step.tokensInput ?? null, step.tokensOutput ?? null,
       step.durationMs, step.timestamp]
    );
  }
}

export function getRunSteps(runId: string): AgentStep[] {
  const d = getDb();
  if (!d) return [];
  const rows = d.exec(
    'SELECT * FROM run_steps WHERE run_id = ? ORDER BY step_index', [runId]
  );
  if (!rows.length) return [];

  return rows[0].values.map((r) => ({
    stepIndex: r[1] as number,
    role: r[2] as 'assistant' | 'tool',
    content: r[3] as string | null,
    toolCall: r[4] ? JSON.parse(r[4] as string) : undefined,
    toolResult: r[5] as string | undefined,
    tokensInput: r[6] as number | undefined,
    tokensOutput: r[7] as number | undefined,
    durationMs: r[8] as number,
    timestamp: r[9] as number,
  }));
}

// ── Benchmarks ────────────────────────────────────────────────

export function saveBenchmark(benchmark: Benchmark): void {
  const d = getDb();
  if (!d) return;
  d.run(
    `INSERT OR REPLACE INTO benchmarks (id, name, timestamp, task_ids, model_ids, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [benchmark.id, benchmark.name, benchmark.timestamp,
     JSON.stringify(benchmark.taskIds), JSON.stringify(benchmark.modelIds), benchmark.status]
  );
  persist();
}

export function getBenchmarks(): Benchmark[] {
  const d = getDb();
  if (!d) return [];
  const rows = d.exec('SELECT * FROM benchmarks ORDER BY timestamp DESC');
  if (!rows.length) return [];

  return rows[0].values.map((r) => ({
    id: r[0] as string,
    name: r[1] as string,
    timestamp: r[2] as number,
    taskIds: JSON.parse(r[3] as string),
    modelIds: JSON.parse(r[4] as string),
    status: r[5] as Benchmark['status'],
  }));
}

// ── Leaderboard Query ─────────────────────────────────────────

export function getLeaderboard(metricName: string, taskId?: string): { modelId: string; avgValue: number; runCount: number }[] {
  let query = `
    SELECT r.model_id, AVG(rm.metric_value) as avg_val, COUNT(*) as cnt
    FROM run_metrics rm
    JOIN runs r ON r.id = rm.run_id
    WHERE rm.metric_name = ? AND r.status = 'completed'
  `;
  const params: any[] = [metricName];

  if (taskId) { query += ' AND r.task_id = ?'; params.push(taskId); }
  query += ' GROUP BY r.model_id ORDER BY avg_val DESC';

  const d = getDb();
  if (!d) return [];
  const rows = d.exec(query, params);
  if (!rows.length) return [];

  return rows[0].values.map((r) => ({
    modelId: r[0] as string,
    avgValue: r[1] as number,
    runCount: r[2] as number,
  }));
}

export function getLeaderboardWithStats(
  metricName: string,
  taskId?: string,
): { modelId: string; mean: number; stdDev: number; min: number; max: number; n: number }[] {
  let query = `
    SELECT r.model_id,
      AVG(rm.metric_value) as mean_val,
      MIN(rm.metric_value) as min_val,
      MAX(rm.metric_value) as max_val,
      COUNT(*) as n,
      SUM(rm.metric_value * rm.metric_value) as sum_sq,
      SUM(rm.metric_value) as sum_val
    FROM run_metrics rm
    JOIN runs r ON r.id = rm.run_id
    WHERE rm.metric_name = ? AND r.status = 'completed'
  `;
  const params: any[] = [metricName];

  if (taskId) { query += ' AND r.task_id = ?'; params.push(taskId); }
  query += ' GROUP BY r.model_id ORDER BY mean_val DESC';

  const d = getDb();
  if (!d) return [];
  const rows = d.exec(query, params);
  if (!rows.length) return [];

  return rows[0].values.map((r) => {
    const n = r[4] as number;
    const sumSq = r[5] as number;
    const sumVal = r[6] as number;
    const mean = r[1] as number;
    // Sample standard deviation
    const stdDev = n > 1 ? Math.sqrt((sumSq - (sumVal * sumVal) / n) / (n - 1)) : 0;

    return {
      modelId: r[0] as string,
      mean,
      stdDev,
      min: r[2] as number,
      max: r[3] as number,
      n,
    };
  });
}

// ── Utilities ─────────────────────────────────────────────────

export function exportDatabase(): Uint8Array {
  return requireDb().export();
}

export function importDatabase(data: Uint8Array): void {
  const SQL = (db as any).constructor;
  db?.close();
  db = new SQL.Database(data);
  persist();
}

export function clearAllData(): void {
  const d = getDb();
  if (!d) return;
  d.run('DELETE FROM run_steps');
  d.run('DELETE FROM run_metrics');
  d.run('DELETE FROM runs');
  d.run('DELETE FROM benchmarks');
  d.run('DELETE FROM tasks');
  d.run('DELETE FROM models');
  persist();
}
