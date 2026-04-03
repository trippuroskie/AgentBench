import React, { useState, useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import type { BenchmarkRun, ModelConfig, TaskDefinition, AgentStep } from '../types';
import { CHART_COLORS, METRIC_CONFIGS } from '../constants';
import { getRunSteps } from '../services/database';
import AgentTraceView from './AgentTraceView';
import GridVisualization from './GridVisualization';

interface CompareProps {
  runs: BenchmarkRun[];
  models: ModelConfig[];
  tasks: TaskDefinition[];
}

export default function Compare({ runs, models, tasks }: CompareProps) {
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [traceRun, setTraceRun] = useState<{ run: BenchmarkRun; steps: AgentStep[] } | null>(null);
  const [gridRun, setGridRun] = useState<BenchmarkRun | null>(null);

  const completedRuns = useMemo(
    () => runs.filter((r) => r.status === 'completed' && r.metrics),
    [runs]
  );

  const uniqueTasks = useMemo(
    () => [...new Set(completedRuns.map((r) => r.taskId))],
    [completedRuns]
  );

  const taskRuns = useMemo(() => {
    if (!selectedTask) return [];
    return completedRuns.filter((r) => r.taskId === selectedTask);
  }, [completedRuns, selectedTask]);

  // Group by model, take best run per model
  const modelBestRuns = useMemo(() => {
    const byModel = new Map<string, BenchmarkRun>();
    for (const run of taskRuns) {
      const existing = byModel.get(run.modelId);
      if (!existing || (run.metrics?.taskSuccess ?? 0) > (existing.metrics?.taskSuccess ?? 0)) {
        byModel.set(run.modelId, run);
      }
    }
    return byModel;
  }, [taskRuns]);

  const comparedRuns = useMemo(() => {
    return [...selectedRuns].map((id) => completedRuns.find((r) => r.id === id)).filter(Boolean) as BenchmarkRun[];
  }, [selectedRuns, completedRuns]);

  // Radar chart data
  const radarData = useMemo(() => {
    if (comparedRuns.length === 0) return [];

    const metrics = ['taskSuccess', 'tokensPerSecond', 'toolCallsCount'] as const;

    // Normalize: find max of each metric across compared runs
    const maxVals: Record<string, number> = {};
    for (const key of metrics) {
      maxVals[key] = Math.max(...comparedRuns.map((r) => (r.metrics as any)?.[key] ?? 0), 0.001);
    }

    return metrics.map((key) => {
      const entry: any = { metric: METRIC_CONFIGS[key]?.label || key };
      for (const run of comparedRuns) {
        const model = models.find((m) => m.id === run.modelId);
        const name = model?.name || run.modelId.split(':')[0];
        const raw = (run.metrics as any)?.[key] ?? 0;
        // Normalize to 0-100
        entry[name] = Math.round((raw / maxVals[key]) * 100);
      }
      return entry;
    });
  }, [comparedRuns, models]);

  const toggleRunSelection = (runId: string) => {
    setSelectedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else if (next.size < 4) {
        next.add(runId);
      }
      return next;
    });
  };

  const handleViewTrace = (run: BenchmarkRun) => {
    const steps = run.steps.length > 0 ? run.steps : getRunSteps(run.id);
    setTraceRun({ run, steps });
  };

  const handleViewGrid = (run: BenchmarkRun) => {
    if (run.steps.length === 0) {
      run = { ...run, steps: getRunSteps(run.id) };
    }
    setGridRun(run);
  };

  const task = tasks.find((t) => t.id === selectedTask);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Compare Models</h1>
        <p className="text-slate-500 mt-1">Side-by-side comparison on the same task (up to 4 models)</p>
      </div>

      {/* Task selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-slate-600 block mb-2">Select a task to compare</label>
        <select
          value={selectedTask}
          onChange={(e) => { setSelectedTask(e.target.value); setSelectedRuns(new Set()); }}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white w-full max-w-md"
        >
          <option value="">Choose a task...</option>
          {uniqueTasks.map((id) => {
            const t = tasks.find((t) => t.id === id);
            return <option key={id} value={id}>{t?.name || id}</option>;
          })}
        </select>
      </div>

      {selectedTask && (
        <>
          {/* Run selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h3 className="text-sm font-bold text-slate-600 mb-3">Select runs to compare (max 4)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Array.from(modelBestRuns.entries()).map(([modelId, run]) => {
                const model = models.find((m) => m.id === modelId);
                const m = run.metrics!;
                return (
                  <label
                    key={run.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedRuns.has(run.id) ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRuns.has(run.id)}
                      onChange={() => toggleRunSelection(run.id)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${model?.color || 'bg-slate-100 text-slate-600'}`}>
                        {model?.name || modelId.split(':')[0]}
                      </span>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] text-slate-400">{Math.round(m.taskSuccess * 100)}% success</span>
                        <span className="text-[10px] text-slate-400">{m.tokensPerSecond.toFixed(1)} t/s</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Comparison */}
          {comparedRuns.length >= 2 && (
            <>
              {/* Radar Chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                <h3 className="text-sm font-bold text-slate-600 mb-4">Performance Radar</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {comparedRuns.map((run, i) => {
                      const model = models.find((m) => m.id === run.modelId);
                      const name = model?.name || run.modelId.split(':')[0];
                      return (
                        <Radar
                          key={run.id}
                          name={name}
                          dataKey={name}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      );
                    })}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Metrics Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4">Metric</th>
                      {comparedRuns.map((run) => {
                        const model = models.find((m) => m.id === run.modelId);
                        return (
                          <th key={run.id} className="p-4">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${model?.color || 'bg-slate-100 text-slate-600'}`}>
                              {model?.name || run.modelId.split(':')[0]}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(['taskSuccess', 'tokensPerSecond', 'wallClockMs', 'tokensTotal', 'toolCallsCount', 'trajectoryEfficiency'] as const).map((key) => {
                      const config = METRIC_CONFIGS[key];
                      if (!config) return null;
                      const values = comparedRuns.map((r) => (r.metrics as any)?.[key] ?? 0);
                      const best = config.higherBetter ? Math.max(...values) : Math.min(...values);

                      return (
                        <tr key={key}>
                          <td className="p-4 text-slate-600 font-medium">{config.label}</td>
                          {comparedRuns.map((run, i) => {
                            const val = (run.metrics as any)?.[key] ?? 0;
                            const isBest = val === best && values.filter((v) => v === best).length === 1;
                            return (
                              <td key={run.id} className={`p-4 font-mono text-xs ${isBest ? 'font-bold text-emerald-600' : 'text-slate-500'}`}>
                                {config.format(val)}
                                {isBest && <i className="fas fa-crown text-amber-500 ml-1 text-[10px]"></i>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {comparedRuns.map((run, i) => {
                  const model = models.find((m) => m.id === run.modelId);
                  return (
                    <div key={run.id} className="flex gap-2">
                      <button
                        onClick={() => handleViewTrace(run)}
                        className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors"
                      >
                        <i className="fas fa-magnifying-glass mr-1"></i>
                        {model?.name || 'Model'} Trace
                      </button>
                      {task?.type === 'visual' && task.configJson && (
                        <button
                          onClick={() => handleViewGrid(run)}
                          className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors"
                        >
                          <i className="fas fa-grid mr-1"></i>
                          Grid
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Trace Modal */}
      {traceRun && (
        <AgentTraceView
          steps={traceRun.steps}
          onClose={() => setTraceRun(null)}
          modelName={models.find((m) => m.id === traceRun.run.modelId)?.name}
          taskName={tasks.find((t) => t.id === traceRun.run.taskId)?.name}
        />
      )}

      {/* Grid Modal */}
      {gridRun && task?.configJson && (
        <GridVisualization
          gridConfig={task.configJson}
          steps={gridRun.steps.length > 0 ? gridRun.steps : getRunSteps(gridRun.id)}
          onClose={() => setGridRun(null)}
          modelName={models.find((m) => m.id === gridRun.modelId)?.name}
        />
      )}
    </div>
  );
}
