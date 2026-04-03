import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { BenchmarkRun, ModelConfig, TaskDefinition } from '../types';
import { CHART_COLORS, METRIC_CONFIGS } from '../constants';

interface DashboardProps {
  runs: BenchmarkRun[];
  models: ModelConfig[];
  tasks: TaskDefinition[];
  onNavigate: (view: string) => void;
}

export default function Dashboard({ runs, models, tasks, onNavigate }: DashboardProps) {
  const completedRuns = useMemo(() => runs.filter((r) => r.status === 'completed' && r.metrics), [runs]);

  const stats = useMemo(() => {
    if (completedRuns.length === 0) return { avgSuccess: 0, avgTps: 0, avgDuration: 0, totalRuns: 0 };

    const avgSuccess = completedRuns.reduce((s, r) => s + (r.metrics?.taskSuccess ?? 0), 0) / completedRuns.length;
    const avgTps = completedRuns.reduce((s, r) => s + (r.metrics?.tokensPerSecond ?? 0), 0) / completedRuns.length;
    const avgDuration = completedRuns.reduce((s, r) => s + (r.metrics?.wallClockMs ?? 0), 0) / completedRuns.length;

    return { avgSuccess, avgTps, avgDuration, totalRuns: completedRuns.length };
  }, [completedRuns]);

  const modelSuccessData = useMemo(() => {
    const byModel = new Map<string, { total: number; count: number }>();
    for (const r of completedRuns) {
      const cur = byModel.get(r.modelId) || { total: 0, count: 0 };
      cur.total += r.metrics?.taskSuccess ?? 0;
      cur.count += 1;
      byModel.set(r.modelId, cur);
    }

    return Array.from(byModel.entries())
      .map(([modelId, { total, count }]) => {
        const model = models.find((m) => m.id === modelId);
        return {
          name: model?.name || modelId.split(':')[0],
          success: Math.round((total / count) * 100),
          modelId,
        };
      })
      .sort((a, b) => b.success - a.success);
  }, [completedRuns, models]);

  const recentRuns = useMemo(() => completedRuns.slice(0, 10), [completedRuns]);

  const statCards = [
    { label: 'Total Runs', value: stats.totalRuns.toString(), icon: 'fa-flask', color: 'from-indigo-500 to-violet-500' },
    { label: 'Avg Success', value: METRIC_CONFIGS.taskSuccess.format(stats.avgSuccess), icon: 'fa-bullseye', color: 'from-emerald-500 to-teal-500' },
    { label: 'Avg Speed', value: METRIC_CONFIGS.tokensPerSecond.format(stats.avgTps), icon: 'fa-bolt', color: 'from-amber-500 to-orange-500' },
    { label: 'Models', value: models.length.toString(), icon: 'fa-microchip', color: 'from-rose-500 to-pink-500' },
  ];

  if (completedRuns.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
        <p className="text-slate-500 mb-8">Overview of your benchmarking results</p>

        <div className="text-center py-16">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-rocket text-4xl text-indigo-400"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">No benchmarks yet</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Run your first benchmark to see model performance comparisons, metrics, and insights.
          </p>
          <button
            onClick={() => onNavigate('benchmark')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 hover:shadow-xl transition-all"
          >
            <i className="fas fa-play mr-2"></i>
            Run First Benchmark
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your benchmarking results</p>
        </div>
        <button
          onClick={() => onNavigate('benchmark')}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/20 hover:shadow-xl transition-all"
        >
          <i className="fas fa-play mr-2"></i>New Benchmark
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <i className={`fas ${card.icon} text-white text-sm`}></i>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Success by Model */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-600 mb-4">Task Success by Model</h3>
          {modelSuccessData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={modelSuccessData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={75} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="success" radius={[0, 6, 6, 0]}>
                  {modelSuccessData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No data</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-600 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button onClick={() => onNavigate('leaderboard')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left">
              <i className="fas fa-trophy text-amber-500"></i>
              <span className="text-sm font-medium text-slate-700">View Leaderboard</span>
              <i className="fas fa-chevron-right text-xs text-slate-400 ml-auto"></i>
            </button>
            <button onClick={() => onNavigate('results')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left">
              <i className="fas fa-table text-indigo-500"></i>
              <span className="text-sm font-medium text-slate-700">View All Results ({completedRuns.length})</span>
              <i className="fas fa-chevron-right text-xs text-slate-400 ml-auto"></i>
            </button>
            <button onClick={() => onNavigate('compare')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left">
              <i className="fas fa-code-compare text-violet-500"></i>
              <span className="text-sm font-medium text-slate-700">Compare Models</span>
              <i className="fas fa-chevron-right text-xs text-slate-400 ml-auto"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-600 mb-4">Recent Runs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pr-4">Model</th>
                <th className="pb-3 pr-4">Task</th>
                <th className="pb-3 pr-4">Success</th>
                <th className="pb-3 pr-4">Duration</th>
                <th className="pb-3 pr-4">Tokens</th>
                <th className="pb-3 pr-4">Tool Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRuns.map((run) => {
                const model = models.find((m) => m.id === run.modelId);
                const task = tasks.find((t) => t.id === run.taskId);
                const m = run.metrics!;
                return (
                  <tr key={run.id} className="hover:bg-slate-50/50">
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${model?.color || 'bg-slate-100 text-slate-600'}`}>
                        {model?.name || run.modelId.split(':')[0]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{task?.name || run.taskId}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-bold ${m.taskSuccess >= 0.8 ? 'text-emerald-600' : m.taskSuccess >= 0.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {Math.round(m.taskSuccess * 100)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 font-mono text-xs">
                      {METRIC_CONFIGS.wallClockMs.format(m.wallClockMs)}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 font-mono text-xs">{m.tokensTotal}</td>
                    <td className="py-3 pr-4 text-slate-500 font-mono text-xs">{m.toolCallsCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
