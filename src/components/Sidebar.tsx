import React from 'react';
import type { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  ollamaStatus: 'connected' | 'disconnected' | 'checking';
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const menuItems: { id: ViewState; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
  { id: 'tasks', label: 'Tasks', icon: 'fa-list-check' },
  { id: 'models', label: 'Models', icon: 'fa-microchip' },
  { id: 'tools', label: 'Tools', icon: 'fa-wrench' },
  { id: 'benchmark', label: 'Run Benchmark', icon: 'fa-play' },
  { id: 'results', label: 'Results', icon: 'fa-table' },
  { id: 'compare', label: 'Compare', icon: 'fa-code-compare' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'fa-trophy' },
  { id: 'settings', label: 'Settings', icon: 'fa-gear' },
];

const statusConfig = {
  connected: { color: 'bg-emerald-400', label: 'Connected' },
  disconnected: { color: 'bg-rose-400', label: 'Disconnected' },
  checking: { color: 'bg-amber-400 animate-pulse', label: 'Checking...' },
};

export default function Sidebar({ currentView, onNavigate, ollamaStatus, collapsed, onToggleCollapse }: SidebarProps) {
  const status = statusConfig[ollamaStatus];

  return (
    <div className={`${collapsed ? 'w-20' : 'w-64'} bg-slate-900 text-white flex flex-col transition-all duration-300 flex-shrink-0`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-700/50">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <i className="fas fa-robot text-white text-sm"></i>
          </div>
          {!collapsed && <span className="text-lg font-bold tracking-tight">AgentBench</span>}
        </div>
        {!collapsed && (
          <button onClick={onToggleCollapse} className="text-slate-400 hover:text-white transition-colors">
            <i className="fas fa-chevron-left text-xs"></i>
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={onToggleCollapse} className="py-3 text-slate-400 hover:text-white transition-colors">
          <i className="fas fa-chevron-right text-xs"></i>
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
              currentView === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            } ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <i className={`fas ${item.icon} ${collapsed ? 'text-base' : 'text-xs w-4 text-center'}`}></i>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Ollama Status */}
      <div className="p-4 border-t border-slate-700/50">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${status.color} flex-shrink-0`}></div>
          {!collapsed && (
            <div>
              <p className="text-xs font-semibold text-slate-300">Ollama</p>
              <p className="text-[10px] text-slate-500">{status.label}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
