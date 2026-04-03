import React, { useState } from 'react';
import type { TaskDefinition, ModelConfig } from '../types';

interface BenchmarkRunnerProps {
  tasks: TaskDefinition[];
  models: ModelConfig[];
  ollamaConnected: boolean;
  onRunBenchmark: (taskIds: string[], modelIds: string[], iterations: number) => Promise<void>;
}

const TYPE_BADGES: Record<string, { color: string; icon: string }> = {
  deterministic: { color: 'bg-blue-100 text-blue-700', icon: 'fa-calculator' },
  open_ended: { color: 'bg-purple-100 text-purple-700', icon: 'fa-brain' },
  visual: { color: 'bg-emerald-100 text-emerald-700', icon: 'fa-grid' },
};

export default function BenchmarkRunner({ tasks, models, ollamaConnected, onRunBenchmark }: BenchmarkRunnerProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [iterations, setIterations] = useState(1);
  const [launching, setLaunching] = useState(false);

  const totalRuns = selectedTasks.size * selectedModels.size * iterations;

  const toggleTask = (id: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModel = (id: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllTasks = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
  };

  const toggleAllModels = () => {
    if (selectedModels.size === models.length) {
      setSelectedModels(new Set());
    } else {
      setSelectedModels(new Set(models.map((m) => m.id)));
    }
  };

  const handleLaunch = async () => {
    if (selectedTasks.size === 0 || selectedModels.size === 0) return;
    setLaunching(true);
    try {
      await onRunBenchmark([...selectedTasks], [...selectedModels], iterations);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Run Benchmark</h1>
        <p className="text-slate-500 mt-1">Select tasks and models, then launch a benchmark run</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tasks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-700">
              <i className="fas fa-list-check text-indigo-500 mr-2"></i>
              Tasks
            </h2>
            <button onClick={toggleAllTasks} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              {selectedTasks.size === tasks.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No tasks available. Go to Tasks to create some.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tasks.map((task) => {
                const badge = TYPE_BADGES[task.type] || TYPE_BADGES.deterministic;
                return (
                  <label
                    key={task.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTasks.has(task.id)
                        ? 'border-indigo-300 bg-indigo-50/50'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTasks.has(task.id)}
                      onChange={() => toggleTask(task.id)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 truncate">{task.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                          {task.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{task.tools.length} tools</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Models */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-700">
              <i className="fas fa-microchip text-violet-500 mr-2"></i>
              Models
            </h2>
            <button onClick={toggleAllModels} className="text-xs font-medium text-violet-600 hover:text-violet-800">
              {selectedModels.size === models.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {!ollamaConnected ? (
            <div className="text-center py-8">
              <i className="fas fa-plug text-2xl text-rose-300 mb-2"></i>
              <p className="text-sm text-rose-500 font-medium">Ollama not connected</p>
              <p className="text-xs text-slate-400 mt-1">Start Ollama and set OLLAMA_ORIGINS=*</p>
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-download text-2xl text-slate-300 mb-2"></i>
              <p className="text-sm text-slate-400">No models found. Pull a model with:</p>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded mt-2 inline-block">ollama pull llama3.2</code>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {models.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedModels.has(model.id)
                      ? 'border-violet-300 bg-violet-50/50'
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.has(model.id)}
                    onChange={() => toggleModel(model.id)}
                    className="w-4 h-4 rounded text-violet-600"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700">{model.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${model.color}`}>
                        {model.family || model.provider}
                      </span>
                      {model.paramsB && (
                        <span className="text-[10px] text-slate-400">{model.paramsB}B params</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-500 font-bold">
                    {model.inputPrice === 0 ? 'FREE' : `$${model.inputPrice.toFixed(6)}/tok`}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-700 mb-4">
          <i className="fas fa-sliders text-amber-500 mr-2"></i>
          Configuration
        </h2>
        <div className="flex items-center gap-8">
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-2">Iterations per combination</label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setIterations(n)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                    iterations === n
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 text-right">
            <div className="text-sm text-slate-500 mb-1">
              {selectedTasks.size} tasks x {selectedModels.size} models x {iterations} iterations
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {totalRuns} <span className="text-sm font-normal text-slate-400">runs queued</span>
            </div>
          </div>
        </div>
      </div>

      {/* Launch */}
      <button
        onClick={handleLaunch}
        disabled={totalRuns === 0 || launching || !ollamaConnected}
        className={`w-full py-4 rounded-2xl text-lg font-bold transition-all flex items-center justify-center gap-3 ${
          totalRuns > 0 && !launching && ollamaConnected
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/30 hover:shadow-2xl hover:shadow-indigo-600/40 active:scale-[0.99]'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        <i className={`fas ${launching ? 'fa-spinner animate-spin' : 'fa-rocket'}`}></i>
        {launching ? 'Running...' : `Launch Benchmark — ${totalRuns} Runs`}
      </button>
    </div>
  );
}
