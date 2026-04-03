import React, { useState } from 'react';
import type { ModelConfig } from '../types';
import { MODEL_COLORS } from '../constants';
import { OllamaService } from '../services/ollama';

interface ModelManagerProps {
  models: ModelConfig[];
  ollamaStatus: 'connected' | 'disconnected' | 'checking';
  onRefresh: () => Promise<void>;
  onAddModel: (model: ModelConfig) => void;
  ollamaBaseUrl?: string;
}

export default function ModelManager({ models, ollamaStatus, onRefresh, onAddModel, ollamaBaseUrl }: ModelManagerProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState<'ollama' | 'openrouter'>('ollama');
  const [newInputPrice, setNewInputPrice] = useState('');
  const [newOutputPrice, setNewOutputPrice] = useState('');

  // Pull state
  const [showPull, setShowPull] = useState(false);
  const [pullModelName, setPullModelName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState('');
  const [pullProgress, setPullProgress] = useState<{ completed: number; total: number } | null>(null);
  const [pullError, setPullError] = useState('');

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
      name: newName || newId,
      provider: newProvider,
      family: newProvider === 'openrouter' ? newId.split('/')[0] : undefined,
      color: MODEL_COLORS[models.length % MODEL_COLORS.length],
      inputPrice: newProvider === 'openrouter' ? parseFloat(newInputPrice) || 0 : 0,
      outputPrice: newProvider === 'openrouter' ? parseFloat(newOutputPrice) || 0 : 0,
    });

    setNewId('');
    setNewName('');
    setNewProvider('ollama');
    setNewInputPrice('');
    setNewOutputPrice('');
    setShowAdd(false);
  };

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullModelName.trim() || pulling) return;

    const modelName = pullModelName.trim();
    setPulling(true);
    setPullError('');
    setPullStatus('Starting pull...');
    setPullProgress(null);

    try {
      const ollama = new OllamaService(ollamaBaseUrl);
      await ollama.pullModel(modelName, (status, completed, total) => {
        setPullStatus(status);
        if (completed != null && total != null && total > 0) {
          setPullProgress({ completed, total });
        }
      });

      setPullStatus('Pull complete! Refreshing models...');
      await onRefresh();
      setPullModelName('');
      setPullStatus('');
      setPullProgress(null);
      setShowPull(false);
    } catch (err: any) {
      setPullError(err.message || 'Pull failed');
      setPullStatus('');
    } finally {
      setPulling(false);
    }
  };

  const pullPercent = pullProgress && pullProgress.total > 0
    ? Math.round((pullProgress.completed / pullProgress.total) * 100)
    : null;

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
            Refresh
          </button>
          <button
            onClick={() => { setShowPull((p) => !p); setShowAdd(false); setPullError(''); }}
            disabled={ollamaStatus !== 'connected'}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
              showPull ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            <i className={`fas ${showPull ? 'fa-times' : 'fa-download'} mr-2`}></i>
            {showPull ? 'Cancel' : 'Pull Model'}
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowPull(false); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              showAdd ? 'bg-slate-200 text-slate-600' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
            }`}
          >
            <i className={`fas ${showAdd ? 'fa-times' : 'fa-plus'} mr-2`}></i>
            {showAdd ? 'Cancel' : 'Add Custom'}
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

      {/* Pull Model Form */}
      {showPull && (
        <form onSubmit={handlePull} className="bg-white rounded-2xl border border-emerald-200 shadow-lg shadow-emerald-100/50 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-600 mb-4">
            <i className="fas fa-download text-emerald-500 mr-2"></i>
            Pull Model from Ollama Registry
          </h3>

          {pullError && (
            <div className="mb-4 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
              <i className="fas fa-circle-exclamation mr-2"></i>{pullError}
            </div>
          )}

          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={pullModelName}
              onChange={(e) => setPullModelName(e.target.value)}
              placeholder="e.g. llama3.2, qwen3:4b, gemma4:latest"
              disabled={pulling}
              className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pulling || !pullModelName.trim()}
              className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {pulling ? (
                <><i className="fas fa-spinner animate-spin mr-2"></i>Pulling...</>
              ) : (
                <><i className="fas fa-download mr-2"></i>Pull</>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {pulling && (
            <div className="space-y-2">
              {pullPercent != null && (
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${pullPercent}%` }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{pullStatus}</span>
                {pullPercent != null && <span className="font-semibold">{pullPercent}%</span>}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-2">
            Browse available models at <span className="font-semibold">ollama.com/library</span>. The model will be downloaded to your local Ollama instance.
          </p>
        </form>
      )}

      {/* Add Custom Model Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-600 mb-4">
            <i className="fas fa-plus-circle text-violet-500 mr-2"></i>
            Add Custom Model
          </h3>

          {/* Provider Selector */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setNewProvider('ollama')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                newProvider === 'ollama'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <i className="fas fa-server mr-2"></i>Ollama (Local)
            </button>
            <button
              type="button"
              onClick={() => setNewProvider('openrouter')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                newProvider === 'openrouter'
                  ? 'bg-sky-100 text-sky-700 border border-sky-300'
                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <i className="fas fa-cloud mr-2"></i>OpenRouter (Cloud)
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            {newProvider === 'ollama'
              ? 'Add a model that\'s already pulled locally but wasn\'t auto-detected.'
              : 'Add a cloud model via OpenRouter. Requires API key in Settings.'}
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                {newProvider === 'openrouter' ? 'Model ID (e.g. anthropic/claude-sonnet-4-20250514)' : 'Model ID (Ollama name)'}
              </label>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder={newProvider === 'openrouter' ? 'anthropic/claude-sonnet-4-20250514' : 'gemma4:latest'}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Display Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={newProvider === 'openrouter' ? 'Claude Sonnet 4' : 'Gemma 4 27B'}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>
          {newProvider === 'openrouter' && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Input Price ($/token)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={newInputPrice}
                  onChange={(e) => setNewInputPrice(e.target.value)}
                  placeholder="0.000003"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Output Price ($/token)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={newOutputPrice}
                  onChange={(e) => setNewOutputPrice(e.target.value)}
                  placeholder="0.000015"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
                />
              </div>
            </div>
          )}
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
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800 truncate">{model.name}</h3>
                  {model.provider === 'openrouter' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-700">
                      <i className="fas fa-cloud mr-0.5"></i>CLOUD
                    </span>
                  )}
                </div>
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
