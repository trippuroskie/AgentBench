import React from 'react';
import type { AgentStep } from '../types';

interface AgentTraceViewProps {
  steps: AgentStep[];
  onClose: () => void;
  modelName?: string;
  taskName?: string;
}

export default function AgentTraceView({ steps, onClose, modelName, taskName }: AgentTraceViewProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white rounded-[2rem] w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Agent Trace</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {modelName && <span className="font-medium text-slate-600">{modelName}</span>}
              {modelName && taskName && <span className="mx-2">on</span>}
              {taskName && <span className="font-medium text-slate-600">{taskName}</span>}
              <span className="ml-2">— {steps.length} steps</span>
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <i className="fas fa-times text-slate-500"></i>
          </button>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {steps.map((step) => (
            <div
              key={step.stepIndex}
              className={`rounded-xl border p-4 ${
                step.role === 'assistant'
                  ? step.toolCall
                    ? 'border-indigo-200 bg-indigo-50/30'
                    : 'border-blue-200 bg-blue-50/30'
                  : 'border-emerald-200 bg-emerald-50/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${
                  step.role === 'assistant' ? 'bg-indigo-500' : 'bg-emerald-500'
                }`}>
                  {step.stepIndex}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {step.role === 'assistant' ? (step.toolCall ? 'Tool Call' : 'Response') : 'Tool Result'}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto font-mono">
                  {step.durationMs.toFixed(0)}ms
                  {step.tokensOutput != null && ` · ${step.tokensOutput} tokens`}
                </span>
              </div>

              {/* Tool call */}
              {step.toolCall && (
                <div className="mb-2">
                  <span className="text-sm font-semibold text-indigo-700">
                    {step.toolCall.function.name}
                  </span>
                  <pre className="mt-1 text-xs bg-white/60 rounded-lg p-2 overflow-x-auto text-slate-600 border border-slate-200/50">
                    {formatJson(step.toolCall.function.arguments)}
                  </pre>
                </div>
              )}

              {/* Content */}
              {step.content && !step.toolCall && step.role === 'assistant' && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{step.content}</p>
              )}

              {/* Tool result */}
              {step.role === 'tool' && step.content && (
                <pre className="text-xs bg-white/60 rounded-lg p-2 overflow-x-auto text-slate-600 border border-slate-200/50 max-h-40">
                  {formatJson(step.content)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
