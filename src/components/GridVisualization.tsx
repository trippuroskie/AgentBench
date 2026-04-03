import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CellType, AgentStep, GridConfig } from '../types';
import { bfs } from '../utils/pathfinding';

interface GridVisualizationProps {
  gridConfig: GridConfig;
  steps: AgentStep[];
  onClose?: () => void;
  modelName?: string;
}

interface GridState {
  agentPos: [number, number];
  visitedCells: Set<string>;
  currentStep: number;
}

export default function GridVisualization({ gridConfig, steps, onClose, modelName }: GridVisualizationProps) {
  const [state, setState] = useState<GridState>({
    agentPos: [...gridConfig.startPos] as [number, number],
    visitedCells: new Set([`${gridConfig.startPos[0]},${gridConfig.startPos[1]}`]),
    currentStep: -1,
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [showOptimal, setShowOptimal] = useState(false);
  const timerRef = useRef<number | null>(null);

  const optimalPath = React.useMemo(
    () => bfs(gridConfig.grid, gridConfig.startPos, gridConfig.goalPos),
    [gridConfig]
  );

  const moveSteps = React.useMemo(() => {
    return steps.filter(
      (s) => s.role === 'tool' && s.content && s.content.includes('"success":true') && s.content.includes('"position"')
    );
  }, [steps]);

  const stepTo = useCallback((targetStep: number) => {
    const pos: [number, number] = [...gridConfig.startPos] as [number, number];
    const visited = new Set([`${pos[0]},${pos[1]}`]);

    for (let i = 0; i <= targetStep && i < moveSteps.length; i++) {
      try {
        const result = JSON.parse(moveSteps[i].content || '{}');
        if (result.success && result.position) {
          pos[0] = result.position[0];
          pos[1] = result.position[1];
          visited.add(`${pos[0]},${pos[1]}`);
        }
      } catch {}
    }

    setState({ agentPos: [...pos] as [number, number], visitedCells: visited, currentStep: targetStep });
  }, [gridConfig, moveSteps]);

  const stepForward = useCallback(() => {
    setState((prev) => {
      const nextStep = prev.currentStep + 1;
      if (nextStep >= moveSteps.length) {
        setPlaying(false);
        return prev;
      }
      return prev; // actual state update happens in stepTo
    });
    setState((prev) => {
      const nextStep = prev.currentStep + 1;
      if (nextStep >= moveSteps.length) return prev;

      const pos: [number, number] = [...prev.agentPos] as [number, number];
      const visited = new Set(prev.visitedCells);

      try {
        const result = JSON.parse(moveSteps[nextStep].content || '{}');
        if (result.success && result.position) {
          pos[0] = result.position[0];
          pos[1] = result.position[1];
          visited.add(`${pos[0]},${pos[1]}`);
        }
      } catch {}

      return { agentPos: pos, visitedCells: visited, currentStep: nextStep };
    });
  }, [moveSteps]);

  const stepBack = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep < 0) return prev;
      const newStep = prev.currentStep - 1;
      return prev; // handled below
    });
    setState((prev) => {
      const target = Math.max(-1, prev.currentStep - 1);
      // Rebuild from scratch
      const pos: [number, number] = [...gridConfig.startPos] as [number, number];
      const visited = new Set([`${pos[0]},${pos[1]}`]);

      for (let i = 0; i <= target && i < moveSteps.length; i++) {
        try {
          const result = JSON.parse(moveSteps[i].content || '{}');
          if (result.success && result.position) {
            pos[0] = result.position[0];
            pos[1] = result.position[1];
            visited.add(`${pos[0]},${pos[1]}`);
          }
        } catch {}
      }

      return { agentPos: pos, visitedCells: visited, currentStep: target };
    });
  }, [gridConfig, moveSteps]);

  const reset = useCallback(() => {
    setPlaying(false);
    setState({
      agentPos: [...gridConfig.startPos] as [number, number],
      visitedCells: new Set([`${gridConfig.startPos[0]},${gridConfig.startPos[1]}`]),
      currentStep: -1,
    });
  }, [gridConfig]);

  const jumpToEnd = useCallback(() => {
    setPlaying(false);
    stepTo(moveSteps.length - 1);
  }, [moveSteps, stepTo]);

  // Playback
  useEffect(() => {
    if (playing) {
      timerRef.current = window.setInterval(() => {
        setState((prev) => {
          const nextStep = prev.currentStep + 1;
          if (nextStep >= moveSteps.length) {
            setPlaying(false);
            return prev;
          }

          const pos: [number, number] = [...prev.agentPos] as [number, number];
          const visited = new Set(prev.visitedCells);

          try {
            const result = JSON.parse(moveSteps[nextStep].content || '{}');
            if (result.success && result.position) {
              pos[0] = result.position[0];
              pos[1] = result.position[1];
              visited.add(`${pos[0]},${pos[1]}`);
            }
          } catch {}

          return { agentPos: pos, visitedCells: visited, currentStep: nextStep };
        });
      }, speed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed, moveSteps]);

  const optimalSet = React.useMemo(
    () => new Set(optimalPath.map(([r, c]) => `${r},${c}`)),
    [optimalPath]
  );

  const getCellClasses = (row: number, col: number): string => {
    const key = `${row},${col}`;
    const isAgent = state.agentPos[0] === row && state.agentPos[1] === col;
    const isStart = row === gridConfig.startPos[0] && col === gridConfig.startPos[1];
    const isGoal = row === gridConfig.goalPos[0] && col === gridConfig.goalPos[1];
    const isObstacle = gridConfig.grid[row][col] === 'obstacle';
    const isVisited = state.visitedCells.has(key);
    const isOptimal = showOptimal && optimalSet.has(key);

    if (isAgent) return 'bg-indigo-500 shadow-lg shadow-indigo-500/40 scale-110 z-10';
    if (isGoal) return 'bg-amber-400 shadow-md shadow-amber-400/30';
    if (isStart) return 'bg-emerald-400';
    if (isObstacle) return 'bg-slate-700';
    if (isVisited && isOptimal) return 'bg-indigo-200';
    if (isVisited) return 'bg-indigo-100';
    if (isOptimal) return 'bg-amber-100/60';
    return 'bg-slate-100';
  };

  const reachedGoal = state.agentPos[0] === gridConfig.goalPos[0] && state.agentPos[1] === gridConfig.goalPos[1];

  return (
    <div className={onClose ? 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md' : ''}>
      <div className={`bg-white rounded-[2rem] ${onClose ? 'max-w-3xl w-full shadow-2xl' : ''} p-6`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Grid Navigation
              {modelName && <span className="text-sm font-normal text-slate-500 ml-2">— {modelName}</span>}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {gridConfig.width}x{gridConfig.height} grid · Optimal: {gridConfig.optimalPathLength} steps · Agent: {state.currentStep + 1} moves
              {reachedGoal && <span className="text-emerald-600 font-bold ml-2">Goal Reached!</span>}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
              <i className="fas fa-times text-slate-500"></i>
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="flex justify-center mb-4">
          <div
            className="inline-grid gap-1 p-3 bg-slate-50 rounded-xl"
            style={{
              gridTemplateColumns: `repeat(${gridConfig.width}, minmax(0, 1fr))`,
              width: `${Math.min(gridConfig.width * 40, 480)}px`,
            }}
          >
            {gridConfig.grid.map((row, r) =>
              row.map((_, c) => (
                <div
                  key={`${r}-${c}`}
                  className={`aspect-square rounded-md transition-all duration-200 flex items-center justify-center text-[10px] font-bold text-white relative ${getCellClasses(r, c)}`}
                >
                  {state.agentPos[0] === r && state.agentPos[1] === c && (
                    <i className="fas fa-robot text-white text-xs"></i>
                  )}
                  {r === gridConfig.goalPos[0] && c === gridConfig.goalPos[1] && state.agentPos[0] !== r && (
                    <i className="fas fa-star text-amber-800 text-xs"></i>
                  )}
                  {r === gridConfig.startPos[0] && c === gridConfig.startPos[1] && state.agentPos[0] !== r && (
                    <span className="text-emerald-800">S</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button onClick={reset} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" title="Reset">
            <i className="fas fa-backward-fast text-slate-500 text-xs"></i>
          </button>
          <button onClick={stepBack} disabled={state.currentStep < 0} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors disabled:opacity-30" title="Step Back">
            <i className="fas fa-backward-step text-slate-500 text-xs"></i>
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              playing ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
            }`}
          >
            <i className={`fas ${playing ? 'fa-pause' : 'fa-play'} text-sm`}></i>
          </button>
          <button onClick={stepForward} disabled={state.currentStep >= moveSteps.length - 1} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors disabled:opacity-30" title="Step Forward">
            <i className="fas fa-forward-step text-slate-500 text-xs"></i>
          </button>
          <button onClick={jumpToEnd} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" title="Jump to End">
            <i className="fas fa-forward-fast text-slate-500 text-xs"></i>
          </button>
        </div>

        {/* Speed + Optimal Path Toggle */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Speed:</span>
            {[{ label: '0.5x', ms: 1000 }, { label: '1x', ms: 500 }, { label: '2x', ms: 250 }, { label: '4x', ms: 100 }].map((s) => (
              <button
                key={s.label}
                onClick={() => setSpeed(s.ms)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                  speed === s.ms ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showOptimal}
              onChange={(e) => setShowOptimal(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-amber-500"
            />
            <span className="text-xs text-slate-500">Show optimal path</span>
          </label>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3">
          {[
            { color: 'bg-indigo-500', label: 'Agent' },
            { color: 'bg-emerald-400', label: 'Start' },
            { color: 'bg-amber-400', label: 'Goal' },
            { color: 'bg-slate-700', label: 'Obstacle' },
            { color: 'bg-indigo-100', label: 'Visited' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${item.color}`}></div>
              <span className="text-[10px] text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${moveSteps.length > 0 ? ((state.currentStep + 1) / moveSteps.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
