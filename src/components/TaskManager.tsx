import React, { useState, useMemo } from 'react';
import type { TaskDefinition, TaskType, ScoringMethod, GridConfig } from '../types';
import { createGridTask, type GridDifficulty } from '../tasks/grid-navigation';
import { getAllToolNames } from '../agent/tools';
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
    label: 'Contains Check',
    description: 'Agent\'s answer must contain the expected value (case-insensitive). Good for answers embedded in sentences.',
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

const TASK_TYPE_OPTIONS: { value: TaskType; label: string; description: string }[] = [
  { value: 'deterministic', label: 'Deterministic', description: 'Has a known correct answer that can be verified automatically' },
  { value: 'open_ended', label: 'Open-Ended', description: 'Requires LLM-as-Judge evaluation (no single correct answer)' },
];

const SCORING_OPTIONS: { value: ScoringMethod; label: string; forTypes: TaskType[] }[] = [
  { value: 'exact_match', label: 'Exact Match', forTypes: ['deterministic'] },
  { value: 'function_check', label: 'Contains Check', forTypes: ['deterministic'] },
  { value: 'llm_judge', label: 'LLM-as-Judge', forTypes: ['deterministic', 'open_ended'] },
];

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant with access to tools. Use the available tools to answer the user\'s question accurately. When you have the final answer, respond with just the answer — no extra explanation unless asked.';

