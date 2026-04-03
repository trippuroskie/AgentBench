import React, { useState, useMemo } from 'react';
import type { BenchmarkRun, ModelConfig, TaskDefinition, AgentStep } from '../types';
import { METRIC_CONFIGS } from '../constants';
import { getRunSteps } from '../services/database';
import AgentTraceView from './AgentTraceView';
import { computeStats, groupRunsByModelTask, getMetricValues } from '../utils/stats';

interface ResultsViewProps {
  runs: BenchmarkRun[];
  models: ModelConfig[];
  tasks: TaskDefinition[];
}

type SortKey = 'timestamp' | 'taskSuccess' | 'wallClockMs' | 'tokensTotal' | 'toolCallsCount' | 'tokensPerSecond';

export default function ResultsView({ runs, models, tasks }: ResultsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterModel, setFilterModel] = useState<string>('');
  const [filterTask, setFilterTask] = useState<string>('');
  const [traceRun, setTraceRun] = useState<{ run: BenchmarkRun; steps: AgentStep[] } | null>(null);

  const completedRuns = useMemo(
    () => runs.filter((r) => r.status === 'completed' && r.metrics),
    [runs]
  );

  const filtered = useMemo(() => {
    let result = completedRuns;
    if (filterModel) result = result.filter((r) => r.modelId === filterModel);
    if (filterTask) result = result.filter((r) => r.taskId === filterTask);
    return result;
  }, [completedRuns, filterModel, filterTask]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === 'timestamp') {
        va = a.timestamp;
        vb = b.timestamp;
      } else {
        va = (a.metrics as any)?.[sortKey] ?? 0;
        vb = (b.metrics as any)?.[sortKey] ?? 0;
      }
      return sortAsc ? va - vb : vb - va;
    });
  }, [filtered, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleViewTrace = (run: BenchmarkRun) => {
    const steps = run.steps.length > 0 ? run.steps : getRunSteps(run.id);
    setTraceRun({ run, steps });
  };

  const uniqueModels = useMemo(() => [...new Set(completedRuns.map((r) => r.modelId))], [completedRuns]);
  const uniqueTasks = useMemo(() => [...new Set(completedRuns.map((r) => r.taskId))], [completedRuns]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="pb-3 pr-4 cursor-pointer hover:text-slate-600 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      {label}
      {sortKey === field && (
        <i className={`fas fa-caret-${sortAsc ? 'up' : 'down'} ml-1`}></i>
      )}
    </th>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Results</h1>
        <p className="text-slate-500 mt-1">{sorted.length} completed runs</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="">All Models</option>
          {uniqueModels.map((id) => {
            const m = models.find((m) => m.id === id);
            return <option key={id} value={id}>{m?.name || id}</option>;
          })}
        </select>

        <select
          value={filterTask}
          onChange={(e) => setFilterTask(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="">All Tasks</option>
          {uniqueTasks.map((id) => {
            const t = tasks.find((t) => t.id === id);
            return <option key={id} value={id}>{t?.name || id}</option>;
          })}
        </select>
      </div>

      {/* Statistical Summary */}
      {(() => {
        const groups = groupRunsByModelTask(filtered);
        const multiRunGroups = [...groups.entries()].filter(([, runs]) => runs.length > 1);
        if (multiRunGroups.length === 0) return null;

        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h3 className="text-sm font-bold text-slate-600 mb-4">
              <i className="fas fa-chart-bar text-indigo-500 mr-2"></i>
              Statistical Summary
              <span className="text-[10px] text-slate-400 font-normal ml-2">Groups with 2+ runs</span>
            </h3>
            <div className="space-y-4">
              {multiRunGroups.map(([key, groupRuns]) => {
                const [modelId, taskId] = key.split('::');
                const model = models.find((m) => m.id === modelId);
                const task = tasks.find((t) => t.id === taskId);
                const metricKeys = ['taskSuccess', 'wallClockMs', 'tokensPerSecond', 'toolCallsCount'] as const;

                return (
                  <div key={key} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${model?.color || 'bg-slate-100 text-slate-600'}`}>
                        {model?.name || modelId}
                      </span>
                      <span className="text-xs text-slate-400">on</span>
                      <span className="text-xs font-medium text-slate-600">{task?.name || taskId}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">n={groupRuns.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {metricKeys.map((mk) => {
                        const config = METRIC_CONFIGS[mk];
                        const vals = getMetricValues(groupRuns, mk);
                        if (vals.length < 2) return null;
                        const stats = computeStats(vals);
                        return (
                          <div key={mk} className="text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{config.label}</p>
                            <p className="text-sm font-bold text-slate-700">{config.format(stats.mean)}</p>
                            <p className="text-[10px] text-slate-400">
                              +/-{config.format(stats.stdDev)} | [{config.format(stats.min)}, {config.format(stats.max)}]
                            </p>
                            <p className="text-[10px] text-indigo-500 font-medium">
                              95% CI: [{config.format(stats.ci95Low)}, {config.format(stats.ci95High)}]
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <i className="fas fa-inbox text-4xl text-slate-300 mb-4"></i>
          <p className="text-slate-500">No results yet. Run a benchmark first.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4 pr-4">Model</th>
                  <th className="pb-3 pr-4 pt-4">Task</th>
                  <SortHeader label="Success" field="taskSuccess" />
                  <SortHeader label="Duration" field="wallClockMs" />
                  <SortHeader label="Tokens" field="tokensTotal" />
                  <SortHeader label="Tok/s" field="tokensPerSecond" />
                  <SortHeader label="Tools" field="toolCallsCount" />
                  <th className="pb-3 pr-4 pt-4">Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((run) => {
                  const model = models.find((m) => m.id === run.modelId);
                  const task = tasks.find((t) => t.id === run.taskId);
                  const m = run.metrics!;
                  return (
                    <tr key={run.id} className="hover:bg-slate-50/50">
                      <td className="p-4 pr-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${model?.color || 'bg-slate-100 text-slate-600'}`}>
                          {model?.name || run.modelId.split(':')[0]}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 text-xs">{task?.name || run.taskId}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                m.taskSuccess >= 0.8 ? 'bg-emerald-500' : m.taskSuccess >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${m.taskSuccess * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-600">{Math.round(m.taskSuccess * 100)}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 font-mono text-xs">
                        {METRIC_CONFIGS.wallClockMs.format(m.wallClockMs)}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 font-mono text-xs">{m.tokensTotal}</td>
                      <td className="py-3 pr-4 text-slate-500 font-mono text-xs">
                        {m.tokensPerSecond.toFixed(1)}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 font-mono text-xs">{m.toolCallsCount}</td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={() => handleViewTrace(run)}
                          className="text-indigo-500 hover:text-indigo-700 text-xs font-medium"
                        >
                          <i className="fas fa-magnifying-glass mr-1"></i>View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
    </div>
  );
}
