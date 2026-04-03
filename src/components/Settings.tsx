import React, { useState } from 'react';
import type { AppSettings } from '../types';
import { exportDatabase, clearAllData } from '../services/database';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  ollamaStatus: 'connected' | 'disconnected' | 'checking';
}

export default function Settings({ settings, onUpdateSettings, ollamaStatus }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  const update = (partial: Partial<AppSettings>) => {
    setLocalSettings((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  };

  const updateLangfuse = (partial: Partial<AppSettings['langfuse']>) => {
    setLocalSettings((prev) => ({ ...prev, langfuse: { ...prev.langfuse, ...partial } }));
    setSaved(false);
  };

  const handleSave = () => {
    onUpdateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const data = exportDatabase();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentbench-export-${Date.now()}.db`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure? This will delete ALL benchmark data.')) {
      clearAllData();
      window.location.reload();
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">Configure connections and preferences</p>
      </div>

      {/* Ollama */}
      <Section title="Ollama" icon="fa-server" iconColor="text-emerald-500">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${
            ollamaStatus === 'connected' ? 'bg-emerald-400' : ollamaStatus === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'
          }`}></div>
          <span className="text-sm text-slate-600">
            {ollamaStatus === 'connected' ? 'Connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Disconnected'}
          </span>
        </div>
        <Field label="Base URL" value={localSettings.ollamaBaseUrl} onChange={(v) => update({ ollamaBaseUrl: v })} placeholder="http://localhost:11434" />
        <p className="text-xs text-slate-400 mt-2">
          Make sure Ollama is running with <code className="bg-slate-100 px-1 rounded">OLLAMA_ORIGINS=*</code> for CORS support.
        </p>
      </Section>

      {/* OpenRouter */}
      <Section title="OpenRouter (LLM-as-Judge)" icon="fa-cloud" iconColor="text-violet-500">
        <Field label="API Key" value={localSettings.openrouterApiKey} onChange={(v) => update({ openrouterApiKey: v })} placeholder="sk-or-..." type="password" />
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Judge Provider</label>
            <select
              value={localSettings.judgeProvider}
              onChange={(e) => update({ judgeProvider: e.target.value as 'ollama' | 'openrouter' })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="openrouter">OpenRouter (Cloud)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Judge Model</label>
            <input
              type="text"
              value={localSettings.judgeModel}
              onChange={(e) => update({ judgeModel: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              placeholder="llama3.1 or google/gemini-2.0-flash-001"
            />
          </div>
        </div>
      </Section>

      {/* Langfuse */}
      <Section title="Langfuse (Tracing)" icon="fa-chart-line" iconColor="text-indigo-500">
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={localSettings.langfuse.enabled}
            onChange={(e) => updateLangfuse({ enabled: e.target.checked })}
            className="w-4 h-4 rounded text-indigo-600"
          />
          <span className="text-sm font-medium text-slate-600">Enable Langfuse tracing</span>
        </label>
        {localSettings.langfuse.enabled && (
          <>
            <Field label="Host URL" value={localSettings.langfuse.host} onChange={(v) => updateLangfuse({ host: v })} placeholder="http://localhost:3000" />
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Field label="Public Key" value={localSettings.langfuse.publicKey} onChange={(v) => updateLangfuse({ publicKey: v })} placeholder="pk-lf-..." />
              <Field label="Secret Key" value={localSettings.langfuse.secretKey} onChange={(v) => updateLangfuse({ secretKey: v })} placeholder="sk-lf-..." type="password" />
            </div>
          </>
        )}
      </Section>

      {/* Agent Defaults */}
      <Section title="Agent Defaults" icon="fa-robot" iconColor="text-amber-500">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Default Max Steps</label>
          <input
            type="number"
            value={localSettings.defaultMaxSteps}
            onChange={(e) => update({ defaultMaxSteps: parseInt(e.target.value) || 15 })}
            className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm"
            min={1}
            max={100}
          />
        </div>
      </Section>

      {/* Database */}
      <Section title="Database" icon="fa-database" iconColor="text-rose-500">
        <div className="flex gap-3">
          <button onClick={handleExport} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            <i className="fas fa-download mr-2"></i>Export Database
          </button>
          <button onClick={handleClearData} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors">
            <i className="fas fa-trash mr-2"></i>Clear All Data
          </button>
        </div>
      </Section>

      {/* Save */}
      <div className="sticky bottom-0 bg-slate-100 py-4 border-t border-slate-200 mt-8 -mx-8 px-8">
        <button
          onClick={handleSave}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 hover:shadow-xl'
          }`}
        >
          {saved ? (
            <><i className="fas fa-check mr-2"></i>Saved!</>
          ) : (
            <><i className="fas fa-save mr-2"></i>Save Settings</>
          )}
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, iconColor, children }: { title: string; icon: string; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
      <h3 className="text-sm font-bold text-slate-600 mb-4">
        <i className={`fas ${icon} ${iconColor} mr-2`}></i>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
      />
    </div>
  );
}