export default function TaskManager({ tasks, onAddTask }: TaskManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewGrid, setPreviewGrid] = useState<{ config: GridConfig; name: string } | null>(null);
  const [gridDifficulty, setGridDifficulty] = useState<GridDifficulty>('easy');
  const [showAdd, setShowAdd] = useState(false);

  // ── Create Task Form State ─────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<TaskType>('deterministic');
  const [newSystemPrompt, setNewSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [newUserPrompt, setNewUserPrompt] = useState('');
  const [newTools, setNewTools] = useState<string[]>([]);
  const [newMaxSteps, setNewMaxSteps] = useState(10);
  const [newScoringMethod, setNewScoringMethod] = useState<ScoringMethod>('function_check');
  const [newExpectedAnswer, setNewExpectedAnswer] = useState('');
  const [formError, setFormError] = useState('');

  const availableTools = useMemo(() => getAllToolNames(), []);

  const handleGenerateGrid = () => {
    const task = createGridTask(gridDifficulty);
    onAddTask(task);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleTool = (tool: string) => {
    setNewTools((prev) => prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]);
  };

  const resetForm = () => {
    setNewName('');
    setNewDescription('');
    setNewType('deterministic');
    setNewSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setNewUserPrompt('');
    setNewTools([]);
    setNewMaxSteps(10);
    setNewScoringMethod('function_check');
    setNewExpectedAnswer('');
    setFormError('');
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newName.trim()) { setFormError('Task name is required'); return; }
    if (!newUserPrompt.trim()) { setFormError('User prompt is required'); return; }
    if (newScoringMethod !== 'llm_judge' && !newExpectedAnswer.trim()) {
      setFormError('Expected answer is required for this scoring method'); return;
    }

    const taskId = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (tasks.some((t) => t.id === taskId)) {
      setFormError(`A task with ID "${taskId}" already exists`); return;
    }

    const task: TaskDefinition = {
      id: taskId,
      name: newName.trim(),
      type: newType,
      description: newDescription.trim() || newUserPrompt.trim().slice(0, 100),
      systemPrompt: newSystemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
      userPrompt: newUserPrompt.trim(),
      tools: newTools,
      maxSteps: newMaxSteps,
      scoringMethod: newScoringMethod,
      expectedAnswer: newExpectedAnswer.trim() || undefined,
    };

    onAddTask(task);
    resetForm();
    setShowAdd(false);
  };

  // Auto-switch scoring when type changes
  const handleTypeChange = (type: TaskType) => {
    setNewType(type);
    if (type === 'open_ended') {
      setNewScoringMethod('llm_judge');
    } else if (newScoringMethod === 'llm_judge') {
      setNewScoringMethod('function_check');
    }
  };

  const filteredScoringOptions = SCORING_OPTIONS.filter((o) => o.forTypes.includes(newType));
  const customCount = useMemo(() => tasks.filter((t) => !t.builtin).length, [tasks]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tasks</h1>
          <p className="text-slate-500 mt-1">
            {tasks.length} tasks available{customCount > 0 ? ` (${customCount} custom)` : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowAdd((p) => !p); if (showAdd) resetForm(); }}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            showAdd
              ? 'bg-slate-200 text-slate-600'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
          }`}
        >
          <i className={`fas ${showAdd ? 'fa-times' : 'fa-plus'} mr-2`}></i>
          {showAdd ? 'Cancel' : 'Create Task'}
        </button>
      </div>

      {/* ── Create Task Form ────────────────────────────────── */}
      {showAdd && (
        <form onSubmit={handleCreateTask} className="bg-white rounded-2xl border border-indigo-200 shadow-lg shadow-indigo-100/50 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-600 mb-4">
            <i className="fas fa-plus-circle text-indigo-500 mr-2"></i>
            Create Custom Task
          </h3>

          {formError && (
            <div className="mb-4 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
              <i className="fas fa-circle-exclamation mr-2"></i>{formError}
            </div>
          )}

          {/* Row 1: Name + Type */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Task Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. API Key Extraction"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
              {newName && (
                <p className="text-[10px] text-slate-400 mt-1">
                  ID: <span className="font-mono font-semibold">{newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Task Type</label>
              <div className="space-y-1.5">
                {TASK_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      newType === opt.value
                        ? `${TYPE_BADGES[opt.value].color} border-current`
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <i className={`fas ${TYPE_BADGES[opt.value].icon} mr-1.5`}></i>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description of what this task tests"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>

          {/* System Prompt */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Prompt</label>
              <button
                type="button"
                onClick={() => setNewSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                className="text-[10px] text-indigo-500 hover:text-indigo-600 font-semibold"
              >
                Reset to Default
              </button>
            </div>
            <textarea
              value={newSystemPrompt}
              onChange={(e) => setNewSystemPrompt(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
            />
          </div>

          {/* User Prompt */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">User Prompt</label>
            <textarea
              value={newUserPrompt}
              onChange={(e) => setNewUserPrompt(e.target.value)}
              placeholder="The instruction or question the agent will receive..."
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
            />
          </div>

          {/* Tools + Max Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Tool Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Available Tools <span className="font-normal text-slate-400">({newTools.length} selected)</span>
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                {availableTools.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {availableTools.map((tool) => {
                      const selected = newTools.includes(tool);
                      return (
                        <button
                          key={tool}
                          type="button"
                          onClick={() => toggleTool(tool)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all border ${
                            selected
                              ? 'bg-violet-100 text-violet-700 border-violet-300'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {selected && <i className="fas fa-check mr-1.5 text-[10px]"></i>}
                          {tool}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No tools registered. Create tools first in the Tools section.</p>
                )}
              </div>
            </div>

            {/* Max Steps */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Max Steps</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={newMaxSteps}
                  onChange={(e) => setNewMaxSteps(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-200 rounded-full appearance-none accent-indigo-600"
                />
                <span className="w-10 text-center text-sm font-bold text-slate-700 bg-slate-100 rounded-lg py-1">{newMaxSteps}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Maximum LLM calls before the agent is stopped</p>

              {/* Scoring Method */}
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 mt-4">Scoring Method</label>
              <div className="space-y-1.5">
                {filteredScoringOptions.map((opt) => {
                  const desc = SCORING_DESCRIPTIONS[opt.value];
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewScoringMethod(opt.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border ${
                        newScoringMethod === opt.value
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <i className={`fas ${desc?.icon || 'fa-question'} mr-1.5`}></i>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Expected Answer (not shown for llm_judge) */}
          {newScoringMethod !== 'llm_judge' && (
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expected Answer</label>
              <input
                type="text"
                value={newExpectedAnswer}
                onChange={(e) => setNewExpectedAnswer(e.target.value)}
                placeholder={newScoringMethod === 'exact_match' ? 'The exact answer the agent should return' : 'A value that should appear in the agent\'s answer'}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {newScoringMethod === 'exact_match'
                  ? 'The agent\'s answer must match this exactly (case-insensitive, trimmed)'
                  : 'The agent\'s answer must contain this value (case-insensitive)'}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <i className="fas fa-plus mr-2"></i>Create Task
            </button>
          </div>
        </form>
      )}

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
