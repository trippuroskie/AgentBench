import React, { useState, useMemo } from 'react';
import type { ToolDefinition, CustomToolType, HttpToolConfig } from '../types';
import { getAllToolDefinitions, hasTool, registerCustomTool, registerHttpTool, registerJsTool } from '../agent/tools';

const TOOL_ICONS: Record<string, string> = {
  calculator: 'fa-calculator',
  search: 'fa-magnifying-glass',
  weather: 'fa-cloud-sun',
  move: 'fa-arrows-up-down-left-right',
  look: 'fa-eye',
};

const BUILTIN_TOOLS = new Set(['calculator', 'search', 'weather', 'move', 'look']);

const EXAMPLE_TOOLS = {
  weather_api: {
    name: 'weather_api',
    description: 'Get real weather data for any city using wttr.in API',
    params: [{ name: 'city', type: 'string', description: 'City name', required: true }],
    toolType: 'http' as CustomToolType,
    httpMethod: 'GET' as const,
    urlTemplate: 'https://wttr.in/{{city}}?format=j1',
  },
  duckduckgo: {
    name: 'web_search',
    description: 'Search the web using DuckDuckGo instant answers API',
    params: [{ name: 'query', type: 'string', description: 'Search query', required: true }],
    toolType: 'http' as CustomToolType,
    httpMethod: 'GET' as const,
    urlTemplate: 'https://api.duckduckgo.com/?q={{query}}&format=json&no_html=1',
  },
};

