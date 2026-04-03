import React, { useState } from 'react';
import type { ModelConfig } from '../types';
import { MODEL_COLORS } from '../constants';

interface ModelManagerProps {
  models: ModelConfig[];
  ollamaStatus: 'connected' | 'disconnected' | 'checking';
  onRefresh: () => Promise<void>;
  onAddModel: (model: ModelConfig) => void;
}

export default function ModelManager({ models, ollamaStatus, onRefresh, onAddModel }: ModelManagerProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;

    onAddModel({
      id: newId,
      name: newName,
      provider: 'ollama',
      color: MODEL_COLORS[models.length % MODEL_COLORS.length],
      inputPrice: 0,
      outputPrice: 0,
    });

    setNewId('');
    setNewName('');
    setShowAdd(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Models</h1>
          <p className="text-slate-500 mt-1">{models.length} models available</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || ollamaStatus !== 'connected'}
            className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <i className={`fas fa-sync ${refreshing ? 'animate-spin' : ''} mr-2`}></i>
            Refresh from Ollama
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-xl bg-violet-50 text-violet-600 text-sm font-medium hover:bg-violet-100 transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>Add Custom
          </button>
        </div>
      </div>

      {ollamaStatus !== 'connected' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Ollama is not connected. Make sure it's running and <code className="bg-amber-100 px-1 rounded">OLLAMA_ORIGINS=*</code> is set.
          </p>
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-600 mb-4">Add Custom Model</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Model ID (Ollama name)</label>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="e.g. gemma4:latest"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Display Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Gemma 4 27B"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors">
              Add Model
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-500 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {models.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <i className="fas fa-microchip text-4xl text-slate-300 mb-4"></i>
          <p className="text-slate-500 mb-2">No models found</p>
          <p className="text-sm text-slate-400">Pull a model: <code className="bg-slate-100 px-2 py-1 rounded">ollama pull llama3.2</code></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {models.map((model) => (
            <div key={model.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${model.color}`}>
                {model.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 truncate">{model.name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-400 font-mono">{model.id}</span>
                  {model.paramsB && <span className="text-xs text-slate-400">{model.paramsB}B params</span>}
                  {model.family && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${model.color}`}>
                      {model.family}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-500">
                {model.inputPrice === 0 ? 'FREE' : `$${model.inputPrice}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
