import React, { useState } from 'react';
import type { TaskDefinition, GridConfig } from '../types';
import { createGridTask, type GridDifficulty } from '../tasks/grid-navigation';
import GridVisualization from './GridVisualization';

interface TaskManagerProps {
  tasks: TaskDefinition[];
  onAddTask: (task: TaskDefinition) => void;
}

const TYPE_BADGES: Record<string, { color: string; icon: string; label: string }> = {
  deterministic: { color: 'bg-blue-100 text-blue-700', icon: 'fa-calculator', label: 'Deterministic' },
  open_ended: { color: 'bg-purple-100 text-purple-700', icon: 'fa-brain', label: 'Open-Ended' },
  visual: { color: 'bg-emerald-100 text-emerald-700', icon: 'fa-grid', label: 'Visual' },
};

const SCORING_DESCRIPTIONS: Record<string, { label: string; description: string; icon: string }> = {
  exact_match: {
    label: 'Exact Match',
    description: 'Agent\'s answer must exactly match the expected answer (case-insensitive, trimmed).',
    icon: 'fa-equals',
  },
  function_check: {
    label: 'Function Check',
    description: 'A custom function validates the answer — checks if it contains the correct value or falls within tolerance.',
    icon: 'fa-code',
  },
  json_compare: {
    label: 'JSON Compare',
    description: 'Compares JSON output field-by-field against expected structure. Partial credit for partial matches.',
    icon: 'fa-brackets-curly',
  },
  llm_judge: {
    label: 'LLM-as-Judge',
    description: 'A separate judge model scores the output on a 1-5 rubric evaluating correctness, reasoning, and efficiency.',
    icon: 'fa-gavel',
  },
  trajectory: {
    label: 'Trajectory Efficiency',
    description: 'Scores based on whether the agent reached the goal AND how efficiently (optimal steps / actual steps). Must reach goal to score > 0.',
    icon: 'fa-route',
  },
};

