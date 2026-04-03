import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ViewState, ModelConfig, TaskDefinition, BenchmarkRun, BenchmarkProgress, AppSettings, LiveRunState, AgentStep, TaskContext, QueueItem } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { initDatabase, saveModel, getModels, getTasks, getRuns, saveRun, saveTask } from './services/database';
import { OllamaService } from './services/ollama';
import { runAgent } from './agent/harness';
import { getBuiltinTasks } from './tasks/registry';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import BenchmarkRunner from './components/BenchmarkRunner';
import ResultsView from './components/ResultsView';
import Leaderboard from './components/Leaderboard';
import Compare from './components/Compare';
import ModelManager from './components/ModelManager';
import TaskManager from './components/TaskManager';
import ToolsManager from './components/ToolsManager';
import Settings from './components/Settings';
import LiveMonitor from './components/LiveMonitor';

export default function App() {
  // ── State ─────────────────────────────────────────────────
  const [view, setView] = useState<ViewState>('dashboard');
  const [dbReady, setDbReady] = useState(false);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('agentbench_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [liveRuns, setLiveRuns] = useState<LiveRunState[]>([]);
  const cancelRef = useRef(false);
  const ollamaRef = useRef(new OllamaService(settings.ollamaBaseUrl));

  // ── Persist Settings ──────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('agentbench_settings', JSON.stringify(settings));
    ollamaRef.current = new OllamaService(settings.ollamaBaseUrl);
  }, [settings]);

  // ── Initialize ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const builtinTasks = getBuiltinTasks();
      setTasks(builtinTasks);

      try {
        await initDatabase();
        setDbReady(true);

        const savedModels = getModels();
        if (savedModels.length > 0) setModels(savedModels);

        const savedTasks = getTasks();
        const allTasks = mergeTaskLists(builtinTasks, savedTasks);
        setTasks(allTasks);
        for (const t of builtinTasks) saveTask(t);

        const savedRuns = getRuns({ limit: 200 });
        if (savedRuns.length > 0) setRuns(savedRuns);
      } catch (e) {
        console.error('Failed to init database:', e);
        setDbReady(true);
      }
    })();
  }, []);

  // ── Ollama Health Check ───────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!mounted) return;
      setOllamaStatus('checking');
      const healthy = await ollamaRef.current.isHealthy();
      if (mounted) setOllamaStatus(healthy ? 'connected' : 'disconnected');
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [settings.ollamaBaseUrl]);

  // ── Auto-detect Models ────────────────────────────────────
  const refreshModels = useCallback(async () => {
    try {
      const detected = await ollamaRef.current.listModels();
      setModels(detected);
      for (const m of detected) saveModel(m);
    } catch (e) {
      console.error('Failed to list Ollama models:', e);
    }
  }, []);

  useEffect(() => {
    if (ollamaStatus === 'connected') refreshModels();
  }, [ollamaStatus, refreshModels]);

  // ── Handlers ──────────────────────────────────────────────
  const handleAddTask = useCallback((task: TaskDefinition) => {
    saveTask(task);
    setTasks((prev) => {
      const exists = prev.findIndex((t) => t.id === task.id);
      if (exists >= 0) { const next = [...prev]; next[exists] = task; return next; }
      return [...prev, task];
    });
  }, []);

  const handleCancelBenchmark = useCallback(() => {
    cancelRef.current = true;
    setProgress(null);
    setLiveRuns([]);
  }, []);

  // ── Run Benchmark (with live monitoring) ──────────────────
  const handleRunBenchmark = useCallback(async (taskIds: string[], modelIds: string[], iterations: number) => {
    cancelRef.current = false;
    setLiveRuns([]);

    const queueItems: QueueItem[] = [];
    for (let iter = 0; iter < iterations; iter++) {
      for (const modelId of modelIds) {
        for (const taskId of taskIds) {
          queueItems.push({ taskId, modelId, iteration: iter, status: 'pending' });
        }
      }
    }

    const total = queueItems.length;
    setProgress({ isRunning: true, current: 0, total, message: 'Starting benchmark...', queue: [...queueItems] });

    for (let i = 0; i < queueItems.length; i++) {
      if (cancelRef.current) break;

      const { taskId, modelId } = queueItems[i];
      const task = tasks.find((t) => t.id === taskId);
      const model = models.find((m) => m.id === modelId);
      if (!task || !model) continue;

      // Update queue statuses
      queueItems[i].status = 'running';
      const runId = crypto.randomUUID();
      const runStart = Date.now();

      setLiveRuns((prev) => [...prev, {
        runId, modelId, taskId, status: 'running',
        steps: [], tokensIn: 0, tokensOut: 0, toolCalls: 0,
        startTime: runStart, elapsedMs: 0,
      }]);

      setProgress({
        isRunning: true, current: i, total,
        message: `Run ${i + 1} of ${total}`,
        queue: [...queueItems],
        currentModel: model.name,
        currentTask: task.name,
      });

      const elapsed = setInterval(() => {
        setLiveRuns((prev) => prev.map((r) =>
          r.runId === runId ? { ...r, elapsedMs: Date.now() - runStart } : r
        ));
      }, 200);

      try {
        const result = await runAgent({
          model: modelId,
          task,
          ollamaService: ollamaRef.current,
          abortSignal: cancelRef.current ? AbortSignal.abort() : undefined,
          modelConfig: { inputPrice: model.inputPrice, outputPrice: model.outputPrice },
          judgeConfig: task.scoringMethod === 'llm_judge'
            ? { model: settings.judgeModel, ollamaBaseUrl: settings.ollamaBaseUrl }
            : undefined,
          onStep: (step: AgentStep, context?: TaskContext) => {
            setLiveRuns((prev) => prev.map((r) => {
              if (r.runId !== runId) return r;
              const updated = {
                ...r,
                steps: [...r.steps, step],
                tokensIn: r.tokensIn + (step.tokensInput || 0),
                tokensOut: r.tokensOut + (step.tokensOutput || 0),
                toolCalls: r.toolCalls + (step.role === 'assistant' && step.toolCall ? 1 : 0),
                elapsedMs: Date.now() - runStart,
              };
              if (context?.agentPos && context?.visitedCells) {
                updated.gridState = {
                  agentPos: [...context.agentPos] as [number, number],
                  visitedCells: [...context.visitedCells],
                };
              }
              return updated;
            }));
          },
        });

        clearInterval(elapsed);
        queueItems[i].status = 'completed';

        setLiveRuns((prev) => prev.map((r) =>
          r.runId === runId ? { ...r, status: 'completed', elapsedMs: Date.now() - runStart, result } : r
        ));

        saveRun(result);
        setRuns((prev) => [result, ...prev]);
      } catch (e: any) {
        clearInterval(elapsed);
        queueItems[i].status = 'failed';
        console.error(`Run failed for ${model.name} on ${task.name}:`, e);

        const failedRun: BenchmarkRun = {
          id: runId, taskId, modelId, status: 'failed',
          timestamp: Date.now(), steps: [], error: e.message,
        };

        setLiveRuns((prev) => prev.map((r) =>
          r.runId === runId ? { ...r, status: 'failed', elapsedMs: Date.now() - runStart, result: failedRun } : r
        ));

        saveRun(failedRun);
        setRuns((prev) => [failedRun, ...prev]);
      }

      // Update progress with latest queue state
      setProgress((prev) => prev ? { ...prev, current: i + 1, queue: [...queueItems] } : null);
    }

    setProgress((prev) => prev ? { ...prev, current: total, message: 'Benchmark complete!', queue: [...queueItems] } : null);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setProgress(null);
    setLiveRuns([]);
    if (!cancelRef.current) setView('results');
  }, [tasks, models, settings]);

  // ── Render ────────────────────────────────────────────────
  const renderView = () => {
    if (!dbReady) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-database text-4xl text-slate-300 mb-4 animate-pulse"></i>
            <p className="text-slate-500 font-medium">Initializing database...</p>
          </div>
        </div>
      );
    }

    switch (view) {
      case 'dashboard':
        return <Dashboard runs={runs} models={models} tasks={tasks} onNavigate={(v) => setView(v as ViewState)} />;
      case 'tasks':
        return <TaskManager tasks={tasks} onAddTask={handleAddTask} />;
      case 'tools':
        return <ToolsManager />;
      case 'models':
        return <ModelManager models={models} ollamaStatus={ollamaStatus} onRefresh={refreshModels} ollamaBaseUrl={settings.ollamaBaseUrl} onAddModel={(m) => { saveModel(m); setModels(prev => { const i = prev.findIndex(x => x.id === m.id); if (i >= 0) { const next = [...prev]; next[i] = m; return next; } return [...prev, m]; }); }} />;
      case 'benchmark':
        return (
          <BenchmarkRunner
            tasks={tasks}
            models={models}
            ollamaConnected={ollamaStatus === 'connected'}
            onRunBenchmark={handleRunBenchmark}
          />
        );
      case 'results':
        return <ResultsView runs={runs} models={models} tasks={tasks} />;
      case 'compare':
        return <Compare runs={runs} models={models} tasks={tasks} />;
      case 'leaderboard':
        return <Leaderboard runs={runs} models={models} tasks={tasks} />;
      case 'settings':
        return <Settings settings={settings} onUpdateSettings={setSettings} ollamaStatus={ollamaStatus} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar
        currentView={view}
        onNavigate={setView}
        ollamaStatus={ollamaStatus}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      <main className="flex-1 overflow-y-auto relative">
        {renderView()}
      </main>

      {/* Live Monitor (full-screen overlay during benchmarks) */}
      {progress && (
        <LiveMonitor
          progress={progress}
          liveRuns={liveRuns}
          models={models}
          tasks={tasks}
          onCancel={handleCancelBenchmark}
        />
      )}
    </div>
  );
}

function mergeTaskLists(builtin: TaskDefinition[], saved: TaskDefinition[]): TaskDefinition[] {
  const map = new Map<string, TaskDefinition>();
  for (const t of saved) map.set(t.id, t);
  for (const t of builtin) map.set(t.id, t);
  return Array.from(map.values());
}
