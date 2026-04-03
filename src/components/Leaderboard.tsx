import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { BenchmarkRun, ModelConfig, TaskDefinition } from '../types';
import { METRIC_CONFIGS, CHART_COLORS } from '../constants';
import type { MetricConfig } from '../constants';
import { computeStats } from '../utils/stats';

interface LeaderboardProps {
  runs: BenchmarkRun[];
  models: ModelConfig[];
  tasks: TaskDefinition[];
}

type SortMetric = 'taskSuccess' | 'tokensPerSecond' | 'wallClockMs' | 'toolCallsCount' | 'toolEfficiency' | 'trajectoryEfficiency' | 'costEstimateUsd';

const SORT_OPTIONS: { key: SortMetric; label: string }[] = [
  { key: 'taskSuccess', label: 'Success Rate' },
  { key: 'tokensPerSecond', label: 'Tokens/sec' },
  { key: 'wallClockMs', label: 'Duration' },
  { key: 'toolCallsCount', label: 'Tool Calls' },
  { key: 'toolEfficiency', label: 'Tool Efficiency' },
  { key: 'trajectoryEfficiency', label: 'Trajectory' },
];

export default function Leaderboard({ runs, models, tasks }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortMetric>('taskSuccess');
  const [filterTask, setFilterTask] = useState<string>('');

  const completedRuns = useMemo(
    () => runs.filter((r) => r.status === 'completed' && r.metrics),
    [runs]
  );

  const filteredRuns = useMemo(() => {
    if (!filterTask) return completedRuns;
    return completedRuns.filter((r) => r.taskId === filterTask);
  }, [completedRuns, filterTask]);

  const leaderboardData = useMemo(() => {
    const metricKeys = ['taskSuccess', 'tokensPerSecond', 'wallClockMs', 'toolCallsCount', 'toolEfficiency', 'trajectoryEfficiency', 'costEstimateUsd'] as const;
    const byModel = new Map<string, { values: Record<string, number[]> }>();

    for (const run of filteredRuns) {
      const m = run.metrics!;
      let entry = byModel.get(run.modelId);
      if (!entry) {
        entry = { values: {} };
        byModel.set(run.modelId, entry);
      }

      for (const key of metricKeys) {
        const val = m[key];
        if (val != null) {
          if (!entry.values[key]) entry.values[key] = [];
          entry.values[key].push(val);
        }
      }
    }

    return Array.from(byModel.entries()).map(([modelId, { values }]) => {
      const model = models.find((m) => m.id === modelId);
      const avgs: Record<string, number> = {};
      const stdDevs: Record<string, number> = {};
      let runCount = 0;

      for (const key of Object.keys(values)) {
        const stats = computeStats(values[key]);
        avgs[key] = stats.mean;
        stdDevs[key] = stats.stdDev;
        if (key === 'taskSuccess') runCount = stats.n;
      }

      return {
        modelId,
        name: model?.name || modelId.split(':')[0],
        color: model?.color || 'bg-slate-100 text-slate-600',
        paramsB: model?.paramsB,
        runs: runCount,
        stdDevs,
        ...avgs,
      };
    });
  }, [filteredRuns, models]);

  const sorted = useMemo(() => {
    const config = METRIC_CONFIGS[sortBy];
    return [...leaderboardData].sort((a, b) => {
      const va = (a as any)[sortBy] ?? 0;
      const vb = (b as any)[sortBy] ?? 0;
      return config.higherBetter ? vb - va : va - vb;
    });
  }, [leaderboardData, sortBy]);

  const config = METRIC_CONFIGS[sortBy];
  const uniqueTasks = useMemo(() => [...new Set(completedRuns.map((r) => r.taskId))], [completedRuns]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Leaderboard</h1>
        <p className="text-slate-500 mt-1">Model rankings across benchmarks</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex bg-white rounded-xl border border-slate-200 p-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                sortBy === opt.key
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

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

      {sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <i className="fas fa-trophy text-4xl text-slate-300 mb-4"></i>
          <p className="text-slate-500">No data yet. Run some benchmarks first.</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 50)}>
              <BarChart data={sorted} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(v) => config.format(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={95} />
                <Tooltip formatter={(v: number) => config.format(v)} />
                <Bar dataKey={sortBy} radius={[0, 6, 6, 0]}>
                  {sorted.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4 w-12">#</th>
                  <th className="p-4">Model</th>
                  <th className="p-4">Runs</th>
                  <th className="p-4">Success</th>
                  <th className="p-4">Speed</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Tool Calls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((entry, i) => (
                  <tr key={entry.modelId} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${entry.color}`}>{entry.name}</span>
                      {entry.paramsB && <span className="text-[10px] text-slate-400 ml-2">{entry.paramsB}B</span>}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">{entry.runs}</td>
                    <td className="p-4 font-bold text-slate-700">
                      {METRIC_CONFIGS.taskSuccess.format((entry as any).taskSuccess || 0)}
                      {entry.runs > 1 && entry.stdDevs.taskSuccess > 0 && (
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          +/-{Math.round(entry.stdDevs.taskSuccess * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">
                      {METRIC_CONFIGS.tokensPerSecond.format((entry as any).tokensPerSecond || 0)}
                      {entry.runs > 1 && entry.stdDevs.tokensPerSecond > 0 && (
                        <span className="text-[10px] text-slate-400 ml-1">+/-{entry.stdDevs.tokensPerSecond.toFixed(1)}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">
                      {METRIC_CONFIGS.wallClockMs.format((entry as any).wallClockMs || 0)}
                      {entry.runs > 1 && entry.stdDevs.wallClockMs > 0 && (
                        <span className="text-[10px] text-slate-400 ml-1">+/-{METRIC_CONFIGS.wallClockMs.format(entry.stdDevs.wallClockMs)}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">{Math.round((entry as any).toolCallsCount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
