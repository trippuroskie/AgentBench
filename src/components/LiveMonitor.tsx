import React, { useEffect, useRef, useState } from 'react';
import type { LiveRunState, ModelConfig, TaskDefinition, BenchmarkProgress, AgentStep, GridConfig, QueueItem } from '../types';
import { METRIC_CONFIGS, CHART_COLORS } from '../constants';
import { bfs } from '../utils/pathfinding';

interface LiveMonitorProps {
  progress: BenchmarkProgress;
  liveRuns: LiveRunState[];
  models: ModelConfig[];
  tasks: TaskDefinition[];
  onCancel: () => void;
}

export default function LiveMonitor({ progress, liveRuns, models, tasks, onCancel }: LiveMonitorProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'runs' | 'queue'>('queue');
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const startRef = useRef(Date.now());

  // Tick the total timer
  useEffect(() => {
    const interval = setInterval(() => setElapsedTotal(Date.now() - startRef.current), 200);
    return () => clearInterval(interval);
  }, []);

  // Auto-select the current running run
  const currentRun = liveRuns.find((r) => r.status === 'running') || liveRuns[liveRuns.length - 1];
  const activeRunId = selectedRunId || currentRun?.runId;
  const activeRun = liveRuns.find((r) => r.runId === activeRunId);

  const completedCount = liveRuns.filter((r) => r.status === 'completed').length;
  const failedCount = liveRuns.filter((r) => r.status === 'failed').length;
  const successCount = liveRuns.filter((r) => r.result?.metrics?.taskSuccess === 1).length;

  // Aggregate token totals
  const totalTokens = liveRuns.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const totalToolCalls = liveRuns.reduce((s, r) => s + r.toolCalls, 0);

  const activeTask = activeRun ? tasks.find((t) => t.id === activeRun.taskId) : null;
  const activeModel = activeRun ? models.find((m) => m.id === activeRun.modelId) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-sm font-bold">Live Benchmark</span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <span className="text-xs text-slate-400">
            {progress.current}/{progress.total} runs
          </span>
          <div className="h-4 w-px bg-slate-700"></div>
          <span className="text-xs text-slate-400 font-mono">{formatDuration(elapsedTotal)}</span>
          {progress.current > 0 && progress.current < progress.total && (
            <>
              <div className="h-4 w-px bg-slate-700"></div>
              <span className="text-xs text-slate-500">
                ETA: ~{formatDuration(Math.round((elapsedTotal / progress.current) * (progress.total - progress.current)))}
              </span>
            </>
          )}
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-semibold hover:bg-rose-500/30 transition-colors"
        >
          <i className="fas fa-stop mr-1.5"></i>Stop
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 h-1">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        ></div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 bg-slate-900/50 border-r border-slate-800 flex flex-col overflow-hidden">
          {/* Summary Stats */}
          <div className="p-3 border-b border-slate-800 grid grid-cols-2 gap-2">
            <MiniStat label="Completed" value={`${completedCount}/${progress.total}`} icon="fa-check-circle" color="text-emerald-400" />
            <MiniStat label="Passed" value={successCount.toString()} icon="fa-trophy" color="text-amber-400" />
            <MiniStat label="Tokens" value={formatTokens(totalTokens)} icon="fa-coins" color="text-blue-400" />
            <MiniStat label="Tool Calls" value={totalToolCalls.toString()} icon="fa-wrench" color="text-violet-400" />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setLeftTab('queue')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                leftTab === 'queue' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <i className="fas fa-list-ol mr-1.5"></i>Queue ({progress.queue.filter(q => q.status === 'pending').length} left)
            </button>
            <button
              onClick={() => setLeftTab('runs')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                leftTab === 'runs' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <i className="fas fa-stream mr-1.5"></i>Runs ({liveRuns.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {leftTab === 'queue' ? (
              /* Queue View */
              progress.queue.map((item, i) => {
                const model = models.find((m) => m.id === item.modelId);
                const task = tasks.find((t) => t.id === item.taskId);
                return (
                  <div
                    key={`${item.modelId}-${item.taskId}-${item.iteration}-${i}`}
                    className={`p-2.5 rounded-lg transition-all ${
                      item.status === 'running' ? 'bg-indigo-500/15 ring-1 ring-indigo-500/30' :
                      item.status === 'completed' ? 'bg-slate-800/30 opacity-60' :
                      item.status === 'failed' ? 'bg-rose-500/10 opacity-60' :
                      'bg-slate-800/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <QueueStatusIcon status={item.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${model?.color || 'bg-slate-700 text-slate-300'}`}>
                            {model?.name || item.modelId.split(':')[0]}
                          </span>
                          {item.iteration > 0 && (
                            <span className="text-[9px] text-slate-600">iter {item.iteration + 1}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{task?.name || item.taskId}</p>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono">#{i + 1}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Runs View */
              liveRuns.map((run, i) => {
                const model = models.find((m) => m.id === run.modelId);
                const task = tasks.find((t) => t.id === run.taskId);
                const isActive = run.runId === activeRunId;

                return (
                  <button
                    key={run.runId}
                    onClick={() => setSelectedRunId(run.runId)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      isActive ? 'bg-slate-700/80 ring-1 ring-indigo-500/50' : 'bg-slate-800/40 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <RunStatusDot status={run.status} success={run.result?.metrics?.taskSuccess} />
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {model?.name || run.modelId.split(':')[0]}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto font-mono">
                        #{i + 1}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{task?.name || run.taskId}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                      <span><i className="fas fa-shoe-prints mr-0.5"></i>{run.steps.length}</span>
                      <span><i className="fas fa-wrench mr-0.5"></i>{run.toolCalls}</span>
                      <span><i className="fas fa-coins mr-0.5"></i>{run.tokensOut}</span>
                      {run.status === 'running' && (
                        <span className="ml-auto text-blue-400 font-mono">{formatDuration(run.elapsedMs)}</span>
                      )}
                      {run.status === 'completed' && run.result?.metrics && (
                        <span className={`ml-auto font-bold ${run.result.metrics.taskSuccess >= 0.8 ? 'text-emerald-400' : run.result.metrics.taskSuccess >= 0.5 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {Math.round(run.result.metrics.taskSuccess * 100)}%
                        </span>
                      )}
                      {run.status === 'failed' && (
                        <span className="ml-auto text-rose-400 font-bold">FAIL</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Live Feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeRun ? (
            <>
              {/* Active Run Header */}
              <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-800 flex items-center gap-4">
                <RunStatusDot status={activeRun.status} success={activeRun.result?.metrics?.taskSuccess} large />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${activeModel?.color || 'bg-slate-700 text-slate-300'}`}>
                      {activeModel?.name || activeRun.modelId}
                    </span>
                    <span className="text-sm text-slate-300">{activeTask?.name}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
                    <span><i className="fas fa-clock mr-1"></i>{formatDuration(activeRun.elapsedMs)}</span>
                    <span><i className="fas fa-arrow-down mr-1"></i>{activeRun.tokensIn} in</span>
                    <span><i className="fas fa-arrow-up mr-1"></i>{activeRun.tokensOut} out</span>
                    <span><i className="fas fa-wrench mr-1"></i>{activeRun.toolCalls} calls</span>
                    {activeRun.tokensOut > 0 && activeRun.elapsedMs > 0 && (
                      <span><i className="fas fa-bolt mr-1"></i>{(activeRun.tokensOut / (activeRun.elapsedMs / 1000)).toFixed(1)} t/s</span>
                    )}
                  </div>
                </div>
                {activeRun.status === 'completed' && activeRun.result?.metrics && (
                  <div className="ml-auto text-right">
                    <span className={`text-2xl font-black ${
                      activeRun.result.metrics.taskSuccess >= 0.8 ? 'text-emerald-400' : activeRun.result.metrics.taskSuccess >= 0.5 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {Math.round(activeRun.result.metrics.taskSuccess * 100)}%
                    </span>
                    <p className="text-[10px] text-slate-500">task success</p>
                  </div>
                )}
              </div>

              {/* Step Feed + Grid */}
              <div className="flex-1 flex overflow-hidden">
                {/* Steps */}
                <StepFeed steps={activeRun.steps} />

                {/* Grid (if visual task) */}
                {activeTask?.type === 'visual' && activeTask.configJson && activeRun.gridState && (
                  <div className="w-80 border-l border-slate-800 p-4 flex flex-col items-center justify-center bg-slate-900/30">
                    <MiniGrid
                      gridConfig={activeTask.configJson}
                      agentPos={activeRun.gridState.agentPos}
                      visitedCells={new Set(activeRun.gridState.visitedCells)}
                    />
                    <div className="mt-3 text-center">
                      <p className="text-[10px] text-slate-500">
                        Moves: {activeRun.gridState.visitedCells.length - 1} / Optimal: {activeTask.configJson.optimalPathLength}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-satellite-dish text-3xl text-slate-600 mb-3 animate-pulse"></i>
                <p className="text-sm text-slate-500">Waiting for first run...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step Feed ─────────────────────────────────────────────────

function StepFeed({ steps }: { steps: AgentStep[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps.length]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
      {steps.length === 0 && (
        <div className="text-slate-600 text-center py-8">
          <i className="fas fa-hourglass-start animate-pulse mr-2"></i>
          Waiting for agent response...
        </div>
      )}
      {steps.map((step) => (
        <div key={step.stepIndex} className="flex gap-2">
          <span className="text-slate-600 w-8 text-right flex-shrink-0">{step.stepIndex}</span>
          <div className="flex-1 min-w-0">
            {step.role === 'assistant' && step.toolCall ? (
              <div>
                <span className="text-indigo-400">
                  <i className="fas fa-arrow-right mr-1"></i>
                  {step.toolCall.function.name}
                </span>
                <span className="text-slate-500">(</span>
                <span className="text-amber-300/70">{truncate(step.toolCall.function.arguments, 120)}</span>
                <span className="text-slate-500">)</span>
                <span className="text-slate-600 ml-2">{step.durationMs.toFixed(0)}ms</span>
              </div>
            ) : step.role === 'assistant' && step.content ? (
              <div>
                <span className="text-blue-400"><i className="fas fa-comment mr-1"></i></span>
                <span className="text-slate-300">{truncate(step.content, 200)}</span>
                {step.tokensOutput != null && (
                  <span className="text-slate-600 ml-2">{step.tokensOutput}tok {step.durationMs.toFixed(0)}ms</span>
                )}
              </div>
            ) : step.role === 'tool' ? (
              <div>
                <span className="text-emerald-400"><i className="fas fa-arrow-left mr-1"></i></span>
                <span className="text-slate-400">{truncate(step.content || '', 200)}</span>
                <span className="text-slate-600 ml-2">{step.durationMs.toFixed(0)}ms</span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Mini Grid ─────────────────────────────────────────────────

function MiniGrid({ gridConfig, agentPos, visitedCells }: {
  gridConfig: GridConfig;
  agentPos: [number, number];
  visitedCells: Set<string>;
}) {
  const cellSize = Math.min(24, Math.floor(240 / gridConfig.width));

  return (
    <div
      className="inline-grid gap-px bg-slate-800 rounded-lg p-1"
      style={{ gridTemplateColumns: `repeat(${gridConfig.width}, ${cellSize}px)` }}
    >
      {gridConfig.grid.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`;
          const isAgent = agentPos[0] === r && agentPos[1] === c;
          const isGoal = r === gridConfig.goalPos[0] && c === gridConfig.goalPos[1];
          const isStart = r === gridConfig.startPos[0] && c === gridConfig.startPos[1];
          const isVisited = visitedCells.has(key);

          let bg = 'bg-slate-700/50';
          if (cell === 'obstacle') bg = 'bg-slate-600';
          if (isVisited) bg = 'bg-indigo-500/30';
          if (isStart) bg = 'bg-emerald-500/40';
          if (isGoal) bg = 'bg-amber-500/50';
          if (isAgent) bg = 'bg-indigo-500 shadow-lg shadow-indigo-500/50';

          return (
            <div
              key={key}
              className={`rounded-sm flex items-center justify-center transition-all duration-200 ${bg}`}
              style={{ width: cellSize, height: cellSize }}
            >
              {isAgent && <i className="fas fa-robot text-white" style={{ fontSize: Math.max(8, cellSize * 0.5) }}></i>}
              {isGoal && !isAgent && <i className="fas fa-star text-amber-300" style={{ fontSize: Math.max(6, cellSize * 0.4) }}></i>}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Small Components ──────────────────────────────────────────

function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <i className={`fas ${icon} text-[10px] ${color}`}></i>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

function QueueStatusIcon({ status }: { status: string }) {
  if (status === 'running') return <i className="fas fa-spinner animate-spin text-indigo-400 text-xs w-4 text-center"></i>;
  if (status === 'completed') return <i className="fas fa-check text-emerald-400 text-xs w-4 text-center"></i>;
  if (status === 'failed') return <i className="fas fa-xmark text-rose-400 text-xs w-4 text-center"></i>;
  return <i className="fas fa-circle text-slate-600 text-[6px] w-4 text-center"></i>;
}

function RunStatusDot({ status, success, large }: { status: string; success?: number; large?: boolean }) {
  const size = large ? 'w-3 h-3' : 'w-2 h-2';
  let color = 'bg-slate-500';

  if (status === 'running') color = 'bg-blue-400 animate-pulse';
  else if (status === 'failed') color = 'bg-rose-500';
  else if (status === 'completed') {
    if (success != null) {
      color = success >= 0.8 ? 'bg-emerald-400' : success >= 0.5 ? 'bg-amber-400' : 'bg-rose-400';
    } else {
      color = 'bg-emerald-400';
    }
  }

  return <div className={`${size} rounded-full flex-shrink-0 ${color}`}></div>;
}

// ── Helpers ───────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
}