export default function ToolsManager() {
  const [tools, setTools] = useState<ToolDefinition[]>(() => getAllToolDefinitions());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // ── Add Tool Form State ──────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [toolType, setToolType] = useState<CustomToolType>('template');
  const [newParams, setNewParams] = useState<{ name: string; type: string; description: string; required: boolean }[]>([
    { name: '', type: 'string', description: '', required: true },
  ]);
  const [newResponse, setNewResponse] = useState('');
  // HTTP tool state
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST'>('GET');
  const [urlTemplate, setUrlTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  // JS tool state
  const [jsFunction, setJsFunction] = useState('');
  const [error, setError] = useState('');

  const toggleExpand = (name: string) => {
    setExpandedId((prev) => (prev === name ? null : name));
  };

  const addParam = () => {
    setNewParams((prev) => [...prev, { name: '', type: 'string', description: '', required: false }]);
  };

  const removeParam = (index: number) => {
    setNewParams((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParam = (index: number, field: string, value: string | boolean) => {
    setNewParams((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const resetForm = () => {
    setNewName('');
    setNewDescription('');
    setToolType('template');
    setNewParams([{ name: '', type: 'string', description: '', required: true }]);
    setNewResponse('');
    setHttpMethod('GET');
    setUrlTemplate('');
    setBodyTemplate('');
    setJsFunction('');
    setError('');
  };

  const prefillExample = (key: keyof typeof EXAMPLE_TOOLS) => {
    const ex = EXAMPLE_TOOLS[key];
    setNewName(ex.name);
    setNewDescription(ex.description);
    setToolType(ex.toolType);
    setNewParams(ex.params.map((p) => ({ ...p, type: p.type || 'string' })));
    setHttpMethod(ex.httpMethod);
    setUrlTemplate(ex.urlTemplate);
    setError('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const toolName = newName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!toolName) { setError('Tool name is required'); return; }
    if (hasTool(toolName)) { setError(`Tool "${toolName}" already exists`); return; }
    if (!newDescription.trim()) { setError('Description is required'); return; }

    const validParams = newParams.filter((p) => p.name.trim());
    if (toolType !== 'javascript' && validParams.length === 0) { setError('At least one parameter is required'); return; }

    const parameters: Record<string, { type: string; description?: string }> = {};
    for (const p of validParams) {
      parameters[p.name.trim()] = { type: p.type, description: p.description || undefined };
    }
    const required = validParams.filter((p) => p.required).map((p) => p.name.trim());

    if (toolType === 'template') {
      if (!newResponse.trim()) { setError('Response template is required'); return; }
      registerCustomTool(toolName, newDescription.trim(), parameters, required, newResponse.trim());
    } else if (toolType === 'http') {
      if (!urlTemplate.trim()) { setError('URL template is required'); return; }
      const httpConfig: HttpToolConfig = {
        method: httpMethod,
        urlTemplate: urlTemplate.trim(),
        bodyTemplate: httpMethod === 'POST' && bodyTemplate.trim() ? bodyTemplate.trim() : undefined,
      };
      registerHttpTool(toolName, newDescription.trim(), parameters, required, httpConfig);
    } else if (toolType === 'javascript') {
      if (!jsFunction.trim()) { setError('JavaScript function body is required'); return; }
      registerJsTool(toolName, newDescription.trim(), parameters, required, jsFunction.trim());
    }

    setTools(getAllToolDefinitions());
    resetForm();
    setShowAdd(false);
  };

  const customCount = useMemo(() => tools.filter((t) => !BUILTIN_TOOLS.has(t.function.name)).length, [tools]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tools</h1>
          <p className="text-slate-500 mt-1">
            {tools.length} tools available{customCount > 0 ? ` (${customCount} custom)` : ''}
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
          {showAdd ? 'Cancel' : 'Create Tool'}
        </button>
      </div>

      {/* ── Create Tool Form ──────────────────────────────────── */}
      {showAdd && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-indigo-200 shadow-lg shadow-indigo-100/50 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-600 mb-4">
            <i className="fas fa-plus-circle text-indigo-500 mr-2"></i>
            Create Custom Tool
          </h3>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
              <i className="fas fa-circle-exclamation mr-2"></i>{error}
            </div>
          )}

          {/* Tool Type Tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { type: 'template' as const, label: 'Template', icon: 'fa-file-code' },
              { type: 'http' as const, label: 'HTTP Request', icon: 'fa-globe' },
              { type: 'javascript' as const, label: 'JavaScript', icon: 'fa-js' },
            ]).map(({ type, label, icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setToolType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  toolType === type
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <i className={`fab ${icon} mr-2`}></i>{label}
              </button>
            ))}
          </div>

          {/* Example Tools (HTTP only) */}
          {toolType === 'http' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-medium text-amber-700 mb-2">
                <i className="fas fa-lightbulb mr-1"></i>Quick start with an example:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => prefillExample('weather_api')}
                  className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <i className="fas fa-cloud-sun mr-1"></i>Real Weather (wttr.in)
                </button>
                <button
                  type="button"
                  onClick={() => prefillExample('duckduckgo')}
                  className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <i className="fas fa-search mr-1"></i>Web Search (DuckDuckGo)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tool Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. translate"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 font-mono"
              />
              {newName && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Registered as: <span className="font-mono font-semibold">{newName.trim().toLowerCase().replace(/\s+/g, '_')}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this tool does (shown to the agent)"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>
          </div>

          {/* Parameters */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parameters</label>
              <button type="button" onClick={addParam} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">
                <i className="fas fa-plus mr-1"></i>Add Parameter
              </button>
            </div>
            <div className="space-y-2">
              {newParams.map((param, i) => (
                <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <input
                    type="text"
                    value={param.name}
                    onChange={(e) => updateParam(i, 'name', e.target.value)}
                    placeholder="param name"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <select
                    value={param.type}
                    onChange={(e) => updateParam(i, 'type', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                  <input
                    type="text"
                    value={param.description}
                    onChange={(e) => updateParam(i, 'description', e.target.value)}
                    placeholder="description"
                    className="flex-[2] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <label className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={param.required}
                      onChange={(e) => updateParam(i, 'required', e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                    />
                    <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">Required</span>
                  </label>
                  {newParams.length > 1 && (
                    <button type="button" onClick={() => removeParam(i)} className="px-2 py-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                      <i className="fas fa-trash-can text-xs"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tool-Type-Specific Config */}
          {toolType === 'template' && (
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Response Template</label>
              <textarea
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                placeholder={'JSON response the tool returns. Use {{paramName}} for dynamic values.\ne.g. {"translation": "Hello in {{language}}", "source": "{{text}}"}'}
                rows={3}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Use <span className="font-mono font-semibold">{'{{paramName}}'}</span> placeholders to insert parameter values.
              </p>
            </div>
          )}

          {toolType === 'http' && (
            <div className="mb-5 space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value as 'GET' | 'POST')}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">URL Template</label>
                  <input
                    type="text"
                    value={urlTemplate}
                    onChange={(e) => setUrlTemplate(e.target.value)}
                    placeholder="https://api.example.com/{{param}}?key=value"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                  />
                </div>
              </div>
              {httpMethod === 'POST' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Body Template (JSON)</label>
                  <textarea
                    value={bodyTemplate}
                    onChange={(e) => setBodyTemplate(e.target.value)}
                    placeholder='{"query": "{{query}}", "limit": 10}'
                    rows={3}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
                  />
                </div>
              )}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  Some APIs may not work from the browser due to CORS restrictions. APIs like wttr.in and DuckDuckGo allow cross-origin requests.
                </p>
              </div>
            </div>
          )}

          {toolType === 'javascript' && (
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Function Body</label>
              <textarea
                value={jsFunction}
                onChange={(e) => setJsFunction(e.target.value)}
                placeholder={`// Receives (args, context). Must return a string.\n// Example:\nconst result = args.text.toUpperCase();\nreturn JSON.stringify({ result });`}
                rows={6}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Write a function body that receives <span className="font-mono font-semibold">(args, context)</span> and returns a string.
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mt-2">
                <p className="text-xs text-rose-700">
                  <i className="fas fa-shield-halved mr-1"></i>
                  JS tools execute arbitrary code in your browser. Only use code you trust.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <i className="fas fa-plus mr-2"></i>Create Tool
            </button>
          </div>
        </form>
      )}

      {/* ── Tool List ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {tools.map((tool) => {
          const name = tool.function.name;
          const isBuiltin = BUILTIN_TOOLS.has(name);
          const isExpanded = expandedId === name;
          const icon = TOOL_ICONS[name] || 'fa-puzzle-piece';
          const params = tool.function.parameters.properties;
          const paramNames = Object.keys(params);
          const required = tool.function.parameters.required || [];

          return (
            <div
              key={name}
              className={`bg-white rounded-2xl border transition-all ${
                isExpanded ? 'border-violet-200 shadow-lg shadow-violet-100/50' : 'border-slate-200'
              }`}
            >
              {/* Header */}
              <button
                onClick={() => toggleExpand(name)}
                className="w-full text-left p-5 flex items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isBuiltin ? 'bg-violet-100 text-violet-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  <i className={`fas ${icon} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 font-mono">{name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isBuiltin ? 'bg-violet-100 text-violet-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {isBuiltin ? 'Built-in' : 'Custom'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{tool.function.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span>
                      <i className="fas fa-cube mr-1"></i>
                      {paramNames.length} parameter{paramNames.length !== 1 ? 's' : ''}
                    </span>
                    <span>
                      <i className="fas fa-asterisk mr-1"></i>
                      {required.length} required
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-slate-400`}></i>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      <i className="fas fa-cube mr-1.5 text-violet-400"></i>Parameters
                    </h4>
                    {paramNames.length > 0 ? (
                      <div className="space-y-2">
                        {paramNames.map((pName) => {
                          const p = params[pName];
                          const isRequired = required.includes(pName);
                          return (
                            <div key={pName} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <div className="flex-shrink-0 mt-0.5">
                                <span className="inline-block w-2 h-2 rounded-full bg-violet-400"></span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold text-slate-700">{pName}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-500">{p.type}</span>
                                  {isRequired && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-500">required</span>
                                  )}
                                </div>
                                {p.description && (
                                  <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                                )}
                                {p.enum && (
                                  <div className="flex gap-1 mt-1.5">
                                    {p.enum.map((v: string) => (
                                      <span key={v} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-100">
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">No parameters</p>
                    )}
                  </div>

                  {/* Schema Preview */}
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <i className="fas fa-code mr-1.5 text-slate-400"></i>Tool Schema (sent to agent)
                    </h4>
                    <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap overflow-x-auto border border-slate-100 font-mono leading-relaxed max-h-48 overflow-y-auto">
                      {JSON.stringify(tool, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tools.length === 0 && (
        <div className="text-center py-16">
          <i className="fas fa-wrench text-4xl text-slate-300 mb-4"></i>
          <p className="text-slate-500 font-medium">No tools registered</p>
          <p className="text-sm text-slate-400 mt-1">Create a custom tool to get started</p>
        </div>
      )}
    </div>
  );
}