export default function TaskManager({ tasks, onAddTask }: TaskManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewGrid, setPreviewGrid] = useState<{ config: GridConfig; name: string } | null>(null);
  const [gridDifficulty, setGridDifficulty] = useState<GridDifficulty>('easy');

  const handleGenerateGrid = () => {
    const task = createGridTask(gridDifficulty);
    onAddTask(task);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tasks</h1>
          <p className="text-slate-500 mt-1">{tasks.length} tasks available</p>
        </div>
      </div>

      {/* Generate Grid Task */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-bold text-slate-600 mb-3">
          <i className="fas fa-grid text-emerald-500 mr-2"></i>
          Generate New Grid Navigation Task
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['easy', 'medium', 'hard'] as GridDifficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setGridDifficulty(d)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
                  gridDifficulty === d ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerateGrid}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            <i className="fas fa-shuffle mr-2"></i>Generate
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const badge = TYPE_BADGES[task.type] || TYPE_BADGES.deterministic;
          const isExpanded = expandedId === task.id;
          const scoring = SCORING_DESCRIPTIONS[task.scoringMethod] || {
            label: task.scoringMethod, description: '', icon: 'fa-question',
          };

          return (
            <div
              key={task.id}
              className={`bg-white rounded-2xl border transition-all ${
                isExpanded ? 'border-indigo-200 shadow-lg shadow-indigo-100/50' : 'border-slate-200'
              }`}
            >
              {/* Header (always visible, clickable) */}
              <button
                onClick={() => toggleExpand(task.id)}
                className="w-full text-left p-5 flex items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${badge.color}`}>
                  <i className={`fas ${badge.icon} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800">{task.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                    {task.builtin && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                        Built-in
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{task.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span><i className="fas fa-wrench mr-1"></i>{task.tools.join(', ') || 'none'}</span>
                    <span><i className="fas fa-shoe-prints mr-1"></i>Max {task.maxSteps} steps</span>
                    <span><i className={`fas ${scoring.icon} mr-1`}></i>{scoring.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.type === 'visual' && task.configJson && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setPreviewGrid({ config: task.configJson, name: task.name }); }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <i className="fas fa-eye mr-1"></i>Grid
                    </span>
                  )}
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-slate-400`}></i>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    {/* System Prompt */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        <i className="fas fa-terminal mr-1.5 text-indigo-400"></i>System Prompt
                      </h4>
                      <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap max-h-40 overflow-y-auto border border-slate-100 font-mono leading-relaxed">
                        {task.systemPrompt}
                      </pre>
                    </div>

                    {/* User Prompt */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        <i className="fas fa-user mr-1.5 text-blue-400"></i>User Prompt
                      </h4>
                      <pre className="text-xs text-slate-600 bg-blue-50/50 rounded-xl p-3 whitespace-pre-wrap max-h-40 overflow-y-auto border border-blue-100/50 font-mono leading-relaxed">
                        {task.userPrompt}
                      </pre>
                    </div>

                    {/* Scoring */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        <i className={`fas ${scoring.icon} mr-1.5 text-amber-400`}></i>Scoring Method
                      </h4>
                      <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/50">
                        <p className="text-sm font-semibold text-slate-700 mb-1">{scoring.label}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{scoring.description}</p>
                        {task.expectedAnswer && (
                          <div className="mt-2 pt-2 border-t border-amber-200/50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Expected Answer</span>
                            <p className="text-sm font-mono text-slate-700 mt-0.5">{task.expectedAnswer}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tools */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        <i className="fas fa-wrench mr-1.5 text-violet-400"></i>Available Tools
                      </h4>
                      {task.tools.length > 0 ? (
                        <div className="space-y-1.5">
                          {task.tools.map((toolName) => (
                            <div key={toolName} className="flex items-center gap-2 bg-violet-50/50 rounded-lg p-2.5 border border-violet-100/50">
                              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                                <i className={`fas ${getToolIcon(toolName)} text-violet-600 text-[10px]`}></i>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-700 font-mono">{toolName}</p>
                                <p className="text-[10px] text-slate-400">{getToolDescription(toolName)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">No tools — pure reasoning task</p>
                      )}
                    </div>
                  </div>

                  {/* Grid Config (for visual tasks) */}
                  {task.type === 'visual' && task.configJson && (
                    <div className="mt-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        <i className="fas fa-grid mr-1.5 text-emerald-400"></i>Grid Configuration
                      </h4>
                      <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/50 flex items-center gap-6">
                        <div className="text-xs text-slate-600">
                          <span className="font-semibold">{task.configJson.width}x{task.configJson.height}</span> grid
                        </div>
                        <div className="text-xs text-slate-600">
                          Start: <span className="font-mono font-semibold">[{task.configJson.startPos.join(', ')}]</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Goal: <span className="font-mono font-semibold">[{task.configJson.goalPos.join(', ')}]</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Optimal: <span className="font-semibold">{task.configJson.optimalPathLength} steps</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Obstacles: <span className="font-semibold">
                            {task.configJson.grid.flat().filter((c: string) => c === 'obstacle').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid Preview */}
      {previewGrid && (
        <GridVisualization
          gridConfig={previewGrid.config}
          steps={[]}
          onClose={() => setPreviewGrid(null)}
          modelName={previewGrid.name}
        />
      )}
    </div>
  );
}

function getToolIcon(name: string): string {
  const icons: Record<string, string> = {
    calculator: 'fa-calculator',
    search: 'fa-magnifying-glass',
    weather: 'fa-cloud-sun',
    move: 'fa-arrows-up-down-left-right',
    look: 'fa-eye',
  };
  return icons[name] || 'fa-wrench';
}

function getToolDescription(name: string): string {
  const descriptions: Record<string, string> = {
    calculator: 'Evaluate math expressions',
    search: 'Search a knowledge base for facts',
    weather: 'Get weather data for a city',
    move: 'Move agent on the grid (up/down/left/right)',
    look: 'See surrounding cells and goal position',
  };
  return descriptions[name] || 'Custom tool';
}
